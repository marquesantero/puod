namespace Puod.Services.Studio.Models;

public class StudioCard
{
    public long Id { get; set; }
    public long OwnerUserId { get; set; }
    public StudioScope Scope { get; set; }
    public long? ClientId { get; set; }
    public long? ProfileId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string CardType { get; set; } = string.Empty;
    public string LayoutType { get; set; } = string.Empty;
    public StudioCardStatus Status { get; set; } = StudioCardStatus.Draft;
    public long? IntegrationId { get; set; }
    public string? Query { get; set; }
    public string? FieldsJson { get; set; }
    public string? StyleJson { get; set; }
    public string? LayoutJson { get; set; }
    public string? RefreshPolicyJson { get; set; }
    public string? DataSourceJson { get; set; }
    public DateTime? LastTestedAt { get; set; }
    public bool LastTestSucceeded { get; set; }
    public string? LastTestSignature { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
