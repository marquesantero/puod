using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.User.Models;

[Table("audit_logs")]
public class AuditLog : IAuditableEntity, ISoftDelete
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Required]
    [Column("user_id")]
    public long UserId { get; set; }

    [Required]
    [Column("profile_id")]
    public long ProfileId { get; set; }

    [Required]
    [Column("action")]
    public string Action { get; set; } = string.Empty;

    [Column("resource")]
    public string? Resource { get; set; }

    [Column("timestamp")]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    [Column("is_deleted")]
    public bool IsDeleted { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    [Column("created_by")]
    public long? CreatedBy { get; set; }

    [Column("updated_by")]
    public long? UpdatedBy { get; set; }

    [Column("deleted_by")]
    public long? DeletedBy { get; set; }

    [Column("ip_address")]
    public string? IpAddress { get; set; }

    [Column("details")]
    public Dictionary<string, object>? Details { get; set; }

    public User? User { get; set; }
}
