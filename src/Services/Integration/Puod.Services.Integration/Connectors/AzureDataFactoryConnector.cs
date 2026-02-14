using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Puod.Shared.Common.Authentication;

namespace Puod.Services.Integration.Connectors;

/// <summary>
/// Conector para Azure Data Factory usando Management API
/// Documenta??o: https://learn.microsoft.com/en-us/rest/api/datafactory/
/// </summary>
public class AzureDataFactoryConnector : IConnector
{
    private readonly IHttpClientFactory _httpClientFactory;
    private string? _cachedAccessToken;
    private DateTime _tokenExpiresAt = DateTime.MinValue;
    private bool _useBrowserCookies = false;

    public AzureDataFactoryConnector(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<ConnectionResult> TestConnectionAsync(Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var token = await GetAccessTokenAsync(config);
            var useBrowserAuth = config.ContainsKey("auth_type") && config["auth_type"] == "browser_cookies";
            if (!useBrowserAuth && string.IsNullOrEmpty(token))
            {
                return new ConnectionResult
                {
                    Success = false,
                    ErrorMessage = "Failed to obtain access token"
                };
            }

            // Test by listing pipelines
            var pipelines = await ListPipelinesAsync(config);

            return new ConnectionResult
            {
                Success = true,
                Metadata = new Dictionary<string, object>
                {
                    { "subscription_id", config["subscription_id"] },
                    { "resource_group", config["resource_group"] },
                    { "factory_name", config["factory_name"] },
                    { "pipeline_count", pipelines.Count },
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
            // Para ADF, "query" pode ser interpretado como nome do pipeline para buscar runs
            ValidateConfig(config);

            var normalizedQuery = query?.Trim() ?? string.Empty;
            List<JsonElement> runs;

            if (string.IsNullOrWhiteSpace(normalizedQuery) ||
                normalizedQuery.Equals("pipelineRuns", StringComparison.OrdinalIgnoreCase) ||
                normalizedQuery.Equals("pipeline_runs", StringComparison.OrdinalIgnoreCase) ||
                normalizedQuery.Equals("runs", StringComparison.OrdinalIgnoreCase))
            {
                runs = await ListPipelineRunsAsync(null, config);
            }
            else
            {
                runs = await ListPipelineRunsAsync(normalizedQuery, config);
            }

            stopwatch.Stop();

            var rows = runs.Select(run => new Dictionary<string, object>
            {
                { "run_id", run.GetProperty("runId").GetString() ?? "" },
                { "pipeline_name", run.GetProperty("pipelineName").GetString() ?? "" },
                { "status", run.GetProperty("status").GetString() ?? "" },
                { "run_start", run.GetProperty("runStart").GetString() ?? "" },
                { "run_end", run.TryGetProperty("runEnd", out var endProp) ? endProp.GetString() ?? "" : "" }
            }).ToList();

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
        // Para ADF, retorna lista de pipelines
        try
        {
            var pipelines = await ListPipelinesAsync(config);
            return pipelines.Select(p => p.GetProperty("name").GetString() ?? "").ToList();
        }
        catch
        {
            return new List<string>();
        }
    }

    public async Task<List<string>> ListTablesAsync(string database, Dictionary<string, string> config)
    {
        // Para ADF, retorna lista de activities de um pipeline
        try
        {
            var pipeline = await GetPipelineAsync(database, config);
            if (pipeline == null)
                return new List<string>();

            if (!pipeline.Value.TryGetProperty("properties", out var props))
                return new List<string>();

            if (!props.TryGetProperty("activities", out var activities))
                return new List<string>();

            var activityList = new List<string>();
            foreach (var activity in activities.EnumerateArray())
            {
                if (activity.TryGetProperty("name", out var name))
                {
                    activityList.Add(name.GetString() ?? "");
                }
            }

            return activityList;
        }
        catch
        {
            return new List<string>();
        }
    }

    /// <summary>
    /// Lista pipelines do Data Factory
    /// </summary>
    private async Task<List<JsonElement>> ListPipelinesAsync(Dictionary<string, string> config)
    {
        ValidateConfig(config);

        var token = await GetAccessTokenAsync(config);
        var client = CreateHttpClient(token, config);

        var url = $"/subscriptions/{config["subscription_id"]}/resourceGroups/{config["resource_group"]}" +
                  $"/providers/Microsoft.DataFactory/factories/{config["factory_name"]}/pipelines?api-version=2018-06-01";

        var response = await client.GetAsync(url);

        if (!response.IsSuccessStatusCode)
            return new List<JsonElement>();

        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        if (!result.TryGetProperty("value", out var pipelines))
            return new List<JsonElement>();

        return pipelines.EnumerateArray().ToList();
    }

    /// <summary>
    /// Busca detalhes de um pipeline espec?fico
    /// </summary>
    private async Task<JsonElement?> GetPipelineAsync(string pipelineName, Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var token = await GetAccessTokenAsync(config);
            var client = CreateHttpClient(token, config);

            var url = $"/subscriptions/{config["subscription_id"]}/resourceGroups/{config["resource_group"]}" +
                      $"/providers/Microsoft.DataFactory/factories/{config["factory_name"]}" +
                      $"/pipelines/{pipelineName}?api-version=2018-06-01";

            var response = await client.GetAsync(url);

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
    /// Lista execu??es de um pipeline com filtros
    /// </summary>
    public async Task<List<JsonElement>> ListPipelineRunsAsync(
        string? pipelineName,
        Dictionary<string, string> config,
        DateTime? lastUpdatedAfter = null,
        DateTime? lastUpdatedBefore = null)
    {
        try
        {
            ValidateConfig(config);

            var token = await GetAccessTokenAsync(config);
            var client = CreateHttpClient(token, config);

            var startTime = lastUpdatedAfter ?? DateTime.UtcNow.AddDays(-7);
            var endTime = lastUpdatedBefore ?? DateTime.UtcNow;

            object requestBody;
            if (!string.IsNullOrWhiteSpace(pipelineName))
            {
                requestBody = new
                {
                    lastUpdatedAfter = startTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                    lastUpdatedBefore = endTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                    filters = new[]
                    {
                        new
                        {
                            operand = "PipelineName",
                            @operator = "Equals",
                            values = new[] { pipelineName }
                        }
                    }
                };
            }
            else
            {
                requestBody = new
                {
                    lastUpdatedAfter = startTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                    lastUpdatedBefore = endTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                    filters = Array.Empty<object>()
                };
            }

            var url = $"/subscriptions/{config["subscription_id"]}/resourceGroups/{config["resource_group"]}" +
                      $"/providers/Microsoft.DataFactory/factories/{config["factory_name"]}" +
                      $"/queryPipelineRuns?api-version=2018-06-01";

            var content = new StringContent(
                JsonSerializer.Serialize(requestBody),
                Encoding.UTF8,
                "application/json"
            );

            var response = await client.PostAsync(url, content);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                var statusCode = (int)response.StatusCode;
                throw new InvalidOperationException(
                    $"ADF queryPipelineRuns failed. Status={statusCode}. Body={Truncate(errorBody)}");
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(responseContent))
            {
                throw new InvalidOperationException("ADF queryPipelineRuns returned empty response body.");
            }

            if (!response.Content.Headers.ContentType?.MediaType?.Contains("json", StringComparison.OrdinalIgnoreCase) ?? true)
            {
                throw new InvalidOperationException(
                    $"ADF queryPipelineRuns returned non-JSON response: {Truncate(responseContent)}");
            }

            var result = JsonSerializer.Deserialize<JsonElement>(responseContent);

            if (!result.TryGetProperty("value", out var runs))
            {
                throw new InvalidOperationException(
                    $"ADF queryPipelineRuns response missing 'value'. Body={Truncate(responseContent)}");
            }

            return runs.EnumerateArray().ToList();
        }
        catch (Exception ex)
        {
            var pipelineInfo = string.IsNullOrWhiteSpace(pipelineName) ? "all pipelines" : $"pipeline '{pipelineName}'";
            throw new InvalidOperationException(
                $"ADF queryPipelineRuns failed for {pipelineInfo}. {ex.Message}", ex);
        }
    }

    private static string Truncate(string value, int maxLength = 800)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
        {
            return value;
        }

        return value.Substring(0, maxLength) + "...";
    }

    /// <summary>
    /// Busca detalhes de uma execu??o de pipeline
    /// </summary>
    public async Task<JsonElement?> GetPipelineRunAsync(string runId, Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var token = await GetAccessTokenAsync(config);
            var client = CreateHttpClient(token, config);

            var url = $"/subscriptions/{config["subscription_id"]}/resourceGroups/{config["resource_group"]}" +
                      $"/providers/Microsoft.DataFactory/factories/{config["factory_name"]}" +
                      $"/pipelineruns/{runId}?api-version=2018-06-01";

            var response = await client.GetAsync(url);

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
    /// Busca activity runs de uma execu??o de pipeline
    /// </summary>
    public async Task<List<JsonElement>> GetActivityRunsAsync(
        string runId,
        Dictionary<string, string> config,
        DateTime? runStartAfter = null,
        DateTime? runStartBefore = null)
    {
        try
        {
            ValidateConfig(config);

            var token = await GetAccessTokenAsync(config);
            var client = CreateHttpClient(token, config);

            var startTime = runStartAfter ?? DateTime.UtcNow.AddDays(-7);
            var endTime = runStartBefore ?? DateTime.UtcNow;

            var requestBody = new
            {
                lastUpdatedAfter = startTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                lastUpdatedBefore = endTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            };

            var url = $"/subscriptions/{config["subscription_id"]}/resourceGroups/{config["resource_group"]}" +
                      $"/providers/Microsoft.DataFactory/factories/{config["factory_name"]}" +
                      $"/pipelineruns/{runId}/queryActivityruns?api-version=2018-06-01";

            var content = new StringContent(
                JsonSerializer.Serialize(requestBody),
                Encoding.UTF8,
                "application/json"
            );

            var response = await client.PostAsync(url, content);

            if (!response.IsSuccessStatusCode)
                return new List<JsonElement>();

            var responseContent = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<JsonElement>(responseContent);

            if (!result.TryGetProperty("value", out var activityRuns))
                return new List<JsonElement>();

            return activityRuns.EnumerateArray().ToList();
        }
        catch
        {
            return new List<JsonElement>();
        }
    }

    private HttpClient CreateHttpClient(string? accessToken, Dictionary<string, string> config)
    {
        var client = _httpClientFactory.CreateClient();
        client.BaseAddress = new Uri("https://management.azure.com");

        // Autentica??o via cookies do browser
        if (config.ContainsKey("auth_type") && config["auth_type"] == "browser_cookies")
        {
            var cookieDomain = config.GetValueOrDefault("cookie_domain", "portal.azure.com");

            try
            {
                if (BrowserCookieHelper.TryGetCookieHeader(config, cookieDomain, out var cookieHeader, out var usedBrowser, out var errorMessage))
                {
                    client.DefaultRequestHeaders.Add("Cookie", cookieHeader);
                }
                else if (config.TryGetValue("cookie_header", out var fallbackCookieHeader) &&
                         !string.IsNullOrWhiteSpace(fallbackCookieHeader))
                {
                    Console.WriteLine($"Fallback to configured cookie_header because browser cookies failed: {errorMessage}");
                    client.DefaultRequestHeaders.Add("Cookie", fallbackCookieHeader);
                }
                else
                {
                    throw new InvalidOperationException($"Falha ao extrair cookies do browser {usedBrowser ?? "auto"}: {errorMessage}");
                }
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
        // Autentica??o OAuth2 com Bearer token
        else if (!string.IsNullOrEmpty(accessToken))
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        }

        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        return client;
    }

    private async Task<string> GetAccessTokenAsync(Dictionary<string, string> config)
    {
        // Se usa autentica??o via browser cookies, n?o precisa de token OAuth2
        if (config.ContainsKey("auth_type") && config["auth_type"] == "browser_cookies")
        {
            _useBrowserCookies = true;
            return string.Empty; // N?o precisa de token, vai usar cookies
        }

        // Se o token ainda ? v?lido, retorna o cached
        if (!string.IsNullOrEmpty(_cachedAccessToken) && DateTime.UtcNow < _tokenExpiresAt)
        {
            return _cachedAccessToken;
        }

        // Obter novo token usando Service Principal
        var client = _httpClientFactory.CreateClient();
        var tokenUrl = $"https://login.microsoftonline.com/{config["tenant_id"]}/oauth2/v2.0/token";

        var requestBody = new Dictionary<string, string>
        {
            { "grant_type", "client_credentials" },
            { "client_id", config["client_id"] },
            { "client_secret", config["client_secret"] },
            { "scope", "https://management.azure.com/.default" }
        };

        var content = new FormUrlEncodedContent(requestBody);
        var response = await client.PostAsync(tokenUrl, content);

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new Exception($"Failed to obtain access token: {errorContent}");
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        var tokenResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);

        _cachedAccessToken = tokenResponse.GetProperty("access_token").GetString() ?? "";
        var expiresIn = tokenResponse.GetProperty("expires_in").GetInt32();
        _tokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn - 300); // Renova 5 minutos antes

        return _cachedAccessToken;
    }

    private void ValidateConfig(Dictionary<string, string> config)
    {
        // Campos sempre obrigat?rios
        var alwaysRequired = new[] { "subscription_id", "resource_group", "factory_name" };

        foreach (var field in alwaysRequired)
        {
            if (!config.ContainsKey(field) || string.IsNullOrEmpty(config[field]))
                throw new ArgumentException($"Missing required config: {field}");
        }

        // Se n?o usa browser cookies, precisa de credenciais OAuth2
        var useBrowserAuth = config.ContainsKey("auth_type") && config["auth_type"] == "browser_cookies";

        if (!useBrowserAuth)
        {
            var oauth2Required = new[] { "tenant_id", "client_id", "client_secret" };

            foreach (var field in oauth2Required)
            {
                if (!config.ContainsKey(field) || string.IsNullOrEmpty(config[field]))
                    throw new ArgumentException($"Missing required config for OAuth2: {field}. Use auth_type=browser_cookies para autentica??o via browser.");
            }
        }
    }
}
