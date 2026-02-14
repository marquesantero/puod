using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.Integration.Models;

/// <summary>
/// Configuração de monitoramento agendado para recursos (DAGs, Pipelines)
/// </summary>
[Table("scheduled_monitors")]
public class ScheduledMonitor
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("integration_id")]
    [Required]
    public long IntegrationId { get; set; }

    [ForeignKey(nameof(IntegrationId))]
    public Integration? Integration { get; set; }

    [Column("resource_type")]
    [Required]
    [MaxLength(50)]
    public string ResourceType { get; set; } = string.Empty; // "airflow_dag", "adf_pipeline"

    [Column("resource_id")]
    [Required]
    [MaxLength(255)]
    public string ResourceId { get; set; } = string.Empty; // DAG ID ou Pipeline name

    [Column("poll_interval_seconds")]
    [Required]
    public int PollIntervalSeconds { get; set; } = 300; // Default: 5 minutos

    [Column("last_poll_at")]
    public DateTime? LastPollAt { get; set; }

    [Column("next_poll_at")]
    public DateTime? NextPollAt { get; set; }

    [Column("last_status")]
    [MaxLength(50)]
    public string? LastStatus { get; set; }

    [Column("last_error")]
    public string? LastError { get; set; }

    [Column("consecutive_failures")]
    public int ConsecutiveFailures { get; set; } = 0;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("configuration", TypeName = "jsonb")]
    public Dictionary<string, string>? Configuration { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
