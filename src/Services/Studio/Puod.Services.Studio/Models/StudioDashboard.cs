namespace Puod.Services.Studio.Models;

public class StudioDashboard
{
    public long Id { get; set; }
    public long OwnerUserId { get; set; }
    public StudioScope Scope { get; set; }
    public long? ClientId { get; set; }
    public long? ProfileId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string LayoutType { get; set; } = "grid";
    public StudioDashboardStatus Status { get; set; } = StudioDashboardStatus.Draft;
    public string? LayoutJson { get; set; }
    public string? RefreshPolicyJson { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
