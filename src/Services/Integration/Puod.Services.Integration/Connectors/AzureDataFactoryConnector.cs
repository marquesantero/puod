using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Puod.Shared.Common.Authentication;
using Puod.Services.Integration.Models;

namespace Puod.Services.Integration.Connectors;

/// <summary>
/// Conector para Azure Data Factory usando Management REST API.
/// Suporta: Pipelines, Pipeline Runs, Activity Runs, Trigger Runs, Datasets, Linked Services, Data Flows, Triggers.
/// Documentação: https://learn.microsoft.com/en-us/rest/api/datafactory/
/// </summary>
public class AzureDataFactoryConnector : IConnector
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AzureDataFactoryConnector> _logger;
    private string? _cachedAccessToken;
    private DateTime _tokenExpiresAt = DateTime.MinValue;

    private const string ApiVersion = "2018-06-01";
    private const string BaseUrl = "https://management.azure.com";

    /// <summary>
    /// Tipos de query suportados (read-only).
    /// O "query" do ExecuteQueryAsync é interpretado como um desses recursos.
    /// </summary>
    private static readonly HashSet<string> SupportedQueryTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "pipelines", "pipelineRuns", "pipeline_runs", "runs",
        "activityRuns", "activity_runs",
        "triggerRuns", "trigger_runs",
        "triggers",
        "datasets",
        "linkedServices", "linked_services",
        "dataFlows", "data_flows",
        "integrationRuntimes", "integration_runtimes",
        "managedVirtualNetworks", "managed_virtual_networks"
    };

    public AzureDataFactoryConnector(
        IHttpClientFactory httpClientFactory,
        ILogger<AzureDataFactoryConnector> logger)
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

            var client = await CreateAuthenticatedClientAsync(config);

            // Testar conectividade buscando info do factory
            var factoryUrl = BuildFactoryUrl(config);
            var response = await client.GetAsync($"{factoryUrl}?api-version={ApiVersion}");

            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var factory = JsonSerializer.Deserialize<JsonElement>(content);

                // Contar pipelines
                var pipelines = await ListPipelinesAsync(config);

                var metadata = new Dictionary<string, object>
                {
                    { "subscription_id", config["subscription_id"] },
                    { "resource_group", config["resource_group"] },
                    { "factory_name", config["factory_name"] },
                    { "pipeline_count", pipelines.Count },
                    { "provisioning_state", GetJsonString(factory, "properties", "provisioningState") },
                    { "location", GetJsonString(factory, "location") },
                    { "tested_at", DateTime.UtcNow }
                };

                if (factory.TryGetProperty("identity", out var identity))
                {
                    metadata["identity_type"] = GetJsonString(identity, "type");
                }

                return new ConnectionResult
                {
                    Success = true,
                    Metadata = metadata
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

            var client = await CreateAuthenticatedClientAsync(config);
            var normalizedQuery = query?.Trim() ?? string.Empty;
            var queryType = DetermineQueryType(normalizedQuery);

            _logger.LogInformation("Executing ADF query. Type: {QueryType}, Query: {Query}", queryType, Truncate(normalizedQuery, 200));

            List<Dictionary<string, object>> rows;

            switch (queryType)
            {
                case AdfQueryType.PipelineRuns:
                    rows = await QueryPipelineRunsAsync(normalizedQuery, config, client);
                    break;

                case AdfQueryType.ActivityRuns:
                    rows = await QueryActivityRunsAsync(normalizedQuery, config, client);
                    break;

                case AdfQueryType.TriggerRuns:
                    rows = await QueryTriggerRunsAsync(normalizedQuery, config, client);
                    break;

                case AdfQueryType.Pipelines:
                    rows = await QueryPipelinesListAsync(config, client);
                    break;

                case AdfQueryType.Triggers:
                    rows = await QueryTriggersListAsync(config, client);
                    break;

                case AdfQueryType.Datasets:
                    rows = await QueryDatasetsListAsync(config, client);
                    break;

                case AdfQueryType.LinkedServices:
                    rows = await QueryLinkedServicesListAsync(config, client);
                    break;

                case AdfQueryType.DataFlows:
                    rows = await QueryDataFlowsListAsync(config, client);
                    break;

                case AdfQueryType.IntegrationRuntimes:
                    rows = await QueryIntegrationRuntimesListAsync(config, client);
                    break;

                default:
                    stopwatch.Stop();
                    return new QueryResult
                    {
                        Success = false,
                        ErrorMessage = $"Unsupported query: '{Truncate(normalizedQuery, 200)}'. " +
                            "Supported types: pipelineRuns (default), activityRuns/<runId>, triggerRuns, " +
                            "pipelines, triggers, datasets, linkedServices, dataFlows, integrationRuntimes. " +
                            "You can also pass a pipeline name to query its runs.",
                        ExecutionTime = stopwatch.Elapsed
                    };
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
            _logger.LogError(ex, "Error executing ADF query: {Query}", Truncate(query ?? "", 200));

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
            return pipelines
                .Select(p => GetJsonString(p, "name"))
                .Where(n => !string.IsNullOrEmpty(n))
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error listing ADF pipelines");
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
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error listing ADF activities for pipeline {Pipeline}", database);
            return new List<string>();
        }
    }

    #endregion

    #region Pipeline Runs

    /// <summary>
    /// Query pipeline runs com filtros opcionais.
    /// Query pode ser: "pipelineRuns", "pipeline_runs", "runs", ou um nome de pipeline para filtrar.
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryPipelineRunsAsync(
        string query,
        Dictionary<string, string> config,
        HttpClient client)
    {
        var settings = DataSourceSettingsHelper.ParseSettings<AdfDataSourceSettings>(
            config.GetValueOrDefault("dataSourceJson", null));

        // Extrair nome do pipeline do query se não for um tipo genérico
        string? pipelineName = null;
        var lowerQuery = query.ToLowerInvariant().Trim();

        if (!string.IsNullOrWhiteSpace(query) &&
            !lowerQuery.Equals("pipelineruns") && !lowerQuery.Equals("pipeline_runs") &&
            !lowerQuery.Equals("runs") && !lowerQuery.StartsWith("pipelineruns/") &&
            !lowerQuery.StartsWith("pipeline_runs/"))
        {
            pipelineName = query.Trim();
        }

        // Se o parâmetro contém "/" pode ser "pipelineRuns/<pipelineName>"
        if (lowerQuery.StartsWith("pipelineruns/") || lowerQuery.StartsWith("pipeline_runs/"))
        {
            pipelineName = query.Split('/').Last().Trim();
            if (string.IsNullOrWhiteSpace(pipelineName))
                pipelineName = null;
        }

        // Usar nomes do settings se disponível
        if (pipelineName == null && settings?.PipelineNames != null && settings.PipelineNames.Count == 1)
        {
            pipelineName = settings.PipelineNames.First();
        }

        var runs = await ListPipelineRunsAsync(pipelineName, config, client: client);

        var rows = runs.Select(run => new Dictionary<string, object>
        {
            { "run_id", GetJsonString(run, "runId") },
            { "pipeline_name", GetJsonString(run, "pipelineName") },
            { "status", GetJsonString(run, "status") },
            { "run_start", GetJsonString(run, "runStart") },
            { "run_end", GetJsonString(run, "runEnd") },
            { "duration_in_ms", GetJsonLong(run, "durationInMs") },
            { "run_group_id", GetJsonString(run, "runGroupId") },
            { "invoked_by_name", run.TryGetProperty("invokedBy", out var inv) ? GetJsonString(inv, "name") : "" },
            { "invoked_by_type", run.TryGetProperty("invokedBy", out var inv2) ? GetJsonString(inv2, "invokedByType") : "" },
            { "is_latest", run.TryGetProperty("isLatest", out var il) && il.ValueKind == JsonValueKind.True },
            { "last_updated", GetJsonString(run, "lastUpdated") },
            { "message", GetJsonString(run, "message") }
        }).ToList();

        return rows;
    }

    /// <summary>
    /// Lista execuções de pipeline com filtros
    /// </summary>
    public async Task<List<JsonElement>> ListPipelineRunsAsync(
        string? pipelineName,
        Dictionary<string, string> config,
        DateTime? lastUpdatedAfter = null,
        DateTime? lastUpdatedBefore = null,
        HttpClient? client = null)
    {
        try
        {
            ValidateConfig(config);

            client ??= await CreateAuthenticatedClientAsync(config);

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
                    },
                    orderBy = new[]
                    {
                        new { orderBy = "RunStart", order = "DESC" }
                    }
                };
            }
            else
            {
                requestBody = new
                {
                    lastUpdatedAfter = startTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                    lastUpdatedBefore = endTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                    filters = Array.Empty<object>(),
                    orderBy = new[]
                    {
                        new { orderBy = "RunStart", order = "DESC" }
                    }
                };
            }

            var url = $"{BuildFactoryUrl(config)}/queryPipelineRuns?api-version={ApiVersion}";

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

            var result = JsonSerializer.Deserialize<JsonElement>(responseContent);

            if (!result.TryGetProperty("value", out var runs))
            {
                throw new InvalidOperationException(
                    $"ADF queryPipelineRuns response missing 'value'. Body={Truncate(responseContent)}");
            }

            return runs.EnumerateArray().ToList();
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            var pipelineInfo = string.IsNullOrWhiteSpace(pipelineName) ? "all pipelines" : $"pipeline '{pipelineName}'";
            throw new InvalidOperationException(
                $"ADF queryPipelineRuns failed for {pipelineInfo}. {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Busca detalhes de uma execução de pipeline
    /// </summary>
    public async Task<JsonElement?> GetPipelineRunAsync(string runId, Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var client = await CreateAuthenticatedClientAsync(config);
            var url = $"{BuildFactoryUrl(config)}/pipelineruns/{runId}?api-version={ApiVersion}";

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

    #endregion

    #region Activity Runs

    /// <summary>
    /// Query activity runs para um pipeline run específico.
    /// Query format: "activityRuns/<runId>" ou "activity_runs/<runId>"
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryActivityRunsAsync(
        string query,
        Dictionary<string, string> config,
        HttpClient client)
    {
        // Extrair runId do query
        var runId = ExtractParameterFromQuery(query, new[] { "activityRuns", "activity_runs" });

        if (string.IsNullOrWhiteSpace(runId))
        {
            throw new InvalidOperationException(
                "Activity runs query requires a pipeline run ID. Format: 'activityRuns/<runId>' or 'activity_runs/<runId>'");
        }

        var activityRuns = await GetActivityRunsAsync(runId, config, client: client);

        return activityRuns.Select(ar => new Dictionary<string, object>
        {
            { "activity_name", GetJsonString(ar, "activityName") },
            { "activity_type", GetJsonString(ar, "activityType") },
            { "status", GetJsonString(ar, "status") },
            { "activity_run_start", GetJsonString(ar, "activityRunStart") },
            { "activity_run_end", GetJsonString(ar, "activityRunEnd") },
            { "duration_in_ms", GetJsonLong(ar, "durationInMs") },
            { "pipeline_name", GetJsonString(ar, "pipelineName") },
            { "pipeline_run_id", GetJsonString(ar, "pipelineRunId") },
            { "activity_run_id", GetJsonString(ar, "activityRunId") },
            { "linked_service_name", GetJsonString(ar, "linkedServiceName") },
            { "input", ar.TryGetProperty("input", out var inp) ? inp.ToString() : "" },
            { "output", ar.TryGetProperty("output", out var outp) ? Truncate(outp.ToString(), 500) : "" },
            { "error", ar.TryGetProperty("error", out var err) ? Truncate(err.ToString(), 500) : "" }
        }).ToList();
    }

    /// <summary>
    /// Busca activity runs de uma execução de pipeline
    /// </summary>
    public async Task<List<JsonElement>> GetActivityRunsAsync(
        string runId,
        Dictionary<string, string> config,
        DateTime? runStartAfter = null,
        DateTime? runStartBefore = null,
        HttpClient? client = null)
    {
        try
        {
            ValidateConfig(config);

            client ??= await CreateAuthenticatedClientAsync(config);

            var startTime = runStartAfter ?? DateTime.UtcNow.AddDays(-7);
            var endTime = runStartBefore ?? DateTime.UtcNow;

            var requestBody = new
            {
                lastUpdatedAfter = startTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                lastUpdatedBefore = endTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            };

            var url = $"{BuildFactoryUrl(config)}/pipelineruns/{runId}/queryActivityruns?api-version={ApiVersion}";

            var content = new StringContent(
                JsonSerializer.Serialize(requestBody),
                Encoding.UTF8,
                "application/json"
            );

            var response = await client.PostAsync(url, content);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                throw new InvalidOperationException(
                    $"ADF queryActivityRuns failed for run {runId}. Status={response.StatusCode}. Body={Truncate(errorBody)}");
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<JsonElement>(responseContent);

            if (!result.TryGetProperty("value", out var activityRuns))
                return new List<JsonElement>();

            return activityRuns.EnumerateArray().ToList();
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            throw new InvalidOperationException(
                $"ADF queryActivityRuns failed for run {runId}. {ex.Message}", ex);
        }
    }

    #endregion

    #region Trigger Runs

    /// <summary>
    /// Query trigger runs do Data Factory
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryTriggerRunsAsync(
        string query,
        Dictionary<string, string> config,
        HttpClient client)
    {
        var startTime = DateTime.UtcNow.AddDays(-7);
        var endTime = DateTime.UtcNow;

        // Extrair trigger name se especificado
        string? triggerName = ExtractParameterFromQuery(query, new[] { "triggerRuns", "trigger_runs" });

        object requestBody;
        if (!string.IsNullOrWhiteSpace(triggerName))
        {
            requestBody = new
            {
                lastUpdatedAfter = startTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                lastUpdatedBefore = endTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                filters = new[]
                {
                    new
                    {
                        operand = "TriggerName",
                        @operator = "Equals",
                        values = new[] { triggerName }
                    }
                },
                orderBy = new[]
                {
                    new { orderBy = "TriggerRunTimestamp", order = "DESC" }
                }
            };
        }
        else
        {
            requestBody = new
            {
                lastUpdatedAfter = startTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                lastUpdatedBefore = endTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                filters = Array.Empty<object>(),
                orderBy = new[]
                {
                    new { orderBy = "TriggerRunTimestamp", order = "DESC" }
                }
            };
        }

        var url = $"{BuildFactoryUrl(config)}/queryTriggerRuns?api-version={ApiVersion}";

        var content = new StringContent(
            JsonSerializer.Serialize(requestBody),
            Encoding.UTF8,
            "application/json"
        );

        var response = await client.PostAsync(url, content);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"ADF queryTriggerRuns failed. Status={response.StatusCode}. Body={Truncate(errorBody)}");
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(responseContent);

        if (!result.TryGetProperty("value", out var triggerRuns))
            return new List<Dictionary<string, object>>();

        return triggerRuns.EnumerateArray().Select(tr => new Dictionary<string, object>
        {
            { "trigger_run_id", GetJsonString(tr, "triggerRunId") },
            { "trigger_name", GetJsonString(tr, "triggerName") },
            { "trigger_type", GetJsonString(tr, "triggerType") },
            { "status", GetJsonString(tr, "status") },
            { "trigger_run_timestamp", GetJsonString(tr, "triggerRunTimestamp") },
            { "message", GetJsonString(tr, "message") },
            { "triggered_pipelines", tr.TryGetProperty("triggeredPipelines", out var tp) ? tp.ToString() : "" }
        }).ToList();
    }

    #endregion

    #region Pipelines

    /// <summary>
    /// Lista pipelines com detalhes completos
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryPipelinesListAsync(
        Dictionary<string, string> config,
        HttpClient client)
    {
        var pipelines = await ListPipelinesInternalAsync(config, client);

        return pipelines.Select(p =>
        {
            var row = new Dictionary<string, object>
            {
                { "name", GetJsonString(p, "name") },
                { "type", GetJsonString(p, "type") },
                { "etag", GetJsonString(p, "etag") }
            };

            if (p.TryGetProperty("properties", out var props))
            {
                if (props.TryGetProperty("activities", out var activities))
                {
                    row["activity_count"] = activities.GetArrayLength();

                    // Listar nomes das atividades
                    var activityNames = new List<string>();
                    foreach (var a in activities.EnumerateArray())
                    {
                        if (a.TryGetProperty("name", out var actName))
                            activityNames.Add(actName.GetString() ?? "");
                    }
                    row["activity_names"] = string.Join(", ", activityNames);
                }

                if (props.TryGetProperty("parameters", out var parameters))
                {
                    var paramNames = new List<string>();
                    foreach (var param in parameters.EnumerateObject())
                    {
                        paramNames.Add(param.Name);
                    }
                    row["parameters"] = string.Join(", ", paramNames);
                }

                row["description"] = props.TryGetProperty("description", out var desc) ? desc.GetString() ?? "" : "";

                if (props.TryGetProperty("folder", out var folder))
                {
                    row["folder"] = GetJsonString(folder, "name");
                }
            }

            return row;
        }).ToList();
    }

    /// <summary>
    /// Lista pipelines do Data Factory (raw JSON)
    /// </summary>
    private async Task<List<JsonElement>> ListPipelinesInternalAsync(Dictionary<string, string> config, HttpClient client)
    {
        var url = $"{BuildFactoryUrl(config)}/pipelines?api-version={ApiVersion}";

        var response = await client.GetAsync(url);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"ADF pipelines list failed. Status={response.StatusCode}. Body={Truncate(errorBody)}");
        }

        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        if (!result.TryGetProperty("value", out var pipelines))
            return new List<JsonElement>();

        return pipelines.EnumerateArray().ToList();
    }

    /// <summary>
    /// Lista pipelines (versão pública que cria seu próprio client)
    /// </summary>
    private async Task<List<JsonElement>> ListPipelinesAsync(Dictionary<string, string> config)
    {
        ValidateConfig(config);
        var client = await CreateAuthenticatedClientAsync(config);
        return await ListPipelinesInternalAsync(config, client);
    }

    /// <summary>
    /// Busca detalhes de um pipeline específico
    /// </summary>
    private async Task<JsonElement?> GetPipelineAsync(string pipelineName, Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var client = await CreateAuthenticatedClientAsync(config);
            var url = $"{BuildFactoryUrl(config)}/pipelines/{Uri.EscapeDataString(pipelineName)}?api-version={ApiVersion}";

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

    #endregion

    #region Triggers

    /// <summary>
    /// Lista triggers do Data Factory
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryTriggersListAsync(
        Dictionary<string, string> config,
        HttpClient client)
    {
        var url = $"{BuildFactoryUrl(config)}/triggers?api-version={ApiVersion}";

        var response = await client.GetAsync(url);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"ADF triggers list failed. Status={response.StatusCode}. Body={Truncate(errorBody)}");
        }

        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        if (!result.TryGetProperty("value", out var triggers))
            return new List<Dictionary<string, object>>();

        return triggers.EnumerateArray().Select(t =>
        {
            var row = new Dictionary<string, object>
            {
                { "name", GetJsonString(t, "name") },
                { "type", GetJsonString(t, "type") },
                { "etag", GetJsonString(t, "etag") }
            };

            if (t.TryGetProperty("properties", out var props))
            {
                row["runtime_state"] = GetJsonString(props, "runtimeState");
                row["description"] = GetJsonString(props, "description");
                row["trigger_type"] = GetJsonString(props, "type");

                if (props.TryGetProperty("typeProperties", out var tp))
                {
                    if (tp.TryGetProperty("recurrence", out var recurrence))
                    {
                        row["frequency"] = GetJsonString(recurrence, "frequency");
                        row["interval"] = GetJsonLong(recurrence, "interval");
                        row["start_time"] = GetJsonString(recurrence, "startTime");
                        row["end_time"] = GetJsonString(recurrence, "endTime");
                        row["time_zone"] = GetJsonString(recurrence, "timeZone");
                    }
                }

                if (props.TryGetProperty("pipelines", out var pipelines))
                {
                    var pipelineNames = new List<string>();
                    foreach (var p in pipelines.EnumerateArray())
                    {
                        if (p.TryGetProperty("pipelineReference", out var pRef))
                            pipelineNames.Add(GetJsonString(pRef, "referenceName"));
                    }
                    row["pipelines"] = string.Join(", ", pipelineNames);
                }
            }

            return row;
        }).ToList();
    }

    #endregion

    #region Datasets

    /// <summary>
    /// Lista datasets do Data Factory
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryDatasetsListAsync(
        Dictionary<string, string> config,
        HttpClient client)
    {
        var url = $"{BuildFactoryUrl(config)}/datasets?api-version={ApiVersion}";

        var response = await client.GetAsync(url);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"ADF datasets list failed. Status={response.StatusCode}. Body={Truncate(errorBody)}");
        }

        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        if (!result.TryGetProperty("value", out var datasets))
            return new List<Dictionary<string, object>>();

        return datasets.EnumerateArray().Select(ds =>
        {
            var row = new Dictionary<string, object>
            {
                { "name", GetJsonString(ds, "name") },
                { "type", GetJsonString(ds, "type") },
                { "etag", GetJsonString(ds, "etag") }
            };

            if (ds.TryGetProperty("properties", out var props))
            {
                row["dataset_type"] = GetJsonString(props, "type");
                row["description"] = GetJsonString(props, "description");

                if (props.TryGetProperty("linkedServiceName", out var ls))
                {
                    row["linked_service"] = GetJsonString(ls, "referenceName");
                }

                if (props.TryGetProperty("typeProperties", out var tp))
                {
                    row["type_properties"] = Truncate(tp.ToString(), 500);
                }

                if (props.TryGetProperty("schema", out var schema))
                {
                    row["column_count"] = schema.ValueKind == JsonValueKind.Array ? schema.GetArrayLength() : 0;
                }

                if (props.TryGetProperty("folder", out var folder))
                {
                    row["folder"] = GetJsonString(folder, "name");
                }
            }

            return row;
        }).ToList();
    }

    #endregion

    #region Linked Services

    /// <summary>
    /// Lista linked services do Data Factory
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryLinkedServicesListAsync(
        Dictionary<string, string> config,
        HttpClient client)
    {
        var url = $"{BuildFactoryUrl(config)}/linkedservices?api-version={ApiVersion}";

        var response = await client.GetAsync(url);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"ADF linked services list failed. Status={response.StatusCode}. Body={Truncate(errorBody)}");
        }

        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        if (!result.TryGetProperty("value", out var linkedServices))
            return new List<Dictionary<string, object>>();

        return linkedServices.EnumerateArray().Select(ls =>
        {
            var row = new Dictionary<string, object>
            {
                { "name", GetJsonString(ls, "name") },
                { "type", GetJsonString(ls, "type") },
                { "etag", GetJsonString(ls, "etag") }
            };

            if (ls.TryGetProperty("properties", out var props))
            {
                row["service_type"] = GetJsonString(props, "type");
                row["description"] = GetJsonString(props, "description");

                if (props.TryGetProperty("typeProperties", out var tp))
                {
                    // Extrair URL de conexão se disponível (sem expor secrets)
                    if (tp.TryGetProperty("url", out var url2))
                        row["url"] = url2.GetString() ?? "";
                    else if (tp.TryGetProperty("connectionString", out _))
                        row["has_connection_string"] = true;
                    else if (tp.TryGetProperty("endpoint", out var ep))
                        row["endpoint"] = ep.GetString() ?? "";
                }

                if (props.TryGetProperty("connectVia", out var connectVia))
                {
                    row["integration_runtime"] = GetJsonString(connectVia, "referenceName");
                }
            }

            return row;
        }).ToList();
    }

    #endregion

    #region Data Flows

    /// <summary>
    /// Lista data flows do Data Factory
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryDataFlowsListAsync(
        Dictionary<string, string> config,
        HttpClient client)
    {
        var url = $"{BuildFactoryUrl(config)}/dataflows?api-version={ApiVersion}";

        var response = await client.GetAsync(url);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"ADF data flows list failed. Status={response.StatusCode}. Body={Truncate(errorBody)}");
        }

        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        if (!result.TryGetProperty("value", out var dataFlows))
            return new List<Dictionary<string, object>>();

        return dataFlows.EnumerateArray().Select(df =>
        {
            var row = new Dictionary<string, object>
            {
                { "name", GetJsonString(df, "name") },
                { "type", GetJsonString(df, "type") },
                { "etag", GetJsonString(df, "etag") }
            };

            if (df.TryGetProperty("properties", out var props))
            {
                row["flow_type"] = GetJsonString(props, "type");
                row["description"] = GetJsonString(props, "description");

                if (props.TryGetProperty("typeProperties", out var tp))
                {
                    if (tp.TryGetProperty("sources", out var sources))
                    {
                        var sourceNames = new List<string>();
                        foreach (var s in sources.EnumerateArray())
                        {
                            if (s.TryGetProperty("name", out var sName))
                                sourceNames.Add(sName.GetString() ?? "");
                        }
                        row["sources"] = string.Join(", ", sourceNames);
                        row["source_count"] = sourceNames.Count;
                    }

                    if (tp.TryGetProperty("sinks", out var sinks))
                    {
                        var sinkNames = new List<string>();
                        foreach (var s in sinks.EnumerateArray())
                        {
                            if (s.TryGetProperty("name", out var sName))
                                sinkNames.Add(sName.GetString() ?? "");
                        }
                        row["sinks"] = string.Join(", ", sinkNames);
                        row["sink_count"] = sinkNames.Count;
                    }

                    if (tp.TryGetProperty("transformations", out var transformations))
                    {
                        row["transformation_count"] = transformations.GetArrayLength();
                    }
                }

                if (props.TryGetProperty("folder", out var folder))
                {
                    row["folder"] = GetJsonString(folder, "name");
                }
            }

            return row;
        }).ToList();
    }

    #endregion

    #region Integration Runtimes

    /// <summary>
    /// Lista integration runtimes do Data Factory
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryIntegrationRuntimesListAsync(
        Dictionary<string, string> config,
        HttpClient client)
    {
        var url = $"{BuildFactoryUrl(config)}/integrationRuntimes?api-version={ApiVersion}";

        var response = await client.GetAsync(url);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"ADF integration runtimes list failed. Status={response.StatusCode}. Body={Truncate(errorBody)}");
        }

        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        if (!result.TryGetProperty("value", out var runtimes))
            return new List<Dictionary<string, object>>();

        return runtimes.EnumerateArray().Select(ir =>
        {
            var row = new Dictionary<string, object>
            {
                { "name", GetJsonString(ir, "name") },
                { "type", GetJsonString(ir, "type") },
                { "etag", GetJsonString(ir, "etag") }
            };

            if (ir.TryGetProperty("properties", out var props))
            {
                row["runtime_type"] = GetJsonString(props, "type");
                row["description"] = GetJsonString(props, "description");
                row["state"] = GetJsonString(props, "state");

                if (props.TryGetProperty("typeProperties", out var tp))
                {
                    if (tp.TryGetProperty("computeProperties", out var compute))
                    {
                        row["location"] = GetJsonString(compute, "location");
                        row["data_flow_core_count"] = GetJsonLong(compute, "dataFlowProperties.coreCount");
                    }
                }
            }

            return row;
        }).ToList();
    }

    #endregion

    #region HTTP Client & Auth

    /// <summary>
    /// Cria HttpClient já autenticado
    /// </summary>
    private async Task<HttpClient> CreateAuthenticatedClientAsync(Dictionary<string, string> config)
    {
        var client = _httpClientFactory.CreateClient();
        client.BaseAddress = new Uri(BaseUrl);
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        client.DefaultRequestHeaders.UserAgent.ParseAdd("PUOD-ADF-Connector/1.0");

        // 1. Browser cookies
        if (config.TryGetValue("auth_type", out var authType) && authType == "browser_cookies")
        {
            var cookieDomain = config.GetValueOrDefault("cookie_domain", "portal.azure.com");

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
                    _logger.LogWarning("Fallback to configured cookie_header because browser cookies failed: {Error}", errorMessage);
                    client.DefaultRequestHeaders.Add("Cookie", fallbackCookieHeader);
                    return client;
                }

                throw new InvalidOperationException(
                    $"Failed to extract browser cookies for {usedBrowser ?? "auto"}: {errorMessage}");
            }
            catch (Exception ex) when (ex is not InvalidOperationException)
            {
                throw new InvalidOperationException($"Failed to extract browser cookies: {ex.Message}", ex);
            }
        }

        // 2. Cookie header direto
        if (config.TryGetValue("cookie_header", out var rawCookieHeader) &&
            !string.IsNullOrWhiteSpace(rawCookieHeader))
        {
            client.DefaultRequestHeaders.Add("Cookie", rawCookieHeader);
            return client;
        }

        // 3. OAuth2 Service Principal
        var token = await GetAccessTokenAsync(config);
        if (!string.IsNullOrEmpty(token))
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return client;
        }

        throw new InvalidOperationException("No valid authentication method found.");
    }

    /// <summary>
    /// Obtém token de acesso usando Service Principal (client_credentials)
    /// </summary>
    private async Task<string> GetAccessTokenAsync(Dictionary<string, string> config)
    {
        // Se usa autenticação via browser cookies, não precisa de token OAuth2
        if (config.TryGetValue("auth_type", out var authType) && authType == "browser_cookies")
        {
            return string.Empty;
        }

        // Se o token ainda é válido, retorna o cached
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
            throw new InvalidOperationException($"Failed to obtain access token: {Truncate(errorContent)}");
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        var tokenResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);

        _cachedAccessToken = tokenResponse.GetProperty("access_token").GetString() ?? "";
        var expiresIn = tokenResponse.GetProperty("expires_in").GetInt32();
        _tokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn - 300); // Renova 5 minutos antes

        return _cachedAccessToken;
    }

    #endregion

    #region Helpers

    private void ValidateConfig(Dictionary<string, string> config)
    {
        // Campos sempre obrigatórios
        var alwaysRequired = new[] { "subscription_id", "resource_group", "factory_name" };

        foreach (var field in alwaysRequired)
        {
            if (!config.ContainsKey(field) || string.IsNullOrEmpty(config[field]))
                throw new ArgumentException($"Missing required config: {field}");
        }

        // Se não usa browser cookies, precisa de credenciais OAuth2
        var useBrowserAuth = config.TryGetValue("auth_type", out var authType) && authType == "browser_cookies";
        var hasCookieHeader = config.ContainsKey("cookie_header") && !string.IsNullOrWhiteSpace(config["cookie_header"]);

        if (!useBrowserAuth && !hasCookieHeader)
        {
            var oauth2Required = new[] { "tenant_id", "client_id", "client_secret" };

            foreach (var field in oauth2Required)
            {
                if (!config.ContainsKey(field) || string.IsNullOrEmpty(config[field]))
                    throw new ArgumentException(
                        $"Missing required config for OAuth2: {field}. Use auth_type=browser_cookies for browser authentication.");
            }
        }
    }

    private AdfQueryType DetermineQueryType(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return AdfQueryType.PipelineRuns; // Default

        var lowerQuery = query.ToLowerInvariant().Trim();

        // Pipeline Runs (default)
        if (lowerQuery == "pipelineruns" || lowerQuery == "pipeline_runs" || lowerQuery == "runs")
            return AdfQueryType.PipelineRuns;

        // Pipeline Runs por nome de pipeline
        if (lowerQuery.StartsWith("pipelineruns/") || lowerQuery.StartsWith("pipeline_runs/"))
            return AdfQueryType.PipelineRuns;

        // Activity Runs
        if (lowerQuery.StartsWith("activityruns") || lowerQuery.StartsWith("activity_runs"))
            return AdfQueryType.ActivityRuns;

        // Trigger Runs
        if (lowerQuery.StartsWith("triggerruns") || lowerQuery.StartsWith("trigger_runs"))
            return AdfQueryType.TriggerRuns;

        // Pipelines
        if (lowerQuery == "pipelines")
            return AdfQueryType.Pipelines;

        // Triggers
        if (lowerQuery == "triggers")
            return AdfQueryType.Triggers;

        // Datasets
        if (lowerQuery == "datasets")
            return AdfQueryType.Datasets;

        // Linked Services
        if (lowerQuery == "linkedservices" || lowerQuery == "linked_services")
            return AdfQueryType.LinkedServices;

        // Data Flows
        if (lowerQuery == "dataflows" || lowerQuery == "data_flows")
            return AdfQueryType.DataFlows;

        // Integration Runtimes
        if (lowerQuery == "integrationruntimes" || lowerQuery == "integration_runtimes")
            return AdfQueryType.IntegrationRuntimes;

        // Se não é um tipo reconhecido, trata como nome de pipeline para buscar runs
        return AdfQueryType.PipelineRuns;
    }

    private static string BuildFactoryUrl(Dictionary<string, string> config)
    {
        return $"/subscriptions/{config["subscription_id"]}/resourceGroups/{config["resource_group"]}" +
               $"/providers/Microsoft.DataFactory/factories/{config["factory_name"]}";
    }

    private static string Truncate(string value, int maxLength = 800)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
            return value;

        return value[..maxLength] + "...";
    }

    private static string GetJsonString(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var prop) && prop.ValueKind == JsonValueKind.String
            ? prop.GetString() ?? ""
            : "";
    }

    /// <summary>
    /// Get nested property value (e.g., "properties.provisioningState")
    /// </summary>
    private static string GetJsonString(JsonElement element, string path1, string path2)
    {
        if (element.TryGetProperty(path1, out var level1) && level1.TryGetProperty(path2, out var level2))
        {
            return level2.ValueKind == JsonValueKind.String ? level2.GetString() ?? "" : "";
        }
        return "";
    }

    private static long GetJsonLong(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var prop))
            return 0;

        if (prop.ValueKind == JsonValueKind.Number)
            return prop.TryGetInt64(out var val) ? val : 0;

        if (prop.ValueKind == JsonValueKind.String && long.TryParse(prop.GetString(), out var parsedVal))
            return parsedVal;

        return 0;
    }

    /// <summary>
    /// Extrai parâmetro de um query após o prefixo.
    /// Ex: "activityRuns/abc-123" → "abc-123"
    /// </summary>
    private static string ExtractParameterFromQuery(string query, string[] prefixes)
    {
        foreach (var prefix in prefixes)
        {
            if (query.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                var remainder = query[prefix.Length..].Trim();
                if (remainder.StartsWith("/"))
                    remainder = remainder[1..].Trim();
                return remainder;
            }
        }
        return "";
    }

    #endregion

    private enum AdfQueryType
    {
        Unknown,
        PipelineRuns,
        ActivityRuns,
        TriggerRuns,
        Pipelines,
        Triggers,
        Datasets,
        LinkedServices,
        DataFlows,
        IntegrationRuntimes
    }
}
