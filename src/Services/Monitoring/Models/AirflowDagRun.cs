using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.Monitoring.Models;

/// <summary>
/// Representa uma execução de DAG do Airflow
/// </summary>
[Table("airflow_dag_runs")]
public class AirflowDagRun
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("integration_id")]
    [Required]
    public Guid IntegrationId { get; set; }

    [Column("dag_run_id")]
    [Required]
    [MaxLength(255)]
    public string DagRunId { get; set; } = string.Empty;

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

    [Column("state")]
    [MaxLength(50)]
    public string State { get; set; } = string.Empty; // queued, running, success, failed

    [Column("run_type")]
    [MaxLength(50)]
    public string? RunType { get; set; } // manual, scheduled, backfill

    [Column("external_trigger")]
    public bool ExternalTrigger { get; set; }

    [Column("conf", TypeName = "jsonb")]
    public Dictionary<string, object>? Configuration { get; set; }

    [Column("duration_seconds")]
    public int? DurationSeconds { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public List<AirflowTaskInstance> TaskInstances { get; set; } = new();
}
