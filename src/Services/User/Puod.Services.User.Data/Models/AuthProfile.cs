using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.User.Models;

public enum AuthProviderType
{
    Local,
    WindowsAd,
    AzureAd
}

[Table("auth_profiles")]
public class AuthProfile : IAuditableEntity, ISoftDelete
{
    [Key]
    [Column("id")]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    [Column("profile_id")]
    public long? ProfileId { get; set; }

    [Required]
    [Column("owner_type")]
    public OwnerType OwnerType { get; set; } = OwnerType.Company;

    [Column("company_ids")]
    public List<long> CompanyIds { get; set; } = new();

    [Column("client_id")]
    public long? ClientId { get; set; }

    [Required]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("provider_type")]
    public AuthProviderType ProviderType { get; set; } = AuthProviderType.Local;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("domains")]
    public List<string> Domains { get; set; } = new();

    [Column("config_json")]
    public string ConfigJson { get; set; } = "{}";

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

    public Profile? Profile { get; set; }
    public Client? Client { get; set; }
}
