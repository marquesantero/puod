namespace Puod.Services.Studio.Models;

public class StudioDashboardCard
{
    public long Id { get; set; }
    public long DashboardId { get; set; }
    public long CardId { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public bool ShowTitle { get; set; } = true;
    public bool ShowDescription { get; set; } = true;
    public long? IntegrationId { get; set; }
    public int OrderIndex { get; set; }
    public int PositionX { get; set; }
    public int PositionY { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public string? LayoutJson { get; set; }
    public string? RefreshPolicyJson { get; set; }
    public string? DataSourceJson { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
