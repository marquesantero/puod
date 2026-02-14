using Puod.Services.Integration.Models;

namespace Puod.Services.Integration.DTOs;

public record CreateIntegrationRequest(
    long? ProfileId,
    long? ClientId,
    List<long>? CompanyIds,
    string Name,
    ConnectorType Type,
    Dictionary<string, string> Configuration
);

public record UpdateIntegrationRequest(
    string? Name,
    Dictionary<string, string>? Configuration,
    List<long>? CompanyIds,
    bool? IsActive
);

public record IntegrationDto(
    long Id,
    long ProfileId,
    OwnerType OwnerType,
    List<long> CompanyIds,
    long? ClientId,
    string Name,
    ConnectorType Type,
    IntegrationStatus Status,
    DateTime CreatedAt,
    DateTime? LastSyncAt,
    bool IsActive
);

public record IntegrationDetailDto(
    long Id,
    long ProfileId,
    OwnerType OwnerType,
    List<long> CompanyIds,
    long? ClientId,
    string Name,
    ConnectorType Type,
    IntegrationStatus Status,
    Dictionary<string, string> Configuration,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? LastSyncAt,
    bool IsActive
);

public record TestConnectionRequest(
    ConnectorType Type,
    Dictionary<string, string> Configuration
);

public record ExecuteQueryRequest(
    long IntegrationId,
    string Query,
    string? DataSourceJson = null
);

public record QueryResultDto(
    bool Success,
    string? ErrorMessage,
    List<Dictionary<string, object>>? Rows,
    int RowCount,
    double ExecutionTimeMs
);

public record UpdateIntegrationCookieRequest(
    string CookieHeader,
    string CookieDomain
);
