using Puod.Services.User.DTOs;
using Puod.Services.User.Models;

namespace Puod.Services.User.Services;

public class BootstrapAuthService : IAuthService
{
    private static readonly long BootstrapUserId = 1;
    private static readonly long BootstrapProfileId = 0;
    private const string BootstrapUsername = "puod_admin";
    private const string BootstrapPassword = "passwd_admin";

    private readonly IJwtTokenService _jwtTokenService;
    private readonly BootstrapRefreshTokenStore _refreshTokenStore;
    private readonly ILogger<BootstrapAuthService> _logger;

    public BootstrapAuthService(
        IJwtTokenService jwtTokenService,
        BootstrapRefreshTokenStore refreshTokenStore,
        ILogger<BootstrapAuthService> logger)
    {
        _jwtTokenService = jwtTokenService;
        _refreshTokenStore = refreshTokenStore;
        _logger = logger;
    }

    public Task<LoginResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        return Task.FromException<LoginResponse>(
            new InvalidOperationException("Registration is disabled in bootstrap mode."));
    }

    public Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        if (!IsBootstrapCredentials(request))
        {
            throw new InvalidOperationException("Invalid credentials");
        }

        var user = CreateBootstrapUser();
        var refreshToken = _jwtTokenService.GenerateRefreshToken(user.Id);
        _refreshTokenStore.Store(refreshToken.Token, user.Id, refreshToken.ExpiresAt);

        return Task.FromResult(BuildLoginResponse(user, refreshToken));
    }

    public Task<DiscoveryResponse> DiscoverAsync(string email, CancellationToken ct = default)
    {
        // Bootstrap admin is always Local
        return Task.FromResult(new DiscoveryResponse("Local", null, null, "PUOD Platform", "Local Authentication"));
    }

    public Task<LoginResponse> CallbackAsync(CallbackRequest request, CancellationToken ct = default)
    {
        throw new InvalidOperationException("Bootstrap admin does not support OAuth callback.");
    }

    public Task<LoginResponse> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        if (!_refreshTokenStore.TryUse(refreshToken, out var userId))
        {
            throw new InvalidOperationException("Invalid refresh token");
        }

        var user = CreateBootstrapUser(userId);
        var newRefresh = _jwtTokenService.GenerateRefreshToken(user.Id);
        _refreshTokenStore.Store(newRefresh.Token, user.Id, newRefresh.ExpiresAt);

        return Task.FromResult(BuildLoginResponse(user, newRefresh));
    }

    public Task RevokeAsync(string refreshToken, CancellationToken ct = default)
    {
        _refreshTokenStore.Revoke(refreshToken);
        return Task.CompletedTask;
    }

    public Task<List<AzureProfileInfo>> GetAzureProfilesAsync(CancellationToken ct = default)
    {
        // Bootstrap mode doesn't have Azure profiles
        return Task.FromResult(new List<AzureProfileInfo>());
    }

    public Task<bool> CheckUserExistsAsync(string email, CancellationToken ct = default)
    {
        // Bootstrap admin always exists
        if (string.Equals(email?.Trim(), BootstrapUsername, StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(true);
        }
        return Task.FromResult(false);
    }

    private static bool IsBootstrapCredentials(LoginRequest request)
    {
        return string.Equals(request.Email?.Trim(), BootstrapUsername, StringComparison.OrdinalIgnoreCase)
               && string.Equals(request.Password, BootstrapPassword, StringComparison.Ordinal);
    }

    private static Models.User CreateBootstrapUser(long? overrideId = null)
    {
        return new Models.User
        {
            Id = overrideId ?? BootstrapUserId,
            Email = BootstrapUsername,
            PasswordHash = string.Empty,
            ProfileId = BootstrapProfileId,
            Roles = new List<string> { SystemRoles.PlatformAdmin }
        };
    }

    private LoginResponse BuildLoginResponse(Models.User user, RefreshToken refreshToken)
    {
        var accessToken = _jwtTokenService.GenerateAccessToken(user);
        var expires = DateTime.UtcNow.AddMinutes(60);
        _logger.LogInformation("Generated bootstrap tokens for user {UserId}", user.Id);
        return new LoginResponse(accessToken, refreshToken.Token, expires);
    }
}
