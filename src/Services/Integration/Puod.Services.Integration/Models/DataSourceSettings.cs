using System.Text.Json;
using System.Text.Json.Serialization;

namespace Puod.Services.Integration.Models;

/// <summary>
/// Base class for all data source settings
/// </summary>
public class DataSourceSettings
{
    [JsonPropertyName("integrationType")]
    public string? IntegrationType { get; set; }
}

/// <summary>
/// Airflow-specific data source settings
/// </summary>
public class AirflowDataSourceSettings : DataSourceSettings
{
    [JsonPropertyName("dagIds")]
    public List<string>? DagIds { get; set; }

    [JsonPropertyName("limit")]
    public int? Limit { get; set; }

    [JsonPropertyName("orderBy")]
    public string? OrderBy { get; set; }

    [JsonPropertyName("state")]
    public List<string>? State { get; set; }
}

/// <summary>
/// Databricks-specific data source settings
/// </summary>
public class DatabricksDataSourceSettings : DataSourceSettings
{
    [JsonPropertyName("clusterIds")]
    public List<string>? ClusterIds { get; set; }

    [JsonPropertyName("jobIds")]
    public List<string>? JobIds { get; set; }

    [JsonPropertyName("states")]
    public List<string>? States { get; set; }

    [JsonPropertyName("limit")]
    public int? Limit { get; set; }
}

/// <summary>
/// Azure Data Factory-specific data source settings
/// </summary>
public class AdfDataSourceSettings : DataSourceSettings
{
    [JsonPropertyName("pipelineNames")]
    public List<string>? PipelineNames { get; set; }

    [JsonPropertyName("limit")]
    public int? Limit { get; set; }

    [JsonPropertyName("status")]
    public List<string>? Status { get; set; }
}

/// <summary>
/// Helper class to parse and apply data source settings
/// </summary>
public static class DataSourceSettingsHelper
{
    /// <summary>
    /// Parse DataSourceJson to typed settings
    /// </summary>
    public static T? ParseSettings<T>(string? dataSourceJson) where T : DataSourceSettings
    {
        if (string.IsNullOrWhiteSpace(dataSourceJson))
            return null;

        try
        {
            return JsonSerializer.Deserialize<T>(dataSourceJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Apply Airflow settings to query string
    /// Returns either: modified query string OR "USE_POST_LIST_ENDPOINT" to signal using POST /dags/~/dagRuns/list
    /// </summary>
    public static string ApplyAirflowSettings(string query, string? dataSourceJson)
    {
        Console.WriteLine($"[ApplyAirflowSettings] Original query: {query}");
        Console.WriteLine($"[ApplyAirflowSettings] DataSourceJson: {dataSourceJson}");

        var settings = ParseSettings<AirflowDataSourceSettings>(dataSourceJson);
        if (settings == null)
        {
            Console.WriteLine($"[ApplyAirflowSettings] Settings is null, returning original query");
            return query;
        }

        Console.WriteLine($"[ApplyAirflowSettings] Parsed settings - DagIds: {settings.DagIds?.Count ?? 0}, Limit: {settings.Limit}");

        // If we have specific DAG IDs, signal to use POST /dags/~/dagRuns/list endpoint
        if (settings.DagIds != null && settings.DagIds.Any() && query.Contains("dagRuns"))
        {
            Console.WriteLine($"[ApplyAirflowSettings] Will use POST /dags/~/dagRuns/list with {settings.DagIds.Count} DAG IDs");
            return "USE_POST_LIST_ENDPOINT"; // Signal to connector to use POST endpoint
        }

        // Parse query string (assuming format like "dagRuns?limit=25")
        var parts = query.Split('?');
        var endpoint = parts[0];
        var queryParams = new Dictionary<string, string>();

        // Parse existing query parameters
        if (parts.Length > 1)
        {
            var paramPairs = parts[1].Split('&');
            foreach (var pair in paramPairs)
            {
                var kv = pair.Split('=');
                if (kv.Length == 2)
                {
                    queryParams[kv[0]] = kv[1];
                    Console.WriteLine($"[ApplyAirflowSettings] Parsed param: {kv[0]} = {kv[1]}");
                }
            }
        }

        // Apply limit from settings
        if (settings.Limit.HasValue)
        {
            queryParams["limit"] = settings.Limit.Value.ToString();
            Console.WriteLine($"[ApplyAirflowSettings] Applied limit from settings: {settings.Limit.Value}");
        }

        // Apply order_by from settings
        if (!string.IsNullOrWhiteSpace(settings.OrderBy))
        {
            queryParams["order_by"] = settings.OrderBy!;
            Console.WriteLine($"[ApplyAirflowSettings] Applied order_by from settings: {settings.OrderBy}");
        }

        // Rebuild query string
        var newQueryParams = string.Join("&", queryParams.Select(kv => $"{kv.Key}={kv.Value}"));
        var finalQuery = string.IsNullOrEmpty(newQueryParams) ? endpoint : $"{endpoint}?{newQueryParams}";
        Console.WriteLine($"[ApplyAirflowSettings] Final query: {finalQuery}");
        return finalQuery;
    }

    /// <summary>
    /// Filter Airflow results based on settings
    /// </summary>
    public static List<Dictionary<string, object>> FilterAirflowResults(
        List<Dictionary<string, object>> rows,
        string? dataSourceJson)
    {
        Console.WriteLine($"[FilterAirflowResults] Filtering {rows?.Count ?? 0} rows with dataSourceJson: {dataSourceJson}");

        var settings = ParseSettings<AirflowDataSourceSettings>(dataSourceJson);
        if (settings == null || rows == null)
        {
            Console.WriteLine($"[FilterAirflowResults] Settings is null: {settings == null}, rows is null: {rows == null}");
            return rows;
        }

        Console.WriteLine($"[FilterAirflowResults] Settings.DagIds: {settings.DagIds?.Count ?? 0} DAGs");
        if (settings.DagIds != null && settings.DagIds.Any())
        {
            Console.WriteLine($"[FilterAirflowResults] DagIds to filter: {string.Join(", ", settings.DagIds)}");
        }

        var filtered = rows.AsEnumerable();

        // Filter by DAG IDs
        if (settings.DagIds != null && settings.DagIds.Any())
        {
            var hasDagId = rows.Any(row => row.ContainsKey("dag_id"));

            // Log first row keys to debug field names
            if (rows.Any())
            {
                Console.WriteLine($"[FilterAirflowResults] First row keys: {string.Join(", ", rows.First().Keys)}");
            }

            if (!hasDagId)
            {
                Console.WriteLine("[FilterAirflowResults] No 'dag_id' in rows. Skipping DagIds filter.");
            }
            else
            {
                filtered = filtered.Where(row =>
                {
                    if (row.TryGetValue("dag_id", out var dagId))
                    {
                        var dagIdStr = dagId?.ToString() ?? "";
                        var matches = settings.DagIds.Contains(dagIdStr);
                        Console.WriteLine($"[FilterAirflowResults] Checking dag_id '{dagIdStr}': {(matches ? "MATCH" : "no match")}");
                        return matches;
                    }
                    Console.WriteLine($"[FilterAirflowResults] Row doesn't have 'dag_id' key");
                    return false;
                });
            }
        }

        // Filter by state
        if (settings.State != null && settings.State.Any())
        {
            filtered = filtered.Where(row =>
            {
                if (row.TryGetValue("state", out var state))
                {
                    return settings.State.Contains(state?.ToString() ?? "");
                }
                return false;
            });
        }

        return filtered.ToList();
    }

    /// <summary>
    /// Filter Databricks results based on settings
    /// </summary>
    public static List<Dictionary<string, object>> FilterDatabricksResults(
        List<Dictionary<string, object>> rows,
        string? dataSourceJson)
    {
        var settings = ParseSettings<DatabricksDataSourceSettings>(dataSourceJson);
        if (settings == null || rows == null)
            return rows;

        var filtered = rows.AsEnumerable();

        // Filter by cluster IDs
        if (settings.ClusterIds != null && settings.ClusterIds.Any())
        {
            filtered = filtered.Where(row =>
            {
                if (row.TryGetValue("cluster_id", out var clusterId))
                {
                    return settings.ClusterIds.Contains(clusterId?.ToString() ?? "");
                }
                return false;
            });
        }

        // Filter by job IDs
        if (settings.JobIds != null && settings.JobIds.Any())
        {
            filtered = filtered.Where(row =>
            {
                if (row.TryGetValue("job_id", out var jobId))
                {
                    return settings.JobIds.Contains(jobId?.ToString() ?? "");
                }
                return false;
            });
        }

        // Filter by states (supports state/result_state/status keys)
        if (settings.States != null && settings.States.Any())
        {
            filtered = filtered.Where(row =>
            {
                if (row.TryGetValue("state", out var state)
                    || row.TryGetValue("result_state", out state)
                    || row.TryGetValue("status", out state))
                {
                    return settings.States.Contains(state?.ToString() ?? "");
                }
                return false;
            });
        }

        // Apply limit
        if (settings.Limit.HasValue)
        {
            filtered = filtered.Take(settings.Limit.Value);
        }

        return filtered.ToList();
    }

    /// <summary>
    /// Filter ADF results based on settings
    /// </summary>
    public static List<Dictionary<string, object>> FilterAdfResults(
        List<Dictionary<string, object>> rows,
        string? dataSourceJson)
    {
        var settings = ParseSettings<AdfDataSourceSettings>(dataSourceJson);
        if (settings == null || rows == null)
            return rows;

        var filtered = rows.AsEnumerable();

        // Filter by pipeline names
        if (settings.PipelineNames != null && settings.PipelineNames.Any())
        {
            filtered = filtered.Where(row =>
            {
                if (row.TryGetValue("pipelineName", out var pipelineName) ||
                    row.TryGetValue("pipeline_name", out pipelineName))
                {
                    return settings.PipelineNames.Contains(pipelineName?.ToString() ?? "");
                }
                return false;
            });
        }

        // Filter by status
        if (settings.Status != null && settings.Status.Any())
        {
            filtered = filtered.Where(row =>
            {
                if (row.TryGetValue("status", out var status))
                {
                    return settings.Status.Contains(status?.ToString() ?? "");
                }
                return false;
            });
        }

        // Apply limit
        if (settings.Limit.HasValue)
        {
            filtered = filtered.Take(settings.Limit.Value);
        }

        return filtered.ToList();
    }
}
