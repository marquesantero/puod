using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Puod.Services.Integration.Models;

namespace Puod.Services.Integration.Connectors;

/// <summary>
/// Conector para AWS Step Functions usando REST API com AWS Signature V4.
/// Suporta: State Machines, Executions, Execution History, Map Runs.
/// Documentação: https://docs.aws.amazon.com/step-functions/latest/apireference/
/// </summary>
public class AwsStepFunctionsConnector : IConnector
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AwsStepFunctionsConnector> _logger;

    private const string ServiceName = "states";

    public AwsStepFunctionsConnector(
        IHttpClientFactory httpClientFactory,
        ILogger<AwsStepFunctionsConnector> logger)
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
            var payload = JsonSerializer.Serialize(new { maxResults = 1 });
            var response = await SendAwsRequestAsync(client, config, "AWSStepFunctions.ListStateMachines", payload);

            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<JsonElement>(content);

                return new ConnectionResult
                {
                    Success = true,
                    Metadata = new Dictionary<string, object>
                    {
                        { "region", config["region"] },
                        { "service", "AWS Step Functions" },
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

            _logger.LogInformation("Executing Step Functions query. Type: {QueryType}", queryType);

            List<Dictionary<string, object>> rows;

            switch (queryType)
            {
                case SfnQueryType.StateMachines:
                    rows = await QueryStateMachinesAsync(config, client);
                    break;

                case SfnQueryType.Executions:
                    rows = await QueryExecutionsAsync(normalizedQuery, config, client);
                    break;

                case SfnQueryType.ExecutionHistory:
                    rows = await QueryExecutionHistoryAsync(normalizedQuery, config, client);
                    break;

                case SfnQueryType.MapRuns:
                    rows = await QueryMapRunsAsync(normalizedQuery, config, client);
                    break;

                case SfnQueryType.Activities:
                    rows = await QueryActivitiesAsync(config, client);
                    break;

                default:
                    stopwatch.Stop();
                    return new QueryResult
                    {
                        Success = false,
                        ErrorMessage = $"Unsupported query: '{Truncate(normalizedQuery, 200)}'. " +
                            "Supported: stateMachines, executions/<stateMachineArn>, " +
                            "history/<executionArn>, mapRuns/<executionArn>, activities",
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
            _logger.LogError(ex, "Error executing Step Functions query");

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
            var machines = await QueryStateMachinesAsync(config, client);
            return machines
                .Select(m => m.TryGetValue("name", out var n) ? n?.ToString() ?? "" : "")
                .Where(n => !string.IsNullOrEmpty(n))
                .ToList();
        }
        catch { return new List<string>(); }
    }

    public async Task<List<string>> ListTablesAsync(string database, Dictionary<string, string> config)
    {
        // Para Step Functions, retorna as últimas execuções de uma state machine
        try
        {
            ValidateConfig(config);
            var client = _httpClientFactory.CreateClient();

            // database pode ser um ARN ou nome — precisamos do ARN
            var arn = database.StartsWith("arn:") ? database : await ResolveStateMachineArnAsync(database, config, client);
            if (string.IsNullOrEmpty(arn)) return new List<string>();

            var executions = await QueryExecutionsAsync($"executions/{arn}", config, client);
            return executions
                .Select(e => e.TryGetValue("name", out var n) ? n?.ToString() ?? "" : "")
                .Where(n => !string.IsNullOrEmpty(n))
                .Take(50)
                .ToList();
        }
        catch { return new List<string>(); }
    }

    #endregion

    #region Query Methods

    private async Task<List<Dictionary<string, object>>> QueryStateMachinesAsync(
        Dictionary<string, string> config, HttpClient client)
    {
        var allMachines = new List<Dictionary<string, object>>();
        string? nextToken = null;

        do
        {
            var payloadObj = nextToken != null
                ? new { maxResults = 100, nextToken }
                : (object)new { maxResults = 100 };

            var payload = JsonSerializer.Serialize(payloadObj);
            var response = await SendAwsRequestAsync(client, config, "AWSStepFunctions.ListStateMachines", payload);
            var content = await ReadAndValidateAsync(response, "ListStateMachines");
            var result = JsonSerializer.Deserialize<JsonElement>(content);

            if (result.TryGetProperty("stateMachines", out var machines))
            {
                foreach (var sm in machines.EnumerateArray())
                {
                    var arn = GetStr(sm, "stateMachineArn");

                    allMachines.Add(new Dictionary<string, object>
                    {
                        { "name", GetStr(sm, "name") },
                        { "state_machine_arn", arn },
                        { "type", GetStr(sm, "type") },
                        { "creation_date", GetStr(sm, "creationDate") }
                    });
                }
            }

            nextToken = result.TryGetProperty("nextToken", out var nt) ? nt.GetString() : null;
        } while (nextToken != null && allMachines.Count < 500);

        // Enriquecer com descrição de cada state machine
        foreach (var sm in allMachines)
        {
            try
            {
                var arn = sm["state_machine_arn"]?.ToString();
                if (string.IsNullOrEmpty(arn)) continue;

                var descPayload = JsonSerializer.Serialize(new { stateMachineArn = arn });
                var descResponse = await SendAwsRequestAsync(client, config, "AWSStepFunctions.DescribeStateMachine", descPayload);

                if (descResponse.IsSuccessStatusCode)
                {
                    var descContent = await descResponse.Content.ReadAsStringAsync();
                    var desc = JsonSerializer.Deserialize<JsonElement>(descContent);

                    sm["status"] = GetStr(desc, "status");
                    sm["description"] = GetStr(desc, "description");
                    sm["role_arn"] = GetStr(desc, "roleArn");
                    sm["logging_level"] = desc.TryGetProperty("loggingConfiguration", out var lc)
                        ? GetStr(lc, "level") : "";
                }
            }
            catch { /* skip enrichment errors */ }
        }

        return allMachines;
    }

    private async Task<List<Dictionary<string, object>>> QueryExecutionsAsync(
        string query, Dictionary<string, string> config, HttpClient client)
    {
        var arn = ExtractParameter(query, new[] { "executions", "execution" });

        if (string.IsNullOrWhiteSpace(arn))
            throw new InvalidOperationException(
                "Executions query requires a state machine ARN. Format: 'executions/<stateMachineArn>'");

        // Se não é ARN, resolver por nome
        if (!arn.StartsWith("arn:"))
            arn = await ResolveStateMachineArnAsync(arn, config, client) ?? throw new InvalidOperationException($"State machine '{arn}' not found");

        var payload = JsonSerializer.Serialize(new { stateMachineArn = arn, maxResults = 50 });
        var response = await SendAwsRequestAsync(client, config, "AWSStepFunctions.ListExecutions", payload);
        var content = await ReadAndValidateAsync(response, "ListExecutions");
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("executions", out var executions))
            return rows;

        foreach (var exec in executions.EnumerateArray())
        {
            rows.Add(new Dictionary<string, object>
            {
                { "name", GetStr(exec, "name") },
                { "execution_arn", GetStr(exec, "executionArn") },
                { "state_machine_arn", GetStr(exec, "stateMachineArn") },
                { "status", GetStr(exec, "status") },
                { "start_date", GetStr(exec, "startDate") },
                { "stop_date", GetStr(exec, "stopDate") },
                { "map_run_arn", GetStr(exec, "mapRunArn") },
                { "item_count", GetNum(exec, "itemCount") },
                { "redrive_count", GetNum(exec, "redriveCount") },
                { "redrive_date", GetStr(exec, "redriveDate") }
            });
        }

        return rows;
    }

    private async Task<List<Dictionary<string, object>>> QueryExecutionHistoryAsync(
        string query, Dictionary<string, string> config, HttpClient client)
    {
        var executionArn = ExtractParameter(query, new[] { "history", "executionHistory", "execution_history" });

        if (string.IsNullOrWhiteSpace(executionArn))
            throw new InvalidOperationException(
                "Execution history requires an execution ARN. Format: 'history/<executionArn>'");

        var payload = JsonSerializer.Serialize(new { executionArn, maxResults = 100, reverseOrder = true });
        var response = await SendAwsRequestAsync(client, config, "AWSStepFunctions.GetExecutionHistory", payload);
        var content = await ReadAndValidateAsync(response, "GetExecutionHistory");
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("events", out var events))
            return rows;

        foreach (var evt in events.EnumerateArray())
        {
            var row = new Dictionary<string, object>
            {
                { "id", GetNum(evt, "id") },
                { "type", GetStr(evt, "type") },
                { "timestamp", GetStr(evt, "timestamp") },
                { "previous_event_id", GetNum(evt, "previousEventId") }
            };

            // Extrair detalhes do evento baseado no tipo
            var eventType = GetStr(evt, "type");
            var detailProps = new[]
            {
                "stateEnteredEventDetails", "stateExitedEventDetails",
                "executionStartedEventDetails", "executionSucceededEventDetails",
                "executionFailedEventDetails", "executionTimedOutEventDetails",
                "taskScheduledEventDetails", "taskStartedEventDetails",
                "taskSucceededEventDetails", "taskFailedEventDetails",
                "lambdaFunctionScheduledEventDetails", "lambdaFunctionSucceededEventDetails",
                "lambdaFunctionFailedEventDetails"
            };

            foreach (var detailProp in detailProps)
            {
                if (evt.TryGetProperty(detailProp, out var details))
                {
                    row["detail_type"] = detailProp;
                    if (details.TryGetProperty("name", out var nameP))
                        row["state_name"] = nameP.GetString() ?? "";
                    if (details.TryGetProperty("error", out var errP))
                        row["error"] = errP.GetString() ?? "";
                    if (details.TryGetProperty("cause", out var causeP))
                        row["cause"] = Truncate(causeP.GetString() ?? "", 500);
                    if (details.TryGetProperty("output", out var outP))
                        row["output"] = Truncate(outP.GetString() ?? "", 300);
                    if (details.TryGetProperty("input", out var inpP))
                        row["input"] = Truncate(inpP.GetString() ?? "", 300);
                    break;
                }
            }

            rows.Add(row);
        }

        return rows;
    }

    private async Task<List<Dictionary<string, object>>> QueryMapRunsAsync(
        string query, Dictionary<string, string> config, HttpClient client)
    {
        var executionArn = ExtractParameter(query, new[] { "mapRuns", "map_runs", "mapruns" });

        if (string.IsNullOrWhiteSpace(executionArn))
            throw new InvalidOperationException(
                "Map runs query requires an execution ARN. Format: 'mapRuns/<executionArn>'");

        var payload = JsonSerializer.Serialize(new { executionArn, maxResults = 50 });
        var response = await SendAwsRequestAsync(client, config, "AWSStepFunctions.ListMapRuns", payload);
        var content = await ReadAndValidateAsync(response, "ListMapRuns");
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("mapRuns", out var mapRuns))
            return rows;

        foreach (var mr in mapRuns.EnumerateArray())
        {
            rows.Add(new Dictionary<string, object>
            {
                { "map_run_arn", GetStr(mr, "mapRunArn") },
                { "execution_arn", GetStr(mr, "executionArn") },
                { "state_machine_arn", GetStr(mr, "stateMachineArn") },
                { "start_date", GetStr(mr, "startDate") },
                { "stop_date", GetStr(mr, "stopDate") },
                { "max_concurrency", GetNum(mr, "maxConcurrency") },
                { "tolerated_failure_count", GetNum(mr, "toleratedFailureCount") },
                { "tolerated_failure_percentage", GetDbl(mr, "toleratedFailurePercentage") }
            });
        }

        return rows;
    }

    private async Task<List<Dictionary<string, object>>> QueryActivitiesAsync(
        Dictionary<string, string> config, HttpClient client)
    {
        var payload = JsonSerializer.Serialize(new { maxResults = 100 });
        var response = await SendAwsRequestAsync(client, config, "AWSStepFunctions.ListActivities", payload);
        var content = await ReadAndValidateAsync(response, "ListActivities");
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        var rows = new List<Dictionary<string, object>>();

        if (!result.TryGetProperty("activities", out var activities))
            return rows;

        foreach (var act in activities.EnumerateArray())
        {
            rows.Add(new Dictionary<string, object>
            {
                { "name", GetStr(act, "name") },
                { "activity_arn", GetStr(act, "activityArn") },
                { "creation_date", GetStr(act, "creationDate") }
            });
        }

        return rows;
    }

    private async Task<string?> ResolveStateMachineArnAsync(string name, Dictionary<string, string> config, HttpClient client)
    {
        var payload = JsonSerializer.Serialize(new { maxResults = 100 });
        var response = await SendAwsRequestAsync(client, config, "AWSStepFunctions.ListStateMachines", payload);
        if (!response.IsSuccessStatusCode) return null;

        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(content);

        if (!result.TryGetProperty("stateMachines", out var machines)) return null;

        foreach (var sm in machines.EnumerateArray())
        {
            if (GetStr(sm, "name").Equals(name, StringComparison.OrdinalIgnoreCase))
                return GetStr(sm, "stateMachineArn");
        }

        return null;
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
            $"https://states.{region}.amazonaws.com";

        var uri = new Uri(endpoint);
        var now = DateTime.UtcNow;
        var dateStamp = now.ToString("yyyyMMdd");
        var amzDate = now.ToString("yyyyMMddTHHmmssZ");

        var payloadHash = HashSha256(payload);

        var headers = new SortedDictionary<string, string>
        {
            { "content-type", "application/x-amz-json-1.0" },
            { "host", uri.Host },
            { "x-amz-date", amzDate },
            { "x-amz-target", target }
        };

        if (!string.IsNullOrEmpty(sessionToken))
            headers["x-amz-security-token"] = sessionToken;

        var signedHeaders = string.Join(";", headers.Keys);
        var canonicalHeaders = string.Join("\n", headers.Select(h => $"{h.Key}:{h.Value}")) + "\n";
        var canonicalRequest = $"POST\n/\n\n{canonicalHeaders}\n{signedHeaders}\n{payloadHash}";

        var credentialScope = $"{dateStamp}/{region}/{ServiceName}/aws4_request";
        var stringToSign = $"AWS4-HMAC-SHA256\n{amzDate}\n{credentialScope}\n{HashSha256(canonicalRequest)}";

        var kDate = HmacSha256(Encoding.UTF8.GetBytes($"AWS4{secretAccessKey}"), dateStamp);
        var kRegion = HmacSha256(kDate, region);
        var kService = HmacSha256(kRegion, ServiceName);
        var kSigning = HmacSha256(kService, "aws4_request");

        var signature = BitConverter.ToString(HmacSha256(kSigning, stringToSign)).Replace("-", "").ToLowerInvariant();

        var authorization = $"AWS4-HMAC-SHA256 Credential={accessKeyId}/{credentialScope}, SignedHeaders={signedHeaders}, Signature={signature}";

        var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Content = new StringContent(payload, Encoding.UTF8, "application/x-amz-json-1.0");
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

    private SfnQueryType DetermineQueryType(string query)
    {
        if (string.IsNullOrWhiteSpace(query)) return SfnQueryType.StateMachines;

        var lower = query.ToLowerInvariant().Trim();

        if (lower.StartsWith("history") || lower.StartsWith("executionhistory") || lower.StartsWith("execution_history"))
            return SfnQueryType.ExecutionHistory;
        if (lower.StartsWith("executions") || lower.StartsWith("execution"))
            return SfnQueryType.Executions;
        if (lower.StartsWith("statemachines") || lower.StartsWith("state_machines") || lower == "machines")
            return SfnQueryType.StateMachines;
        if (lower.StartsWith("mapruns") || lower.StartsWith("map_runs"))
            return SfnQueryType.MapRuns;
        if (lower.StartsWith("activities") || lower == "activity")
            return SfnQueryType.Activities;

        return SfnQueryType.StateMachines;
    }

    private async Task<string> ReadAndValidateAsync(HttpResponseMessage response, string operation)
    {
        var content = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"AWS Step Functions {operation} failed. Status={response.StatusCode}. Body={Truncate(content)}");
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

    private enum SfnQueryType
    {
        Unknown, StateMachines, Executions, ExecutionHistory, MapRuns, Activities
    }
}
