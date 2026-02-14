using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.Monitoring.Models;

public enum AlertSeverity
{
    Info,
    Warning,
    Critical
}

[Table("alerts")]
public class Alert
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("rule_id")]
    public Guid RuleId { get; set; }

    [ForeignKey(nameof(RuleId))]
    public AlertRule? Rule { get; set; }

    [Column("severity")]
    [Required]
    public AlertSeverity Severity { get; set; }

    [Column("message")]
    [Required]
    public string Message { get; set; } = string.Empty;

    [Column("triggered_at")]
    [Required]
    public DateTime TriggeredAt { get; set; }

    [Column("resolved_at")]
    public DateTime? ResolvedAt { get; set; }

    [Column("metadata", TypeName = "jsonb")]
    public Dictionary<string, object>? Metadata { get; set; }
}
