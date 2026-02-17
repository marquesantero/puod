using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Puod.Services.Integration.Connectors;

/// <summary>
/// Conector para dbt Cloud usando REST API v2/v3.
/// Suporta: Projects, Jobs, Job Runs, Environments, Models, Sources, Tests.
/// Documentação: https://docs.getdbt.com/dbt-cloud/api-v2
/// </summary>
public class DbtCloudConnector : IConnector
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<DbtCloudConnector> _logger;

    private const string DefaultBaseUrl = "https://cloud.getdbt.com";

    public DbtCloudConnector(
        IHttpClientFactory httpClientFactory,
        ILogger<DbtCloudConnector> logger)
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

            var client = CreateHttpClient(config);
            var accountId = config["account_id"];

            var response = await client.GetAsync($"/api/v2/accounts/{accountId}/");

            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<JsonElement>(content);

                var accountName = "";
                if (result.TryGetProperty("data", out var data) &&
                    data.TryGetProperty("name", out var name))
                {
                    accountName = name.GetString() ?? "";
                }

                return new ConnectionResult
                {
                    Success = true,
                    Metadata = new Dictionary<string, object>
                    {
                        { "service", "dbt Cloud" },
                        { "account_id", accountId },
                        { "account_name", accountName },
                        { "tested_at", DateTime.UtcNow }
                    }
                };
            }

            var errorBody = await response.Content.ReadAsStringAsync();
            return new ConnectionResult
            {
                Success = false,
                ErrorMessage = $"Connection failed: {response.StatusCode} - {Truncate(errorBody)}"
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

            var client = CreateHttpClient(config);
            var accountId = config["account_id"];

            // Route query to appropriate endpoint
            var (endpoint, listProperty) = ResolveEndpoint(query, accountId, config);

            _logger.LogDebug("dbt Cloud query: {Query} -> {Endpoint}", query, endpoint);

            var response = await client.GetAsync(endpoint);
            var responseContent = await response.Content.ReadAsStringAsync();
            stopwatch.Stop();

            if (!response.IsSuccessStatusCode)
            {
                return new QueryResult
                {
                    Success = false,
                    ErrorMessage = $"API request failed: {response.StatusCode} - {Truncate(responseContent)}",
                    ExecutionTime = stopwatch.Elapsed
                };
            }

            var result = JsonSerializer.Deserialize<JsonElement>(responseContent);
            var rows = ParseResponse(result, listProperty);

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
        try
        {
            ValidateConfig(config);

            var client = CreateHttpClient(config);
            var accountId = config["account_id"];

            var response = await client.GetAsync($"/api/v2/accounts/{accountId}/projects/");

            if (!response.IsSuccessStatusCode)
                return new List<string>();

            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<JsonElement>(content);

            var projects = new List<string>();
            if (result.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var project in data.EnumerateArray())
                {
                    if (project.TryGetProperty("name", out var name))
                    {
                        var id = project.TryGetProperty("id", out var idEl) ? idEl.GetInt64().ToString() : "";
                        projects.Add($"{name.GetString()} (id:{id})");
                    }
                }
            }

            return projects;
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

            var client = CreateHttpClient(config);
            var accountId = config["account_id"];

            // database pode ser "project_name (id:123)" ou simplesmente o id
            var projectId = ExtractProjectId(database);

            var response = await client.GetAsync($"/api/v2/accounts/{accountId}/jobs/?project_id={projectId}");

            if (!response.IsSuccessStatusCode)
                return new List<string>();

            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<JsonElement>(content);

            var jobs = new List<string>();
            if (result.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var job in data.EnumerateArray())
                {
                    if (job.TryGetProperty("name", out var name))
                    {
                        jobs.Add(name.GetString() ?? "");
                    }
                }
            }

            return jobs;
        }
        catch
        {
            return new List<string>();
        }
    }

    #endregion

    #region Private Methods

    private (string endpoint, string listProperty) ResolveEndpoint(string query, string accountId, Dictionary<string, string> config)
    {
        var queryLower = query.ToLowerInvariant().Trim();

        // Projects
        if (queryLower == "projects" || queryLower.StartsWith("projects"))
        {
            return ($"/api/v2/accounts/{accountId}/projects/", "data");
        }

        // Jobs
        if (queryLower == "jobs" || queryLower.StartsWith("jobs"))
        {
            var projectFilter = config.TryGetValue("project_id", out var pid) ? $"?project_id={pid}" : "";
            return ($"/api/v2/accounts/{accountId}/jobs/{projectFilter}", "data");
        }

        // Job Runs
        if (queryLower == "runs" || queryLower.StartsWith("runs"))
        {
            var jobFilter = config.TryGetValue("job_id", out var jid) ? $"?job_definition_id={jid}" : "";
            return ($"/api/v2/accounts/{accountId}/runs/{jobFilter}", "data");
        }

        // Specific run by ID
        if (queryLower.StartsWith("run/"))
        {
            var runId = queryLower.Substring(4).Trim();
            return ($"/api/v2/accounts/{accountId}/runs/{runId}/", "data");
        }

        // Environments
        if (queryLower == "environments" || queryLower.StartsWith("environments"))
        {
            return ($"/api/v3/accounts/{accountId}/environments/", "data");
        }

        // Connections
        if (queryLower == "connections" || queryLower.StartsWith("connections"))
        {
            return ($"/api/v2/accounts/{accountId}/connections/", "data");
        }

        // Repositories
        if (queryLower == "repositories" || queryLower.StartsWith("repositories"))
        {
            return ($"/api/v2/accounts/{accountId}/repositories/", "data");
        }

        // Default: treat as raw endpoint path
        if (queryLower.StartsWith("/api/"))
        {
            return (query, "data");
        }

        return ($"/api/v2/accounts/{accountId}/{query}/", "data");
    }

    private List<Dictionary<string, object>> ParseResponse(JsonElement result, string listProperty)
    {
        var rows = new List<Dictionary<string, object>>();

        if (result.TryGetProperty(listProperty, out var data))
        {
            if (data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    rows.Add(ParseJsonElement(item));
                }
            }
            else if (data.ValueKind == JsonValueKind.Object)
            {
                rows.Add(ParseJsonElement(data));
            }
        }
        else
        {
            // Fallback: parse entire response as single row
            rows.Add(ParseJsonElement(result));
        }

        return rows;
    }

    private Dictionary<string, object> ParseJsonElement(JsonElement element)
    {
        var row = new Dictionary<string, object>();

        if (element.ValueKind != JsonValueKind.Object)
        {
            row["value"] = ConvertJsonValue(element);
            return row;
        }

        foreach (var prop in element.EnumerateObject())
        {
            row[prop.Name] = ConvertJsonValue(prop.Value);
        }

        return row;
    }

    private object ConvertJsonValue(JsonElement value)
    {
        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString() ?? "",
            JsonValueKind.Number => value.TryGetInt64(out var l) ? l : value.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => DBNull.Value,
            JsonValueKind.Array => value.ToString(),
            JsonValueKind.Object => value.ToString(),
            _ => value.ToString()
        };
    }

    private HttpClient CreateHttpClient(Dictionary<string, string> config)
    {
        var client = _httpClientFactory.CreateClient();

        var baseUrl = config.TryGetValue("base_url", out var url) && !string.IsNullOrWhiteSpace(url)
            ? url.TrimEnd('/')
            : DefaultBaseUrl;

        client.BaseAddress = new Uri(baseUrl);
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Token", config["api_token"]);

        return client;
    }

    private void ValidateConfig(Dictionary<string, string> config)
    {
        if (!config.ContainsKey("api_token") || string.IsNullOrWhiteSpace(config["api_token"]))
            throw new ArgumentException("Missing required config: api_token");

        if (!config.ContainsKey("account_id") || string.IsNullOrWhiteSpace(config["account_id"]))
            throw new ArgumentException("Missing required config: account_id");
    }

    private static string ExtractProjectId(string database)
    {
        // Support format "Project Name (id:123)"
        var idPrefix = "(id:";
        var idxStart = database.IndexOf(idPrefix, StringComparison.OrdinalIgnoreCase);
        if (idxStart >= 0)
        {
            var idxEnd = database.IndexOf(')', idxStart);
            if (idxEnd > idxStart)
            {
                return database.Substring(idxStart + idPrefix.Length, idxEnd - idxStart - idPrefix.Length);
            }
        }

        // Assume raw ID
        return database.Trim();
    }

    private static string Truncate(string text, int maxLength = 500)
    {
        return text.Length <= maxLength ? text : text[..maxLength] + "...";
    }

    #endregion
}
