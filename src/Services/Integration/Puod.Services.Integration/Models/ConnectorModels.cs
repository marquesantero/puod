namespace Puod.Services.Integration.Models;

public record ConnectorInfo(string Name, string Type, string Description);

public record ConnectorHealth(bool IsHealthy, string Message);

public record DataQuery(string Command);

public record DataResult(IEnumerable<IDictionary<string, object>> Rows);
