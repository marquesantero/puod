using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Client;
using Puod.Services.User.Data;
using Puod.Services.User.DTOs;
using Puod.Services.User.Models;

namespace Puod.Services.User.Services;

public class AuthService : IAuthService
{
    private readonly PuodDbContext _dbContext;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ILogger<AuthService> _logger;
    private readonly IServiceProvider _serviceProvider;

    public AuthService(PuodDbContext dbContext, IJwtTokenService jwtTokenService, ILogger<AuthService> logger, IServiceProvider serviceProvider)
    {
        _dbContext = dbContext;
        _jwtTokenService = jwtTokenService;
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    public Task<LoginResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        return Task.FromException<LoginResponse>(
            new InvalidOperationException("Registration is disabled. Use the admin panel to create users."));
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await _dbContext.Users.Include(u => u.RefreshTokens)
            .FirstOrDefaultAsync(u => u.Email == request.Email.ToLower(), ct);

        if (user == null)
        {
            throw new InvalidOperationException("Invalid credentials");
        }

        bool isValid = false;

        if (user.AuthProvider == "Local")
        {
            var provider = _serviceProvider.GetRequiredService<Puod.Services.User.Services.Identity.LocalIdentityProvider>();
            isValid = await provider.ValidateCredentialsAsync(request.Email, request.Password, null, ct);
        }
        else if (user.AuthProvider == "WindowsAd")
        {
            var provider = _serviceProvider.GetRequiredService<Puod.Services.User.Services.Identity.WindowsAdIdentityProvider>();

            var domain = user.Email.Split('@').LastOrDefault() ?? "";
            var authProfile = await _dbContext.AuthProfiles
                .FirstOrDefaultAsync(ap => ap.IsActive && ap.ProviderType == AuthProviderType.WindowsAd && ap.Domains.Contains(domain), ct);

            if (authProfile != null)
            {
                var config = System.Text.Json.JsonSerializer.Deserialize<WindowsAdConfig>(authProfile.ConfigJson);
                isValid = await provider.ValidateCredentialsAsync(user.ExternalId ?? user.Email, request.Password, config, ct);
            }
        }
        else if (user.AuthProvider == "AzureAd")
        {
            throw new InvalidOperationException("Azure AD users must login via the Microsoft portal.");
        }

        if (!isValid)
        {
            throw new InvalidOperationException("Invalid credentials");
        }

        user.LastLoginAt = DateTime.UtcNow;

        var refreshToken = _jwtTokenService.GenerateRefreshToken(user.Id);
        _dbContext.RefreshTokens.Add(refreshToken);

        await _dbContext.SaveChangesAsync(ct);

        var permissions = await GetUserPermissionsAsync(user.Id, user.ProfileId, ct);
        return BuildLoginResponse(user, refreshToken, permissions);
    }

    public async Task<DiscoveryResponse> DiscoverAsync(string email, CancellationToken ct = default)
    {
        _logger.LogInformation("Starting discovery for email: {Email}", email);

        if (string.IsNullOrWhiteSpace(email)) return new DiscoveryResponse("Local", null, null, null, "Local Authentication");

        var parts = email.Split('@');
        if (parts.Length != 2) return new DiscoveryResponse("Local", null, null, null, "Local Authentication");
        var domain = parts[1].ToLowerInvariant();

        var profiles = await _dbContext.AuthProfiles
            .Include(p => p.Profile)
            .Where(p => p.IsActive)
            .ToListAsync(ct);

        _logger.LogInformation("Found {Count} active auth profiles.", profiles.Count);

        foreach (var p in profiles)
        {
            _logger.LogInformation("Profile: {Name}, Type: {Type}, Domains: {Domains}",
                p.Name,
                p.ProviderType,
                p.Domains == null ? "NULL" : string.Join(", ", p.Domains));
        }

        var profile = profiles.FirstOrDefault(p => p.Domains != null && p.Domains.Contains(domain, StringComparer.OrdinalIgnoreCase));

        if (profile == null)
        {
            _logger.LogInformation("No matching profile found for domain {Domain}. Fallback to Local.", domain);
            return new DiscoveryResponse("Local", null, null, null, "Local Authentication");
        }

        // Get the display name based on owner type
        string companyName = "Unknown Company";
        if (profile.OwnerType == OwnerType.Company && profile.Profile != null)
        {
            companyName = profile.Profile.CompanyName ?? profile.Profile.Name ?? "Unknown Company";
        }
        else if (profile.OwnerType == OwnerType.Client && profile.ClientId.HasValue)
        {
            var client = await _dbContext.Clients.FirstOrDefaultAsync(c => c.Id == profile.ClientId.Value, ct);
            companyName = client?.Name ?? "Unknown Client";
        }

        if (profile.ProviderType == AuthProviderType.AzureAd)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(profile.ConfigJson) || profile.ConfigJson == "{}")
                {
                    _logger.LogWarning("AuthProfile {Id} has empty config.", profile.Id);
                    return new DiscoveryResponse("Local", null, null, null, "Local Authentication");
                }

                var config = System.Text.Json.JsonSerializer.Deserialize<AzureAdConfig>(profile.ConfigJson);
                if (config != null)
                {
                    var authBaseUrl = config.AuthUrl?.Trim() ?? "";
                    var redirectUri = config.RedirectUri?.Trim() ?? "";
                    var scope = Uri.EscapeDataString(config.Scopes ?? "openid profile email");
                    var redirect = Uri.EscapeDataString(redirectUri);
                    var authUrl = $"{authBaseUrl}?client_id={config.ClientId}&response_type=code&redirect_uri={redirect}&response_mode=query&scope={scope}&state={profile.Id}";

                    return new DiscoveryResponse("AzureAd", authUrl, null, companyName, "Azure AD");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to deserialize AzureAd config for profile {Id}", profile.Id);
                return new DiscoveryResponse("Local", null, null, null, "Local Authentication");
            }
        }
        else if (profile.ProviderType == AuthProviderType.WindowsAd)
        {
            return new DiscoveryResponse("WindowsAd", null, null, companyName, "Windows AD");
        }

        return new DiscoveryResponse("Local", null, null, companyName, "Local Authentication");
    }

    public async Task<LoginResponse> CallbackAsync(CallbackRequest request, CancellationToken ct = default)
    {
        try
        {
            if (!long.TryParse(request.State, out var profileId))
            {
                _logger.LogError("Callback failed: Invalid state GUID: {State}", request.State);
                throw new InvalidOperationException("Invalid state parameter.");
            }

            var profile = await _dbContext.AuthProfiles
                .Include(p => p.Profile)
                .FirstOrDefaultAsync(p => p.Id == profileId, ct);

            if (profile == null)
            {
                _logger.LogError("Callback failed: AuthProfile {Id} not found.", profileId);
                throw new InvalidOperationException("Invalid authentication profile.");
            }

            if (!profile.IsActive)
            {
                _logger.LogError("Callback failed: AuthProfile {Id} is inactive.", profileId);
                throw new InvalidOperationException("Authentication profile is inactive.");
            }

            if (profile.ProviderType != AuthProviderType.AzureAd)
            {
                _logger.LogError("Callback failed: AuthProfile {Id} is not AzureAd (Type: {Type}).", profileId, profile.ProviderType);
                throw new InvalidOperationException("Invalid authentication provider type.");
            }

            var config = System.Text.Json.JsonSerializer.Deserialize<AzureAdConfig>(profile.ConfigJson);
            if (config == null)
            {
                _logger.LogError("Callback failed: Config deserialization returned null for profile {Id}.", profileId);
                throw new InvalidOperationException("Invalid profile configuration.");
            }

            var redirectUri = config.RedirectUri?.Trim() ?? "";
            var authority = !string.IsNullOrWhiteSpace(config.Authority)
                ? config.Authority.Trim()
                : $"https://login.microsoftonline.com/{config.TenantId}";

            _logger.LogInformation("Exchanging code for token. ClientId: {ClientId}, RedirectUri: {RedirectUri}", config.ClientId, redirectUri);

            var app = ConfidentialClientApplicationBuilder.Create(config.ClientId)
                .WithClientSecret(config.ClientSecret)
                .WithAuthority(new Uri(authority))
                .WithRedirectUri(redirectUri)
                .Build();

            AuthenticationResult result;
            try
            {
                result = await app.AcquireTokenByAuthorizationCode(new[] { "openid", "profile", "email" }, request.Code).ExecuteAsync(ct);
            }
            catch (MsalServiceException msalEx) when (msalEx.ErrorCode == "AADSTS50020")
            {
                // User account does not exist in tenant
                var companyName = profile.Profile?.CompanyName ?? profile.Profile?.Name ?? "your organization";
                _logger.LogWarning("SSO login failed: User does not exist in tenant. Error: {Error}", msalEx.Message);
                throw new InvalidOperationException($"Your account is not registered with {companyName}. Please contact your administrator to request access.");
            }
            catch (MsalServiceException msalEx)
            {
                _logger.LogError(msalEx, "Azure AD authentication failed. ErrorCode: {ErrorCode}", msalEx.ErrorCode);
                throw new InvalidOperationException($"Authentication failed: {msalEx.Message}");
            }

            var email = result.Account.Username;
            _logger.LogInformation("Token acquired for email: {Email}", email);

            // Search user by Email (case insensitive)
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower() && !u.IsDeleted, ct);

            if (user == null)
            {
                _logger.LogWarning("SSO login failed: User {Email} not found. User must be imported first.", email);
                throw new InvalidOperationException("User not found. Please contact your administrator to import your account.");
            }

            // Verify user is active
            if (!user.IsActive)
            {
                _logger.LogWarning("SSO login failed: User {Email} is inactive.", email);
                throw new InvalidOperationException("Your account is inactive. Please contact your administrator.");
            }

            // Update user metadata
            user.LastLoginAt = DateTime.UtcNow;
            if (string.IsNullOrEmpty(user.ExternalId))
            {
                user.ExternalId = result.UniqueId;
            }
            if (user.AuthProvider == "Local")
            {
                user.AuthProvider = "AzureAd";
            }
            await _dbContext.SaveChangesAsync(ct);

            var refreshToken = _jwtTokenService.GenerateRefreshToken(user.Id);
            _dbContext.RefreshTokens.Add(refreshToken);

            await _dbContext.SaveChangesAsync(ct);

            var permissions = await GetUserPermissionsAsync(user.Id, user.ProfileId, ct);
            return BuildLoginResponse(user, refreshToken, permissions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in CallbackAsync");
            throw;
        }
    }

    public async Task<LoginResponse> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        var token = await _dbContext.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == refreshToken, ct);

        if (token == null || !token.IsActive || token.User == null)
        {
            throw new InvalidOperationException("Invalid refresh token");
        }

        var newRefresh = _jwtTokenService.GenerateRefreshToken(token.UserId);
        _dbContext.RefreshTokens.Add(newRefresh);

        token.RevokedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        var permissions = await GetUserPermissionsAsync(token.User.Id, token.User.ProfileId, ct);
        return BuildLoginResponse(token.User, newRefresh, permissions);
    }

    public async Task RevokeAsync(string refreshToken, CancellationToken ct = default)
    {
        var token = await _dbContext.RefreshTokens.FirstOrDefaultAsync(t => t.Token == refreshToken, ct);
        if (token == null)
        {
            return;
        }

        token.RevokedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(ct);
    }

    private LoginResponse BuildLoginResponse(Models.User user, RefreshToken refreshToken, IEnumerable<string> permissions)
    {
        var accessToken = _jwtTokenService.GenerateAccessToken(user, permissions);
        var expires = DateTime.UtcNow.AddMinutes(60);
        _logger.LogInformation("Generated tokens for user {UserId}", user.Id);
        return new LoginResponse(accessToken, refreshToken.Token, expires);
    }

    public async Task<List<AzureProfileInfo>> GetAzureProfilesAsync(CancellationToken ct = default)
    {
        var profiles = await _dbContext.AuthProfiles
            .Include(p => p.Profile)
            .Where(p => p.IsActive && !p.IsDeleted && p.ProviderType == AuthProviderType.AzureAd)
            .ToListAsync(ct);

        var result = new List<AzureProfileInfo>();

        foreach (var profile in profiles)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(profile.ConfigJson) || profile.ConfigJson == "{}")
                {
                    continue;
                }

                var config = System.Text.Json.JsonSerializer.Deserialize<AzureAdConfig>(profile.ConfigJson);
                if (config != null)
                {
                    var authBaseUrl = config.AuthUrl?.Trim() ?? "";
                    var redirectUri = config.RedirectUri?.Trim() ?? "";
                    var scope = Uri.EscapeDataString(config.Scopes ?? "openid profile email");
                    var redirect = Uri.EscapeDataString(redirectUri);
                    var authUrl = $"{authBaseUrl}?client_id={config.ClientId}&response_type=code&redirect_uri={redirect}&response_mode=query&scope={scope}&state={profile.Id}&prompt=none";

                    var companyName = profile.Profile?.CompanyName ?? profile.Profile?.Name ?? profile.Name;

                    result.Add(new AzureProfileInfo(
                        profile.Id,
                        profile.Name,
                        authUrl,
                        companyName
                    ));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process AzureAd profile {Id}", profile.Id);
            }
        }

        return result;
    }

    public async Task<bool> CheckUserExistsAsync(string email, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return false;
        }

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower() && !u.IsDeleted, ct);

        return user != null && user.IsActive;
    }

    private async Task<List<string>> GetUserPermissionsAsync(long userId, long? profileId, CancellationToken ct)
    {
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted, ct);

        if (user == null)
        {
            return new List<string>();
        }

        if (user.Roles.Contains(SystemRoles.PlatformAdmin))
        {
            return await _dbContext.Permissions
                .Select(p => p.Id)
                .ToListAsync(ct);
        }

        if (profileId.HasValue)
        {
            return await GetCompanyScopedPermissionsAsync(userId, profileId.Value, ct);
        }

        if (user.ClientId.HasValue)
        {
            return await GetClientScopedPermissionsAsync(userId, user.ClientId.Value, ct);
        }

        return new List<string>();
    }

    private async Task<List<string>> GetCompanyScopedPermissionsAsync(long userId, long profileId, CancellationToken ct)
    {
        var profile = await _dbContext.Profiles
            .Where(p => p.Id == profileId && !p.IsDeleted)
            .Select(p => new { p.Id, p.ClientId })
            .FirstOrDefaultAsync(ct);

        if (profile == null)
        {
            return new List<string>();
        }

        var directRoleIds = await _dbContext.UserTenantRoles
            .Where(utr => utr.UserId == userId && utr.ProfileId == profileId)
            .Select(utr => utr.RoleId)
            .Where(roleId => roleId.HasValue)
            .Select(roleId => roleId!.Value)
            .ToListAsync(ct);

        var groupRoleIds = await _dbContext.GroupTenantRoles
            .Where(gtr => gtr.ProfileId == profileId)
            .Join(_dbContext.UserGroups.Where(ug => ug.UserId == userId),
                gtr => gtr.GroupId,
                ug => ug.GroupId,
                (gtr, ug) => gtr.RoleId)
            .Where(roleId => roleId.HasValue)
            .Select(roleId => roleId!.Value)
            .ToListAsync(ct);

        var companyRoleIds = directRoleIds.Concat(groupRoleIds).Distinct().ToList();

        if (companyRoleIds.Count > 0)
        {
            return await GetMostRestrictivePermissionsAsync(companyRoleIds, ct);
        }

        if (!profile.ClientId.HasValue)
        {
            return new List<string>();
        }

        var clientRoleIds = await _dbContext.UserTenantRoles
            .Where(utr => utr.UserId == userId &&
                          utr.ClientId == profile.ClientId &&
                          (utr.CompanyIds == null || utr.CompanyIds.Count == 0 || utr.CompanyIds.Contains(profileId)))
            .Select(utr => utr.RoleId)
            .Where(roleId => roleId.HasValue)
            .Select(roleId => roleId!.Value)
            .ToListAsync(ct);

        var groupClientRoleIds = await _dbContext.GroupTenantRoles
            .Where(gtr => gtr.ClientId == profile.ClientId &&
                          (gtr.CompanyIds == null || gtr.CompanyIds.Count == 0 || gtr.CompanyIds.Contains(profileId)))
            .Join(_dbContext.UserGroups.Where(ug => ug.UserId == userId),
                gtr => gtr.GroupId,
                ug => ug.GroupId,
                (gtr, ug) => gtr.RoleId)
            .Where(roleId => roleId.HasValue)
            .Select(roleId => roleId!.Value)
            .ToListAsync(ct);

        var scopedClientRoleIds = clientRoleIds.Concat(groupClientRoleIds).Distinct().ToList();
        if (scopedClientRoleIds.Count == 0)
        {
            return new List<string>();
        }

        return await GetMostRestrictivePermissionsAsync(scopedClientRoleIds, ct);
    }

    private async Task<List<string>> GetClientScopedPermissionsAsync(long userId, long clientId, CancellationToken ct)
    {
        var clientRoleIds = await _dbContext.UserTenantRoles
            .Where(utr => utr.UserId == userId
                          && utr.ClientId == clientId

                          && (utr.CompanyIds == null || utr.CompanyIds.Count == 0))
            .Select(utr => utr.RoleId)
            .Where(roleId => roleId.HasValue)
            .Select(roleId => roleId!.Value)
            .ToListAsync(ct);

        var groupRoleIds = await _dbContext.GroupTenantRoles
            .Where(gtr => gtr.ClientId == clientId

                          && (gtr.CompanyIds == null || gtr.CompanyIds.Count == 0))
            .Join(_dbContext.UserGroups.Where(ug => ug.UserId == userId),
                gtr => gtr.GroupId,
                ug => ug.GroupId,
                (gtr, ug) => gtr.RoleId)
            .Where(roleId => roleId.HasValue)
            .Select(roleId => roleId!.Value)
            .ToListAsync(ct);

        var scopedRoleIds = clientRoleIds.Concat(groupRoleIds).Distinct().ToList();
        if (scopedRoleIds.Count == 0)
        {
            return new List<string>();
        }

        return await GetMostRestrictivePermissionsAsync(scopedRoleIds, ct);
    }

    private async Task<List<string>> GetMostRestrictivePermissionsAsync(List<long> roleIds, CancellationToken ct)
    {
        var rolePermissions = await _dbContext.RolePermissions
            .Where(rp => roleIds.Contains(rp.RoleId))
            .GroupBy(rp => rp.RoleId)
            .Select(group => new
            {
                RoleId = group.Key,
                Permissions = group.Select(rp => rp.PermissionId).Distinct().ToList()
            })
            .ToListAsync(ct);

        if (rolePermissions.Count == 0)
        {
            return new List<string>();
        }

        var minCount = rolePermissions.Min(rp => rp.Permissions.Count);
        var mostRestrictive = rolePermissions
            .Where(rp => rp.Permissions.Count == minCount)
            .SelectMany(rp => rp.Permissions)
            .Distinct()
            .ToList();

        return mostRestrictive;
    }
}
