using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.Monitoring.Models;

/// <summary>
/// Representa uma execução de pipeline do Azure Data Factory
/// </summary>
[Table("adf_pipeline_runs")]
public class AdfPipelineRun
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("integration_id")]
    [Required]
    public Guid IntegrationId { get; set; }

    [Column("run_id")]
    [Required]
    [MaxLength(255)]
    public string RunId { get; set; } = string.Empty;

    [Column("pipeline_name")]
    [Required]
    [MaxLength(255)]
    public string PipelineName { get; set; } = string.Empty;

    [Column("run_start")]
    [Required]
    public DateTime RunStart { get; set; }

    [Column("run_end")]
    public DateTime? RunEnd { get; set; }

    [Column("duration_ms")]
    public long? DurationMs { get; set; }

    [Column("status")]
    [MaxLength(50)]
    [Required]
    public string Status { get; set; } = string.Empty; // InProgress, Succeeded, Failed, Cancelled, Queued

    [Column("message")]
    public string? Message { get; set; }

    [Column("run_group_id")]
    [MaxLength(255)]
    public string? RunGroupId { get; set; }

    [Column("is_latest")]
    public bool IsLatest { get; set; } = true;

    [Column("parameters", TypeName = "jsonb")]
    public Dictionary<string, object>? Parameters { get; set; }

    [Column("invoked_by_type")]
    [MaxLength(100)]
    public string? InvokedByType { get; set; } // Manual, Schedule, Trigger

    [Column("invoked_by_name")]
    [MaxLength(255)]
    public string? InvokedByName { get; set; }

    [Column("annotations", TypeName = "jsonb")]
    public List<string>? Annotations { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public List<AdfActivityRun> ActivityRuns { get; set; } = new();
}
