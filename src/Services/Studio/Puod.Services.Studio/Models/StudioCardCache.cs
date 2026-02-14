namespace Puod.Services.Studio.Models;

public class StudioCardCache
{
    public long Id { get; set; }
    public long CardId { get; set; }
    public DateTime RefreshedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool Success { get; set; }
    public string? DataJson { get; set; }
    public string? ErrorMessage { get; set; }
}
