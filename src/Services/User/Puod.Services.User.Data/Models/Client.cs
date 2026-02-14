using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.User.Models;

[Table("clients")]
public class Client : IAuditableEntity, ISoftDelete
{
    [Key]
    [Column("id")]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    [Required]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("slug")]
    public string Slug { get; set; } = string.Empty;

    // Info Fields (Moved from Profile conceptually)
    [Column("tax_id")] public string? TaxId { get; set; }
    [Column("website")] public string? Website { get; set; }
    [Column("email")] public string? Email { get; set; }
    [Column("phone")] public string? Phone { get; set; }
    [Column("address")] public string? Address { get; set; }
    [Column("city")] public string? City { get; set; }
    [Column("state")] public string? State { get; set; }
    [Column("country")] public string? Country { get; set; }
    [Column("postal_code")] public string? PostalCode { get; set; }
    [Column("description")] public string? Description { get; set; }
    [Column("industry")] public string? Industry { get; set; }
    [Column("employee_count")] public int? EmployeeCount { get; set; }
    [Column("founded_date")] public DateTime? FoundedDate { get; set; }
    [Column("logo_url")] public string? LogoUrl { get; set; }

    [Column("tier")]
    public SubscriptionTier Tier { get; set; } = SubscriptionTier.Free;

    [Column("is_alterable")]
    public bool IsAlterable { get; set; } = true;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    // Standard Audit
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime? UpdatedAt { get; set; }
    [Column("is_deleted")] public bool IsDeleted { get; set; }
    [Column("deleted_at")] public DateTime? DeletedAt { get; set; }
    [Column("created_by")] public long? CreatedBy { get; set; }
    [Column("updated_by")] public long? UpdatedBy { get; set; }
    [Column("deleted_by")] public long? DeletedBy { get; set; }

    // Navigation properties
    public List<Profile> Companies { get; set; } = new();
    public List<User> Users { get; set; } = new();
    public List<AuthProfile> AuthProfiles { get; set; } = new();
    public List<IntegrationConnection> Integrations { get; set; } = new();
}
