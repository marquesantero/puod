using Puod.Services.Studio.Models;

namespace Puod.Services.Studio.DTOs;

public record StudioCardDto(
    long Id,
    string Title,
    string CardType,
    string LayoutType,
    StudioCardStatus Status,
    StudioScope Scope,
    long? ClientId,
    long? ProfileId,
    long? IntegrationId,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? LastTestedAt,
    bool LastTestSucceeded
);

public record StudioCardDetailDto(
    long Id,
    string Title,
    string? Description,
    string CardType,
    string LayoutType,
    StudioCardStatus Status,
    StudioScope Scope,
    long? ClientId,
    long? ProfileId,
    long? IntegrationId,
    string? Query,
    string? FieldsJson,
    string? StyleJson,
    string? LayoutJson,
    string? RefreshPolicyJson,
    string? DataSourceJson,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? LastTestedAt,
    bool LastTestSucceeded,
    string? LastTestSignature
);

public record CreateStudioCardRequest(
    string Title,
    string? Description,
    StudioScope Scope,
    long? ClientId,
    long? ProfileId,
    string CardType,
    string LayoutType,
    long? IntegrationId,
    string? Query,
    string? FieldsJson,
    string? StyleJson,
    string? LayoutJson,
    string? RefreshPolicyJson,
    string? DataSourceJson,
    string? TestSignature,
    DateTime? TestedAt
);

public record UpdateStudioCardRequest(
    string? Title,
    string? Description,
    StudioCardStatus? Status,
    string? CardType,
    string? LayoutType,
    long? IntegrationId,
    string? Query,
    string? FieldsJson,
    string? StyleJson,
    string? LayoutJson,
    string? RefreshPolicyJson,
    string? DataSourceJson,
    string? TestSignature,
    DateTime? TestedAt
);

public record StudioCardTestRequest(
    long? IntegrationId,
    string? Query,
    string? CardType,
    string? LayoutType,
    string? FieldsJson,
    string? StyleJson,
    string? LayoutJson,
    string? RefreshPolicyJson,
    string? DataSourceJson
);

public record StudioCardTestResult(
    bool Success,
    string? ErrorMessage,
    string? Signature,
    double? ExecutionTimeMs
);

public record StudioDashboardDto(
    long Id,
    string Name,
    StudioDashboardStatus Status,
    StudioScope Scope,
    long? ClientId,
    long? ProfileId,
    string LayoutType,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record StudioDashboardDetailDto(
    long Id,
    string Name,
    string? Description,
    StudioDashboardStatus Status,
    StudioScope Scope,
    long? ClientId,
    long? ProfileId,
    string LayoutType,
    string? LayoutJson,
    string? RefreshPolicyJson,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<StudioDashboardCardDto> Cards
);

public record StudioDashboardCardDto(
    long Id,
    long CardId,
    string? Title,
    string? Description,
    bool ShowTitle,
    bool ShowDescription,
    long? IntegrationId,
    int OrderIndex,
    int PositionX,
    int PositionY,
    int Width,
    int Height,
    string? LayoutJson,
    string? RefreshPolicyJson,
    string? DataSourceJson
);

public record CreateStudioDashboardRequest(
    string Name,
    string? Description,
    StudioScope Scope,
    long? ClientId,
    long? ProfileId,
    string LayoutType,
    string? LayoutJson,
    string? RefreshPolicyJson
);

public record UpdateStudioDashboardRequest(
    string? Name,
    string? Description,
    StudioDashboardStatus? Status,
    string? LayoutType,
    string? LayoutJson,
    string? RefreshPolicyJson,
    List<UpsertStudioDashboardCardRequest>? Cards
);

public record UpsertStudioDashboardCardRequest(
    long? Id,
    long CardId,
    string? Title,
    string? Description,
    bool? ShowTitle,
    bool? ShowDescription,
    long? IntegrationId,
    int OrderIndex,
    int PositionX,
    int PositionY,
    int Width,
    int Height,
    string? LayoutJson,
    string? RefreshPolicyJson,
    string? DataSourceJson
);

public record StudioShareRequest(
    StudioShareTarget TargetType,
    long TargetId,
    StudioShareSubject SubjectType,
    long SubjectId,
    StudioShareAccess AccessLevel
);

public record StudioShareDto(
    long Id,
    StudioShareTarget TargetType,
    long TargetId,
    StudioShareSubject SubjectType,
    long SubjectId,
    StudioShareAccess AccessLevel,
    DateTime CreatedAt
);
