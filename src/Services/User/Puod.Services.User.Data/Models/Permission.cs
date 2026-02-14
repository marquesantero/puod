using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.User.Models;

[Table("permissions")]
public class Permission
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = string.Empty; // Ex: "CardStudio.Create"

    [Required]
    [Column("category")]
    public string Category { get; set; } = string.Empty; // Ex: "Card Studio"

    [Required]
    [Column("description")]
    public string Description { get; set; } = string.Empty; // Ex: "Can create new cards"

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
