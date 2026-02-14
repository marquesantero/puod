using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.User.Models;

[Table("role_permissions")]
public class RolePermission
{
    [Required]
    [Column("role_id")]
    public long RoleId { get; set; }

    [Required]
    [Column("permission_id")]
    public string PermissionId { get; set; } = string.Empty;

    public Role? Role { get; set; }
    public Permission? Permission { get; set; }
}
