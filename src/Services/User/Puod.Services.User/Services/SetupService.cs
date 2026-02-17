using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Puod.Services.User.Data;
using Puod.Services.User.DTOs;
using Puod.Services.User.Models;

namespace Puod.Services.User.Services;

public interface ISetupService
{
    Task<SetupStatusResponse> GetStatusAsync(CancellationToken ct);
    Task<SetupStepsResponse> GetStepsAsync(CancellationToken ct);
    Task SaveStepAsync(SetupStepSaveRequest request, CancellationToken ct);
    Task ClearStepAsync(SetupStepClearRequest request, CancellationToken ct);
    Task<TenantCreateResponse> CreateTenantAsync(TenantCreateRequest request, long actorUserId, CancellationToken ct);
}

public class SetupService : ISetupService
{
    private readonly PuodDbContext _dbContext;
    private readonly ILogger<SetupService> _logger;
    private readonly SetupDefaults _defaults;

    public SetupService(PuodDbContext dbContext, ILogger<SetupService> logger, IOptions<SetupDefaults> defaults)
    {
        _dbContext = dbContext;
        _logger = logger;
        _defaults = defaults.Value;
    }

    public async Task<SetupStatusResponse> GetStatusAsync(CancellationToken ct)
    {
        var tenantCount = await _dbContext.Profiles.CountAsync(ct);
        var setupState = await _dbContext.SetupStates
            .FirstOrDefaultAsync(state => state.Key == "primary", ct);
        var adminEmail = await _dbContext.UserTenantRoles
            .Where(role => role.RoleName == "Company Owner" || role.RoleName == "Company Admin")
            .OrderBy(role => role.CreatedAt)
            .Select(role => role.User!.Email)
            .FirstOrDefaultAsync(ct);
        var isConfigured = setupState?.IsCompleted ?? tenantCount > 0;
        return new SetupStatusResponse(isConfigured, tenantCount, adminEmail);
    }

    public async Task<SetupStepsResponse> GetStepsAsync(CancellationToken ct)
    {
        var steps = await _dbContext.SetupStepStates
            .Where(step => !step.IsDeleted)
            .OrderBy(step => step.CreatedAt)
            .ToListAsync(ct);

        var response = steps.Select(step => new SetupStepStateResponse(
            step.StepId,
            step.IsCompleted,
            step.SavedAt,
            step.CompletedAt,
            DeserializeStepData(step.StepId, step.DataJson)))
            .ToList();

        return new SetupStepsResponse(response);
    }

    public async Task SaveStepAsync(SetupStepSaveRequest request, CancellationToken ct)
    {
        var stepId = NormalizeStepId(request.StepId);
        if (string.IsNullOrWhiteSpace(stepId))
        {
            throw new InvalidOperationException("Step id is required.");
        }

        var existing = await _dbContext.SetupStepStates
            .FirstOrDefaultAsync(step => step.StepId == stepId, ct);

        var now = DateTime.UtcNow;
        var data = request.Data == null
            ? new Dictionary<string, string?>()
            : new Dictionary<string, string?>(request.Data);

        if (existing != null && !string.IsNullOrWhiteSpace(existing.DataJson))
        {
            var existingData = DeserializeStepData(stepId, existing.DataJson);
            PreserveSensitiveFields(stepId, data, existingData);
        }

        var dataJson = data.Count == 0 ? null : JsonSerializer.Serialize(data);

        if (existing == null)
        {
            var state = new SetupStepState
            {
                StepId = stepId,
                DataJson = dataJson,
                IsCompleted = request.IsCompleted,
                SavedAt = now,
                CompletedAt = request.IsCompleted ? now : null
            };
            _dbContext.SetupStepStates.Add(state);
        }
        else
        {
            existing.DataJson = dataJson;
            existing.IsCompleted = request.IsCompleted;
            existing.SavedAt = now;
            existing.CompletedAt = request.IsCompleted ? now : null;
        }

        await _dbContext.SaveChangesAsync(ct);
    }

    public async Task ClearStepAsync(SetupStepClearRequest request, CancellationToken ct)
    {
        var stepId = NormalizeStepId(request.StepId);
        if (string.IsNullOrWhiteSpace(stepId))
        {
            throw new InvalidOperationException("Step id is required.");
        }

        var existing = await _dbContext.SetupStepStates
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(step => step.StepId == stepId && !step.IsDeleted, ct);

        if (existing == null)
        {
            return;
        }

        existing.IsDeleted = true;
        existing.DeletedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(ct);
    }

    public async Task<TenantCreateResponse> CreateTenantAsync(TenantCreateRequest request, long actorUserId, CancellationToken ct)
    {
        var existingProfile = await _dbContext.Profiles
            .OrderBy(profile => profile.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (existingProfile != null)
        {
            var existingAdminId = await _dbContext.UserTenantRoles
                .Where(role => role.ProfileId == existingProfile.Id
                               && (role.RoleName == "Company Owner" || role.RoleName == "Company Admin"))
                .OrderBy(role => role.CreatedAt)
                .Select(role => role.UserId)
                .FirstOrDefaultAsync(ct);

            if (existingAdminId != 0)
            {
                await EnsureSetupStateAsync(ct);
                return new TenantCreateResponse(existingProfile.Id, existingAdminId, existingProfile.SchemaName);
            }
        }

        var tenantName = string.IsNullOrWhiteSpace(request.TenantName)
            ? _defaults.TenantName
            : request.TenantName.Trim();
        var slugSource = string.IsNullOrWhiteSpace(request.TenantSlug)
            ? _defaults.TenantSlug
            : request.TenantSlug;
        var slug = NormalizeSlug(slugSource);
        if (string.IsNullOrWhiteSpace(slug))
        {
            slug = NormalizeSlug(_defaults.TenantSlug);
            if (string.IsNullOrWhiteSpace(slug))
            {
                slug = "platform";
            }
        }
        var schemaName = $"tenant_{slug}";

        if (await _dbContext.Profiles.AnyAsync(p => p.Slug == slug, ct))
        {
            throw new InvalidOperationException("Tenant slug already exists");
        }

        if (await _dbContext.Users.AnyAsync(u => u.Email == request.AdminEmail.Trim().ToLowerInvariant(), ct))
        {
            throw new InvalidOperationException("Admin email already exists");
        }

        var resolvedPassword = await ResolveAdminPasswordAsync(request.AdminPassword, ct);
        if (string.IsNullOrWhiteSpace(resolvedPassword))
        {
            throw new InvalidOperationException("Admin password is required.");
        }

        var profile = new Profile
        {
            Name = tenantName,
            CompanyName = string.IsNullOrWhiteSpace(request.CompanyName)
                ? _defaults.CompanyName
                : request.CompanyName.Trim(),
            Slug = slug,
            SchemaName = schemaName,
            SetupCompleted = true
        };

        var adminUser = new Models.User
        {
            Email = request.AdminEmail.Trim().ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(resolvedPassword),
            Profile = profile,
            Roles = new List<string> { "user" }
        };

        _dbContext.Users.Add(adminUser);

        var roleMap = await _dbContext.Roles
            .Where(r => r.ProfileId == profile.Id && !r.IsDeleted)
            .ToDictionaryAsync(r => r.Name, ct);

        _dbContext.UserTenantRoles.AddRange(new[]
        {
            new UserTenantRole { User = adminUser, Profile = profile, RoleName = "Company Owner", RoleId = roleMap.GetValueOrDefault("Company Owner")?.Id },
            new UserTenantRole { User = adminUser, Profile = profile, RoleName = "Company Admin", RoleId = roleMap.GetValueOrDefault("Company Admin")?.Id }
        });

        var actorUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == actorUserId, ct);
        if (actorUser != null)
        {
            _dbContext.UserTenantRoles.Add(new UserTenantRole
            {
                User = actorUser,
                Profile = profile,
                RoleName = "Company Admin",
                RoleId = roleMap.GetValueOrDefault("Company Admin")?.Id
            });
        }

        await CreateDefaultRolesAsync(profile, ct);
        await CreateDefaultAuthProfilesAsync(profile, request, ct);

        await _dbContext.SaveChangesAsync(ct);

        await TryCreateSchemaAsync(schemaName, ct);
        await EnsureSetupStateAsync(ct);

        return new TenantCreateResponse(profile.Id, adminUser.Id, schemaName);
    }

    private async Task CreateDefaultRolesAsync(Profile profile, CancellationToken ct)
    {
        var roles = new[]
        {
            new Role { Profile = profile, Name = "Company Owner", Description = "Owner da empresa" },
            new Role { Profile = profile, Name = "Company Admin", Description = "Administra a empresa sem restricoes" },
            new Role { Profile = profile, Name = "Company Contributor", Description = "Cria e altera cards, dashboards e reports" },
            new Role { Profile = profile, Name = "Company Viewer", Description = "Somente visualiza cards, dashboards e reports" }
        };

        await _dbContext.Roles.AddRangeAsync(roles, ct);
        await _dbContext.SaveChangesAsync(ct);

        foreach (var role in roles)
        {
            var permissions = Configuration.DefaultRolePermissions.GetDefaultPermissions(role.Name);
            if (permissions.Count == 0)
            {
                continue;
            }

            var existingLinks = await _dbContext.RolePermissions
                .Where(rp => rp.RoleId == role.Id)
                .Select(rp => rp.PermissionId)
                .ToListAsync(ct);

            var missing = permissions.Where(p => !existingLinks.Contains(p)).ToList();
            if (missing.Count == 0)
            {
                continue;
            }

            _dbContext.RolePermissions.AddRange(missing.Select(permissionId =>
                new RolePermission { RoleId = role.Id, PermissionId = permissionId }));
        }
    }

    private async Task CreateDefaultAuthProfilesAsync(Profile profile, TenantCreateRequest request, CancellationToken ct)
    {
        var profiles = new List<AuthProfile>();

        if (request.EnableLocalAuth)
        {
            profiles.Add(new AuthProfile
            {
                Profile = profile,
                Name = "Local Login",
                ProviderType = AuthProviderType.Local,
                ConfigJson = "{}"
            });
        }

        if (request.EnableWindowsAd)
        {
            var config = new Dictionary<string, object?>
            {
                ["domain"] = request.WindowsAdDomain,
                ["ldapUrl"] = request.WindowsAdLdapUrl,
                ["baseDn"] = request.WindowsAdBaseDn,
                ["bindDn"] = request.WindowsAdBindDn,
                ["bindPassword"] = request.WindowsAdBindPassword,
                ["userFilter"] = request.WindowsAdUserFilter,
                ["groupFilter"] = request.WindowsAdGroupFilter,
                ["useSsl"] = request.WindowsAdUseSsl,
                ["startTls"] = request.WindowsAdStartTls,
                ["timeoutSeconds"] = request.WindowsAdTimeoutSeconds
            };

            profiles.Add(new AuthProfile
            {
                Profile = profile,
                Name = "Windows AD",
                ProviderType = AuthProviderType.WindowsAd,
                ConfigJson = JsonSerializer.Serialize(config)
            });
        }

        if (request.EnableAzureAd)
        {
            var config = new Dictionary<string, object?>
            {
                ["tenantId"] = request.AzureTenantId,
                ["clientId"] = request.AzureClientId,
                ["clientSecret"] = request.AzureClientSecret,
                ["authUrl"] = request.AzureAuthUrl,
                ["tokenUrl"] = request.AzureTokenUrl,
                ["authority"] = request.AzureAuthority,
                ["redirectUri"] = request.AzureRedirectUri,
                ["scopes"] = request.AzureScopes,
                ["issuer"] = request.AzureIssuer,
                ["usePkce"] = request.AzureUsePkce
            };

            profiles.Add(new AuthProfile
            {
                Profile = profile,
                Name = "Azure AD",
                ProviderType = AuthProviderType.AzureAd,
                ConfigJson = JsonSerializer.Serialize(config)
            });
        }

        if (profiles.Count > 0)
        {
            await _dbContext.AuthProfiles.AddRangeAsync(profiles, ct);
        }
    }

    private async Task TryCreateSchemaAsync(string schemaName, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(schemaName))
        {
            return;
        }

        var provider = _dbContext.Database.ProviderName ?? string.Empty;

        try
        {
            if (provider.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
            {
                await _dbContext.Database.ExecuteSqlAsync(
                    $"DO $$ BEGIN EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', {schemaName}); END $$;", ct);
            }
            else if (provider.Contains("SqlServer", StringComparison.OrdinalIgnoreCase))
            {
                await _dbContext.Database.ExecuteSqlAsync($@"
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = {schemaName})
BEGIN
    DECLARE @schema sysname = {schemaName};
    EXEC('CREATE SCHEMA ' + QUOTENAME(@schema));
END", ct);
            }
            else
            {
                _logger.LogInformation("Schema provisioning skipped for provider {Provider}", provider);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create schema {Schema}", schemaName);
        }
    }

    private async Task<string?> ResolveAdminPasswordAsync(string? provided, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(provided))
        {
            return provided;
        }

        var step = await _dbContext.SetupStepStates
            .FirstOrDefaultAsync(state => state.StepId == "admin", ct);

        if (step == null || string.IsNullOrWhiteSpace(step.DataJson))
        {
            return null;
        }

        var data = DeserializeStepData(step.StepId, step.DataJson);
        data.TryGetValue("adminPassword", out var savedPassword);
        return savedPassword;
    }

    private Dictionary<string, string?> DeserializeStepData(string stepId, string? dataJson)
    {
        if (string.IsNullOrWhiteSpace(dataJson))
        {
            return new Dictionary<string, string?>();
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string?>>(dataJson)
                   ?? new Dictionary<string, string?>();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse setup step data for {StepId}.", stepId);
            return new Dictionary<string, string?>();
        }
    }

    private void PreserveSensitiveFields(string stepId, Dictionary<string, string?> incoming, Dictionary<string, string?> existing)
    {
        if (string.Equals(stepId, "admin", StringComparison.OrdinalIgnoreCase))
        {
            PreserveIfMissing(incoming, existing, "adminPassword");
        }

        if (string.Equals(stepId, "auth", StringComparison.OrdinalIgnoreCase))
        {
            PreserveIfMissing(incoming, existing, "windowsAdBindPassword");
            PreserveIfMissing(incoming, existing, "azureClientSecret");
        }
    }

    private static void PreserveIfMissing(
        Dictionary<string, string?> incoming,
        Dictionary<string, string?> existing,
        string key)
    {
        if (incoming.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        if (existing.TryGetValue(key, out var existingValue) && !string.IsNullOrWhiteSpace(existingValue))
        {
            incoming[key] = existingValue;
        }
    }

    private static string NormalizeStepId(string? stepId)
    {
        return (stepId ?? string.Empty).Trim().ToLowerInvariant();
    }

    private static string NormalizeSlug(string value)
    {
        var slug = value.Trim().ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("_", "-");

        return new string(slug.Where(ch => char.IsLetterOrDigit(ch) || ch == '-').ToArray());
    }

    private async Task EnsureSetupStateAsync(CancellationToken ct)
    {
        var state = await _dbContext.SetupStates
            .FirstOrDefaultAsync(entry => entry.Key == "primary", ct);

        if (state == null)
        {
            _dbContext.SetupStates.Add(new SetupState
            {
                Key = "primary",
                IsCompleted = true,
                CompletedAt = DateTime.UtcNow
            });
            await _dbContext.SaveChangesAsync(ct);
            return;
        }

        if (!state.IsCompleted)
        {
            state.IsCompleted = true;
        }

        if (!state.CompletedAt.HasValue)
        {
            state.CompletedAt = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(ct);
    }
}
