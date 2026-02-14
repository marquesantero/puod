using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.User.Models;

public enum SubscriptionTier
{
    Free,
    Pro,
    Enterprise
}

[Table("profiles")]
public class Profile : IAuditableEntity, ISoftDelete
{
    [Key]
    [Column("id")]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    [Required]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("company_name")]
    public string? CompanyName { get; set; }

    [Required]
    [Column("slug")]
    public string Slug { get; set; } = "default";

    [Required]
    [Column("schema_name")]
    public string SchemaName { get; set; } = "tenant_default";

    [Column("client_id")]
    public long? ClientId { get; set; }

    [Column("inherit_from_client")]
    public bool InheritFromClient { get; set; } = true;

    // Granular inheritance fields
    [Column("inherit_basic_info")]
    public bool InheritBasicInfo { get; set; } = false;

    [Column("inherit_logo")]
    public bool InheritLogo { get; set; } = false;

    [Column("inherit_contact")]
    public bool InheritContact { get; set; } = false;

    [Column("inherit_address")]
    public bool InheritAddress { get; set; } = false;

    [Column("inherit_details")]
    public bool InheritDetails { get; set; } = false;

    [Column("inherit_authentication")]
    public bool InheritAuthentication { get; set; } = false;

    [Column("inherit_integrations")]
    public bool InheritIntegrations { get; set; } = false;

    [Column("logo_url")]
    public string? LogoUrl { get; set; }

    [Column("tax_id")]
    public string? TaxId { get; set; }

    [Column("website")]
    public string? Website { get; set; }

    [Column("email")]
    public string? Email { get; set; }

    [Column("phone")]
    public string? Phone { get; set; }

    [Column("address")]
    public string? Address { get; set; }

    [Column("city")]
    public string? City { get; set; }

    [Column("state")]
    public string? State { get; set; }

    [Column("country")]
    public string? Country { get; set; }

    [Column("postal_code")]
    public string? PostalCode { get; set; }

    [Column("description")]
    public string? Description { get; set; }

    [Column("industry")]
    public string? Industry { get; set; }

    [Column("employee_count")]
    public int? EmployeeCount { get; set; }

    [Column("founded_date")]
    public DateTime? FoundedDate { get; set; }

    // NOTE: Tier will be removed in MakeClientCompanyGroupRequired migration
    // Keeping it for now to support existing data during migration
    [Column("tier")]
    public SubscriptionTier Tier { get; set; } = SubscriptionTier.Free;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    [Column("setup_completed")]
    public bool SetupCompleted { get; set; }

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
    public List<User> Users { get; set; } = new();
    public List<UserTenantRole> UserTenantRoles { get; set; } = new();
}
