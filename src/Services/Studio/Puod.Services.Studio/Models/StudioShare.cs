namespace Puod.Services.Studio.Models;

public class StudioShare
{
    public long Id { get; set; }
    public StudioShareTarget TargetType { get; set; }
    public long TargetId { get; set; }
    public StudioShareSubject SubjectType { get; set; }
    public long SubjectId { get; set; }
    public StudioShareAccess AccessLevel { get; set; }
    public long SharedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
