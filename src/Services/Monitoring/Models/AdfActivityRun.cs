using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.Monitoring.Models;

/// <summary>
/// Representa uma execução de activity dentro de um pipeline do Azure Data Factory
/// </summary>
[Table("adf_activity_runs")]
public class AdfActivityRun
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("pipeline_run_id")]
    [Required]
    public Guid PipelineRunId { get; set; }

    [ForeignKey(nameof(PipelineRunId))]
    public AdfPipelineRun? PipelineRun { get; set; }

    [Column("activity_run_id")]
    [Required]
    [MaxLength(255)]
    public string ActivityRunId { get; set; } = string.Empty;

    [Column("activity_name")]
    [Required]
    [MaxLength(255)]
    public string ActivityName { get; set; } = string.Empty;

    [Column("activity_type")]
    [Required]
    [MaxLength(100)]
    public string ActivityType { get; set; } = string.Empty; // Copy, Execute, ForEach, If, etc.

    [Column("pipeline_name")]
    [Required]
    [MaxLength(255)]
    public string PipelineName { get; set; } = string.Empty;

    [Column("pipeline_run_id_ref")]
    [MaxLength(255)]
    public string PipelineRunIdRef { get; set; } = string.Empty;

    [Column("activity_run_start")]
    [Required]
    public DateTime ActivityRunStart { get; set; }

    [Column("activity_run_end")]
    public DateTime? ActivityRunEnd { get; set; }

    [Column("duration_ms")]
    public long? DurationMs { get; set; }

    [Column("status")]
    [MaxLength(50)]
    [Required]
    public string Status { get; set; } = string.Empty; // InProgress, Succeeded, Failed, Cancelled

    [Column("error", TypeName = "jsonb")]
    public Dictionary<string, object>? Error { get; set; }

    [Column("input", TypeName = "jsonb")]
    public Dictionary<string, object>? Input { get; set; }

    [Column("output", TypeName = "jsonb")]
    public Dictionary<string, object>? Output { get; set; }

    [Column("linked_service_name")]
    [MaxLength(255)]
    public string? LinkedServiceName { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
