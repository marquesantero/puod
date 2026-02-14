using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Puod.Shared.Common.Authentication;
using Puod.Services.Integration.Models;

namespace Puod.Services.Integration.Connectors;

/// <summary>
/// Conector para Apache Airflow usando REST API
/// </summary>
public class AirflowConnector : IConnector
{
    private readonly IHttpClientFactory _httpClientFactory;

    public AirflowConnector(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<ConnectionResult> TestConnectionAsync(Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var client = CreateHttpClient(config);
            var response = await client.GetAsync("/api/v1/health");

            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var health = JsonSerializer.Deserialize<JsonElement>(content);

                return new ConnectionResult
                {
                    Success = true,
                    Metadata = new Dictionary<string, object>
                    {
                        { "base_url", config["base_url"] },
                        { "health", health.ToString() },
                        { "tested_at", DateTime.UtcNow }
                    }
                };
            }

            return new ConnectionResult
            {
                Success = false,
                ErrorMessage = $"Connection failed: {response.StatusCode}"
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

            // Check if we should use POST /dags/~/dagRuns/list endpoint (for filtering by specific DAG IDs)
            if (query == "USE_POST_LIST_ENDPOINT")
            {
                Console.WriteLine($"[AirflowConnector] Using POST /api/v1/dags/~/dagRuns/list");

                // Parse dataSourceJson to get DAG IDs and limit
                var settings = DataSourceSettingsHelper.ParseSettings<AirflowDataSourceSettings>(config.ContainsKey("dataSourceJson") ? config["dataSourceJson"] : null);
                if (settings == null || settings.DagIds == null || !settings.DagIds.Any())
                {
                    stopwatch.Stop();
                    return new QueryResult
                    {
                        Success = false,
                        ErrorMessage = "POST list endpoint requires dag_ids in dataSourceJson",
                        ExecutionTime = stopwatch.Elapsed
                    };
                }

                // Build POST body
                var requestBody = new
                {
                    dag_ids = settings.DagIds,
                    page_limit = settings.Limit ?? 100
                };

                var postContent = new StringContent(
                    JsonSerializer.Serialize(requestBody),
                    Encoding.UTF8,
                    "application/json"
                );

                Console.WriteLine($"[AirflowConnector] POST body: {JsonSerializer.Serialize(requestBody)}");

                var response = await client.PostAsync("/api/v1/dags/~/dagRuns/list", postContent);
                var responseContent = await response.Content.ReadAsStringAsync();

                stopwatch.Stop();

                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[AirflowConnector] POST failed with {response.StatusCode}");
                    Console.WriteLine($"[AirflowConnector] Response: {responseContent}");

                    return new QueryResult
                    {
                        Success = false,
                        ErrorMessage = $"API request failed: {response.StatusCode} - Response: {responseContent}",
                        ExecutionTime = stopwatch.Elapsed
                    };
                }

                var result = JsonSerializer.Deserialize<JsonElement>(responseContent);
                var rows = ParseAirflowResponse(result);

                Console.WriteLine($"[AirflowConnector] POST returned {rows.Count} DAG runs");

                return new QueryResult
                {
                    Success = true,
                    Rows = rows,
                    RowCount = rows.Count,
                    ExecutionTime = stopwatch.Elapsed
                };
            }

            // Check if query is a REST endpoint (GET request)
            // SECURITY: Only allow READ-ONLY operations (GET requests)
            if (query.StartsWith("dagRuns", StringComparison.OrdinalIgnoreCase) ||
                query.StartsWith("dags", StringComparison.OrdinalIgnoreCase) ||
                query.StartsWith("tasks", StringComparison.OrdinalIgnoreCase) ||
                query.StartsWith("pools", StringComparison.OrdinalIgnoreCase) ||
                query.StartsWith("connections", StringComparison.OrdinalIgnoreCase) ||
                query.StartsWith("variables", StringComparison.OrdinalIgnoreCase) ||
                query.StartsWith("xcomEntries", StringComparison.OrdinalIgnoreCase) ||
                query.StartsWith("importErrors", StringComparison.OrdinalIgnoreCase) ||
                query.StartsWith("backfills", StringComparison.OrdinalIgnoreCase) ||
                query.StartsWith("health", StringComparison.OrdinalIgnoreCase) ||
                query.StartsWith("version", StringComparison.OrdinalIgnoreCase) ||
                query.StartsWith("/api/v1/", StringComparison.OrdinalIgnoreCase))
            {
                // Handle as REST GET request
                var endpoint = NormalizeAirflowEndpoint(query);

                Console.WriteLine($"[AirflowConnector] Calling endpoint: {endpoint}");
                Console.WriteLine($"[AirflowConnector] Base URL: {client.BaseAddress}");

                var response = await client.GetAsync(endpoint);
                var responseContent = await response.Content.ReadAsStringAsync();

                stopwatch.Stop();

                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[AirflowConnector] Failed with {response.StatusCode}");
                    Console.WriteLine($"[AirflowConnector] Response: {responseContent}");

                    return new QueryResult
                    {
                        Success = false,
                        ErrorMessage = $"API request failed: {response.StatusCode} - URL: {client.BaseAddress}{endpoint} - Response: {responseContent}",
                        ExecutionTime = stopwatch.Elapsed
                    };
                }

                var result = JsonSerializer.Deserialize<JsonElement>(responseContent);
                var rows = ParseAirflowResponse(result);

                return new QueryResult
                {
                    Success = true,
                    Rows = rows,
                    RowCount = rows.Count,
                    ExecutionTime = stopwatch.Elapsed
                };
            }

            // SECURITY: Reject unrecognized queries to prevent accidental write operations
            stopwatch.Stop();
            return new QueryResult
            {
                Success = false,
                ErrorMessage = $"Unsupported query: '{query}'. Only read-only GET endpoints are allowed. Supported endpoints: dagRuns, dags, tasks, pools, connections, variables, xcomEntries, importErrors, backfills, health, version",
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

    /// <summary>
    /// Parse Airflow API response into rows
    /// </summary>
    private List<Dictionary<string, object>> ParseAirflowResponse(JsonElement result)
    {
        var rows = new List<Dictionary<string, object>>();

        // Check for common list properties
        var listProperties = new[] { "dag_runs", "dags", "tasks", "task_instances", "pools",
                                     "connections", "variables", "import_errors", "xcom_entries" };

        foreach (var listProp in listProperties)
        {
            if (!result.TryGetProperty(listProp, out var items))
            {
                continue;
            }

            if (items.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in items.EnumerateArray())
                {
                    rows.Add(ParseJsonElement(item));
                }
                return rows;
            }

            if (items.ValueKind == JsonValueKind.Object)
            {
                if (items.TryGetProperty("task_instances", out var nested) && nested.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in nested.EnumerateArray())
                    {
                        rows.Add(ParseJsonElement(item));
                    }
                    return rows;
                }

                if (items.TryGetProperty("task_instance", out var singleTask))
                {
                    rows.Add(ParseJsonElement(singleTask));
                    return rows;
                }

                var arrayProp = items.EnumerateObject().FirstOrDefault(p => p.Value.ValueKind == JsonValueKind.Array);
                if (!arrayProp.Equals(default(JsonProperty)))
                {
                    foreach (var item in arrayProp.Value.EnumerateArray())
                    {
                        rows.Add(ParseJsonElement(item));
                    }
                    return rows;
                }

                rows.Add(ParseJsonElement(items));
                return rows;
            }

            if (items.ValueKind != JsonValueKind.Undefined && items.ValueKind != JsonValueKind.Null)
            {
                rows.Add(ParseJsonElement(items));
                return rows;
            }
        }

        // Single object - return as single row
        rows.Add(ParseJsonElement(result));
        return rows;
    }

    /// <summary>
    /// Parse JsonElement into Dictionary with proper type conversion
    /// </summary>
    private Dictionary<string, object> ParseJsonElement(JsonElement element)
    {
        var row = new Dictionary<string, object>();

        foreach (var prop in element.EnumerateObject())
        {
            row[prop.Name] = ConvertJsonValue(prop.Value);
        }

        return row;
    }

    /// <summary>
    /// Convert JsonElement to appropriate .NET type
    /// </summary>
    private object ConvertJsonValue(JsonElement value)
    {
        switch (value.ValueKind)
        {
            case JsonValueKind.String:
                return value.GetString() ?? "";

            case JsonValueKind.Number:
                if (value.TryGetInt64(out var longValue))
                    return longValue;
                return value.GetDouble();

            case JsonValueKind.True:
                return true;

            case JsonValueKind.False:
                return false;

            case JsonValueKind.Null:
                return DBNull.Value;

            case JsonValueKind.Array:
                var list = new List<object>();
                foreach (var item in value.EnumerateArray())
                {
                    list.Add(ConvertJsonValue(item));
                }
                return list;

            case JsonValueKind.Object:
                // For nested objects, serialize to JSON string for display
                return value.ToString();

            default:
                return value.ToString();
        }
    }

    /// <summary>
    /// Normalize Airflow endpoint to correct API path
    /// </summary>
    private string NormalizeAirflowEndpoint(string query)
    {
        // Already a full path
        if (query.StartsWith("/api/v1/", StringComparison.OrdinalIgnoreCase))
            return query;

        // Special case: dagRuns without dag_id should query all dags
        if (query.StartsWith("dagRuns", StringComparison.OrdinalIgnoreCase))
        {
            // Extract query parameters if present
            var queryPart = query.Substring(7); // Remove "dagRuns"
            return $"/api/v1/dags/~/dagRuns{queryPart}";
        }

        // Special case: tasks without path should list all
        if (query.Equals("tasks", StringComparison.OrdinalIgnoreCase))
        {
            return "/api/v1/dags/~/tasks";
        }

        // Health endpoint
        if (query.StartsWith("health", StringComparison.OrdinalIgnoreCase))
        {
            return "/api/v1/health";
        }

        // Version endpoint
        if (query.StartsWith("version", StringComparison.OrdinalIgnoreCase))
        {
            return "/api/v1/version";
        }

        // Pools endpoint
        if (query.StartsWith("pools", StringComparison.OrdinalIgnoreCase))
        {
            return $"/api/v1/{query}";
        }

        // Connections endpoint
        if (query.StartsWith("connections", StringComparison.OrdinalIgnoreCase))
        {
            return $"/api/v1/{query}";
        }

        // Variables endpoint
        if (query.StartsWith("variables", StringComparison.OrdinalIgnoreCase))
        {
            return $"/api/v1/{query}";
        }

        // Import errors endpoint
        if (query.StartsWith("importErrors", StringComparison.OrdinalIgnoreCase))
        {
            return $"/api/v1/{query}";
        }

        // XCom entries endpoint
        if (query.StartsWith("xcomEntries", StringComparison.OrdinalIgnoreCase))
        {
            return $"/api/v1/{query}";
        }

        // Backfills endpoint
        if (query.StartsWith("backfills", StringComparison.OrdinalIgnoreCase))
        {
            return $"/api/v1/{query}";
        }

        // Default: dags and other standard endpoints
        return $"/api/v1/{query}";
    }

    public async Task<List<string>> ListDatabasesAsync(Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var debug = config.TryGetValue("debug", out var debugValue)
                && string.Equals(debugValue, "true", StringComparison.OrdinalIgnoreCase);
            var client = CreateHttpClient(config);
            var targetDags = ParseTargetDags(config);

            if (targetDags.Count > 0)
            {
                var includePaused = config.TryGetValue("include_paused", out var includePausedValue)
                    && string.Equals(includePausedValue, "true", StringComparison.OrdinalIgnoreCase);
                var validated = new List<string>();

                foreach (var dagId in targetDags)
                {
                    var encodedDagId = Uri.EscapeDataString(dagId);
                    var response = await client.GetAsync($"/api/v1/dags/{encodedDagId}");

                    if (!response.IsSuccessStatusCode)
                    {
                        if (debug)
                        {
                            var errorBody = await response.Content.ReadAsStringAsync();
                            Console.WriteLine($"Airflow dag error ({dagId}): {(int)response.StatusCode} {response.StatusCode}");
                            Console.WriteLine(errorBody);
                        }

                        continue;
                    }

                    var content = await response.Content.ReadAsStringAsync();
                    var result = JsonSerializer.Deserialize<JsonElement>(content);

                    if (!includePaused &&
                        result.TryGetProperty("is_paused", out var pausedElement) &&
                        pausedElement.ValueKind == JsonValueKind.True)
                    {
                        continue;
                    }

                    validated.Add(dagId);
                }

                return validated;
            }

            var pageLimit = GetIntConfig(config, "page_limit", 100);
            var maxDags = GetIntConfig(config, "max_dags", 5000);
            var offset = 0;
            var totalEntries = int.MaxValue;
            var dagList = new List<string>();

            // Use Airflow's native dag_id_pattern filter if search_pattern is provided
            var searchPattern = config.TryGetValue("search_pattern", out var pattern) ? pattern : null;
            var dagIdPattern = !string.IsNullOrWhiteSpace(searchPattern) ? $"%{searchPattern}%" : null;

            if (dagIdPattern != null && debug)
            {
                Console.WriteLine($"[AirflowConnector] Using dag_id_pattern filter: {dagIdPattern}");
            }

            while (offset < totalEntries && dagList.Count < maxDags)
            {
                var queryParams = $"limit={pageLimit}&offset={offset}&only_active=false";
                if (dagIdPattern != null)
                {
                    queryParams += $"&dag_id_pattern={Uri.EscapeDataString(dagIdPattern)}";
                }

                if (debug && offset == 0)
                {
                    Console.WriteLine($"[AirflowConnector] Calling: /api/v1/dags?{queryParams}");
                }

                var response = await client.GetAsync($"/api/v1/dags?{queryParams}");

                if (!response.IsSuccessStatusCode)
                {
                    if (debug)
                    {
                        var errorBody = await response.Content.ReadAsStringAsync();
                        Console.WriteLine($"Airflow dags error: {(int)response.StatusCode} {response.StatusCode}");
                        Console.WriteLine(errorBody);
                    }

                    return new List<string>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<JsonElement>(content);

                if (!result.TryGetProperty("dags", out var dags))
                {
                    if (debug)
                    {
                        Console.WriteLine("Airflow dags response missing 'dags' property.");
                        Console.WriteLine(content);
                    }
                    break;
                }

                if (result.TryGetProperty("total_entries", out var totalEntriesElement) &&
                    totalEntriesElement.TryGetInt32(out var total))
                {
                    totalEntries = total;
                }

                var pageCount = 0;

                foreach (var dag in dags.EnumerateArray())
                {
                    pageCount++;

                    if (dag.TryGetProperty("is_paused", out var isPausedElement) &&
                        isPausedElement.ValueKind == JsonValueKind.True)
                    {
                        continue;
                    }

                    if (dag.TryGetProperty("dag_id", out var dagId))
                    {
                        var dagValue = dagId.GetString();
                        if (!string.IsNullOrWhiteSpace(dagValue))
                        {
                            dagList.Add(dagValue);
                        }
                    }
                }

                if (pageCount == 0)
                {
                    break;
                }

                offset += pageLimit;
            }

            if (debug)
            {
                Console.WriteLine($"Airflow dags fetched: {dagList.Count} (total_entries: {totalEntries})");
            }

            return dagList;
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
            var response = await client.GetAsync($"/api/v1/dags/{database}/tasks");

            if (!response.IsSuccessStatusCode)
                return new List<string>();

            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<JsonElement>(content);

            if (!result.TryGetProperty("tasks", out var tasks))
                return new List<string>();

            var taskList = new List<string>();

            foreach (var task in tasks.EnumerateArray())
            {
                if (task.TryGetProperty("task_id", out var taskId))
                {
                    taskList.Add(taskId.GetString() ?? "");
                }
            }

            return taskList;
        }
        catch
        {
            return new List<string>();
        }
    }

    private HttpClient CreateHttpClient(Dictionary<string, string> config)
    {
        var client = _httpClientFactory.CreateClient();
        client.BaseAddress = new Uri(config["base_url"]);
        client.DefaultRequestHeaders.UserAgent.ParseAdd(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        if (config.TryGetValue("auth_type", out var authTypeValue) && authTypeValue == "profile")
        {
            var token = GetAzureAdTokenAsync(config).GetAwaiter().GetResult();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return client;
        }

        // Autenticacao via cookies do browser (Vivaldi, Chrome, Edge)
        if (config.ContainsKey("auth_type") && config["auth_type"] == "browser_cookies")
        {
            var cookieDomain = config.GetValueOrDefault("cookie_domain", new Uri(config["base_url"]).Host);

            try
            {
                if (BrowserCookieHelper.TryGetCookieHeader(config, cookieDomain, out var cookieHeader, out var usedBrowser, out var errorMessage))
                {
                    client.DefaultRequestHeaders.Add("Cookie", cookieHeader);
                    return client;
                }

                if (config.TryGetValue("cookie_header", out var fallbackCookieHeader) &&
                    !string.IsNullOrWhiteSpace(fallbackCookieHeader))
                {
                    Console.WriteLine($"Fallback to configured cookie_header because browser cookies failed: {errorMessage}");
                    client.DefaultRequestHeaders.Add("Cookie", fallbackCookieHeader);
                    return client;
                }

                throw new InvalidOperationException($"Falha ao extrair cookies do browser {usedBrowser ?? "auto"}: {errorMessage}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Erro ao extrair cookies do browser: {ex.Message}");
                throw new InvalidOperationException($"Falha ao extrair cookies do browser: {ex.Message}", ex);
            }
        }
        else if (config.TryGetValue("cookie_header", out var rawCookieHeader) &&
                 !string.IsNullOrWhiteSpace(rawCookieHeader))
        {
            client.DefaultRequestHeaders.Add("Cookie", rawCookieHeader);
            return client;
        }
        // Autenticacao basica (username/password)
        else if (config.ContainsKey("username") && config.ContainsKey("password"))
        {
            var credentials = Convert.ToBase64String(
                Encoding.ASCII.GetBytes($"{config["username"]}:{config["password"]}")
            );
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        }
        // Autenticacao via Bearer token
        else if (config.ContainsKey("token"))
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config["token"]);
        }

        return client;
    }

    private void ValidateConfig(Dictionary<string, string> config)
    {
        if (!config.ContainsKey("base_url") || string.IsNullOrEmpty(config["base_url"]))
            throw new ArgumentException("Missing required config: base_url");

        var hasCredentials = config.ContainsKey("username") && config.ContainsKey("password");
        var hasToken = config.ContainsKey("token");
        var hasBrowserCookies = config.ContainsKey("auth_type") && config["auth_type"] == "browser_cookies";
        var hasProfileAuth = config.ContainsKey("auth_type") && config["auth_type"] == "profile";
        var hasCookieHeader = config.ContainsKey("cookie_header") && !string.IsNullOrWhiteSpace(config["cookie_header"]);

        if (!hasCredentials && !hasToken && !hasBrowserCookies && !hasCookieHeader && !hasProfileAuth)
            throw new ArgumentException("Missing authentication: username/password, token, cookie_header, or auth_type=browser_cookies required");

        if (hasProfileAuth)
        {
            if (!config.ContainsKey("client_id") || string.IsNullOrWhiteSpace(config["client_id"]))
                throw new ArgumentException("Missing required config for profile auth: client_id");
            if (!config.ContainsKey("client_secret") || string.IsNullOrWhiteSpace(config["client_secret"]))
                throw new ArgumentException("Missing required config for profile auth: client_secret");
            if (!config.ContainsKey("tenant_id") && !config.ContainsKey("token_url"))
                throw new ArgumentException("Missing required config for profile auth: tenant_id or token_url");
            if (!config.ContainsKey("scopes") || string.IsNullOrWhiteSpace(config["scopes"]))
                throw new ArgumentException("Missing required config for profile auth: scopes");
        }
    }

    private async Task<string> GetAzureAdTokenAsync(Dictionary<string, string> config)
    {
        var tokenUrl = config.TryGetValue("token_url", out var tokenUrlValue) && !string.IsNullOrWhiteSpace(tokenUrlValue)
            ? tokenUrlValue
            : $"https://login.microsoftonline.com/{config["tenant_id"]}/oauth2/v2.0/token";

        var scope = config.TryGetValue("scopes", out var scopesValue) ? scopesValue : string.Empty;
        if (string.IsNullOrWhiteSpace(scope))
            throw new ArgumentException("Missing required config: scopes");

        var client = _httpClientFactory.CreateClient();
        var requestBody = new Dictionary<string, string>
        {
            { "grant_type", "client_credentials" },
            { "client_id", config["client_id"] },
            { "client_secret", config["client_secret"] },
            { "scope", scope }
        };

        var content = new FormUrlEncodedContent(requestBody);
        var response = await client.PostAsync(tokenUrl, content);

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Failed to obtain access token: {errorContent}");
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        var tokenResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);

        return tokenResponse.GetProperty("access_token").GetString() ?? "";
    }

    private static int GetIntConfig(Dictionary<string, string> config, string key, int defaultValue)
    {
        if (!config.TryGetValue(key, out var value) || string.IsNullOrWhiteSpace(value))
            return defaultValue;

        return int.TryParse(value, out var parsed) ? parsed : defaultValue;
    }

    private static HashSet<string> ParseTargetDags(Dictionary<string, string> config)
    {
        if (!config.TryGetValue("target_dags", out var raw) || string.IsNullOrWhiteSpace(raw))
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var items = raw
            .Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(item => item.Trim())
            .Where(item => !string.IsNullOrWhiteSpace(item));

        return new HashSet<string>(items, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Busca detalhes de uma execucao especifica de DAG
    /// </summary>
    public async Task<JsonElement?> GetDagRunAsync(string dagId, string dagRunId, Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var client = CreateHttpClient(config);
            var response = await client.GetAsync($"/api/v1/dags/{dagId}/dagRuns/{dagRunId}");

            if (!response.IsSuccessStatusCode)
                return null;

            var content = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<JsonElement>(content);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Lista execucoes de um DAG com filtros
    /// </summary>
    public async Task<List<JsonElement>> ListDagRunsAsync(
        string dagId,
        Dictionary<string, string> config,
        DateTime? startDate = null,
        DateTime? endDate = null,
        string? state = null,
        int limit = 100,
        int offset = 0)
    {
        try
        {
            ValidateConfig(config);

            var queryParams = new List<string> { $"limit={limit}", $"offset={offset}" };

            if (startDate.HasValue)
                queryParams.Add($"execution_date_gte={startDate.Value:yyyy-MM-ddTHH:mm:ssZ}");

            if (endDate.HasValue)
                queryParams.Add($"execution_date_lte={endDate.Value:yyyy-MM-ddTHH:mm:ssZ}");

            if (!string.IsNullOrEmpty(state))
                queryParams.Add($"state={state}");

            var queryString = string.Join("&", queryParams);
            var client = CreateHttpClient(config);
            var response = await client.GetAsync($"/api/v1/dags/{dagId}/dagRuns?{queryString}");

            if (!response.IsSuccessStatusCode)
                return new List<JsonElement>();

            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<JsonElement>(content);

            if (!result.TryGetProperty("dag_runs", out var dagRuns))
                return new List<JsonElement>();

            var runList = new List<JsonElement>();
            foreach (var run in dagRuns.EnumerateArray())
            {
                runList.Add(run);
            }

            return runList;
        }
        catch
        {
            return new List<JsonElement>();
        }
    }

    /// <summary>
    /// Busca task instances de uma execucao de DAG
    /// </summary>
    public async Task<List<JsonElement>> GetTaskInstancesAsync(
        string dagId,
        string dagRunId,
        Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var client = CreateHttpClient(config);
            var response = await client.GetAsync($"/api/v1/dags/{dagId}/dagRuns/{dagRunId}/taskInstances");

            if (!response.IsSuccessStatusCode)
                return new List<JsonElement>();

            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<JsonElement>(content);

            if (!result.TryGetProperty("task_instances", out var tasks))
                return new List<JsonElement>();

            var taskList = new List<JsonElement>();
            foreach (var task in tasks.EnumerateArray())
            {
                taskList.Add(task);
            }

            return taskList;
        }
        catch
        {
            return new List<JsonElement>();
        }
    }

    /// <summary>
    /// Busca logs de uma task instance
    /// </summary>
    public async Task<string?> GetTaskLogsAsync(
        string dagId,
        string dagRunId,
        string taskId,
        int tryNumber,
        Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var client = CreateHttpClient(config);
            var response = await client.GetAsync(
                $"/api/v1/dags/{dagId}/dagRuns/{dagRunId}/taskInstances/{taskId}/logs/{tryNumber}");

            if (!response.IsSuccessStatusCode)
                return null;

            return await response.Content.ReadAsStringAsync();
        }
        catch
        {
            return null;
        }
    }
}
