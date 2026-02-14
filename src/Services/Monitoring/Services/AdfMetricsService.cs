using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Puod.Services.Monitoring.Data;
using Puod.Services.Monitoring.Models;

namespace Puod.Services.Monitoring.Services;

public interface IAdfMetricsService
{
    Task ProcessPipelineRunAsync(Guid integrationId, JsonElement pipelineRun, List<JsonElement> activityRuns);
    Task<List<AdfPipelineRun>> GetPipelineRunsAsync(Guid integrationId, string? pipelineName = null, int limit = 100);
    Task<AdfPipelineRun?> GetPipelineRunByIdAsync(Guid pipelineRunId);
    Task<List<MetricSnapshot>> GenerateMetricsFromPipelineRunAsync(AdfPipelineRun pipelineRun);
}

/// <summary>
/// Serviço para processar e armazenar métricas do Azure Data Factory
/// </summary>
public class AdfMetricsService : IAdfMetricsService
{
    private readonly MonitoringDbContext _context;
    private readonly ILogger<AdfMetricsService> _logger;

    public AdfMetricsService(MonitoringDbContext context, ILogger<AdfMetricsService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task ProcessPipelineRunAsync(Guid integrationId, JsonElement pipelineRun, List<JsonElement> activityRuns)
    {
        try
        {
            var runId = pipelineRun.GetProperty("runId").GetString() ?? "";
            var pipelineName = pipelineRun.GetProperty("pipelineName").GetString() ?? "";

            // Verificar se já existe
            var existing = await _context.AdfPipelineRuns
                .FirstOrDefaultAsync(r => r.IntegrationId == integrationId && r.RunId == runId);

            AdfPipelineRun pipelineRunModel;

            if (existing != null)
            {
                // Atualizar existente
                pipelineRunModel = existing;
                UpdatePipelineRunFromJson(pipelineRunModel, pipelineRun);
                pipelineRunModel.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                // Criar novo
                pipelineRunModel = CreatePipelineRunFromJson(integrationId, pipelineRun);
                await _context.AdfPipelineRuns.AddAsync(pipelineRunModel);
            }

            await _context.SaveChangesAsync();

            // Processar activity runs
            foreach (var activityJson in activityRuns)
            {
                await ProcessActivityRunAsync(pipelineRunModel.Id, pipelineName, activityJson);
            }

            await _context.SaveChangesAsync();

            // Gerar métricas
            var metrics = await GenerateMetricsFromPipelineRunAsync(pipelineRunModel);
            await _context.Metrics.AddRangeAsync(metrics);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Processed pipeline run {RunId} for pipeline {PipelineName}", runId, pipelineName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing pipeline run");
            throw;
        }
    }

    private async Task ProcessActivityRunAsync(Guid pipelineRunId, string pipelineName, JsonElement activityJson)
    {
        var activityRunId = activityJson.GetProperty("activityRunId").GetString() ?? "";

        var existing = await _context.AdfActivityRuns
            .FirstOrDefaultAsync(a =>
                a.PipelineRunId == pipelineRunId &&
                a.ActivityRunId == activityRunId);

        if (existing != null)
        {
            UpdateActivityRunFromJson(existing, activityJson);
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            var activityModel = CreateActivityRunFromJson(pipelineRunId, pipelineName, activityJson);
            await _context.AdfActivityRuns.AddAsync(activityModel);
        }
    }

    private AdfPipelineRun CreatePipelineRunFromJson(Guid integrationId, JsonElement pipelineRun)
    {
        var runStart = DateTime.Parse(pipelineRun.GetProperty("runStart").GetString() ?? "");
        var runEnd = pipelineRun.TryGetProperty("runEnd", out var re) && re.ValueKind != JsonValueKind.Null
            ? DateTime.Parse(re.GetString()!)
            : (DateTime?)null;

        var durationMs = pipelineRun.TryGetProperty("durationInMs", out var dur) && dur.ValueKind != JsonValueKind.Null
            ? dur.GetInt64()
            : (long?)null;

        return new AdfPipelineRun
        {
            Id = Guid.NewGuid(),
            IntegrationId = integrationId,
            RunId = pipelineRun.GetProperty("runId").GetString() ?? "",
            PipelineName = pipelineRun.GetProperty("pipelineName").GetString() ?? "",
            RunStart = runStart,
            RunEnd = runEnd,
            DurationMs = durationMs,
            Status = pipelineRun.GetProperty("status").GetString() ?? "",
            Message = pipelineRun.TryGetProperty("message", out var msg) ? msg.GetString() : null,
            RunGroupId = pipelineRun.TryGetProperty("runGroupId", out var rg) ? rg.GetString() : null,
            IsLatest = pipelineRun.TryGetProperty("isLatest", out var il) && il.GetBoolean(),
            Parameters = pipelineRun.TryGetProperty("parameters", out var p) && p.ValueKind == JsonValueKind.Object
                ? JsonSerializer.Deserialize<Dictionary<string, object>>(p.GetRawText())
                : null,
            InvokedByType = pipelineRun.TryGetProperty("invokedBy", out var ib) && ib.TryGetProperty("invokedByType", out var ibt)
                ? ibt.GetString()
                : null,
            InvokedByName = pipelineRun.TryGetProperty("invokedBy", out var ib2) && ib2.TryGetProperty("name", out var ibn)
                ? ibn.GetString()
                : null,
            Annotations = pipelineRun.TryGetProperty("annotations", out var ann) && ann.ValueKind == JsonValueKind.Array
                ? ann.EnumerateArray().Select(a => a.GetString() ?? "").ToList()
                : null
        };
    }

    private void UpdatePipelineRunFromJson(AdfPipelineRun model, JsonElement pipelineRun)
    {
        var runEnd = pipelineRun.TryGetProperty("runEnd", out var re) && re.ValueKind != JsonValueKind.Null
            ? DateTime.Parse(re.GetString()!)
            : (DateTime?)null;

        var durationMs = pipelineRun.TryGetProperty("durationInMs", out var dur) && dur.ValueKind != JsonValueKind.Null
            ? dur.GetInt64()
            : (long?)null;

        model.RunEnd = runEnd;
        model.DurationMs = durationMs;
        model.Status = pipelineRun.GetProperty("status").GetString() ?? "";
        model.Message = pipelineRun.TryGetProperty("message", out var msg) ? msg.GetString() : null;
        model.IsLatest = pipelineRun.TryGetProperty("isLatest", out var il) && il.GetBoolean();
    }

    private AdfActivityRun CreateActivityRunFromJson(Guid pipelineRunId, string pipelineName, JsonElement activityJson)
    {
        var activityRunStart = DateTime.Parse(activityJson.GetProperty("activityRunStart").GetString() ?? "");
        var activityRunEnd = activityJson.TryGetProperty("activityRunEnd", out var are) && are.ValueKind != JsonValueKind.Null
            ? DateTime.Parse(are.GetString()!)
            : (DateTime?)null;

        var durationMs = activityJson.TryGetProperty("durationInMs", out var dur) && dur.ValueKind != JsonValueKind.Null
            ? dur.GetInt64()
            : (long?)null;

        return new AdfActivityRun
        {
            Id = Guid.NewGuid(),
            PipelineRunId = pipelineRunId,
            ActivityRunId = activityJson.GetProperty("activityRunId").GetString() ?? "",
            ActivityName = activityJson.GetProperty("activityName").GetString() ?? "",
            ActivityType = activityJson.GetProperty("activityType").GetString() ?? "",
            PipelineName = pipelineName,
            PipelineRunIdRef = activityJson.GetProperty("pipelineRunId").GetString() ?? "",
            ActivityRunStart = activityRunStart,
            ActivityRunEnd = activityRunEnd,
            DurationMs = durationMs,
            Status = activityJson.GetProperty("status").GetString() ?? "",
            Error = activityJson.TryGetProperty("error", out var err) && err.ValueKind == JsonValueKind.Object
                ? JsonSerializer.Deserialize<Dictionary<string, object>>(err.GetRawText())
                : null,
            Input = activityJson.TryGetProperty("input", out var inp) && inp.ValueKind == JsonValueKind.Object
                ? JsonSerializer.Deserialize<Dictionary<string, object>>(inp.GetRawText())
                : null,
            Output = activityJson.TryGetProperty("output", out var outp) && outp.ValueKind == JsonValueKind.Object
                ? JsonSerializer.Deserialize<Dictionary<string, object>>(outp.GetRawText())
                : null,
            LinkedServiceName = activityJson.TryGetProperty("linkedServiceName", out var lsn) ? lsn.GetString() : null
        };
    }

    private void UpdateActivityRunFromJson(AdfActivityRun model, JsonElement activityJson)
    {
        var activityRunEnd = activityJson.TryGetProperty("activityRunEnd", out var are) && are.ValueKind != JsonValueKind.Null
            ? DateTime.Parse(are.GetString()!)
            : (DateTime?)null;

        var durationMs = activityJson.TryGetProperty("durationInMs", out var dur) && dur.ValueKind != JsonValueKind.Null
            ? dur.GetInt64()
            : (long?)null;

        model.ActivityRunEnd = activityRunEnd;
        model.DurationMs = durationMs;
        model.Status = activityJson.GetProperty("status").GetString() ?? "";
        model.Error = activityJson.TryGetProperty("error", out var err) && err.ValueKind == JsonValueKind.Object
            ? JsonSerializer.Deserialize<Dictionary<string, object>>(err.GetRawText())
            : null;
        model.Output = activityJson.TryGetProperty("output", out var outp) && outp.ValueKind == JsonValueKind.Object
            ? JsonSerializer.Deserialize<Dictionary<string, object>>(outp.GetRawText())
            : null;
    }

    public async Task<List<MetricSnapshot>> GenerateMetricsFromPipelineRunAsync(AdfPipelineRun pipelineRun)
    {
        var metrics = new List<MetricSnapshot>();
        var timestamp = pipelineRun.RunEnd ?? DateTime.UtcNow;

        // Métricas do Pipeline Run
        if (pipelineRun.DurationMs.HasValue)
        {
            metrics.Add(new MetricSnapshot
            {
                Timestamp = timestamp,
                ProfileId = Guid.Empty, // Será preenchido posteriormente
                Source = "adf",
                MetricName = "pipeline_run_duration_ms",
                Value = pipelineRun.DurationMs.Value,
                Tags = new Dictionary<string, string>
                {
                    { "pipeline_name", pipelineRun.PipelineName },
                    { "run_id", pipelineRun.RunId },
                    { "status", pipelineRun.Status },
                    { "invoked_by", pipelineRun.InvokedByType ?? "unknown" }
                }
            });
        }

        // Métrica de status (0 = failed, 1 = succeeded, 0.5 = in progress)
        var statusValue = pipelineRun.Status.ToLower() switch
        {
            "succeeded" => 1.0,
            "failed" => 0.0,
            "inprogress" => 0.5,
            "queued" => 0.25,
            "cancelled" => -1.0,
            _ => 0.0
        };

        metrics.Add(new MetricSnapshot
        {
            Timestamp = timestamp,
            ProfileId = Guid.Empty,
            Source = "adf",
            MetricName = "pipeline_run_status",
            Value = statusValue,
            Tags = new Dictionary<string, string>
            {
                { "pipeline_name", pipelineRun.PipelineName },
                { "run_id", pipelineRun.RunId },
                { "status", pipelineRun.Status }
            }
        });

        // Métricas de activities
        var activities = await _context.AdfActivityRuns
            .Where(a => a.PipelineRunId == pipelineRun.Id)
            .ToListAsync();

        var failedActivities = activities.Count(a => a.Status.ToLower() == "failed");
        var succeededActivities = activities.Count(a => a.Status.ToLower() == "succeeded");

        metrics.Add(new MetricSnapshot
        {
            Timestamp = timestamp,
            ProfileId = Guid.Empty,
            Source = "adf",
            MetricName = "pipeline_run_failed_activities_count",
            Value = failedActivities,
            Tags = new Dictionary<string, string>
            {
                { "pipeline_name", pipelineRun.PipelineName },
                { "run_id", pipelineRun.RunId }
            }
        });

        metrics.Add(new MetricSnapshot
        {
            Timestamp = timestamp,
            ProfileId = Guid.Empty,
            Source = "adf",
            MetricName = "pipeline_run_succeeded_activities_count",
            Value = succeededActivities,
            Tags = new Dictionary<string, string>
            {
                { "pipeline_name", pipelineRun.PipelineName },
                { "run_id", pipelineRun.RunId }
            }
        });

        return metrics;
    }

    public async Task<List<AdfPipelineRun>> GetPipelineRunsAsync(Guid integrationId, string? pipelineName = null, int limit = 100)
    {
        var query = _context.AdfPipelineRuns
            .Where(r => r.IntegrationId == integrationId);

        if (!string.IsNullOrEmpty(pipelineName))
        {
            query = query.Where(r => r.PipelineName == pipelineName);
        }

        return await query
            .OrderByDescending(r => r.RunStart)
            .Take(limit)
            .Include(r => r.ActivityRuns)
            .ToListAsync();
    }

    public async Task<AdfPipelineRun?> GetPipelineRunByIdAsync(Guid pipelineRunId)
    {
        return await _context.AdfPipelineRuns
            .Include(r => r.ActivityRuns)
            .FirstOrDefaultAsync(r => r.Id == pipelineRunId);
    }
}
