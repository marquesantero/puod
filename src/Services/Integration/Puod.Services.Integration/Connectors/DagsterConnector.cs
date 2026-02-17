using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Puod.Services.Integration.Connectors;

/// <summary>
/// Conector para Dagster usando GraphQL API.
/// Suporta: Jobs, Runs, Assets, Schedules, Sensors, Repositories.
/// Funciona com Dagster Cloud (token auth) e Dagster OSS (sem auth).
/// Documentação: https://docs.dagster.io/api/graphql
/// </summary>
public class DagsterConnector : IConnector
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<DagsterConnector> _logger;

    private const string DefaultBaseUrl = "http://localhost:3000";

    public DagsterConnector(
        IHttpClientFactory httpClientFactory,
        ILogger<DagsterConnector> logger)
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

            var result = await ExecuteGraphQLAsync("{ version }", config);

            if (result.TryGetProperty("data", out var data) &&
                data.TryGetProperty("version", out var version))
            {
                return new ConnectionResult
                {
                    Success = true,
                    Metadata = new Dictionary<string, object>
                    {
                        { "service", "Dagster" },
                        { "version", version.GetString() ?? "unknown" },
                        { "base_url", GetBaseUrl(config) },
                        { "tested_at", DateTime.UtcNow }
                    }
                };
            }

            // Check for errors in response
            var errorMessage = ExtractGraphQLError(result);
            return new ConnectionResult
            {
                Success = false,
                ErrorMessage = errorMessage ?? "Failed to retrieve Dagster version"
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

            var graphqlQuery = ResolveGraphQLQuery(query, config);

            _logger.LogDebug("Dagster query: {Query} -> GraphQL", query);

            var result = await ExecuteGraphQLAsync(graphqlQuery, config);
            stopwatch.Stop();

            // Check for GraphQL errors
            var errorMessage = ExtractGraphQLError(result);
            if (errorMessage != null)
            {
                return new QueryResult
                {
                    Success = false,
                    ErrorMessage = errorMessage,
                    ExecutionTime = stopwatch.Elapsed
                };
            }

            var rows = ParseGraphQLResponse(result, query);

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

            var graphql = @"
            {
                repositoriesOrError {
                    ... on RepositoryConnection {
                        nodes {
                            name
                            location { name }
                        }
                    }
                }
            }";

            var result = await ExecuteGraphQLAsync(graphql, config);

            var repositories = new List<string>();

            if (result.TryGetProperty("data", out var data) &&
                data.TryGetProperty("repositoriesOrError", out var reposOrError) &&
                reposOrError.TryGetProperty("nodes", out var nodes) &&
                nodes.ValueKind == JsonValueKind.Array)
            {
                foreach (var node in nodes.EnumerateArray())
                {
                    var repoName = node.TryGetProperty("name", out var name) ? name.GetString() : null;
                    var locName = "";
                    if (node.TryGetProperty("location", out var loc) &&
                        loc.TryGetProperty("name", out var ln))
                    {
                        locName = ln.GetString() ?? "";
                    }

                    if (!string.IsNullOrWhiteSpace(repoName))
                    {
                        repositories.Add(string.IsNullOrWhiteSpace(locName)
                            ? repoName
                            : $"{repoName}@{locName}");
                    }
                }
            }

            return repositories;
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

            // database format: "repoName" or "repoName@locationName"
            var (repoName, locationName) = ParseRepositorySelector(database);

            var graphql = $@"
            {{
                repositoryOrError(repositorySelector: {{
                    repositoryName: ""{EscapeGraphQLString(repoName)}""
                    repositoryLocationName: ""{EscapeGraphQLString(locationName)}""
                }}) {{
                    ... on Repository {{
                        jobs {{ name }}
                    }}
                }}
            }}";

            var result = await ExecuteGraphQLAsync(graphql, config);

            var jobs = new List<string>();

            if (result.TryGetProperty("data", out var data) &&
                data.TryGetProperty("repositoryOrError", out var repoOrError) &&
                repoOrError.TryGetProperty("jobs", out var jobsArray) &&
                jobsArray.ValueKind == JsonValueKind.Array)
            {
                foreach (var job in jobsArray.EnumerateArray())
                {
                    if (job.TryGetProperty("name", out var name))
                    {
                        var jobName = name.GetString();
                        if (!string.IsNullOrWhiteSpace(jobName))
                            jobs.Add(jobName);
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

    #region GraphQL Query Resolution

    private string ResolveGraphQLQuery(string query, Dictionary<string, string> config)
    {
        var queryLower = query.ToLowerInvariant().Trim();

        // Jobs / Pipelines
        if (queryLower == "jobs" || queryLower == "pipelines")
        {
            return @"
            {
                repositoriesOrError {
                    ... on RepositoryConnection {
                        nodes {
                            name
                            location { name }
                            jobs {
                                name
                                description
                                isJob
                            }
                        }
                    }
                }
            }";
        }

        // Runs
        if (queryLower == "runs")
        {
            var limit = config.TryGetValue("limit", out var l) && int.TryParse(l, out var lv) ? lv : 50;
            return $@"
            {{
                runsOrError(limit: {limit}) {{
                    ... on Runs {{
                        results {{
                            runId
                            jobName
                            status
                            startTime
                            endTime
                            runConfigYaml
                            tags {{ key value }}
                        }}
                    }}
                    ... on InvalidPipelineRunsFilterError {{
                        message
                    }}
                    ... on PythonError {{
                        message
                    }}
                }}
            }}";
        }

        // Specific run by ID
        if (queryLower.StartsWith("run/"))
        {
            var runId = query.Substring(4).Trim();
            return $@"
            {{
                runOrError(runId: ""{EscapeGraphQLString(runId)}"") {{
                    ... on Run {{
                        runId
                        jobName
                        status
                        startTime
                        endTime
                        runConfigYaml
                        tags {{ key value }}
                        stepStats {{
                            stepKey
                            status
                            startTime
                            endTime
                        }}
                    }}
                    ... on RunNotFoundError {{
                        message
                    }}
                    ... on PythonError {{
                        message
                    }}
                }}
            }}";
        }

        // Assets
        if (queryLower == "assets")
        {
            return @"
            {
                assetsOrError {
                    ... on AssetConnection {
                        nodes {
                            key { path }
                            definition {
                                description
                                computeKind
                                groupName
                            }
                        }
                    }
                }
            }";
        }

        // Schedules
        if (queryLower == "schedules")
        {
            return @"
            {
                schedulesOrError {
                    ... on Schedules {
                        results {
                            name
                            cronSchedule
                            scheduleState { status }
                            pipelineName
                        }
                    }
                }
            }";
        }

        // Sensors
        if (queryLower == "sensors")
        {
            return @"
            {
                sensorsOrError {
                    ... on Sensors {
                        results {
                            name
                            sensorType
                            sensorState { status }
                            targets { pipelineName }
                        }
                    }
                }
            }";
        }

        // Repositories
        if (queryLower == "repositories" || queryLower == "repos")
        {
            return @"
            {
                repositoriesOrError {
                    ... on RepositoryConnection {
                        nodes {
                            name
                            location { name }
                            jobs { name }
                            schedules { name }
                            sensors { name }
                        }
                    }
                }
            }";
        }

        // Instance status
        if (queryLower == "status" || queryLower == "instance")
        {
            return @"
            {
                instance {
                    info
                    runQueuingSupported
                    daemonHealth {
                        allDaemonStatuses {
                            daemonType
                            healthy
                            lastHeartbeatTime
                        }
                    }
                }
            }";
        }

        // Default: treat as raw GraphQL (read-only validation)
        return ValidateReadOnlyGraphQL(query);
    }

    #endregion

    #region Response Parsing

    private List<Dictionary<string, object>> ParseGraphQLResponse(JsonElement result, string query)
    {
        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("data", out var data))
        {
            return rows;
        }

        var queryLower = query.ToLowerInvariant().Trim();

        // Route parsing based on query type
        if (queryLower == "jobs" || queryLower == "pipelines")
        {
            return ParseRepositoryJobs(data);
        }

        if (queryLower == "runs")
        {
            return ParseRunsResponse(data);
        }

        if (queryLower.StartsWith("run/"))
        {
            return ParseSingleRunResponse(data);
        }

        if (queryLower == "assets")
        {
            return ParseAssetsResponse(data);
        }

        if (queryLower == "schedules")
        {
            return ParseSchedulesResponse(data);
        }

        if (queryLower == "sensors")
        {
            return ParseSensorsResponse(data);
        }

        if (queryLower == "repositories" || queryLower == "repos")
        {
            return ParseRepositoriesResponse(data);
        }

        // Generic: flatten top-level data
        return ParseGenericResponse(data);
    }

    private List<Dictionary<string, object>> ParseRepositoryJobs(JsonElement data)
    {
        var rows = new List<Dictionary<string, object>>();

        if (data.TryGetProperty("repositoriesOrError", out var reposOrError) &&
            reposOrError.TryGetProperty("nodes", out var nodes) &&
            nodes.ValueKind == JsonValueKind.Array)
        {
            foreach (var repo in nodes.EnumerateArray())
            {
                var repoName = repo.TryGetProperty("name", out var rn) ? rn.GetString() ?? "" : "";
                var locName = "";
                if (repo.TryGetProperty("location", out var loc) && loc.TryGetProperty("name", out var ln))
                    locName = ln.GetString() ?? "";

                if (repo.TryGetProperty("jobs", out var jobs) && jobs.ValueKind == JsonValueKind.Array)
                {
                    foreach (var job in jobs.EnumerateArray())
                    {
                        var row = new Dictionary<string, object>
                        {
                            { "repository", repoName },
                            { "location", locName }
                        };

                        foreach (var prop in job.EnumerateObject())
                        {
                            row[prop.Name] = ConvertJsonValue(prop.Value);
                        }

                        rows.Add(row);
                    }
                }
            }
        }

        return rows;
    }

    private List<Dictionary<string, object>> ParseRunsResponse(JsonElement data)
    {
        var rows = new List<Dictionary<string, object>>();

        if (data.TryGetProperty("runsOrError", out var runsOrError) &&
            runsOrError.TryGetProperty("results", out var results) &&
            results.ValueKind == JsonValueKind.Array)
        {
            foreach (var run in results.EnumerateArray())
            {
                rows.Add(ParseJsonElement(run));
            }
        }

        return rows;
    }

    private List<Dictionary<string, object>> ParseSingleRunResponse(JsonElement data)
    {
        var rows = new List<Dictionary<string, object>>();

        if (data.TryGetProperty("runOrError", out var runOrError))
        {
            if (runOrError.TryGetProperty("runId", out _))
            {
                rows.Add(ParseJsonElement(runOrError));
            }
            else if (runOrError.TryGetProperty("message", out var msg))
            {
                rows.Add(new Dictionary<string, object> { { "error", msg.GetString() ?? "Run not found" } });
            }
        }

        return rows;
    }

    private List<Dictionary<string, object>> ParseAssetsResponse(JsonElement data)
    {
        var rows = new List<Dictionary<string, object>>();

        if (data.TryGetProperty("assetsOrError", out var assetsOrError) &&
            assetsOrError.TryGetProperty("nodes", out var nodes) &&
            nodes.ValueKind == JsonValueKind.Array)
        {
            foreach (var asset in nodes.EnumerateArray())
            {
                var row = new Dictionary<string, object>();

                if (asset.TryGetProperty("key", out var key) &&
                    key.TryGetProperty("path", out var path))
                {
                    var pathParts = new List<string>();
                    foreach (var part in path.EnumerateArray())
                    {
                        pathParts.Add(part.GetString() ?? "");
                    }
                    row["asset_key"] = string.Join(".", pathParts);
                }

                if (asset.TryGetProperty("definition", out var def) &&
                    def.ValueKind == JsonValueKind.Object)
                {
                    foreach (var prop in def.EnumerateObject())
                    {
                        row[prop.Name] = ConvertJsonValue(prop.Value);
                    }
                }

                rows.Add(row);
            }
        }

        return rows;
    }

    private List<Dictionary<string, object>> ParseSchedulesResponse(JsonElement data)
    {
        var rows = new List<Dictionary<string, object>>();

        if (data.TryGetProperty("schedulesOrError", out var schedulesOrError) &&
            schedulesOrError.TryGetProperty("results", out var results) &&
            results.ValueKind == JsonValueKind.Array)
        {
            foreach (var schedule in results.EnumerateArray())
            {
                var row = new Dictionary<string, object>();

                if (schedule.TryGetProperty("name", out var name))
                    row["name"] = name.GetString() ?? "";
                if (schedule.TryGetProperty("cronSchedule", out var cron))
                    row["cronSchedule"] = cron.GetString() ?? "";
                if (schedule.TryGetProperty("pipelineName", out var pipeline))
                    row["pipelineName"] = pipeline.GetString() ?? "";
                if (schedule.TryGetProperty("scheduleState", out var state) &&
                    state.TryGetProperty("status", out var status))
                    row["status"] = status.GetString() ?? "";

                rows.Add(row);
            }
        }

        return rows;
    }

    private List<Dictionary<string, object>> ParseSensorsResponse(JsonElement data)
    {
        var rows = new List<Dictionary<string, object>>();

        if (data.TryGetProperty("sensorsOrError", out var sensorsOrError) &&
            sensorsOrError.TryGetProperty("results", out var results) &&
            results.ValueKind == JsonValueKind.Array)
        {
            foreach (var sensor in results.EnumerateArray())
            {
                var row = new Dictionary<string, object>();

                if (sensor.TryGetProperty("name", out var name))
                    row["name"] = name.GetString() ?? "";
                if (sensor.TryGetProperty("sensorType", out var stype))
                    row["sensorType"] = stype.GetString() ?? "";
                if (sensor.TryGetProperty("sensorState", out var state) &&
                    state.TryGetProperty("status", out var status))
                    row["status"] = status.GetString() ?? "";
                if (sensor.TryGetProperty("targets", out var targets) &&
                    targets.ValueKind == JsonValueKind.Array)
                {
                    var targetNames = new List<string>();
                    foreach (var t in targets.EnumerateArray())
                    {
                        if (t.TryGetProperty("pipelineName", out var pn))
                            targetNames.Add(pn.GetString() ?? "");
                    }
                    row["targets"] = string.Join(", ", targetNames);
                }

                rows.Add(row);
            }
        }

        return rows;
    }

    private List<Dictionary<string, object>> ParseRepositoriesResponse(JsonElement data)
    {
        var rows = new List<Dictionary<string, object>>();

        if (data.TryGetProperty("repositoriesOrError", out var reposOrError) &&
            reposOrError.TryGetProperty("nodes", out var nodes) &&
            nodes.ValueKind == JsonValueKind.Array)
        {
            foreach (var repo in nodes.EnumerateArray())
            {
                var row = new Dictionary<string, object>();

                if (repo.TryGetProperty("name", out var name))
                    row["name"] = name.GetString() ?? "";
                if (repo.TryGetProperty("location", out var loc) &&
                    loc.TryGetProperty("name", out var locName))
                    row["location"] = locName.GetString() ?? "";
                if (repo.TryGetProperty("jobs", out var jobs) && jobs.ValueKind == JsonValueKind.Array)
                    row["jobCount"] = jobs.GetArrayLength();
                if (repo.TryGetProperty("schedules", out var schedules) && schedules.ValueKind == JsonValueKind.Array)
                    row["scheduleCount"] = schedules.GetArrayLength();
                if (repo.TryGetProperty("sensors", out var sensors) && sensors.ValueKind == JsonValueKind.Array)
                    row["sensorCount"] = sensors.GetArrayLength();

                rows.Add(row);
            }
        }

        return rows;
    }

    private List<Dictionary<string, object>> ParseGenericResponse(JsonElement data)
    {
        var rows = new List<Dictionary<string, object>>();

        // Try to find an array in the response
        foreach (var prop in data.EnumerateObject())
        {
            var value = prop.Value;

            // Unwrap ...OrError pattern
            if (prop.Name.EndsWith("OrError") && value.ValueKind == JsonValueKind.Object)
            {
                // Look for results, nodes, or any array property
                foreach (var innerProp in value.EnumerateObject())
                {
                    if (innerProp.Value.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in innerProp.Value.EnumerateArray())
                        {
                            rows.Add(ParseJsonElement(item));
                        }
                        return rows;
                    }
                }

                // Single object result
                rows.Add(ParseJsonElement(value));
                return rows;
            }

            if (value.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in value.EnumerateArray())
                {
                    rows.Add(ParseJsonElement(item));
                }
                return rows;
            }
        }

        // Fallback: entire data as single row
        rows.Add(ParseJsonElement(data));
        return rows;
    }

    #endregion

    #region HTTP / GraphQL Execution

    private async Task<JsonElement> ExecuteGraphQLAsync(string query, Dictionary<string, string> config)
    {
        var client = CreateHttpClient(config);
        var graphqlEndpoint = GetGraphQLEndpoint(config);

        var requestBody = new { query = query };
        var jsonContent = new StringContent(
            JsonSerializer.Serialize(requestBody),
            Encoding.UTF8,
            "application/json");

        var response = await client.PostAsync(graphqlEndpoint, jsonContent);
        var responseContent = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException(
                $"Dagster GraphQL request failed: {response.StatusCode} - {Truncate(responseContent)}");
        }

        return JsonSerializer.Deserialize<JsonElement>(responseContent);
    }

    private HttpClient CreateHttpClient(Dictionary<string, string> config)
    {
        var client = _httpClientFactory.CreateClient();

        var baseUrl = GetBaseUrl(config);
        client.BaseAddress = new Uri(baseUrl);
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        // Dagster Cloud auth
        if (config.TryGetValue("api_token", out var token) && !string.IsNullOrWhiteSpace(token))
        {
            client.DefaultRequestHeaders.Add("Dagster-Cloud-Api-Token", token);
        }

        return client;
    }

    private string GetBaseUrl(Dictionary<string, string> config)
    {
        return config.TryGetValue("base_url", out var url) && !string.IsNullOrWhiteSpace(url)
            ? url.TrimEnd('/')
            : DefaultBaseUrl;
    }

    private string GetGraphQLEndpoint(Dictionary<string, string> config)
    {
        var deployment = config.TryGetValue("deployment", out var dep) && !string.IsNullOrWhiteSpace(dep)
            ? dep
            : null;

        // Dagster Cloud: /{deployment}/graphql
        if (deployment != null)
            return $"/{deployment}/graphql";

        // Dagster OSS: /graphql
        return "/graphql";
    }

    #endregion

    #region Helpers

    private void ValidateConfig(Dictionary<string, string> config)
    {
        if (!config.ContainsKey("base_url") || string.IsNullOrWhiteSpace(config["base_url"]))
            throw new ArgumentException("Missing required config: base_url");
    }

    private static string ValidateReadOnlyGraphQL(string query)
    {
        // Block mutations — only allow queries
        var trimmed = query.TrimStart();

        if (trimmed.StartsWith("mutation", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Mutations are not allowed. Only read-only GraphQL queries are supported.");
        }

        // Ensure it looks like a valid GraphQL query
        if (!trimmed.StartsWith("{") && !trimmed.StartsWith("query", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Invalid GraphQL query. Must start with '{{' or 'query'. Got: '{Truncate(trimmed, 50)}'");
        }

        return query;
    }

    private static string? ExtractGraphQLError(JsonElement result)
    {
        if (result.TryGetProperty("errors", out var errors) &&
            errors.ValueKind == JsonValueKind.Array &&
            errors.GetArrayLength() > 0)
        {
            var firstError = errors[0];
            if (firstError.TryGetProperty("message", out var msg))
            {
                return $"GraphQL error: {msg.GetString()}";
            }
            return "Unknown GraphQL error";
        }

        return null;
    }

    private static (string repoName, string locationName) ParseRepositorySelector(string database)
    {
        // Support format "repoName@locationName"
        var atIndex = database.IndexOf('@');
        if (atIndex > 0)
        {
            return (database[..atIndex].Trim(), database[(atIndex + 1)..].Trim());
        }

        return (database.Trim(), database.Trim());
    }

    private static string EscapeGraphQLString(string value)
    {
        return value
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\n", "\\n")
            .Replace("\r", "\\r");
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

    private static string Truncate(string text, int maxLength = 500)
    {
        return text.Length <= maxLength ? text : text[..maxLength] + "...";
    }

    #endregion
}
