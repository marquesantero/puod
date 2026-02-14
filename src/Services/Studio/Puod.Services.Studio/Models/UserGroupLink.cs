namespace Puod.Services.Studio.Models;

public class UserGroupLink
{
    public long UserId { get; set; }
    public long GroupId { get; set; }
    public bool IsDeleted { get; set; }
}
