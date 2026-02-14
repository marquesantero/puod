using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.User.Models;

/// <summary>
/// Tracks which companies a client-level user is available to
/// When a user is imported at the client level, they can be made available to specific companies
/// </summary>
[Table("client_user_company_availability")]
public class ClientUserCompanyAvailability : IAuditableEntity
{
    [Required]
    [Column("user_id")]
    public long UserId { get; set; }

    [Required]
    [Column("client_id")]
    public long ClientId { get; set; }

    [Required]
    [Column("company_id")]
    public long CompanyId { get; set; }

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
    public Profile? Company { get; set; }
}
