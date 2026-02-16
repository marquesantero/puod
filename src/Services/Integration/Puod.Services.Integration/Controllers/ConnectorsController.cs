using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Puod.Services.Integration.Connectors;
using Puod.Services.Integration.Models;

namespace Puod.Services.Integration.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/integration/connectors")]
[Asp.Versioning.ApiVersion(1.0)]
public class ConnectorsController : ControllerBase
{
    private readonly DataConnectorFactory _factory;
    private readonly IEnumerable<IDataConnector> _connectors;

    public ConnectorsController(DataConnectorFactory factory, IEnumerable<IDataConnector> connectors)
    {
        _factory = factory;
        _connectors = connectors;
    }

    [HttpGet]
    public ActionResult<IEnumerable<ConnectorInfo>> GetConnectors()
    {
        var list = _connectors.Select(c =>
            new ConnectorInfo(c.Name, c.Type, $"{c.Name} connector"));
        return Ok(list);
    }

    [HttpGet("{type}/health")]
    public async Task<ActionResult<ConnectorHealth>> GetHealth(string type, CancellationToken ct)
    {
        var connector = _factory.Create(type);
        var health = await connector.CheckHealthAsync(ct);
        return Ok(health);
    }

    [Authorize]
    [HttpPost("{type}/query")]
    public async Task<ActionResult<DataResult>> Query(string type, [FromBody] DataQuery query, CancellationToken ct)
    {
        var connector = _factory.Create(type);
        var result = await connector.ExecuteQueryAsync(query, ct);
        return Ok(result);
    }
}
