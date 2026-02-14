using Puod.Services.Integration.Models;

namespace Puod.Services.Integration.Connectors;

public interface IDataConnector
{
    string Name { get; }
    string Type { get; }

    Task<ConnectorHealth> CheckHealthAsync(CancellationToken ct = default);
    Task<DataResult> ExecuteQueryAsync(DataQuery query, CancellationToken ct = default);
}
