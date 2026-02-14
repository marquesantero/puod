using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Puod.Services.Monitoring.Data;
using Puod.Services.Monitoring.Models;

namespace Puod.Services.Monitoring.Services;

public interface IAirflowMetricsService
{
    Task ProcessDagRunAsync(Guid integrationId, JsonElement dagRun, List<JsonElement> taskInstances);
    Task<List<AirflowDagRun>> GetDagRunsAsync(Guid integrationId, string? dagId = null, int limit = 100);
    Task<AirflowDagRun?> GetDagRunByIdAsync(Guid dagRunId);
    Task<List<MetricSnapshot>> GenerateMetricsFromDagRunAsync(AirflowDagRun dagRun);
}

/// <summary>
/// Serviço para processar e armazenar métricas do Airflow
/// </summary>
public class AirflowMetricsService : IAirflowMetricsService
{
    private readonly MonitoringDbContext _context;
    private readonly ILogger<AirflowMetricsService> _logger;

    public AirflowMetricsService(MonitoringDbContext context, ILogger<AirflowMetricsService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task ProcessDagRunAsync(Guid integrationId, JsonElement dagRun, List<JsonElement> taskInstances)
    {
        try
        {
            var dagRunId = dagRun.GetProperty("dag_run_id").GetString() ?? "";
            var dagId = dagRun.GetProperty("dag_id").GetString() ?? "";

            // Verificar se já existe
            var existing = await _context.AirflowDagRuns
                .FirstOrDefaultAsync(r => r.IntegrationId == integrationId && r.DagRunId == dagRunId);

            AirflowDagRun dagRunModel;

            if (existing != null)
            {
                // Atualizar existente
                dagRunModel = existing;
                UpdateDagRunFromJson(dagRunModel, dagRun);
                dagRunModel.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                // Criar novo
                dagRunModel = CreateDagRunFromJson(integrationId, dagRun);
                await _context.AirflowDagRuns.AddAsync(dagRunModel);
            }

            await _context.SaveChangesAsync();

            // Processar task instances
            foreach (var taskJson in taskInstances)
            {
                await ProcessTaskInstanceAsync(dagRunModel.Id, dagId, taskJson);
            }

            await _context.SaveChangesAsync();

            // Gerar métricas
            var metrics = await GenerateMetricsFromDagRunAsync(dagRunModel);
            await _context.Metrics.AddRangeAsync(metrics);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Processed DAG run {DagRunId} for DAG {DagId}", dagRunId, dagId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing DAG run");
            throw;
        }
    }

    private async Task ProcessTaskInstanceAsync(Guid dagRunId, string dagId, JsonElement taskJson)
    {
        var taskId = taskJson.GetProperty("task_id").GetString() ?? "";
        var executionDate = DateTime.Parse(taskJson.GetProperty("execution_date").GetString() ?? "");

        var existing = await _context.AirflowTaskInstances
            .FirstOrDefaultAsync(t =>
                t.DagRunId == dagRunId &&
                t.TaskId == taskId &&
                t.ExecutionDate == executionDate);

        if (existing != null)
        {
            UpdateTaskInstanceFromJson(existing, taskJson);
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            var taskModel = CreateTaskInstanceFromJson(dagRunId, dagId, taskJson);
            await _context.AirflowTaskInstances.AddAsync(taskModel);
        }
    }

    private AirflowDagRun CreateDagRunFromJson(Guid integrationId, JsonElement dagRun)
    {
        var startDate = dagRun.TryGetProperty("start_date", out var sd) && sd.ValueKind != JsonValueKind.Null
            ? DateTime.Parse(sd.GetString()!)
            : (DateTime?)null;

        var endDate = dagRun.TryGetProperty("end_date", out var ed) && ed.ValueKind != JsonValueKind.Null
            ? DateTime.Parse(ed.GetString()!)
            : (DateTime?)null;

        return new AirflowDagRun
        {
            Id = Guid.NewGuid(),
            IntegrationId = integrationId,
            DagRunId = dagRun.GetProperty("dag_run_id").GetString() ?? "",
            DagId = dagRun.GetProperty("dag_id").GetString() ?? "",
            ExecutionDate = DateTime.Parse(dagRun.GetProperty("execution_date").GetString() ?? ""),
            StartDate = startDate,
            EndDate = endDate,
            State = dagRun.GetProperty("state").GetString() ?? "",
            RunType = dagRun.TryGetProperty("run_type", out var rt) ? rt.GetString() : null,
            ExternalTrigger = dagRun.TryGetProperty("external_trigger", out var et) && et.GetBoolean(),
            Configuration = dagRun.TryGetProperty("conf", out var conf) && conf.ValueKind == JsonValueKind.Object
                ? JsonSerializer.Deserialize<Dictionary<string, object>>(conf.GetRawText())
                : null,
            DurationSeconds = CalculateDuration(startDate, endDate)
        };
    }

    private void UpdateDagRunFromJson(AirflowDagRun model, JsonElement dagRun)
    {
        var startDate = dagRun.TryGetProperty("start_date", out var sd) && sd.ValueKind != JsonValueKind.Null
            ? DateTime.Parse(sd.GetString()!)
            : (DateTime?)null;

        var endDate = dagRun.TryGetProperty("end_date", out var ed) && ed.ValueKind != JsonValueKind.Null
            ? DateTime.Parse(ed.GetString()!)
            : (DateTime?)null;

        model.StartDate = startDate;
        model.EndDate = endDate;
        model.State = dagRun.GetProperty("state").GetString() ?? "";
        model.DurationSeconds = CalculateDuration(startDate, endDate);
    }

    private AirflowTaskInstance CreateTaskInstanceFromJson(Guid dagRunId, string dagId, JsonElement taskJson)
    {
        var startDate = taskJson.TryGetProperty("start_date", out var sd) && sd.ValueKind != JsonValueKind.Null
            ? DateTime.Parse(sd.GetString()!)
            : (DateTime?)null;

        var endDate = taskJson.TryGetProperty("end_date", out var ed) && ed.ValueKind != JsonValueKind.Null
            ? DateTime.Parse(ed.GetString()!)
            : (DateTime?)null;

        var duration = taskJson.TryGetProperty("duration", out var dur) && dur.ValueKind != JsonValueKind.Null
            ? dur.GetDouble()
            : (double?)null;

        return new AirflowTaskInstance
        {
            Id = Guid.NewGuid(),
            DagRunId = dagRunId,
            TaskId = taskJson.GetProperty("task_id").GetString() ?? "",
            DagId = dagId,
            ExecutionDate = DateTime.Parse(taskJson.GetProperty("execution_date").GetString() ?? ""),
            StartDate = startDate,
            EndDate = endDate,
            DurationSeconds = duration,
            State = taskJson.GetProperty("state").GetString() ?? "",
            TryNumber = taskJson.TryGetProperty("try_number", out var tn) ? tn.GetInt32() : 1,
            MaxTries = taskJson.TryGetProperty("max_tries", out var mt) ? mt.GetInt32() : 1,
            Pool = taskJson.TryGetProperty("pool", out var pool) ? pool.GetString() : null,
            Queue = taskJson.TryGetProperty("queue", out var queue) ? queue.GetString() : null,
            Operator = taskJson.TryGetProperty("operator", out var op) ? op.GetString() : null
        };
    }

    private void UpdateTaskInstanceFromJson(AirflowTaskInstance model, JsonElement taskJson)
    {
        var startDate = taskJson.TryGetProperty("start_date", out var sd) && sd.ValueKind != JsonValueKind.Null
            ? DateTime.Parse(sd.GetString()!)
            : (DateTime?)null;

        var endDate = taskJson.TryGetProperty("end_date", out var ed) && ed.ValueKind != JsonValueKind.Null
            ? DateTime.Parse(ed.GetString()!)
            : (DateTime?)null;

        var duration = taskJson.TryGetProperty("duration", out var dur) && dur.ValueKind != JsonValueKind.Null
            ? dur.GetDouble()
            : (double?)null;

        model.StartDate = startDate;
        model.EndDate = endDate;
        model.DurationSeconds = duration;
        model.State = taskJson.GetProperty("state").GetString() ?? "";
    }

    public async Task<List<MetricSnapshot>> GenerateMetricsFromDagRunAsync(AirflowDagRun dagRun)
    {
        var metrics = new List<MetricSnapshot>();
        var timestamp = dagRun.EndDate ?? DateTime.UtcNow;

        // Métricas do DAG Run
        if (dagRun.DurationSeconds.HasValue)
        {
            metrics.Add(new MetricSnapshot
            {
                Timestamp = timestamp,
                ProfileId = Guid.Empty, // Será preenchido posteriormente com o profile da integration
                Source = "airflow",
                MetricName = "dag_run_duration_seconds",
                Value = dagRun.DurationSeconds.Value,
                Tags = new Dictionary<string, string>
                {
                    { "dag_id", dagRun.DagId },
                    { "dag_run_id", dagRun.DagRunId },
                    { "state", dagRun.State },
                    { "run_type", dagRun.RunType ?? "unknown" }
                }
            });
        }

        // Métrica de status (0 = failed, 1 = success, 0.5 = running)
        var statusValue = dagRun.State.ToLower() switch
        {
            "success" => 1.0,
            "failed" => 0.0,
            "running" => 0.5,
            _ => 0.25
        };

        metrics.Add(new MetricSnapshot
        {
            Timestamp = timestamp,
            ProfileId = Guid.Empty,
            Source = "airflow",
            MetricName = "dag_run_status",
            Value = statusValue,
            Tags = new Dictionary<string, string>
            {
                { "dag_id", dagRun.DagId },
                { "dag_run_id", dagRun.DagRunId },
                { "state", dagRun.State }
            }
        });

        // Métricas de tasks
        var tasks = await _context.AirflowTaskInstances
            .Where(t => t.DagRunId == dagRun.Id)
            .ToListAsync();

        var failedTasks = tasks.Count(t => t.State.ToLower() == "failed");
        var successTasks = tasks.Count(t => t.State.ToLower() == "success");

        metrics.Add(new MetricSnapshot
        {
            Timestamp = timestamp,
            ProfileId = Guid.Empty,
            Source = "airflow",
            MetricName = "dag_run_failed_tasks_count",
            Value = failedTasks,
            Tags = new Dictionary<string, string>
            {
                { "dag_id", dagRun.DagId },
                { "dag_run_id", dagRun.DagRunId }
            }
        });

        metrics.Add(new MetricSnapshot
        {
            Timestamp = timestamp,
            ProfileId = Guid.Empty,
            Source = "airflow",
            MetricName = "dag_run_success_tasks_count",
            Value = successTasks,
            Tags = new Dictionary<string, string>
            {
                { "dag_id", dagRun.DagId },
                { "dag_run_id", dagRun.DagRunId }
            }
        });

        return metrics;
    }

    public async Task<List<AirflowDagRun>> GetDagRunsAsync(Guid integrationId, string? dagId = null, int limit = 100)
    {
        var query = _context.AirflowDagRuns
            .Where(r => r.IntegrationId == integrationId);

        if (!string.IsNullOrEmpty(dagId))
        {
            query = query.Where(r => r.DagId == dagId);
        }

        return await query
            .OrderByDescending(r => r.ExecutionDate)
            .Take(limit)
            .Include(r => r.TaskInstances)
            .ToListAsync();
    }

    public async Task<AirflowDagRun?> GetDagRunByIdAsync(Guid dagRunId)
    {
        return await _context.AirflowDagRuns
            .Include(r => r.TaskInstances)
            .FirstOrDefaultAsync(r => r.Id == dagRunId);
    }

    private int? CalculateDuration(DateTime? startDate, DateTime? endDate)
    {
        if (!startDate.HasValue || !endDate.HasValue)
            return null;

        return (int)(endDate.Value - startDate.Value).TotalSeconds;
    }
}
