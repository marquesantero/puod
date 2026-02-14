using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.Monitoring.Models;

public enum AlertCondition
{
    GreaterThan,
    LessThan,
    EqualTo
}

public class NotificationChannel
{
    public string Type { get; set; } = string.Empty; // "email", "slack", "webhook"
    public string Target { get; set; } = string.Empty; // email address, webhook url, etc.
}

[Table("alert_rules")]
public class AlertRule
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("profile_id")]
    [Required]
    public Guid ProfileId { get; set; }

    [Column("name")]
    [Required]
    public string Name { get; set; } = string.Empty;

    [Column("metric_name")]
    [Required]
    public string MetricName { get; set; } = string.Empty;

    [Column("condition")]
    [Required]
    public AlertCondition Condition { get; set; }

    [Column("threshold")]
    [Required]
    public double Threshold { get; set; }

    [Column("duration_minutes")]
    public int DurationMinutes { get; set; } = 5;

    [Column("channels", TypeName = "jsonb")]
    [Required]
    public List<NotificationChannel> Channels { get; set; } = new();

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
