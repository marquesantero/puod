using System.ComponentModel.DataAnnotations;
using Puod.Services.User.Models;

namespace Puod.Services.User.DTOs;

public record RegisterRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(6)] string Password,
    string ProfileName,
    string? CompanyName);

public record LoginRequest(
    [Required] string Email,
    [Required] string Password);

public record RefreshTokenRequest([Required] string RefreshToken);

public record LoginResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt);

public record UserDto(long Id, string Email, long? ClientId, long? ProfileId, IEnumerable<string> Roles, DateTime CreatedAt, bool IsActive)
{
    public static UserDto FromEntity(Models.User user) =>
        new(user.Id, user.Email, user.ClientId, user.ProfileId, user.Roles, user.CreatedAt, user.IsActive);
}

public record JwtSettings
{
    public string Secret { get; init; } = string.Empty;
    public string Issuer { get; init; } = string.Empty;
    public string Audience { get; init; } = string.Empty;
    public int ExpirationMinutes { get; init; } = 60;
}

public record DiscoveryRequest([Required] string Email);

public record DiscoveryResponse(
    string AuthMethod, // Local, WindowsAd, AzureAd
    string? RedirectUrl, // For AzureAd
    object? Config, // Extra config if needed
    string? CompanyName,
    string? ProviderDisplayName
);

public record CallbackRequest(string Code, string State);

public record AzureProfileInfo(
    long Id,
    string Name,
    string AuthUrl,
    string? CompanyName
);
