using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.User.Models;

[Table("user_groups")]
public class UserGroup : IAuditableEntity
{
    [Required]
    [Column("user_id")]
    public long UserId { get; set; }

    [Required]
    [Column("group_id")]
    public long GroupId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    [Column("created_by")]
    public long? CreatedBy { get; set; }

    [Column("updated_by")]
    public long? UpdatedBy { get; set; }

    // Navigation properties
    public User? User { get; set; }
    public Group? Group { get; set; }
}
