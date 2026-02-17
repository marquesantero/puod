using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Puod.Services.Integration.Models;

namespace Puod.Services.Integration.Connectors;

/// <summary>
/// Conector para AWS Glue usando REST API com AWS Signature V4.
/// Suporta: Jobs, Job Runs, Crawlers, Databases, Tables, Data Catalog.
/// Documentação: https://docs.aws.amazon.com/glue/latest/webapi/
/// </summary>
public class AwsGlueConnector : IConnector
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AwsGlueConnector> _logger;

    private const string ServiceName = "glue";

    public AwsGlueConnector(
        IHttpClientFactory httpClientFactory,
        ILogger<AwsGlueConnector> logger)
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

            var client = _httpClientFactory.CreateClient();
            var region = config["region"];

            // Testar listando databases do Data Catalog
            var payload = JsonSerializer.Serialize(new { MaxResults = 1 });
            var response = await SendAwsRequestAsync(client, config, "AWSGlue.GetDatabases", payload);

            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<JsonElement>(content);

                var dbCount = 0;
                if (result.TryGetProperty("DatabaseList", out var dbs))
                    dbCount = dbs.GetArrayLength();

                return new ConnectionResult
                {
                    Success = true,
                    Metadata = new Dictionary<string, object>
                    {
                        { "region", region },
                        { "service", "AWS Glue" },
                        { "catalog_accessible", true },
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

            var client = _httpClientFactory.CreateClient();
            var normalizedQuery = query?.Trim() ?? string.Empty;
            var queryType = DetermineQueryType(normalizedQuery);

            _logger.LogInformation("Executing AWS Glue query. Type: {QueryType}, Query: {Query}", queryType, Truncate(normalizedQuery, 200));

            List<Dictionary<string, object>> rows;

            switch (queryType)
            {
                case GlueQueryType.Jobs:
                    rows = await QueryJobsAsync(config, client);
                    break;

                case GlueQueryType.JobRuns:
                    rows = await QueryJobRunsAsync(normalizedQuery, config, client);
                    break;

                case GlueQueryType.Crawlers:
                    rows = await QueryCrawlersAsync(config, client);
                    break;

                case GlueQueryType.CrawlerRuns:
                    rows = await QueryCrawlerMetricsAsync(normalizedQuery, config, client);
                    break;

                case GlueQueryType.Databases:
                    rows = await QueryDatabasesAsync(config, client);
                    break;

                case GlueQueryType.Tables:
                    rows = await QueryTablesAsync(normalizedQuery, config, client);
                    break;

                case GlueQueryType.Workflows:
                    rows = await QueryWorkflowsAsync(config, client);
                    break;

                case GlueQueryType.Triggers:
                    rows = await QueryTriggersAsync(config, client);
                    break;

                case GlueQueryType.DataQuality:
                    rows = await QueryDataQualityResultsAsync(config, client);
                    break;

                default:
                    stopwatch.Stop();
                    return new QueryResult
                    {
                        Success = false,
                        ErrorMessage = $"Unsupported query: '{Truncate(normalizedQuery, 200)}'. " +
                            "Supported: jobs, jobRuns/<jobName>, crawlers, crawlerRuns/<crawlerName>, " +
                            "databases, tables/<databaseName>, workflows, triggers, dataQuality",
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
            _logger.LogError(ex, "Error executing AWS Glue query: {Query}", Truncate(query ?? "", 200));

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

            var client = _httpClientFactory.CreateClient();
            var databases = await QueryDatabasesAsync(config, client);

            return databases
                .Select(db => db.TryGetValue("name", out var name) ? name?.ToString() ?? "" : "")
                .Where(n => !string.IsNullOrEmpty(n))
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error listing Glue databases");
            return new List<string>();
        }
    }

    public async Task<List<string>> ListTablesAsync(string database, Dictionary<string, string> config)
    {
        try
        {
            ValidateConfig(config);

            var client = _httpClientFactory.CreateClient();
            var tables = await QueryTablesAsync($"tables/{database}", config, client);

            return tables
                .Select(t => t.TryGetValue("name", out var name) ? name?.ToString() ?? "" : "")
                .Where(n => !string.IsNullOrEmpty(n))
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error listing Glue tables for database {Database}", database);
            return new List<string>();
        }
    }

    #endregion

    #region Query Methods

    private async Task<List<Dictionary<string, object>>> QueryJobsAsync(
        Dictionary<string, string> config, HttpClient client)
    {
        var payload = JsonSerializer.Serialize(new { MaxResults = 200 });
        var response = await SendAwsRequestAsync(client, config, "AWSGlue.GetJobs", payload);
        var content = await ReadAndValidateResponseAsync(response, "GetJobs");
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("Jobs", out var jobs))
            return rows;

        foreach (var job in jobs.EnumerateArray())
        {
            rows.Add(new Dictionary<string, object>
            {
                { "name", GetStr(job, "Name") },
                { "role", GetStr(job, "Role") },
                { "created_on", GetStr(job, "CreatedOn") },
                { "last_modified_on", GetStr(job, "LastModifiedOn") },
                { "glue_version", GetStr(job, "GlueVersion") },
                { "worker_type", GetStr(job, "WorkerType") },
                { "number_of_workers", GetNum(job, "NumberOfWorkers") },
                { "max_retries", GetNum(job, "MaxRetries") },
                { "timeout", GetNum(job, "Timeout") },
                { "max_capacity", GetDbl(job, "MaxCapacity") },
                { "description", GetStr(job, "Description") },
                { "command_name", job.TryGetProperty("Command", out var cmd) ? GetStr(cmd, "Name") : "" },
                { "execution_class", GetStr(job, "ExecutionClass") }
            });
        }

        return rows;
    }

    private async Task<List<Dictionary<string, object>>> QueryJobRunsAsync(
        string query, Dictionary<string, string> config, HttpClient client)
    {
        var jobName = ExtractParameter(query, new[] { "jobRuns", "job_runs", "jobruns" });
        if (string.IsNullOrWhiteSpace(jobName))
            throw new InvalidOperationException("Job runs query requires a job name. Format: 'jobRuns/<jobName>'");

        var payload = JsonSerializer.Serialize(new { JobName = jobName, MaxResults = 50 });
        var response = await SendAwsRequestAsync(client, config, "AWSGlue.GetJobRuns", payload);
        var content = await ReadAndValidateResponseAsync(response, "GetJobRuns");
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("JobRuns", out var runs))
            return rows;

        foreach (var run in runs.EnumerateArray())
        {
            rows.Add(new Dictionary<string, object>
            {
                { "id", GetStr(run, "Id") },
                { "job_name", GetStr(run, "JobName") },
                { "job_run_state", GetStr(run, "JobRunState") },
                { "started_on", GetStr(run, "StartedOn") },
                { "completed_on", GetStr(run, "CompletedOn") },
                { "execution_time", GetNum(run, "ExecutionTime") },
                { "timeout", GetNum(run, "Timeout") },
                { "max_capacity", GetDbl(run, "MaxCapacity") },
                { "worker_type", GetStr(run, "WorkerType") },
                { "number_of_workers", GetNum(run, "NumberOfWorkers") },
                { "glue_version", GetStr(run, "GlueVersion") },
                { "error_message", GetStr(run, "ErrorMessage") },
                { "attempt", GetNum(run, "Attempt") },
                { "trigger_name", GetStr(run, "TriggerName") },
                { "dpu_seconds", GetDbl(run, "DPUSeconds") },
                { "execution_class", GetStr(run, "ExecutionClass") },
                { "log_group_name", GetStr(run, "LogGroupName") }
            });
        }

        return rows;
    }

    private async Task<List<Dictionary<string, object>>> QueryCrawlersAsync(
        Dictionary<string, string> config, HttpClient client)
    {
        var payload = JsonSerializer.Serialize(new { MaxResults = 200 });
        var response = await SendAwsRequestAsync(client, config, "AWSGlue.GetCrawlers", payload);
        var content = await ReadAndValidateResponseAsync(response, "GetCrawlers");
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("Crawlers", out var crawlers))
            return rows;

        foreach (var crawler in crawlers.EnumerateArray())
        {
            var row = new Dictionary<string, object>
            {
                { "name", GetStr(crawler, "Name") },
                { "role", GetStr(crawler, "Role") },
                { "database_name", GetStr(crawler, "DatabaseName") },
                { "state", GetStr(crawler, "State") },
                { "creation_time", GetStr(crawler, "CreationTime") },
                { "last_updated", GetStr(crawler, "LastUpdated") },
                { "description", GetStr(crawler, "Description") },
                { "version", GetNum(crawler, "Version") },
                { "crawler_security_configuration", GetStr(crawler, "CrawlerSecurityConfiguration") }
            };

            if (crawler.TryGetProperty("LastCrawl", out var lastCrawl))
            {
                row["last_crawl_status"] = GetStr(lastCrawl, "Status");
                row["last_crawl_start_time"] = GetStr(lastCrawl, "StartTime");
                row["last_crawl_message"] = GetStr(lastCrawl, "MessagePrefix");
                row["last_crawl_log_group"] = GetStr(lastCrawl, "LogGroup");
            }

            if (crawler.TryGetProperty("Schedule", out var schedule))
            {
                row["schedule_expression"] = GetStr(schedule, "ScheduleExpression");
                row["schedule_state"] = GetStr(schedule, "State");
            }

            rows.Add(row);
        }

        return rows;
    }

    private async Task<List<Dictionary<string, object>>> QueryCrawlerMetricsAsync(
        string query, Dictionary<string, string> config, HttpClient client)
    {
        var crawlerName = ExtractParameter(query, new[] { "crawlerRuns", "crawler_runs", "crawlerruns" });

        var payloadObj = string.IsNullOrWhiteSpace(crawlerName)
            ? new { MaxResults = 50 }
            : (object)new { CrawlerNameList = new[] { crawlerName }, MaxResults = 50 };

        var payload = JsonSerializer.Serialize(payloadObj);
        var response = await SendAwsRequestAsync(client, config, "AWSGlue.GetCrawlerMetrics", payload);
        var content = await ReadAndValidateResponseAsync(response, "GetCrawlerMetrics");
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("CrawlerMetricsList", out var metrics))
            return rows;

        foreach (var m in metrics.EnumerateArray())
        {
            rows.Add(new Dictionary<string, object>
            {
                { "crawler_name", GetStr(m, "CrawlerName") },
                { "time_left_seconds", GetDbl(m, "TimeLeftSeconds") },
                { "still_estimating", m.TryGetProperty("StillEstimating", out var se) && se.ValueKind == JsonValueKind.True },
                { "last_runtime_seconds", GetDbl(m, "LastRuntimeSeconds") },
                { "median_runtime_seconds", GetDbl(m, "MedianRuntimeSeconds") },
                { "tables_created", GetNum(m, "TablesCreated") },
                { "tables_updated", GetNum(m, "TablesUpdated") },
                { "tables_deleted", GetNum(m, "TablesDeleted") }
            });
        }

        return rows;
    }

    private async Task<List<Dictionary<string, object>>> QueryDatabasesAsync(
        Dictionary<string, string> config, HttpClient client)
    {
        var payload = JsonSerializer.Serialize(new { MaxResults = 100 });
        var response = await SendAwsRequestAsync(client, config, "AWSGlue.GetDatabases", payload);
        var content = await ReadAndValidateResponseAsync(response, "GetDatabases");
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("DatabaseList", out var dbs))
            return rows;

        foreach (var db in dbs.EnumerateArray())
        {
            rows.Add(new Dictionary<string, object>
            {
                { "name", GetStr(db, "Name") },
                { "description", GetStr(db, "Description") },
                { "location_uri", GetStr(db, "LocationUri") },
                { "create_time", GetStr(db, "CreateTime") },
                { "catalog_id", GetStr(db, "CatalogId") }
            });
        }

        return rows;
    }

    private async Task<List<Dictionary<string, object>>> QueryTablesAsync(
        string query, Dictionary<string, string> config, HttpClient client)
    {
        var databaseName = ExtractParameter(query, new[] { "tables" });
        if (string.IsNullOrWhiteSpace(databaseName))
            throw new InvalidOperationException("Tables query requires a database name. Format: 'tables/<databaseName>'");

        var payload = JsonSerializer.Serialize(new { DatabaseName = databaseName, MaxResults = 100 });
        var response = await SendAwsRequestAsync(client, config, "AWSGlue.GetTables", payload);
        var content = await ReadAndValidateResponseAsync(response, "GetTables");
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("TableList", out var tables))
            return rows;

        foreach (var table in tables.EnumerateArray())
        {
            var row = new Dictionary<string, object>
            {
                { "name", GetStr(table, "Name") },
                { "database_name", GetStr(table, "DatabaseName") },
                { "table_type", GetStr(table, "TableType") },
                { "create_time", GetStr(table, "CreateTime") },
                { "update_time", GetStr(table, "UpdateTime") },
                { "description", GetStr(table, "Description") },
                { "owner", GetStr(table, "Owner") },
                { "retention", GetNum(table, "Retention") },
                { "is_registered_with_lake_formation", table.TryGetProperty("IsRegisteredWithLakeFormation", out var lf) && lf.ValueKind == JsonValueKind.True }
            };

            if (table.TryGetProperty("StorageDescriptor", out var sd))
            {
                row["location"] = GetStr(sd, "Location");
                row["input_format"] = GetStr(sd, "InputFormat");
                row["output_format"] = GetStr(sd, "OutputFormat");
                row["compressed"] = sd.TryGetProperty("Compressed", out var comp) && comp.ValueKind == JsonValueKind.True;

                if (sd.TryGetProperty("Columns", out var cols))
                    row["column_count"] = cols.GetArrayLength();

                if (sd.TryGetProperty("SerdeInfo", out var serde))
                    row["serialization_library"] = GetStr(serde, "SerializationLibrary");
            }

            if (table.TryGetProperty("PartitionKeys", out var partKeys))
                row["partition_key_count"] = partKeys.GetArrayLength();

            rows.Add(row);
        }

        return rows;
    }

    private async Task<List<Dictionary<string, object>>> QueryWorkflowsAsync(
        Dictionary<string, string> config, HttpClient client)
    {
        var payload = JsonSerializer.Serialize(new { MaxResults = 50 });
        var response = await SendAwsRequestAsync(client, config, "AWSGlue.ListWorkflows", payload);
        var content = await ReadAndValidateResponseAsync(response, "ListWorkflows");
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("Workflows", out var workflows))
            return rows;

        // ListWorkflows só retorna nomes, buscar detalhes de cada um
        foreach (var wfName in workflows.EnumerateArray())
        {
            var name = wfName.GetString() ?? "";
            if (string.IsNullOrEmpty(name)) continue;

            try
            {
                var detailPayload = JsonSerializer.Serialize(new { Name = name, IncludeGraph = false });
                var detailResponse = await SendAwsRequestAsync(client, config, "AWSGlue.GetWorkflow", detailPayload);
                var detailContent = await detailResponse.Content.ReadAsStringAsync();

                if (detailResponse.IsSuccessStatusCode)
                {
                    var wfResult = JsonSerializer.Deserialize<JsonElement>(detailContent);
                    if (wfResult.TryGetProperty("Workflow", out var wf))
                    {
                        var row = new Dictionary<string, object>
                        {
                            { "name", GetStr(wf, "Name") },
                            { "description", GetStr(wf, "Description") },
                            { "created_on", GetStr(wf, "CreatedOn") },
                            { "last_modified_on", GetStr(wf, "LastModifiedOn") }
                        };

                        if (wf.TryGetProperty("LastRun", out var lastRun))
                        {
                            row["last_run_status"] = GetStr(lastRun, "Status");
                            row["last_run_started_on"] = GetStr(lastRun, "StartedOn");
                            row["last_run_completed_on"] = GetStr(lastRun, "CompletedOn");
                            row["last_run_error_message"] = GetStr(lastRun, "ErrorMessage");

                            if (lastRun.TryGetProperty("Statistics", out var stats))
                            {
                                row["total_actions"] = GetNum(stats, "TotalActions");
                                row["succeeded_actions"] = GetNum(stats, "SucceededActions");
                                row["failed_actions"] = GetNum(stats, "FailedActions");
                                row["running_actions"] = GetNum(stats, "RunningActions");
                            }
                        }

                        rows.Add(row);
                        continue;
                    }
                }
            }
            catch { /* skip individual workflow errors */ }

            rows.Add(new Dictionary<string, object> { { "name", name } });
        }

        return rows;
    }

    private async Task<List<Dictionary<string, object>>> QueryTriggersAsync(
        Dictionary<string, string> config, HttpClient client)
    {
        var payload = JsonSerializer.Serialize(new { MaxResults = 200 });
        var response = await SendAwsRequestAsync(client, config, "AWSGlue.GetTriggers", payload);
        var content = await ReadAndValidateResponseAsync(response, "GetTriggers");
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("Triggers", out var triggers))
            return rows;

        foreach (var trigger in triggers.EnumerateArray())
        {
            var row = new Dictionary<string, object>
            {
                { "name", GetStr(trigger, "Name") },
                { "type", GetStr(trigger, "Type") },
                { "state", GetStr(trigger, "State") },
                { "description", GetStr(trigger, "Description") },
                { "schedule", GetStr(trigger, "Schedule") },
                { "workflow_name", GetStr(trigger, "WorkflowName") }
            };

            if (trigger.TryGetProperty("Actions", out var actions))
            {
                var actionNames = new List<string>();
                foreach (var a in actions.EnumerateArray())
                {
                    var jobName = GetStr(a, "JobName");
                    var crawlerName = GetStr(a, "CrawlerName");
                    if (!string.IsNullOrEmpty(jobName)) actionNames.Add($"job:{jobName}");
                    if (!string.IsNullOrEmpty(crawlerName)) actionNames.Add($"crawler:{crawlerName}");
                }
                row["actions"] = string.Join(", ", actionNames);
            }

            rows.Add(row);
        }

        return rows;
    }

    private async Task<List<Dictionary<string, object>>> QueryDataQualityResultsAsync(
        Dictionary<string, string> config, HttpClient client)
    {
        var payload = JsonSerializer.Serialize(new { MaxResults = 50 });
        var response = await SendAwsRequestAsync(client, config, "AWSGlue.ListDataQualityResults", payload);
        var content = await ReadAndValidateResponseAsync(response, "ListDataQualityResults");
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("Results", out var results))
            return rows;

        foreach (var r in results.EnumerateArray())
        {
            rows.Add(new Dictionary<string, object>
            {
                { "result_id", GetStr(r, "ResultId") },
                { "score", GetDbl(r, "Score") },
                { "started_on", GetStr(r, "StartedOn") },
                { "completed_on", GetStr(r, "CompletedOn") },
                { "job_name", GetStr(r, "JobName") },
                { "job_run_id", GetStr(r, "JobRunId") },
                { "ruleset_name", GetStr(r, "RulesetName") }
            });
        }

        return rows;
    }

    #endregion

    #region AWS Signature V4

    private async Task<HttpResponseMessage> SendAwsRequestAsync(
        HttpClient client, Dictionary<string, string> config,
        string target, string payload)
    {
        var region = config["region"];
        var accessKeyId = config["access_key_id"];
        var secretAccessKey = config["secret_access_key"];
        var sessionToken = config.GetValueOrDefault("session_token");
        var endpoint = config.GetValueOrDefault("endpoint_url") ??
            $"https://glue.{region}.amazonaws.com";

        var uri = new Uri(endpoint);
        var now = DateTime.UtcNow;
        var dateStamp = now.ToString("yyyyMMdd");
        var amzDate = now.ToString("yyyyMMddTHHmmssZ");

        var payloadHash = HashSha256(payload);

        // Headers
        var headers = new SortedDictionary<string, string>
        {
            { "content-type", "application/x-amz-json-1.1" },
            { "host", uri.Host },
            { "x-amz-date", amzDate },
            { "x-amz-target", target }
        };

        if (!string.IsNullOrEmpty(sessionToken))
            headers["x-amz-security-token"] = sessionToken;

        // Canonical request
        var signedHeaders = string.Join(";", headers.Keys);
        var canonicalHeaders = string.Join("\n", headers.Select(h => $"{h.Key}:{h.Value}")) + "\n";
        var canonicalRequest = $"POST\n/\n\n{canonicalHeaders}\n{signedHeaders}\n{payloadHash}";

        // String to sign
        var credentialScope = $"{dateStamp}/{region}/{ServiceName}/aws4_request";
        var stringToSign = $"AWS4-HMAC-SHA256\n{amzDate}\n{credentialScope}\n{HashSha256(canonicalRequest)}";

        // Signing key
        var kDate = HmacSha256(Encoding.UTF8.GetBytes($"AWS4{secretAccessKey}"), dateStamp);
        var kRegion = HmacSha256(kDate, region);
        var kService = HmacSha256(kRegion, ServiceName);
        var kSigning = HmacSha256(kService, "aws4_request");

        var signature = BitConverter.ToString(HmacSha256(kSigning, stringToSign)).Replace("-", "").ToLowerInvariant();

        var authorization = $"AWS4-HMAC-SHA256 Credential={accessKeyId}/{credentialScope}, SignedHeaders={signedHeaders}, Signature={signature}";

        // Build request
        var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Content = new StringContent(payload, Encoding.UTF8, "application/x-amz-json-1.1");
        request.Headers.TryAddWithoutValidation("X-Amz-Date", amzDate);
        request.Headers.TryAddWithoutValidation("X-Amz-Target", target);
        request.Headers.TryAddWithoutValidation("Authorization", authorization);

        if (!string.IsNullOrEmpty(sessionToken))
            request.Headers.TryAddWithoutValidation("X-Amz-Security-Token", sessionToken);

        return await client.SendAsync(request);
    }

    private static string HashSha256(string data)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(data));
        return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
    }

    private static byte[] HmacSha256(byte[] key, string data)
    {
        using var hmac = new HMACSHA256(key);
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
    }

    #endregion

    #region Helpers

    private void ValidateConfig(Dictionary<string, string> config)
    {
        var required = new[] { "region", "access_key_id", "secret_access_key" };

        foreach (var field in required)
        {
            if (!config.ContainsKey(field) || string.IsNullOrWhiteSpace(config[field]))
                throw new ArgumentException($"Missing required config: {field}");
        }
    }

    private GlueQueryType DetermineQueryType(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return GlueQueryType.Jobs;

        var lower = query.ToLowerInvariant().Trim();

        if (lower.StartsWith("jobruns") || lower.StartsWith("job_runs"))
            return GlueQueryType.JobRuns;
        if (lower.StartsWith("jobs") || lower == "job")
            return GlueQueryType.Jobs;
        if (lower.StartsWith("crawlerruns") || lower.StartsWith("crawler_runs") || lower.StartsWith("crawlermetrics"))
            return GlueQueryType.CrawlerRuns;
        if (lower.StartsWith("crawlers") || lower == "crawler")
            return GlueQueryType.Crawlers;
        if (lower.StartsWith("databases") || lower == "catalog")
            return GlueQueryType.Databases;
        if (lower.StartsWith("tables"))
            return GlueQueryType.Tables;
        if (lower.StartsWith("workflows") || lower == "workflow")
            return GlueQueryType.Workflows;
        if (lower.StartsWith("triggers") || lower == "trigger")
            return GlueQueryType.Triggers;
        if (lower.StartsWith("dataquality") || lower.StartsWith("data_quality"))
            return GlueQueryType.DataQuality;

        return GlueQueryType.Jobs;
    }

    private async Task<string> ReadAndValidateResponseAsync(HttpResponseMessage response, string operation)
    {
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"AWS Glue {operation} failed. Status={response.StatusCode}. Body={Truncate(content)}");
        }

        return content;
    }

    private static string ExtractParameter(string query, string[] prefixes)
    {
        foreach (var prefix in prefixes)
        {
            if (query.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                var remainder = query[prefix.Length..].Trim();
                if (remainder.StartsWith("/")) remainder = remainder[1..].Trim();
                return remainder;
            }
        }
        return "";
    }

    private static string GetStr(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    private static long GetNum(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Number ? (v.TryGetInt64(out var n) ? n : 0) : 0;

    private static double GetDbl(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : 0;

    private static string Truncate(string value, int maxLength = 800) =>
        string.IsNullOrEmpty(value) || value.Length <= maxLength ? value : value[..maxLength] + "...";

    #endregion

    private enum GlueQueryType
    {
        Unknown, Jobs, JobRuns, Crawlers, CrawlerRuns,
        Databases, Tables, Workflows, Triggers, DataQuality
    }
}
