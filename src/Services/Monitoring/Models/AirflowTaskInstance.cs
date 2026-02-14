using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.Monitoring.Models;

/// <summary>
/// Representa uma execução de task dentro de um DAG run do Airflow
/// </summary>
[Table("airflow_task_instances")]
public class AirflowTaskInstance
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("dag_run_id")]
    [Required]
    public Guid DagRunId { get; set; }

    [ForeignKey(nameof(DagRunId))]
    public AirflowDagRun? DagRun { get; set; }

    [Column("task_id")]
    [Required]
    [MaxLength(255)]
    public string TaskId { get; set; } = string.Empty;

    [Column("dag_id")]
    [Required]
    [MaxLength(255)]
    public string DagId { get; set; } = string.Empty;

    [Column("execution_date")]
    [Required]
    public DateTime ExecutionDate { get; set; }

    [Column("start_date")]
    public DateTime? StartDate { get; set; }

    [Column("end_date")]
    public DateTime? EndDate { get; set; }

    [Column("duration_seconds")]
    public double? DurationSeconds { get; set; }

    [Column("state")]
    [MaxLength(50)]
    public string State { get; set; } = string.Empty; // queued, running, success, failed, skipped

    [Column("try_number")]
    public int TryNumber { get; set; } = 1;

    [Column("max_tries")]
    public int MaxTries { get; set; } = 1;

    [Column("pool")]
    [MaxLength(100)]
    public string? Pool { get; set; }

    [Column("queue")]
    [MaxLength(100)]
    public string? Queue { get; set; }

    [Column("priority_weight")]
    public int? PriorityWeight { get; set; }

    [Column("operator")]
    [MaxLength(255)]
    public string? Operator { get; set; }

    [Column("queued_when")]
    public DateTime? QueuedWhen { get; set; }

    [Column("pid")]
    public int? Pid { get; set; }

    [Column("hostname")]
    [MaxLength(255)]
    public string? Hostname { get; set; }

    [Column("unixname")]
    [MaxLength(100)]
    public string? Unixname { get; set; }

    [Column("job_id")]
    public int? JobId { get; set; }

    [Column("pool_slots")]
    public int PoolSlots { get; set; } = 1;

    [Column("executor_config", TypeName = "jsonb")]
    public Dictionary<string, object>? ExecutorConfig { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
