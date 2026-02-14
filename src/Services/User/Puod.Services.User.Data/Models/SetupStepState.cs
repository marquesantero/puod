using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Puod.Services.User.Models;

[Table("setup_step_states")]
public class SetupStepState : IAuditableEntity, ISoftDelete
{
    [Key]
    [Column("id")]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    [Required]
    [Column("step_id")]
    public string StepId { get; set; } = string.Empty;

    [Column("data_json")]
    public string? DataJson { get; set; }

    [Column("is_completed")]
    public bool IsCompleted { get; set; }

    [Column("saved_at")]
    public DateTime? SavedAt { get; set; }

    [Column("completed_at")]
    public DateTime? CompletedAt { get; set; }

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
}
