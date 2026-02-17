using System.Text.Json.Serialization;

namespace Puod.Services.User.DTOs;

public enum IdentitySource
{
    Local = 0,
    WindowsAd = 1,
    AzureAd = 2
}

public record IdentityUserResult(
    string Id,          // ID interno (Guid) ou Externo (SID/ObjectId)
    string Username,    // Email ou DOMAIN\User
    string DisplayName,
    IdentitySource Source,
    bool IsImported     // Se já existe na tabela Users local
)
{
    public long? ClientId { get; init; }
    public long? ProfileId { get; init; }
    public bool IsActive { get; init; }
}

public record UpdateUserStatusRequest(bool IsActive);

public record IdentityGroupResult(
    string Id,
    string Name,
    IdentitySource Source,
    bool IsImported
)
{
    public long ProfileId { get; init; }
}

public record PermissionDto(
    string Id,
    string Category,
    string Description
);

public record RoleDto(
    long Id,
    string Name,
    string? Description,
    List<string> PermissionIds,
    long? ClientId = null,
    long? ProfileId = null
);

public record CreateRoleRequest(
    string Name,
    string? Description,
    List<string> PermissionIds
);

public record UpdateRoleRequest(
    string? Description,
    List<string> PermissionIds
);

public record ImportUserRequest(
    long ProfileId,
    string ExternalId,
    string Username,
    string DisplayName,
    IdentitySource Source
)
{
    // For client-level imports: list of companies this user should be available to
    public List<long>? CompanyIds { get; init; }
    // Whether this is a client-level import (true) or company-level (false)
    public bool IsClientLevel { get; init; }
}

public record ImportGroupRequest(
    long ProfileId,
    string ExternalId,
    string Name,
    IdentitySource Source
);

public record UserRoleAssignmentRequest(
    long ProfileId,
    List<long> RoleIds
)
{
    // For client-level role assignment: which companies each role applies to
    public Dictionary<long, List<long>>? RoleCompanies { get; init; } // RoleId -> CompanyIds
}

public record GroupRoleAssignmentRequest(
    long ProfileId,
    List<long> RoleIds
)
{
    // For client-level role assignment: which companies each role applies to
    public Dictionary<long, List<long>>? RoleCompanies { get; init; } // RoleId -> CompanyIds
}

public record CompanyAvailabilityDto(
    long CompanyId,
    string CompanyName,
    string CompanySlug,
    bool IsAvailable
);

public record UpdateUserCompanyAvailabilityRequest(
    long ClientId,
    List<long> CompanyIds
);

public record GroupDto(
    long Id,
    string Name,
    string? Description,
    string Type,  // Local, WindowsAd, AzureAd
    string? ExternalId,
    int UserCount,
    List<string> RoleNames,
    DateTime CreatedAt
);

public record CreateGroupRequest(
    string Name,
    string? Description
);

public record UpdateGroupRequest(
    string Name,
    string? Description
);

public record GroupMembersDto(
    List<IdentityUserResult> Members
);

public record AddGroupMembersRequest(
    List<long> UserIds
);

public record CreateLocalUserRequest(
    long ProfileId,
    string Username,
    string DisplayName,
    string Password,
    string? PhotoUrl
)
{
    // For client-level creation: list of companies this user should be available to
    public List<long>? CompanyIds { get; init; }
    // Whether this is a client-level creation (true) or company-level (false)
    public bool IsClientLevel { get; init; }
}
