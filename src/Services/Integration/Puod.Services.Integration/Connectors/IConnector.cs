namespace Puod.Services.Integration.Connectors;

/// <summary>
/// Interface base para conectores de BI tools
/// </summary>
public interface IConnector
{
    Task<ConnectionResult> TestConnectionAsync(Dictionary<string, string> config);
    Task<QueryResult> ExecuteQueryAsync(string query, Dictionary<string, string> config);
    Task<List<string>> ListDatabasesAsync(Dictionary<string, string> config);
    Task<List<string>> ListTablesAsync(string database, Dictionary<string, string> config);
}

public class ConnectionResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public Dictionary<string, object>? Metadata { get; set; }
}

public class QueryResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public List<Dictionary<string, object>>? Rows { get; set; }
    public int RowCount { get; set; }
    public TimeSpan ExecutionTime { get; set; }
}
