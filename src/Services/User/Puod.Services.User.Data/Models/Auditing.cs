namespace Puod.Services.User.Models;

public interface IAuditableEntity
{
    DateTime CreatedAt { get; set; }
    DateTime? UpdatedAt { get; set; }
    long? CreatedBy { get; set; }
    long? UpdatedBy { get; set; }
}

public interface ISoftDelete
{
    bool IsDeleted { get; set; }
    DateTime? DeletedAt { get; set; }
    long? DeletedBy { get; set; }
}
