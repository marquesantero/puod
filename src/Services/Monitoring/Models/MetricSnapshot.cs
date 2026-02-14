using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.Monitoring.Models;

[Table("metrics")]
public class MetricSnapshot
{
    [Column("time")]
    [Required]
    public DateTime Timestamp { get; set; }

    [Column("profile_id")]
    [Required]
    public Guid ProfileId { get; set; }

    [Column("source")]
    [Required]
    public string Source { get; set; } = string.Empty;

    [Column("metric_name")]
    [Required]
    public string MetricName { get; set; } = string.Empty;

    [Column("value")]
    [Required]
    public double Value { get; set; }

    [Column("tags", TypeName = "jsonb")]
    public Dictionary<string, string>? Tags { get; set; }
}
