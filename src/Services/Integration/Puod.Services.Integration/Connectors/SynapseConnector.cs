using System.Data;
using Microsoft.Data.SqlClient;
using System.Diagnostics;

namespace Puod.Services.Integration.Connectors;

/// <summary>
/// Conector para Azure Synapse Analytics usando ADO.NET
/// </summary>
public class SynapseConnector : IConnector
{
    public async Task<ConnectionResult> TestConnectionAsync(Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var connectionString = BuildConnectionString(config);

            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

            return new ConnectionResult
            {
                Success = true,
                Metadata = new Dictionary<string, object>
                {
                    { "server", config["server"] },
                    { "database", config["database"] },
                    { "tested_at", DateTime.UtcNow }
                }
            };
        }
        catch (Exception ex)
        {
            return new ConnectionResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }

    public async Task<QueryResult> ExecuteQueryAsync(string query, Dictionary<string, string> config)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            ValidateConfig(config);

            // SECURITY: Only allow SELECT queries (read-only operations)
            if (!IsReadOnlyQuery(query))
            {
                stopwatch.Stop();
                return new QueryResult
                {
                    Success = false,
                    ErrorMessage = "Only SELECT queries are allowed. Write operations (INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, EXEC, etc.) are not permitted for security reasons.",
                    ExecutionTime = stopwatch.Elapsed
                };
            }

            var connectionString = BuildConnectionString(config);

            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

            using var command = new SqlCommand(query, connection);
            command.CommandTimeout = 300;

            using var reader = await command.ExecuteReaderAsync();

            var rows = new List<Dictionary<string, object>>();

            while (await reader.ReadAsync())
            {
                var row = new Dictionary<string, object>();

                for (int i = 0; i < reader.FieldCount; i++)
                {
                    var columnName = reader.GetName(i);
                    var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                    row[columnName] = value ?? DBNull.Value;
                }

                rows.Add(row);
            }

            stopwatch.Stop();

            return new QueryResult
            {
                Success = true,
                Rows = rows,
                RowCount = rows.Count,
                ExecutionTime = stopwatch.Elapsed
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            return new QueryResult
            {
                Success = false,
                ErrorMessage = ex.Message,
                ExecutionTime = stopwatch.Elapsed
            };
        }
    }

    public async Task<List<string>> ListDatabasesAsync(Dictionary<string, string> config)
    {
        var result = await ExecuteQueryAsync("SELECT name FROM sys.databases WHERE database_id > 4", config);

        if (!result.Success || result.Rows == null)
            return new List<string>();

        return result.Rows
            .Select(row => row.ContainsKey("name") ? row["name"]?.ToString() ?? "" : "")
            .Where(name => !string.IsNullOrEmpty(name))
            .ToList();
    }

    public async Task<List<string>> ListTablesAsync(string database, Dictionary<string, string> config)
    {
        var query = $@"
            SELECT TABLE_SCHEMA + '.' + TABLE_NAME as full_name
            FROM [{database}].INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
        ";

        var result = await ExecuteQueryAsync(query, config);

        if (!result.Success || result.Rows == null)
            return new List<string>();

        return result.Rows
            .Select(row => row.ContainsKey("full_name") ? row["full_name"]?.ToString() ?? "" : "")
            .Where(name => !string.IsNullOrEmpty(name))
            .ToList();
    }

    private string BuildConnectionString(Dictionary<string, string> config)
    {
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = config["server"],
            InitialCatalog = config["database"],
            Encrypt = true,
            TrustServerCertificate = false,
            ConnectTimeout = 30
        };

        if (config.ContainsKey("username") && config.ContainsKey("password"))
        {
            builder.UserID = config["username"];
            builder.Password = config["password"];
        }
        else if (config.ContainsKey("token"))
        {
            builder.Authentication = SqlAuthenticationMethod.ActiveDirectoryServicePrincipal;
        }
        else if (config.TryGetValue("auth_type", out var authTypeValue) && authTypeValue == "profile")
        {
            builder.Authentication = SqlAuthenticationMethod.ActiveDirectoryServicePrincipal;
            builder.UserID = config["client_id"];
            builder.Password = config["client_secret"];

            if (config.TryGetValue("tenant_id", out var tenantId) && !string.IsNullOrWhiteSpace(tenantId))
            {
                builder["Authority Id"] = tenantId;
            }
        }

        return builder.ConnectionString;
    }

    private void ValidateConfig(Dictionary<string, string> config)
    {
        if (!config.ContainsKey("server") || string.IsNullOrEmpty(config["server"]))
            throw new ArgumentException("Missing required config: server");

        if (!config.ContainsKey("database") || string.IsNullOrEmpty(config["database"]))
            throw new ArgumentException("Missing required config: database");

        var hasCredentials = config.ContainsKey("username") && config.ContainsKey("password");
        var hasToken = config.ContainsKey("token");
        var hasProfileAuth = config.ContainsKey("auth_type") && config["auth_type"] == "profile";

        if (!hasCredentials && !hasToken && !hasProfileAuth)
            throw new ArgumentException("Missing authentication: either username/password or token required");

        if (hasProfileAuth)
        {
            if (!config.ContainsKey("client_id") || string.IsNullOrWhiteSpace(config["client_id"]))
                throw new ArgumentException("Missing required config for profile auth: client_id");
            if (!config.ContainsKey("client_secret") || string.IsNullOrWhiteSpace(config["client_secret"]))
                throw new ArgumentException("Missing required config for profile auth: client_secret");
        }
    }

    /// <summary>
    /// SECURITY: Validates that the query is read-only (SELECT/WITH only)
    /// </summary>
    private bool IsReadOnlyQuery(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return false;

        // Normalize: trim, remove comments, convert to uppercase
        var normalizedQuery = query.Trim();

        // Remove SQL comments (-- and /* */)
        normalizedQuery = System.Text.RegularExpressions.Regex.Replace(normalizedQuery, @"--.*$", "", System.Text.RegularExpressions.RegexOptions.Multiline);
        normalizedQuery = System.Text.RegularExpressions.Regex.Replace(normalizedQuery, @"/\*.*?\*/", "", System.Text.RegularExpressions.RegexOptions.Singleline);

        normalizedQuery = normalizedQuery.Trim().ToUpperInvariant();

        // Allow only SELECT and WITH (Common Table Expressions)
        if (!normalizedQuery.StartsWith("SELECT") && !normalizedQuery.StartsWith("WITH"))
            return false;

        // Blocked keywords that indicate write operations
        var blockedKeywords = new[]
        {
            "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE",
            "GRANT", "REVOKE", "EXEC", "EXECUTE", "MERGE", "BULK", "BACKUP",
            "RESTORE", "RECONFIGURE", "SHUTDOWN", "DBCC"
        };

        foreach (var keyword in blockedKeywords)
        {
            // Check for keyword as whole word (with word boundaries)
            if (System.Text.RegularExpressions.Regex.IsMatch(normalizedQuery, $@"\b{keyword}\b"))
                return false;
        }

        return true;
    }
}
