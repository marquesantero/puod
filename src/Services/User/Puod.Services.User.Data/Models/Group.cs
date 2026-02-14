using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.User.Models;

[Table("groups")]
public class Group : IAuditableEntity, ISoftDelete
{
    [Key]
    [Column("id")]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    [Required]
    [Column("profile_id")]
    public long ProfileId { get; set; }

    [Required]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("description")]
    public string? Description { get; set; }

    [Required]
    [Column("type")]
    public GroupType Type { get; set; } = GroupType.Local;

    /// <summary>
    /// External ID from AD/Azure AD
    /// </summary>
    [Column("external_id")]
    public string? ExternalId { get; set; }

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

    // Navigation properties
    public Profile? Profile { get; set; }
    public List<UserGroup> UserGroups { get; set; } = new();
    public List<GroupTenantRole> GroupTenantRoles { get; set; } = new();
}
