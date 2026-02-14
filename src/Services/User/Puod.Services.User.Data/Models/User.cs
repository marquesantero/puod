using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.User.Models;

[Table("users")]
public class User : IAuditableEntity, ISoftDelete
{
    [Key]
    [Column("id")]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    [Required]
    [Column("email")]
    public string Email { get; set; } = string.Empty;

    [Column("display_name")]
    public string? DisplayName { get; set; }

    [Column("photo_url")]
    public string? PhotoUrl { get; set; }

    [Required]
    [Column("password_hash")]
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>
    /// Client ID - if user belongs to a client (not a specific company)
    /// </summary>
    [Column("client_id")]
    public long? ClientId { get; set; }

    /// <summary>
    /// Profile ID - if user belongs to a specific company
    /// Note: A user belongs to either a Client OR a Company, not both
    /// </summary>
    [Column("profile_id")]
    public long? ProfileId { get; set; }

    [Column("roles")]
    public List<string> Roles { get; set; } = new() { "user" };

    [Column("external_id")]
    public string? ExternalId { get; set; }

    [Column("auth_provider")]
    public string AuthProvider { get; set; } = "Local"; // Local, WindowsAd, AzureAd

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    [Column("last_login_at")]
    public DateTime? LastLoginAt { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

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
    public Client? Client { get; set; }
    public Profile? Profile { get; set; }
    public List<RefreshToken> RefreshTokens { get; set; } = new();
    public List<AuditLog> AuditLogs { get; set; } = new();
    public List<UserTenantRole> UserTenantRoles { get; set; } = new();
}
