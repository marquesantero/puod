namespace Puod.Services.Integration.Models;

/// <summary>
/// Representa uma integração configurada com BI tool (Databricks, Synapse, Airflow)
/// </summary>
public class Integration
{
    public long Id { get; set; }
    public long? ProfileId { get; set; }
    public long? GroupId { get; set; }
    public OwnerType OwnerType { get; set; } = OwnerType.Company;
    public List<long> CompanyIds { get; set; } = new();
    public long? ClientId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ConnectorType Type { get; set; }
    public string? ConfigJson { get; set; } = "{}";
    public IntegrationStatus Status { get; set; } = IntegrationStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeletedAt { get; set; }
    public bool IsDeleted { get; set; }
    public long? CreatedBy { get; set; }
    public long? UpdatedBy { get; set; }
    public long? DeletedBy { get; set; }
}

public enum OwnerType
{
    Company,
    Group,
    Client
}

public enum ConnectorType
{
    Databricks,
    Synapse,
    Airflow,
    AzureDataFactory
}

public enum IntegrationStatus
{
    Pending,
    Active,
    Error,
    Disabled
}
