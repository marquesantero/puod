using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.User.Models;

/// <summary>
/// Represents a role assignment for a user
/// Can be at Client level (ClientId set) or Company level (ProfileId set)
/// When at Client level with ClientAdmin role, CompanyIds indicates which companies have access
/// </summary>
[Table("user_tenant_roles")]
public class UserTenantRole : IAuditableEntity
{
    [Key]
    [Column("id")]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    [Required]
    [Column("user_id")]
    public long UserId { get; set; }

    /// <summary>
    /// Client ID - set for client-level roles (e.g., ClientAdmin)
    /// </summary>
    [Column("client_id")]
    public long? ClientId { get; set; }

    /// <summary>
    /// Profile/Company ID - set for company-level roles (e.g., CompanyAdmin)
    /// </summary>
    [Column("profile_id")]
    public long? ProfileId { get; set; }

    [Required]
    [Column("role_name")]
    public string RoleName { get; set; } = string.Empty;

    [Column("role_id")]
    public long? RoleId { get; set; }

    /// <summary>
    /// List of Company IDs where this role applies
    /// Used for ClientAdmin to specify which companies the user can access
    /// </summary>
    [Column("company_ids")]
    public List<long> CompanyIds { get; set; } = new();

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
    public Client? Client { get; set; }
    public Profile? Profile { get; set; }
    public Role? Role { get; set; }
}
