using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Puod.Shared.Common.Authentication;
using Puod.Services.Integration.Models;

namespace Puod.Services.Integration.Connectors;

/// <summary>
/// Conector para Databricks usando REST API.
/// Suporta: SQL Statement Execution API, Jobs API, Clusters API, Unity Catalog API.
/// Documentação: https://docs.databricks.com/api/workspace
/// </summary>
public class DatabricksConnector : IConnector
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<DatabricksConnector> _logger;

    private string? _cachedAccessToken;
    private DateTime _tokenExpiresAt = DateTime.MinValue;

    /// <summary>
    /// Endpoints de consulta suportados (read-only).
    /// O "query" do ExecuteQueryAsync pode ser um desses endpoints ou uma SQL query para o SQL Statement API.
    /// </summary>
    private static readonly HashSet<string> SupportedEndpoints = new(StringComparer.OrdinalIgnoreCase)
    {
        "jobs", "jobs/list", "jobs/runs/list",
        "clusters", "clusters/list",
        "sql/statements", "sql/warehouses",
        "pipelines",
        "workspace/list",
        "repos",
        "unity-catalog/catalogs", "unity-catalog/schemas", "unity-catalog/tables",
        "serving-endpoints"
    };

    public DatabricksConnector(
        IHttpClientFactory httpClientFactory,
        ILogger<DatabricksConnector> logger)
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

            // Testar conectividade listando clusters
            var response = await client.GetAsync("/api/2.0/clusters/list");

            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<JsonElement>(content);

                var clusterCount = 0;
                if (result.TryGetProperty("clusters", out var clusters))
                {
                    clusterCount = clusters.GetArrayLength();
                }

                // Tentar obter info do workspace
                var workspaceInfo = await GetWorkspaceStatusAsync(client);

                var metadata = new Dictionary<string, object>
                {
                    { "workspace_url", config["workspace_url"] },
                    { "cluster_count", clusterCount },
                    { "tested_at", DateTime.UtcNow }
                };

                if (workspaceInfo != null)
                {
                    if (workspaceInfo.Value.TryGetProperty("user_name", out var userName))
                        metadata["authenticated_user"] = userName.GetString() ?? "";
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

            var client = CreateHttpClient(config);
            var normalizedQuery = query?.Trim() ?? string.Empty;

            // Determinar tipo de query
            var queryType = DetermineQueryType(normalizedQuery);

            _logger.LogInformation("Executing Databricks query. Type: {QueryType}, Query: {Query}", queryType, Truncate(normalizedQuery, 200));

            List<Dictionary<string, object>> rows;

            switch (queryType)
            {
                case DatabricksQueryType.SqlStatement:
                    rows = await ExecuteSqlStatementAsync(normalizedQuery, config, client);
                    break;

                case DatabricksQueryType.JobsList:
                    rows = await QueryJobsListAsync(normalizedQuery, config, client);
                    break;

                case DatabricksQueryType.JobRunsList:
                    rows = await QueryJobRunsListAsync(normalizedQuery, config, client);
                    break;

                case DatabricksQueryType.ClustersList:
                    rows = await QueryClustersListAsync(client);
                    break;

                case DatabricksQueryType.SqlWarehouses:
                    rows = await QuerySqlWarehousesAsync(client);
                    break;

                case DatabricksQueryType.Pipelines:
                    rows = await QueryPipelinesAsync(client);
                    break;

                case DatabricksQueryType.Repos:
                    rows = await QueryReposAsync(client);
                    break;

                case DatabricksQueryType.ServingEndpoints:
                    rows = await QueryServingEndpointsAsync(client);
                    break;

                case DatabricksQueryType.UnityCatalog:
                    rows = await QueryUnityCatalogAsync(normalizedQuery, client);
                    break;

                case DatabricksQueryType.RestEndpoint:
                    rows = await QueryRestEndpointAsync(normalizedQuery, client);
                    break;

                default:
                    stopwatch.Stop();
                    return new QueryResult
                    {
                        Success = false,
                        ErrorMessage = $"Unsupported query: '{Truncate(normalizedQuery, 200)}'. " +
                            "Supported types: SQL statements (SELECT ...), REST endpoints (jobs, jobs/runs/list, clusters, " +
                            "sql/warehouses, pipelines, repos, serving-endpoints, unity-catalog/catalogs, unity-catalog/schemas, unity-catalog/tables)",
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
            _logger.LogError(ex, "Error executing Databricks query: {Query}", Truncate(query ?? "", 200));

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

            // Tentar usar Unity Catalog primeiro (listando catalogs)
            var catalogs = await ListUnityCatalogCatalogsAsync(client);
            if (catalogs.Count > 0)
                return catalogs;

            // Fallback: usar SQL Statement API com SHOW DATABASES
            var warehouseId = GetWarehouseId(config);
            if (!string.IsNullOrEmpty(warehouseId))
            {
                var result = await ExecuteSqlStatementAsync("SHOW DATABASES", config, client);
                return result
                    .Select(row =>
                    {
                        if (row.TryGetValue("databaseName", out var name) ||
                            row.TryGetValue("namespace", out name) ||
                            row.TryGetValue("schema_name", out name))
                            return name?.ToString() ?? "";
                        // Fallback: usar primeiro valor
                        return row.Values.FirstOrDefault()?.ToString() ?? "";
                    })
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .ToList();
            }

            _logger.LogWarning("Cannot list databases: no Unity Catalog access and no warehouse_id configured");
            return new List<string>();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error listing Databricks databases");
            return new List<string>();
        }
    }

    public async Task<List<string>> ListTablesAsync(string database, Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var client = CreateHttpClient(config);

            // Tentar Unity Catalog primeiro
            var tables = await ListUnityCatalogTablesAsync(database, client);
            if (tables.Count > 0)
                return tables;

            // Fallback: SQL Statement API
            var warehouseId = GetWarehouseId(config);
            if (!string.IsNullOrEmpty(warehouseId))
            {
                var result = await ExecuteSqlStatementAsync($"SHOW TABLES IN {database}", config, client);
                return result
                    .Select(row =>
                    {
                        if (row.TryGetValue("tableName", out var name) ||
                            row.TryGetValue("table_name", out name))
                            return name?.ToString() ?? "";
                        return row.Values.FirstOrDefault()?.ToString() ?? "";
                    })
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .ToList();
            }

            _logger.LogWarning("Cannot list tables: no Unity Catalog access and no warehouse_id configured");
            return new List<string>();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error listing tables for database {Database}", database);
            return new List<string>();
        }
    }

    #endregion

    #region SQL Statement Execution API

    /// <summary>
    /// Executa uma query SQL usando o Databricks SQL Statement Execution API.
    /// Requer um SQL warehouse_id na config.
    /// Docs: https://docs.databricks.com/api/workspace/statementexecution
    /// </summary>
    private async Task<List<Dictionary<string, object>>> ExecuteSqlStatementAsync(
        string sql,
        Dictionary<string, string> config,
        HttpClient client)
    {
        var warehouseId = GetWarehouseId(config);
        if (string.IsNullOrEmpty(warehouseId))
        {
            throw new InvalidOperationException(
                "SQL execution requires 'warehouse_id' in config. " +
                "Configure the SQL warehouse ID for your Databricks workspace.");
        }

        // SECURITY: validar que é apenas leitura
        if (!IsReadOnlySql(sql))
        {
            throw new InvalidOperationException(
                "Only read-only SQL operations are allowed (SELECT, SHOW, DESCRIBE, EXPLAIN, WITH). " +
                "Write operations are not permitted.");
        }

        var catalog = config.GetValueOrDefault("catalog", null);
        var schema = config.GetValueOrDefault("schema", null);

        var requestBody = new Dictionary<string, object>
        {
            { "warehouse_id", warehouseId },
            { "statement", sql },
            { "wait_timeout", "30s" },
            { "on_wait_timeout", "CANCEL" },
            { "format", "JSON_ARRAY" }
        };

        if (!string.IsNullOrWhiteSpace(catalog))
            requestBody["catalog"] = catalog;
        if (!string.IsNullOrWhiteSpace(schema))
            requestBody["schema"] = schema;

        var content = new StringContent(
            JsonSerializer.Serialize(requestBody),
            Encoding.UTF8,
            "application/json"
        );

        var response = await client.PostAsync("/api/2.0/sql/statements", content);
        var responseContent = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"SQL Statement Execution failed. Status={response.StatusCode}. Body={Truncate(responseContent)}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(responseContent);

        // Verificar status da statement
        if (result.TryGetProperty("status", out var status))
        {
            var state = status.TryGetProperty("state", out var stateProp) ? stateProp.GetString() : "UNKNOWN";

            if (state == "FAILED")
            {
                var errorMessage = "SQL execution failed";
                if (status.TryGetProperty("error", out var error))
                {
                    if (error.TryGetProperty("message", out var errMsg))
                        errorMessage = errMsg.GetString() ?? errorMessage;
                }
                throw new InvalidOperationException(errorMessage);
            }

            if (state == "CANCELED")
            {
                throw new InvalidOperationException("SQL execution was cancelled (timeout exceeded).");
            }

            // Se ainda estiver rodando (PENDING/RUNNING), aguardar
            if (state == "PENDING" || state == "RUNNING")
            {
                if (result.TryGetProperty("statement_id", out var stmtId))
                {
                    return await PollStatementResultAsync(stmtId.GetString()!, client);
                }
                throw new InvalidOperationException("Statement is still running but no statement_id returned.");
            }
        }

        // Extrair resultado
        return ParseSqlStatementResult(result);
    }

    /// <summary>
    /// Polling para aguardar resultado de uma SQL statement em execução
    /// </summary>
    private async Task<List<Dictionary<string, object>>> PollStatementResultAsync(string statementId, HttpClient client)
    {
        const int maxAttempts = 30;
        const int pollIntervalMs = 2000;

        for (int attempt = 0; attempt < maxAttempts; attempt++)
        {
            await Task.Delay(pollIntervalMs);

            var response = await client.GetAsync($"/api/2.0/sql/statements/{statementId}");
            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException(
                    $"Failed to poll statement status. Status={response.StatusCode}. Body={Truncate(content)}");
            }

            var result = JsonSerializer.Deserialize<JsonElement>(content);

            if (result.TryGetProperty("status", out var status))
            {
                var state = status.TryGetProperty("state", out var stateProp) ? stateProp.GetString() : "UNKNOWN";

                if (state == "SUCCEEDED")
                    return ParseSqlStatementResult(result);

                if (state == "FAILED")
                {
                    var errorMessage = "SQL execution failed";
                    if (status.TryGetProperty("error", out var error) && error.TryGetProperty("message", out var errMsg))
                        errorMessage = errMsg.GetString() ?? errorMessage;
                    throw new InvalidOperationException(errorMessage);
                }

                if (state == "CANCELED")
                    throw new InvalidOperationException("SQL execution was cancelled.");

                _logger.LogDebug("Statement {StatementId} still in state {State} (attempt {Attempt})", statementId, state, attempt + 1);
            }
        }

        // Cancelar statement se exceder polling
        try { await client.PostAsync($"/api/2.0/sql/statements/{statementId}/cancel", null); } catch { }
        throw new InvalidOperationException($"SQL statement timed out after {maxAttempts * pollIntervalMs / 1000}s of polling.");
    }

    /// <summary>
    /// Parseia resultado do SQL Statement Execution API
    /// </summary>
    private List<Dictionary<string, object>> ParseSqlStatementResult(JsonElement result)
    {
        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("manifest", out var manifest))
            return rows;

        if (!manifest.TryGetProperty("schema", out var schema))
            return rows;

        if (!schema.TryGetProperty("columns", out var columns))
            return rows;

        // Obter nomes das colunas
        var columnNames = new List<string>();
        foreach (var col in columns.EnumerateArray())
        {
            columnNames.Add(col.TryGetProperty("name", out var name) ? name.GetString() ?? $"col_{columnNames.Count}" : $"col_{columnNames.Count}");
        }

        // Extrair dados
        if (result.TryGetProperty("result", out var resultData))
        {
            if (resultData.TryGetProperty("data_array", out var dataArray))
            {
                foreach (var rowArray in dataArray.EnumerateArray())
                {
                    var row = new Dictionary<string, object>();
                    var colIndex = 0;

                    foreach (var cell in rowArray.EnumerateArray())
                    {
                        var colName = colIndex < columnNames.Count ? columnNames[colIndex] : $"col_{colIndex}";
                        row[colName] = ConvertJsonValue(cell);
                        colIndex++;
                    }

                    rows.Add(row);
                }
            }
            // Formato alternativo: external links (para resultados grandes)
            else if (resultData.TryGetProperty("external_links", out var externalLinks))
            {
                rows.Add(new Dictionary<string, object>
                {
                    { "_info", "Result too large for inline response. External links available." },
                    { "external_link_count", externalLinks.GetArrayLength() },
                    { "row_count", result.TryGetProperty("manifest", out var m) && m.TryGetProperty("total_row_count", out var rc) ? rc.GetInt64() : 0 }
                });
            }
        }

        return rows;
    }

    #endregion

    #region Jobs API

    /// <summary>
    /// Lista jobs do Databricks workspace
    /// Docs: https://docs.databricks.com/api/workspace/jobs/list
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryJobsListAsync(
        string query,
        Dictionary<string, string> config,
        HttpClient client)
    {
        var settings = DataSourceSettingsHelper.ParseSettings<DatabricksDataSourceSettings>(
            config.GetValueOrDefault("dataSourceJson", null));

        var limit = settings?.Limit ?? 25;
        var queryParams = new List<string> { $"limit={limit}", "expand_tasks=false" };

        // Filtrar por nome se o query contém algo além do endpoint
        var namePart = ExtractQueryParameter(query, new[] { "jobs", "jobs/list" });
        if (!string.IsNullOrWhiteSpace(namePart))
        {
            queryParams.Add($"name={Uri.EscapeDataString(namePart)}");
        }

        var url = $"/api/2.1/jobs/list?{string.Join("&", queryParams)}";
        var allJobs = new List<Dictionary<string, object>>();
        var hasMore = true;

        while (hasMore)
        {
            var response = await client.GetAsync(url);
            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException(
                    $"Jobs list failed. Status={response.StatusCode}. Body={Truncate(content)}");
            }

            var result = JsonSerializer.Deserialize<JsonElement>(content);

            if (result.TryGetProperty("jobs", out var jobs))
            {
                foreach (var job in jobs.EnumerateArray())
                {
                    var row = new Dictionary<string, object>();

                    row["job_id"] = GetJsonLong(job, "job_id");

                    if (job.TryGetProperty("settings", out var settings2))
                    {
                        row["name"] = GetJsonString(settings2, "name");
                        row["format"] = GetJsonString(settings2, "format");
                        row["max_concurrent_runs"] = GetJsonLong(settings2, "max_concurrent_runs");

                        if (settings2.TryGetProperty("schedule", out var schedule))
                        {
                            row["schedule_cron"] = GetJsonString(schedule, "quartz_cron_expression");
                            row["schedule_paused"] = schedule.TryGetProperty("pause_status", out var ps) ? ps.GetString() ?? "" : "";
                        }
                    }

                    row["creator_user_name"] = GetJsonString(job, "creator_user_name");
                    row["created_time"] = FormatEpochMs(job, "created_time");

                    allJobs.Add(row);
                }
            }

            // Paginação
            hasMore = result.TryGetProperty("has_more", out var hasMoreProp) && hasMoreProp.GetBoolean();
            if (hasMore && result.TryGetProperty("next_page_token", out var nextToken))
            {
                url = $"/api/2.1/jobs/list?limit={limit}&page_token={nextToken.GetString()}";
            }
            else
            {
                hasMore = false;
            }
        }

        return allJobs;
    }

    /// <summary>
    /// Lista job runs do Databricks workspace
    /// Docs: https://docs.databricks.com/api/workspace/jobs/listruns
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryJobRunsListAsync(
        string query,
        Dictionary<string, string> config,
        HttpClient client)
    {
        var settings = DataSourceSettingsHelper.ParseSettings<DatabricksDataSourceSettings>(
            config.GetValueOrDefault("dataSourceJson", null));

        var limit = settings?.Limit ?? 25;
        var queryParams = new List<string> { $"limit={limit}", "expand_tasks=false" };

        // Filtrar por job_id se especificado
        if (settings?.JobIds != null && settings.JobIds.Count == 1)
        {
            queryParams.Add($"job_id={settings.JobIds.First()}");
        }

        // Extrair job_id do query string se passado diretamente
        var jobIdPart = ExtractQueryParameter(query, new[] { "jobs/runs/list" });
        if (!string.IsNullOrWhiteSpace(jobIdPart) && long.TryParse(jobIdPart, out _))
        {
            queryParams.Add($"job_id={jobIdPart}");
        }

        // Filtrar por active_only ou completed_only
        if (settings?.States != null && settings.States.Count > 0)
        {
            var hasRunning = settings.States.Any(s => s.Equals("RUNNING", StringComparison.OrdinalIgnoreCase) ||
                                                       s.Equals("PENDING", StringComparison.OrdinalIgnoreCase));
            var hasCompleted = settings.States.Any(s => s.Equals("TERMINATED", StringComparison.OrdinalIgnoreCase) ||
                                                         s.Equals("SKIPPED", StringComparison.OrdinalIgnoreCase));

            if (hasRunning && !hasCompleted)
                queryParams.Add("active_only=true");
            else if (hasCompleted && !hasRunning)
                queryParams.Add("completed_only=true");
        }

        var url = $"/api/2.1/jobs/runs/list?{string.Join("&", queryParams)}";
        var allRuns = new List<Dictionary<string, object>>();
        var hasMore = true;

        while (hasMore)
        {
            var response = await client.GetAsync(url);
            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException(
                    $"Job runs list failed. Status={response.StatusCode}. Body={Truncate(content)}");
            }

            var result = JsonSerializer.Deserialize<JsonElement>(content);

            if (result.TryGetProperty("runs", out var runs))
            {
                foreach (var run in runs.EnumerateArray())
                {
                    var row = new Dictionary<string, object>();

                    row["run_id"] = GetJsonLong(run, "run_id");
                    row["job_id"] = GetJsonLong(run, "job_id");
                    row["run_name"] = GetJsonString(run, "run_name");
                    row["number_in_job"] = GetJsonLong(run, "number_in_job");

                    if (run.TryGetProperty("state", out var state))
                    {
                        row["life_cycle_state"] = GetJsonString(state, "life_cycle_state");
                        row["result_state"] = GetJsonString(state, "result_state");
                        row["state_message"] = GetJsonString(state, "state_message");
                    }

                    row["start_time"] = FormatEpochMs(run, "start_time");
                    row["end_time"] = FormatEpochMs(run, "end_time");
                    row["setup_duration"] = GetJsonLong(run, "setup_duration");
                    row["execution_duration"] = GetJsonLong(run, "execution_duration");
                    row["cleanup_duration"] = GetJsonLong(run, "cleanup_duration");
                    row["run_duration"] = GetJsonLong(run, "run_duration");
                    row["trigger"] = GetJsonString(run, "trigger");
                    row["creator_user_name"] = GetJsonString(run, "creator_user_name");
                    row["run_page_url"] = GetJsonString(run, "run_page_url");

                    if (run.TryGetProperty("cluster_spec", out var clusterSpec))
                    {
                        if (clusterSpec.TryGetProperty("existing_cluster_id", out var existingId))
                            row["cluster_id"] = existingId.GetString() ?? "";
                    }

                    allRuns.Add(row);
                }
            }

            hasMore = result.TryGetProperty("has_more", out var hasMoreProp) && hasMoreProp.GetBoolean();
            if (hasMore && result.TryGetProperty("next_page_token", out var nextToken))
            {
                url = $"/api/2.1/jobs/runs/list?limit={limit}&page_token={nextToken.GetString()}";
            }
            else
            {
                hasMore = false;
            }
        }

        return allRuns;
    }

    /// <summary>
    /// Busca detalhes de uma run específica
    /// </summary>
    public async Task<JsonElement?> GetJobRunAsync(long runId, Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var client = CreateHttpClient(config);
            var response = await client.GetAsync($"/api/2.1/jobs/runs/get?run_id={runId}");

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
    /// Busca output de uma run específica
    /// </summary>
    public async Task<JsonElement?> GetJobRunOutputAsync(long runId, Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var client = CreateHttpClient(config);
            var response = await client.GetAsync($"/api/2.1/jobs/runs/get-output?run_id={runId}");

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

    #region Clusters API

    /// <summary>
    /// Lista clusters do workspace
    /// Docs: https://docs.databricks.com/api/workspace/clusters/list
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryClustersListAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/2.0/clusters/list");
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Clusters list failed. Status={response.StatusCode}. Body={Truncate(content)}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(content);
        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("clusters", out var clusters))
            return rows;

        foreach (var cluster in clusters.EnumerateArray())
        {
            var row = new Dictionary<string, object>();

            row["cluster_id"] = GetJsonString(cluster, "cluster_id");
            row["cluster_name"] = GetJsonString(cluster, "cluster_name");
            row["state"] = GetJsonString(cluster, "state");
            row["state_message"] = GetJsonString(cluster, "state_message");
            row["spark_version"] = GetJsonString(cluster, "spark_version");
            row["node_type_id"] = GetJsonString(cluster, "node_type_id");
            row["driver_node_type_id"] = GetJsonString(cluster, "driver_node_type_id");
            row["num_workers"] = GetJsonLong(cluster, "num_workers");
            row["creator_user_name"] = GetJsonString(cluster, "creator_user_name");
            row["cluster_source"] = GetJsonString(cluster, "cluster_source");
            row["start_time"] = FormatEpochMs(cluster, "start_time");
            row["last_activity_time"] = FormatEpochMs(cluster, "last_activity_time");
            row["terminated_time"] = FormatEpochMs(cluster, "terminated_time");

            if (cluster.TryGetProperty("autoscale", out var autoscale))
            {
                row["autoscale_min_workers"] = GetJsonLong(autoscale, "min_workers");
                row["autoscale_max_workers"] = GetJsonLong(autoscale, "max_workers");
            }

            if (cluster.TryGetProperty("default_tags", out var tags))
            {
                row["tags"] = tags.ToString();
            }

            rows.Add(row);
        }

        return rows;
    }

    /// <summary>
    /// Busca detalhes de um cluster específico
    /// </summary>
    public async Task<JsonElement?> GetClusterAsync(string clusterId, Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var client = CreateHttpClient(config);
            var response = await client.GetAsync($"/api/2.0/clusters/get?cluster_id={Uri.EscapeDataString(clusterId)}");

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

    #region SQL Warehouses API

    /// <summary>
    /// Lista SQL warehouses do workspace
    /// Docs: https://docs.databricks.com/api/workspace/warehouses/list
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QuerySqlWarehousesAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/2.0/sql/warehouses");
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"SQL Warehouses list failed. Status={response.StatusCode}. Body={Truncate(content)}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(content);
        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("warehouses", out var warehouses))
            return rows;

        foreach (var wh in warehouses.EnumerateArray())
        {
            var row = new Dictionary<string, object>();

            row["id"] = GetJsonString(wh, "id");
            row["name"] = GetJsonString(wh, "name");
            row["state"] = GetJsonString(wh, "state");
            row["cluster_size"] = GetJsonString(wh, "cluster_size");
            row["min_num_clusters"] = GetJsonLong(wh, "min_num_clusters");
            row["max_num_clusters"] = GetJsonLong(wh, "max_num_clusters");
            row["num_active_sessions"] = GetJsonLong(wh, "num_active_sessions");
            row["num_clusters"] = GetJsonLong(wh, "num_clusters");
            row["auto_stop_mins"] = GetJsonLong(wh, "auto_stop_mins");
            row["warehouse_type"] = GetJsonString(wh, "warehouse_type");
            row["creator_name"] = GetJsonString(wh, "creator_name");
            row["spot_instance_policy"] = GetJsonString(wh, "spot_instance_policy");
            row["enable_serverless_compute"] = wh.TryGetProperty("enable_serverless_compute", out var esc) && esc.ValueKind == JsonValueKind.True;

            rows.Add(row);
        }

        return rows;
    }

    #endregion

    #region Delta Live Tables (Pipelines) API

    /// <summary>
    /// Lista DLT pipelines
    /// Docs: https://docs.databricks.com/api/workspace/pipelines/listpipelines
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryPipelinesAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/2.0/pipelines?max_results=100");
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Pipelines list failed. Status={response.StatusCode}. Body={Truncate(content)}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(content);
        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("statuses", out var pipelines))
            return rows;

        foreach (var pipeline in pipelines.EnumerateArray())
        {
            var row = new Dictionary<string, object>();

            row["pipeline_id"] = GetJsonString(pipeline, "pipeline_id");
            row["name"] = GetJsonString(pipeline, "name");
            row["state"] = GetJsonString(pipeline, "state");
            row["creator_user_name"] = GetJsonString(pipeline, "creator_user_name");
            row["run_as_user_name"] = GetJsonString(pipeline, "run_as_user_name");
            row["latest_update_id"] = GetJsonString(pipeline, "latest_update_id");

            if (pipeline.TryGetProperty("latest_updates", out var updates) &&
                updates.ValueKind == JsonValueKind.Array &&
                updates.GetArrayLength() > 0)
            {
                var latestUpdate = updates[0];
                row["latest_update_state"] = GetJsonString(latestUpdate, "state");
                row["latest_update_creation_time"] = GetJsonString(latestUpdate, "creation_time");
            }

            rows.Add(row);
        }

        return rows;
    }

    #endregion

    #region Repos API

    /// <summary>
    /// Lista repos do workspace
    /// Docs: https://docs.databricks.com/api/workspace/repos/list
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryReposAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/2.0/repos");
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Repos list failed. Status={response.StatusCode}. Body={Truncate(content)}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(content);
        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("repos", out var repos))
            return rows;

        foreach (var repo in repos.EnumerateArray())
        {
            rows.Add(ParseJsonElement(repo));
        }

        return rows;
    }

    #endregion

    #region Serving Endpoints API

    /// <summary>
    /// Lista model serving endpoints
    /// Docs: https://docs.databricks.com/api/workspace/servingendpoints/list
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryServingEndpointsAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/2.0/serving-endpoints");
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Serving endpoints list failed. Status={response.StatusCode}. Body={Truncate(content)}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(content);
        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("endpoints", out var endpoints))
            return rows;

        foreach (var ep in endpoints.EnumerateArray())
        {
            var row = new Dictionary<string, object>();

            row["name"] = GetJsonString(ep, "name");
            row["creation_timestamp"] = FormatEpochMs(ep, "creation_timestamp");
            row["last_updated_timestamp"] = FormatEpochMs(ep, "last_updated_timestamp");
            row["creator"] = GetJsonString(ep, "creator");

            if (ep.TryGetProperty("state", out var state))
            {
                row["ready"] = GetJsonString(state, "ready");
                row["config_update"] = GetJsonString(state, "config_update");
            }

            rows.Add(row);
        }

        return rows;
    }

    #endregion

    #region Unity Catalog API

    /// <summary>
    /// Query Unity Catalog resources (catalogs, schemas, tables)
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryUnityCatalogAsync(string query, HttpClient client)
    {
        var normalizedQuery = query.ToLowerInvariant().Trim();

        if (normalizedQuery.StartsWith("unity-catalog/tables"))
        {
            // Requer catalog.schema como parâmetro
            var param = ExtractQueryParameter(query, new[] { "unity-catalog/tables" });
            if (string.IsNullOrWhiteSpace(param))
                throw new InvalidOperationException("unity-catalog/tables requires a 'catalog_name.schema_name' parameter");

            return await QueryUnityCatalogTablesListAsync(param, client);
        }

        if (normalizedQuery.StartsWith("unity-catalog/schemas"))
        {
            var catalogName = ExtractQueryParameter(query, new[] { "unity-catalog/schemas" });
            if (string.IsNullOrWhiteSpace(catalogName))
                throw new InvalidOperationException("unity-catalog/schemas requires a 'catalog_name' parameter");

            return await QueryUnityCatalogSchemasListAsync(catalogName, client);
        }

        // Default: list catalogs
        return await QueryUnityCatalogCatalogsListAsync(client);
    }

    private async Task<List<Dictionary<string, object>>> QueryUnityCatalogCatalogsListAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/2.1/unity-catalog/catalogs");
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Unity Catalog catalogs list failed. Status={response.StatusCode}. Body={Truncate(content)}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(content);
        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("catalogs", out var catalogs))
            return rows;

        foreach (var catalog in catalogs.EnumerateArray())
        {
            rows.Add(ParseJsonElement(catalog));
        }

        return rows;
    }

    private async Task<List<Dictionary<string, object>>> QueryUnityCatalogSchemasListAsync(string catalogName, HttpClient client)
    {
        var response = await client.GetAsync($"/api/2.1/unity-catalog/schemas?catalog_name={Uri.EscapeDataString(catalogName)}");
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Unity Catalog schemas list failed. Status={response.StatusCode}. Body={Truncate(content)}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(content);
        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("schemas", out var schemas))
            return rows;

        foreach (var schema in schemas.EnumerateArray())
        {
            rows.Add(ParseJsonElement(schema));
        }

        return rows;
    }

    private async Task<List<Dictionary<string, object>>> QueryUnityCatalogTablesListAsync(string catalogSchema, HttpClient client)
    {
        var parts = catalogSchema.Split('.');
        if (parts.Length < 2)
            throw new InvalidOperationException("Expected format: 'catalog_name.schema_name'");

        var catalogName = parts[0];
        var schemaName = parts[1];

        var response = await client.GetAsync(
            $"/api/2.1/unity-catalog/tables?catalog_name={Uri.EscapeDataString(catalogName)}&schema_name={Uri.EscapeDataString(schemaName)}");
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Unity Catalog tables list failed. Status={response.StatusCode}. Body={Truncate(content)}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(content);
        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("tables", out var tables))
            return rows;

        foreach (var table in tables.EnumerateArray())
        {
            var row = new Dictionary<string, object>();

            row["catalog_name"] = GetJsonString(table, "catalog_name");
            row["schema_name"] = GetJsonString(table, "schema_name");
            row["name"] = GetJsonString(table, "name");
            row["full_name"] = GetJsonString(table, "full_name");
            row["table_type"] = GetJsonString(table, "table_type");
            row["data_source_format"] = GetJsonString(table, "data_source_format");
            row["storage_location"] = GetJsonString(table, "storage_location");
            row["owner"] = GetJsonString(table, "owner");
            row["created_at"] = FormatEpochMs(table, "created_at");
            row["updated_at"] = FormatEpochMs(table, "updated_at");

            if (table.TryGetProperty("columns", out var columns))
            {
                row["column_count"] = columns.GetArrayLength();
            }

            rows.Add(row);
        }

        return rows;
    }

    private async Task<List<string>> ListUnityCatalogCatalogsAsync(HttpClient client)
    {
        try
        {
            var response = await client.GetAsync("/api/2.1/unity-catalog/catalogs");
            if (!response.IsSuccessStatusCode)
                return new List<string>();

            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<JsonElement>(content);

            if (!result.TryGetProperty("catalogs", out var catalogs))
                return new List<string>();

            var catalogList = new List<string>();
            foreach (var catalog in catalogs.EnumerateArray())
            {
                if (catalog.TryGetProperty("name", out var name))
                    catalogList.Add(name.GetString() ?? "");
            }

            return catalogList;
        }
        catch
        {
            return new List<string>();
        }
    }

    private async Task<List<string>> ListUnityCatalogTablesAsync(string database, HttpClient client)
    {
        try
        {
            // database pode ser "catalog.schema" ou apenas "schema" (usando catalog default)
            string catalogName, schemaName;

            var parts = database.Split('.');
            if (parts.Length >= 2)
            {
                catalogName = parts[0];
                schemaName = parts[1];
            }
            else
            {
                catalogName = "main"; // default catalog
                schemaName = database;
            }

            var response = await client.GetAsync(
                $"/api/2.1/unity-catalog/tables?catalog_name={Uri.EscapeDataString(catalogName)}&schema_name={Uri.EscapeDataString(schemaName)}");

            if (!response.IsSuccessStatusCode)
                return new List<string>();

            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<JsonElement>(content);

            if (!result.TryGetProperty("tables", out var tables))
                return new List<string>();

            var tableList = new List<string>();
            foreach (var table in tables.EnumerateArray())
            {
                if (table.TryGetProperty("name", out var name))
                    tableList.Add(name.GetString() ?? "");
            }

            return tableList;
        }
        catch
        {
            return new List<string>();
        }
    }

    #endregion

    #region Generic REST Endpoint

    /// <summary>
    /// Executa uma query genérica contra um REST endpoint do Databricks
    /// </summary>
    private async Task<List<Dictionary<string, object>>> QueryRestEndpointAsync(string query, HttpClient client)
    {
        var endpoint = NormalizeDatabricksEndpoint(query);

        _logger.LogInformation("Calling Databricks REST endpoint: {Endpoint}", endpoint);

        var response = await client.GetAsync(endpoint);
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"REST endpoint failed. URL={endpoint}. Status={response.StatusCode}. Body={Truncate(content)}");
        }

        var result = JsonSerializer.Deserialize<JsonElement>(content);
        return ParseDatabricksResponse(result);
    }

    #endregion

    #region HTTP Client & Auth

    private HttpClient CreateHttpClient(Dictionary<string, string> config)
    {
        var client = _httpClientFactory.CreateClient();
        client.BaseAddress = new Uri(config["workspace_url"].TrimEnd('/'));
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        client.DefaultRequestHeaders.UserAgent.ParseAdd("PUOD-Databricks-Connector/1.0");

        // 1. Personal Access Token (PAT)
        if (config.TryGetValue("token", out var pat) && !string.IsNullOrWhiteSpace(pat))
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", pat);
            return client;
        }

        // 2. OAuth2 Service Principal (M2M)
        if (config.TryGetValue("auth_type", out var authType))
        {
            if (authType == "oauth2" || authType == "service_principal")
            {
                var token = GetOAuth2TokenAsync(config).GetAwaiter().GetResult();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
                return client;
            }

            // 3. Azure AD Service Principal (para Azure Databricks)
            if (authType == "azure_ad" || authType == "profile")
            {
                var token = GetAzureAdTokenAsync(config).GetAwaiter().GetResult();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
                return client;
            }

            // 4. Browser cookies
            if (authType == "browser_cookies")
            {
                var cookieDomain = config.GetValueOrDefault("cookie_domain", new Uri(config["workspace_url"]).Host);

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

                    throw new InvalidOperationException($"Failed to extract browser cookies for {usedBrowser ?? "auto"}: {errorMessage}");
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException($"Failed to extract browser cookies: {ex.Message}", ex);
                }
            }
        }

        // 5. Cookie header direto
        if (config.TryGetValue("cookie_header", out var rawCookieHeader) &&
            !string.IsNullOrWhiteSpace(rawCookieHeader))
        {
            client.DefaultRequestHeaders.Add("Cookie", rawCookieHeader);
            return client;
        }

        throw new InvalidOperationException("No valid authentication method found. " +
            "Provide 'token' (PAT), 'auth_type=oauth2' with client credentials, " +
            "'auth_type=azure_ad' with Azure AD credentials, or 'auth_type=browser_cookies'.");
    }

    /// <summary>
    /// Obtém token OAuth2 usando Databricks M2M OAuth (Service Principal)
    /// Docs: https://docs.databricks.com/dev-tools/authentication/oauth-m2m.html
    /// </summary>
    private async Task<string> GetOAuth2TokenAsync(Dictionary<string, string> config)
    {
        if (!string.IsNullOrEmpty(_cachedAccessToken) && DateTime.UtcNow < _tokenExpiresAt)
        {
            return _cachedAccessToken;
        }

        var clientId = config.GetValueOrDefault("client_id", null)
            ?? throw new InvalidOperationException("Missing 'client_id' for OAuth2 authentication.");
        var clientSecret = config.GetValueOrDefault("client_secret", null)
            ?? throw new InvalidOperationException("Missing 'client_secret' for OAuth2 authentication.");

        var workspaceUrl = config["workspace_url"].TrimEnd('/');

        // Databricks OAuth2 token endpoint
        var tokenUrl = config.GetValueOrDefault("token_url", $"{workspaceUrl}/oidc/v1/token");

        var client = _httpClientFactory.CreateClient();

        var authHeader = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", authHeader);

        var requestBody = new Dictionary<string, string>
        {
            { "grant_type", "client_credentials" },
            { "scope", config.GetValueOrDefault("scopes", "all-apis") }
        };

        var content = new FormUrlEncodedContent(requestBody);
        var response = await client.PostAsync(tokenUrl, content);

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Failed to obtain Databricks OAuth2 token: {Truncate(errorContent)}");
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        var tokenResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);

        _cachedAccessToken = tokenResponse.GetProperty("access_token").GetString() ?? "";
        var expiresIn = tokenResponse.TryGetProperty("expires_in", out var expProp) ? expProp.GetInt32() : 3600;
        _tokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn - 300); // Renova 5 min antes

        return _cachedAccessToken;
    }

    /// <summary>
    /// Obtém token Azure AD para Azure Databricks
    /// </summary>
    private async Task<string> GetAzureAdTokenAsync(Dictionary<string, string> config)
    {
        if (!string.IsNullOrEmpty(_cachedAccessToken) && DateTime.UtcNow < _tokenExpiresAt)
        {
            return _cachedAccessToken;
        }

        var tenantId = config.GetValueOrDefault("tenant_id", null)
            ?? throw new InvalidOperationException("Missing 'tenant_id' for Azure AD authentication.");
        var clientId = config.GetValueOrDefault("client_id", null)
            ?? throw new InvalidOperationException("Missing 'client_id' for Azure AD authentication.");
        var clientSecret = config.GetValueOrDefault("client_secret", null)
            ?? throw new InvalidOperationException("Missing 'client_secret' for Azure AD authentication.");

        var tokenUrl = config.GetValueOrDefault("token_url",
            $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token");

        // Scope para Azure Databricks
        var scope = config.GetValueOrDefault("scopes", "2ff814a6-3304-4ab8-85cb-cd0e6f879c1d/.default");

        var client = _httpClientFactory.CreateClient();

        var requestBody = new Dictionary<string, string>
        {
            { "grant_type", "client_credentials" },
            { "client_id", clientId },
            { "client_secret", clientSecret },
            { "scope", scope }
        };

        var content = new FormUrlEncodedContent(requestBody);
        var response = await client.PostAsync(tokenUrl, content);

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Failed to obtain Azure AD token: {Truncate(errorContent)}");
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        var tokenResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);

        _cachedAccessToken = tokenResponse.GetProperty("access_token").GetString() ?? "";
        var expiresIn = tokenResponse.TryGetProperty("expires_in", out var expProp) ? expProp.GetInt32() : 3600;
        _tokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn - 300);

        return _cachedAccessToken;
    }

    #endregion

    #region Helpers

    private void ValidateConfig(Dictionary<string, string> config)
    {
        if (!config.ContainsKey("workspace_url") || string.IsNullOrWhiteSpace(config["workspace_url"]))
            throw new ArgumentException("Missing required config: workspace_url (e.g., https://adb-XXXXXXX.azuredatabricks.net)");

        // Validar que tem ao menos um método de autenticação
        var hasToken = config.ContainsKey("token") && !string.IsNullOrWhiteSpace(config["token"]);
        var hasOAuth2 = config.TryGetValue("auth_type", out var authType) &&
                        (authType == "oauth2" || authType == "service_principal") &&
                        config.ContainsKey("client_id") && config.ContainsKey("client_secret");
        var hasAzureAd = config.TryGetValue("auth_type", out var authType2) &&
                         (authType2 == "azure_ad" || authType2 == "profile") &&
                         config.ContainsKey("client_id") && config.ContainsKey("client_secret") &&
                         config.ContainsKey("tenant_id");
        var hasBrowserCookies = config.TryGetValue("auth_type", out var authType3) && authType3 == "browser_cookies";
        var hasCookieHeader = config.ContainsKey("cookie_header") && !string.IsNullOrWhiteSpace(config["cookie_header"]);

        if (!hasToken && !hasOAuth2 && !hasAzureAd && !hasBrowserCookies && !hasCookieHeader)
        {
            throw new ArgumentException(
                "Missing authentication. Provide one of: " +
                "'token' (Personal Access Token), " +
                "'auth_type=oauth2' with client_id/client_secret, " +
                "'auth_type=azure_ad' with client_id/client_secret/tenant_id, " +
                "'auth_type=browser_cookies', or " +
                "'cookie_header'");
        }
    }

    private DatabricksQueryType DetermineQueryType(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return DatabricksQueryType.Unknown;

        var lowerQuery = query.ToLowerInvariant().Trim();

        // SQL Statement (começa com SELECT, SHOW, DESCRIBE, EXPLAIN, WITH)
        if (lowerQuery.StartsWith("select ") || lowerQuery.StartsWith("select\n") || lowerQuery.StartsWith("select\t") ||
            lowerQuery.StartsWith("show ") || lowerQuery.StartsWith("show\n") ||
            lowerQuery.StartsWith("describe ") || lowerQuery.StartsWith("describe\n") ||
            lowerQuery.StartsWith("explain ") || lowerQuery.StartsWith("explain\n") ||
            lowerQuery.StartsWith("with ") || lowerQuery.StartsWith("with\n"))
        {
            return DatabricksQueryType.SqlStatement;
        }

        // Job Runs
        if (lowerQuery.StartsWith("jobs/runs") || lowerQuery == "jobruns" || lowerQuery == "job_runs")
            return DatabricksQueryType.JobRunsList;

        // Jobs
        if (lowerQuery.StartsWith("jobs") && !lowerQuery.StartsWith("jobs/runs"))
            return DatabricksQueryType.JobsList;

        // Clusters
        if (lowerQuery.StartsWith("clusters"))
            return DatabricksQueryType.ClustersList;

        // SQL Warehouses
        if (lowerQuery.StartsWith("sql/warehouses") || lowerQuery == "warehouses")
            return DatabricksQueryType.SqlWarehouses;

        // Pipelines (DLT)
        if (lowerQuery.StartsWith("pipelines") || lowerQuery == "dlt")
            return DatabricksQueryType.Pipelines;

        // Repos
        if (lowerQuery.StartsWith("repos"))
            return DatabricksQueryType.Repos;

        // Serving Endpoints
        if (lowerQuery.StartsWith("serving-endpoints") || lowerQuery.StartsWith("serving_endpoints"))
            return DatabricksQueryType.ServingEndpoints;

        // Unity Catalog
        if (lowerQuery.StartsWith("unity-catalog") || lowerQuery.StartsWith("unity_catalog") ||
            lowerQuery.StartsWith("catalogs") || lowerQuery.StartsWith("schemas") || lowerQuery.StartsWith("tables"))
        {
            return DatabricksQueryType.UnityCatalog;
        }

        // Endpoint genérico (começa com /api/)
        if (lowerQuery.StartsWith("/api/"))
            return DatabricksQueryType.RestEndpoint;

        // Se não reconhecer, tentar como SQL
        if (lowerQuery.Contains("from ") || lowerQuery.Contains("join ") || lowerQuery.Contains("where "))
            return DatabricksQueryType.SqlStatement;

        return DatabricksQueryType.Unknown;
    }

    private static bool IsReadOnlySql(string sql)
    {
        if (string.IsNullOrWhiteSpace(sql))
            return false;

        var normalized = sql.Trim();
        // Remove comments
        normalized = System.Text.RegularExpressions.Regex.Replace(normalized, @"--.*$", "",
            System.Text.RegularExpressions.RegexOptions.Multiline);
        normalized = System.Text.RegularExpressions.Regex.Replace(normalized, @"/\*.*?\*/", "",
            System.Text.RegularExpressions.RegexOptions.Singleline);
        normalized = normalized.Trim().ToUpperInvariant();

        // Permitir SELECT, SHOW, DESCRIBE, EXPLAIN, WITH
        if (!normalized.StartsWith("SELECT") && !normalized.StartsWith("SHOW") &&
            !normalized.StartsWith("DESCRIBE") && !normalized.StartsWith("EXPLAIN") &&
            !normalized.StartsWith("WITH"))
            return false;

        // Bloquear keywords de escrita
        var blockedKeywords = new[]
        {
            "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE",
            "GRANT", "REVOKE", "MERGE", "COPY", "OPTIMIZE", "VACUUM", "RESTORE",
            "MSCK", "REFRESH", "INVALIDATE", "LOAD", "UNLOAD"
        };

        foreach (var keyword in blockedKeywords)
        {
            if (System.Text.RegularExpressions.Regex.IsMatch(normalized, $@"\b{keyword}\b"))
                return false;
        }

        return true;
    }

    private string NormalizeDatabricksEndpoint(string query)
    {
        if (query.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
            return query;

        // Mapear endpoints simples para caminhos completos da API
        var lowerQuery = query.ToLowerInvariant().Trim();

        return lowerQuery switch
        {
            "jobs" or "jobs/list" => "/api/2.1/jobs/list",
            "jobs/runs/list" => "/api/2.1/jobs/runs/list",
            "clusters" or "clusters/list" => "/api/2.0/clusters/list",
            "sql/warehouses" or "warehouses" => "/api/2.0/sql/warehouses",
            "pipelines" or "dlt" => "/api/2.0/pipelines",
            "repos" => "/api/2.0/repos",
            "serving-endpoints" or "serving_endpoints" => "/api/2.0/serving-endpoints",
            "unity-catalog/catalogs" or "catalogs" => "/api/2.1/unity-catalog/catalogs",
            _ => $"/api/2.0/{query}"
        };
    }

    /// <summary>
    /// Parse generic Databricks API response into rows.
    /// Handles common response formats: { "key": [...] }, single object, etc.
    /// </summary>
    private List<Dictionary<string, object>> ParseDatabricksResponse(JsonElement result)
    {
        var rows = new List<Dictionary<string, object>>();

        // Common list properties in Databricks API responses
        var listProperties = new[]
        {
            "jobs", "runs", "clusters", "warehouses", "pipelines", "statuses",
            "repos", "endpoints", "catalogs", "schemas", "tables",
            "results", "items", "data", "value", "elements"
        };

        foreach (var listProp in listProperties)
        {
            if (!result.TryGetProperty(listProp, out var items))
                continue;

            if (items.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in items.EnumerateArray())
                {
                    rows.Add(ParseJsonElement(item));
                }
                return rows;
            }
        }

        // Se o resultado é um array diretamente
        if (result.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in result.EnumerateArray())
            {
                rows.Add(ParseJsonElement(item));
            }
            return rows;
        }

        // Single object
        rows.Add(ParseJsonElement(result));
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
                return value.ToString();

            default:
                return value.ToString();
        }
    }

    private static string GetJsonString(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var prop) ? prop.GetString() ?? "" : "";
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

    private static string FormatEpochMs(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var prop))
            return "";

        if (prop.ValueKind == JsonValueKind.Number && prop.TryGetInt64(out var epochMs) && epochMs > 0)
        {
            return DateTimeOffset.FromUnixTimeMilliseconds(epochMs).UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ");
        }

        if (prop.ValueKind == JsonValueKind.String)
            return prop.GetString() ?? "";

        return "";
    }

    private static string? GetWarehouseId(Dictionary<string, string> config)
    {
        return config.GetValueOrDefault("warehouse_id", null);
    }

    private static string Truncate(string value, int maxLength = 800)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
            return value;

        return value[..maxLength] + "...";
    }

    /// <summary>
    /// Extrai o parâmetro de uma query após o prefixo do endpoint.
    /// Ex: "jobs/runs/list 12345" → "12345", "unity-catalog/tables main.default" → "main.default"
    /// </summary>
    private static string ExtractQueryParameter(string query, string[] prefixes)
    {
        foreach (var prefix in prefixes)
        {
            if (query.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                var remainder = query[prefix.Length..].Trim();
                // Remover separadores como "/" ou "?"
                if (remainder.StartsWith("/") || remainder.StartsWith("?"))
                    remainder = remainder[1..].Trim();
                return remainder;
            }
        }
        return "";
    }

    private async Task<JsonElement?> GetWorkspaceStatusAsync(HttpClient client)
    {
        try
        {
            var response = await client.GetAsync("/api/2.0/preview/scim/v2/Me");
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

    private enum DatabricksQueryType
    {
        Unknown,
        SqlStatement,
        JobsList,
        JobRunsList,
        ClustersList,
        SqlWarehouses,
        Pipelines,
        Repos,
        ServingEndpoints,
        UnityCatalog,
        RestEndpoint
    }
}
