using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Puod.Services.Integration.Connectors;

/// <summary>
/// Conector para Snowflake usando SQL REST API (v2/statements).
/// Suporta: Warehouses, Databases, Schemas, Tables, Task History, Query History, Stages, Pipes.
/// Documentação: https://docs.snowflake.com/en/developer-guide/sql-api
/// </summary>
public class SnowflakeConnector : IConnector
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SnowflakeConnector> _logger;

    public SnowflakeConnector(
        IHttpClientFactory httpClientFactory,
        ILogger<SnowflakeConnector> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    #region IConnector Implementation

    public async Task<ConnectionResult> TestConnectionAsync(Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var result = await ExecuteStatementAsync("SELECT CURRENT_VERSION() AS version, CURRENT_ACCOUNT() AS account, CURRENT_USER() AS username", config);

            if (result.Success && result.Rows != null && result.Rows.Count > 0)
            {
                var row = result.Rows[0];
                return new ConnectionResult
                {
                    Success = true,
                    Metadata = new Dictionary<string, object>
                    {
                        { "service", "Snowflake" },
                        { "account", config["account"] },
                        { "version", row.TryGetValue("VERSION", out var v) ? v : "unknown" },
                        { "tested_at", DateTime.UtcNow }
                    }
                };
            }

            return new ConnectionResult
            {
                Success = false,
                ErrorMessage = result.ErrorMessage ?? "Failed to execute test query"
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

            // Map friendly query names to SQL statements
            var sql = ResolveSqlQuery(query, config);

            _logger.LogDebug("Snowflake query: {Query} -> {Sql}", query, Truncate(sql));

            var result = await ExecuteStatementAsync(sql, config);
            stopwatch.Stop();
            result.ExecutionTime = stopwatch.Elapsed;

            return result;
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
        try
        {
            ValidateConfig(config);

            var result = await ExecuteStatementAsync("SHOW DATABASES", config);

            if (!result.Success || result.Rows == null)
                return new List<string>();

            var databases = new List<string>();
            foreach (var row in result.Rows)
            {
                if (row.TryGetValue("name", out var name))
                {
                    databases.Add(name?.ToString() ?? "");
                }
            }

            return databases;
        }
        catch
        {
            return new List<string>();
        }
    }

    public async Task<List<string>> ListTablesAsync(string database, Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var schema = config.TryGetValue("schema", out var s) && !string.IsNullOrWhiteSpace(s) ? s : "PUBLIC";
            var sql = $"SHOW TABLES IN {EscapeIdentifier(database)}.{EscapeIdentifier(schema)}";

            var result = await ExecuteStatementAsync(sql, config);

            if (!result.Success || result.Rows == null)
                return new List<string>();

            var tables = new List<string>();
            foreach (var row in result.Rows)
            {
                if (row.TryGetValue("name", out var name))
                {
                    tables.Add(name?.ToString() ?? "");
                }
            }

            return tables;
        }
        catch
        {
            return new List<string>();
        }
    }

    #endregion

    #region Private Methods

    private string ResolveSqlQuery(string query, Dictionary<string, string> config)
    {
        var queryLower = query.ToLowerInvariant().Trim();

        // Friendly query mappings
        return queryLower switch
        {
            "warehouses" => "SHOW WAREHOUSES",
            "databases" => "SHOW DATABASES",
            "schemas" => config.TryGetValue("database", out var db) && !string.IsNullOrWhiteSpace(db)
                ? $"SHOW SCHEMAS IN DATABASE {EscapeIdentifier(db)}"
                : "SHOW SCHEMAS",
            "tables" => ResolvShowTables(config),
            "views" => ResolveShowViews(config),
            "stages" => config.TryGetValue("database", out var sdb) && !string.IsNullOrWhiteSpace(sdb)
                ? $"SHOW STAGES IN {EscapeIdentifier(sdb)}.{EscapeIdentifier(config.GetValueOrDefault("schema", "PUBLIC"))}"
                : "SHOW STAGES",
            "pipes" => config.TryGetValue("database", out var pdb) && !string.IsNullOrWhiteSpace(pdb)
                ? $"SHOW PIPES IN {EscapeIdentifier(pdb)}.{EscapeIdentifier(config.GetValueOrDefault("schema", "PUBLIC"))}"
                : "SHOW PIPES",
            "tasks" => config.TryGetValue("database", out var tdb) && !string.IsNullOrWhiteSpace(tdb)
                ? $"SHOW TASKS IN {EscapeIdentifier(tdb)}.{EscapeIdentifier(config.GetValueOrDefault("schema", "PUBLIC"))}"
                : "SHOW TASKS",
            "task_history" => "SELECT * FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY()) ORDER BY SCHEDULED_TIME DESC LIMIT 100",
            "query_history" => "SELECT * FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY_BY_USER()) ORDER BY START_TIME DESC LIMIT 100",
            "streams" => config.TryGetValue("database", out var stdb) && !string.IsNullOrWhiteSpace(stdb)
                ? $"SHOW STREAMS IN {EscapeIdentifier(stdb)}.{EscapeIdentifier(config.GetValueOrDefault("schema", "PUBLIC"))}"
                : "SHOW STREAMS",
            "users" => "SHOW USERS",
            "roles" => "SHOW ROLES",
            // Default: treat as raw SQL (read-only validation)
            _ => ValidateReadOnlyQuery(query)
        };
    }

    private string ResolvShowTables(Dictionary<string, string> config)
    {
        var db = config.TryGetValue("database", out var d) && !string.IsNullOrWhiteSpace(d) ? d : null;
        var schema = config.TryGetValue("schema", out var s) && !string.IsNullOrWhiteSpace(s) ? s : "PUBLIC";

        if (db != null)
            return $"SHOW TABLES IN {EscapeIdentifier(db)}.{EscapeIdentifier(schema)}";

        return "SHOW TABLES";
    }

    private string ResolveShowViews(Dictionary<string, string> config)
    {
        var db = config.TryGetValue("database", out var d) && !string.IsNullOrWhiteSpace(d) ? d : null;
        var schema = config.TryGetValue("schema", out var s) && !string.IsNullOrWhiteSpace(s) ? s : "PUBLIC";

        if (db != null)
            return $"SHOW VIEWS IN {EscapeIdentifier(db)}.{EscapeIdentifier(schema)}";

        return "SHOW VIEWS";
    }

    private static string ValidateReadOnlyQuery(string query)
    {
        var trimmed = query.TrimStart();
        var firstWord = trimmed.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault()?.ToUpperInvariant() ?? "";

        var allowedKeywords = new HashSet<string> { "SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "LIST", "WITH" };

        if (!allowedKeywords.Contains(firstWord))
        {
            throw new InvalidOperationException(
                $"Only read-only queries are allowed. Unsupported keyword: '{firstWord}'. " +
                "Allowed: SELECT, SHOW, DESCRIBE, EXPLAIN, LIST, WITH");
        }

        return query;
    }

    private async Task<QueryResult> ExecuteStatementAsync(string sql, Dictionary<string, string> config)
    {
        var client = _httpClientFactory.CreateClient();
        var account = config["account"];
        var baseUrl = $"https://{account}.snowflakecomputing.com";

        client.BaseAddress = new Uri(baseUrl);
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        // Use key-pair JWT or user/password login token
        var token = await GetAuthTokenAsync(config);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Build statement request
        var requestBody = new Dictionary<string, object>
        {
            { "statement", sql },
            { "timeout", 60 },
            { "resultSetMetaData", new Dictionary<string, object> { { "format", "jsonv2" } } }
        };

        if (config.TryGetValue("warehouse", out var warehouse) && !string.IsNullOrWhiteSpace(warehouse))
            requestBody["warehouse"] = warehouse;
        if (config.TryGetValue("database", out var database) && !string.IsNullOrWhiteSpace(database))
            requestBody["database"] = database;
        if (config.TryGetValue("schema", out var schema) && !string.IsNullOrWhiteSpace(schema))
            requestBody["schema"] = schema;
        if (config.TryGetValue("role", out var role) && !string.IsNullOrWhiteSpace(role))
            requestBody["role"] = role;

        var jsonContent = new StringContent(
            JsonSerializer.Serialize(requestBody),
            Encoding.UTF8,
            "application/json");

        var response = await client.PostAsync("/api/v2/statements", jsonContent);
        var responseContent = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            return new QueryResult
            {
                Success = false,
                ErrorMessage = $"Snowflake API error: {response.StatusCode} - {Truncate(responseContent)}"
            };
        }

        var result = JsonSerializer.Deserialize<JsonElement>(responseContent);

        // Check statement status
        if (result.TryGetProperty("code", out var code))
        {
            var codeStr = code.GetString() ?? code.ToString();
            if (codeStr != "090001" && codeStr != "0") // 090001 = statement executed successfully
            {
                var message = result.TryGetProperty("message", out var msg) ? msg.GetString() : "Unknown error";
                return new QueryResult
                {
                    Success = false,
                    ErrorMessage = $"Snowflake error (code {codeStr}): {message}"
                };
            }
        }

        // Parse results
        var rows = ParseStatementResult(result);

        return new QueryResult
        {
            Success = true,
            Rows = rows,
            RowCount = rows.Count
        };
    }

    private List<Dictionary<string, object>> ParseStatementResult(JsonElement result)
    {
        var rows = new List<Dictionary<string, object>>();

        // Get column names from resultSetMetaData
        var columnNames = new List<string>();
        if (result.TryGetProperty("resultSetMetaData", out var meta) &&
            meta.TryGetProperty("rowType", out var rowType) &&
            rowType.ValueKind == JsonValueKind.Array)
        {
            foreach (var col in rowType.EnumerateArray())
            {
                if (col.TryGetProperty("name", out var colName))
                {
                    columnNames.Add(colName.GetString() ?? $"col_{columnNames.Count}");
                }
            }
        }

        // Parse data rows
        if (result.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
        {
            foreach (var rowArray in data.EnumerateArray())
            {
                if (rowArray.ValueKind != JsonValueKind.Array)
                    continue;

                var row = new Dictionary<string, object>();
                var colIndex = 0;

                foreach (var cell in rowArray.EnumerateArray())
                {
                    var colName = colIndex < columnNames.Count ? columnNames[colIndex] : $"col_{colIndex}";
                    row[colName] = ConvertCellValue(cell);
                    colIndex++;
                }

                rows.Add(row);
            }
        }

        return rows;
    }

    private object ConvertCellValue(JsonElement value)
    {
        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString() ?? "",
            JsonValueKind.Number => value.TryGetInt64(out var l) ? l : value.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => DBNull.Value,
            _ => value.ToString()
        };
    }

    private async Task<string> GetAuthTokenAsync(Dictionary<string, string> config)
    {
        // If a pre-generated token is provided, use it directly
        if (config.TryGetValue("token", out var token) && !string.IsNullOrWhiteSpace(token))
            return token;

        // Use username/password login to get session token
        var account = config["account"];
        var username = config.TryGetValue("username", out var u) ? u : throw new ArgumentException("Missing: username or token");
        var password = config.TryGetValue("password", out var p) ? p : throw new ArgumentException("Missing: password");

        var client = _httpClientFactory.CreateClient();
        var loginUrl = $"https://{account}.snowflakecomputing.com/session/v1/login-request";

        var loginBody = new
        {
            data = new
            {
                CLIENT_APP_ID = "PuodIntegration",
                CLIENT_APP_VERSION = "1.0",
                ACCOUNT_NAME = account,
                LOGIN_NAME = username,
                PASSWORD = password
            }
        };

        var jsonContent = new StringContent(
            JsonSerializer.Serialize(loginBody),
            Encoding.UTF8,
            "application/json");

        var response = await client.PostAsync(loginUrl, jsonContent);
        var responseContent = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Snowflake login failed: {response.StatusCode} - {Truncate(responseContent)}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(responseContent);

        if (result.TryGetProperty("data", out var data) &&
            data.TryGetProperty("token", out var sessionToken))
        {
            return sessionToken.GetString() ?? throw new InvalidOperationException("Empty session token from Snowflake");
        }

        throw new InvalidOperationException($"Failed to extract session token from Snowflake login response");
    }

    private void ValidateConfig(Dictionary<string, string> config)
    {
        if (!config.ContainsKey("account") || string.IsNullOrWhiteSpace(config["account"]))
            throw new ArgumentException("Missing required config: account");

        var hasToken = config.ContainsKey("token") && !string.IsNullOrWhiteSpace(config["token"]);
        var hasCredentials = config.ContainsKey("username") && config.ContainsKey("password");

        if (!hasToken && !hasCredentials)
            throw new ArgumentException("Missing authentication: provide 'token' or 'username'+'password'");
    }

    private static string EscapeIdentifier(string identifier)
    {
        // Only allow alphanumeric, underscore, and dollar sign
        if (identifier.All(c => char.IsLetterOrDigit(c) || c == '_' || c == '$'))
            return identifier;

        // Quote the identifier
        return $"\"{identifier.Replace("\"", "\"\"")}\"";
    }

    private static string Truncate(string text, int maxLength = 500)
    {
        return text.Length <= maxLength ? text : text[..maxLength] + "...";
    }

    #endregion
}
