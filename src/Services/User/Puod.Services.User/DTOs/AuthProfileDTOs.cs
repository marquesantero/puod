using System.Text.Json.Serialization;
using Puod.Services.User.Models;

namespace Puod.Services.User.DTOs;

public record AuthProfileListResponse(
    long Id,
    long? ProfileId,
    OwnerType OwnerType,
    List<long> CompanyIds,
    long? ClientId,
    string Name,
    string ProviderType,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record AuthProfileDetailResponse(
    long Id,
    long? ProfileId,
    OwnerType OwnerType,
    List<long> CompanyIds,
    long? ClientId,
    string Name,
    [property: JsonConverter(typeof(JsonStringEnumConverter))] AuthProviderType ProviderType,
    List<string> Domains,
    object Config,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record AuthProfileCreateRequest(
    long? ProfileId,
    long? ClientId,
    List<long>? CompanyIds,
    string Name,
    [property: JsonConverter(typeof(JsonStringEnumConverter))] AuthProviderType ProviderType,
    List<string> Domains,
    object Config
);

public record AuthProfileUpdateRequest(
    string Name,
    List<string> Domains,
    List<long>? CompanyIds,
    bool? IsActive,
    object Config
);

public record WindowsAdConfig
{
    [JsonPropertyName("domain")]
    public string Domain { get; set; } = string.Empty;

    [JsonPropertyName("ldapUrl")]
    public string LdapUrl { get; set; } = string.Empty;

    [JsonPropertyName("baseDn")]
    public string BaseDn { get; set; } = string.Empty;

    [JsonPropertyName("bindDn")]
    public string? BindDn { get; set; }

    [JsonPropertyName("bindPassword")]
    public string? BindPassword { get; set; }

    [JsonPropertyName("userFilter")]
    public string? UserFilter { get; set; }

    [JsonPropertyName("groupFilter")]
    public string? GroupFilter { get; set; }

    [JsonPropertyName("useSsl")]
    public bool UseSsl { get; set; } = true;

    [JsonPropertyName("startTls")]
    public bool StartTls { get; set; }

    [JsonPropertyName("timeoutSeconds")]
    public int TimeoutSeconds { get; set; } = 15;
}

public record AzureAdConfig
{
    [JsonPropertyName("tenantId")]
    public string TenantId { get; set; } = string.Empty;

    [JsonPropertyName("clientId")]
    public string ClientId { get; set; } = string.Empty;

    [JsonPropertyName("clientSecret")]
    public string? ClientSecret { get; set; }

    [JsonPropertyName("authUrl")]
    public string AuthUrl { get; set; } = string.Empty;

    [JsonPropertyName("tokenUrl")]
    public string TokenUrl { get; set; } = string.Empty;

    [JsonPropertyName("authority")]
    public string Authority { get; set; } = string.Empty;

    [JsonPropertyName("redirectUri")]
    public string RedirectUri { get; set; } = string.Empty;

    [JsonPropertyName("scopes")]
    public string Scopes { get; set; } = "openid profile email";

    [JsonPropertyName("issuer")]
    public string Issuer { get; set; } = string.Empty;

    [JsonPropertyName("usePkce")]
    public bool UsePkce { get; set; } = true;

    /// <summary>
    /// Optional pre-authenticated access token for Graph API.
    /// When provided, ClientSecret is not required.
    /// </summary>
    [JsonPropertyName("accessToken")]
    public string? AccessToken { get; set; }
}
