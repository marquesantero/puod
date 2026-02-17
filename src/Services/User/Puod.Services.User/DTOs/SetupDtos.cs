using System.ComponentModel.DataAnnotations;

namespace Puod.Services.User.DTOs;

public record SetupStatusResponse(bool IsConfigured, int TenantCount, string? AdminEmail);

public record SetupStepStateResponse(
    string StepId,
    bool IsCompleted,
    DateTime? SavedAt,
    DateTime? CompletedAt,
    Dictionary<string, string?> Data);

public record SetupStepsResponse(IReadOnlyList<SetupStepStateResponse> Steps);

public record SetupStepSaveRequest(
    [Required] string StepId,
    Dictionary<string, string?> Data,
    bool IsCompleted);

public record SetupStepClearRequest([Required] string StepId);

public record TenantCreateRequest(
    string? TenantName,
    string? TenantSlug,
    string? CompanyName,
    [Required] string AdminEmail,
    string? AdminPassword,
    string? AdminName,
    bool EnableLocalAuth,
    bool EnableWindowsAd,
    bool EnableAzureAd,
    string? WindowsAdDomain,
    string? WindowsAdLdapUrl,
    string? WindowsAdBaseDn,
    string? WindowsAdBindDn,
    string? WindowsAdBindPassword,
    string? WindowsAdUserFilter,
    string? WindowsAdGroupFilter,
    bool? WindowsAdUseSsl,
    bool? WindowsAdStartTls,
    int? WindowsAdTimeoutSeconds,
    string? AzureTenantId,
    string? AzureClientId,
    string? AzureClientSecret,
    string? AzureAuthUrl,
    string? AzureTokenUrl,
    string? AzureAuthority,
    string? AzureRedirectUri,
    string? AzureScopes,
    string? AzureIssuer,
    bool? AzureUsePkce
);

public record TenantCreateResponse(long TenantId, long AdminUserId, string TenantSchema);
