using Microsoft.EntityFrameworkCore;
using System.Data.Common;
using Puod.Services.User.Configuration;
using Puod.Services.User.Data;
using Puod.Services.User.Models;

namespace Puod.Services.User.Services;

public class BootstrapSeeder
{
    private const string PlatformClientSlug = "platform";
    private const string PlatformClientName = "Platform";
    private const string PlatformLogoDataUri = "data:image/png;base64,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";
    private readonly PuodDbContext _dbContext;
    private readonly ILogger<BootstrapSeeder> _logger;

    public BootstrapSeeder(PuodDbContext dbContext, ILogger<BootstrapSeeder> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken ct = default)
    {
        if (!await _dbContext.Database.CanConnectAsync(ct))
        {
            _logger.LogInformation("Database not reachable yet. Skipping bootstrap seed.");
            return;
        }

        if (!await HasTableAsync("users", ct))
        {
            _logger.LogInformation("Database tables not ready yet. Skipping bootstrap seed.");
            return;
        }

        // --- 1. Seed Permissions (MUST RUN ALWAYS) ---
        var existingPermissions = await _dbContext.Permissions.Select(p => p.Id).ToListAsync(ct);
        _logger.LogInformation("Found {Count} existing permissions.", existingPermissions.Count);

        var permissionsToAdd = SystemPermissions.All
            .Where(p => !existingPermissions.Contains(p.Id))
            .Select(p => new Permission { Id = p.Id, Category = p.Category, Description = p.Description })
            .ToList();

        if (permissionsToAdd.Count > 0)
        {
            _logger.LogInformation("Seeding {Count} new permissions...", permissionsToAdd.Count);
            _dbContext.Permissions.AddRange(permissionsToAdd);
            await _dbContext.SaveChangesAsync(ct); 
        }

        // --- 2. Ensure Platform client exists ---
        var platformClient = await _dbContext.Clients
            .FirstOrDefaultAsync(c => c.Slug == PlatformClientSlug && !c.IsDeleted, ct);

        if (platformClient == null)
        {
            platformClient = new Client
            {
                Name = PlatformClientName,
                Slug = PlatformClientSlug,
                LogoUrl = PlatformLogoDataUri,
                Tier = SubscriptionTier.Free,
                IsAlterable = false,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Clients.Add(platformClient);
            await _dbContext.SaveChangesAsync(ct);
        }
        else
        {
            var updated = false;
            if (string.IsNullOrWhiteSpace(platformClient.Name))
            {
                platformClient.Name = PlatformClientName;
                updated = true;
            }

            if (string.IsNullOrWhiteSpace(platformClient.Slug))
            {
                platformClient.Slug = PlatformClientSlug;
                updated = true;
            }

            if (string.IsNullOrWhiteSpace(platformClient.LogoUrl))
            {
                platformClient.LogoUrl = PlatformLogoDataUri;
                updated = true;
            }

            if (platformClient.IsAlterable)
            {
                platformClient.IsAlterable = false;
                updated = true;
            }

            if (updated)
            {
                platformClient.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync(ct);
            }
        }

        var profile = await _dbContext.Profiles.FirstOrDefaultAsync(p => p.Slug == PlatformClientSlug, ct)
                      ?? new Profile
                      {
                          Name = PlatformClientName,
                          CompanyName = "PUOD Platform",
                          Slug = PlatformClientSlug,
                          SchemaName = "tenant_platform",
                          ClientId = platformClient.Id,
                          InheritFromClient = true,
                          InheritLogo = true,
                          SetupCompleted = true,
                          Tier = SubscriptionTier.Free
                      };

        if (profile.Id == 0)
        {
            _dbContext.Profiles.Add(profile);
            await _dbContext.SaveChangesAsync(ct);
        }
        else
        {
            var profileUpdated = false;
            if (profile.ClientId != platformClient.Id)
            {
                profile.ClientId = platformClient.Id;
                profileUpdated = true;
            }

            if (!profile.InheritFromClient)
            {
                profile.InheritFromClient = true;
                profileUpdated = true;
            }

            if (!profile.InheritLogo)
            {
                profile.InheritLogo = true;
                profileUpdated = true;
            }

            if (profileUpdated)
            {
                profile.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync(ct);
            }
        }

        // --- 3. Seed Admin User and Predefined Roles ---
        var adminUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == "puod_admin", ct);

        if (adminUser != null)
        {
            var adminUpdated = false;
            if (!adminUser.Roles.Contains(SystemRoles.PlatformAdmin))
            {
                adminUser.Roles.Add(SystemRoles.PlatformAdmin);
                adminUpdated = true;
            }

            if (adminUser.ClientId != platformClient.Id)
            {
                adminUser.ClientId = platformClient.Id;
                adminUpdated = true;
            }

            if (adminUser.ProfileId != null)
            {
                adminUser.ProfileId = null;
                adminUser.Profile = null;
                adminUpdated = true;
            }

            if (adminUpdated)
            {
                adminUser.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync(ct);
            }

            _logger.LogInformation("Platform admin user already exists.");
            // Continue to seed roles even if admin exists
        }

        if (adminUser == null)
        {
            var newAdmin = new Models.User
            {
                Email = "puod_admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("passwd_admin"),
                ClientId = platformClient.Id,
                ProfileId = null,
                AuthProvider = "Local",
                Roles = new List<string> { SystemRoles.PlatformAdmin }
            };

            _dbContext.Users.Add(newAdmin);
            adminUser = newAdmin;
        }

        // --- 4. Seed Predefined Roles with Default Permissions ---
        var existingRoles = await _dbContext.Roles
            .Where(r => r.ProfileId == profile.Id && !r.IsDeleted)
            .ToListAsync(ct);

        var predefinedRoles = new Dictionary<string, string>
        {
            // Client-Level Roles
            { ClientRoles.ClientAdmin, "Full access to client and all companies - can manage users, roles, companies, and all resources" },
            { ClientRoles.ClientManager, "Elevated permissions - can manage users and most resources with limited security permissions" },
            { ClientRoles.ClientAnalyst, "Read-only access to company data and monitoring dashboards" },
            { ClientRoles.ClientCardDesigner, "Specialized role for card creation and editing across all companies" },

            // Company-Level Roles
            { CompanyRoles.CompanyAdmin, "Full access to the company - can manage users, roles, and all company resources" },
            { CompanyRoles.CompanyManager, "Elevated permissions - can manage integrations and company settings" },
            { CompanyRoles.CardStudioAdmin, "Full access to card management - create, edit, delete, and export cards" },
            { CompanyRoles.CardEditor, "Can create and edit cards - cannot delete cards" },
            { CompanyRoles.CardViewer, "Read-only access to cards" },
            { CompanyRoles.IntegrationManager, "Can create, edit, delete, and execute integrations" },
            { CompanyRoles.Analyst, "Read-only access to company info, cards, and monitoring" },
            { CompanyRoles.Viewer, "Minimal read-only access to company info, cards, and monitoring" }
        };

        foreach (var (roleName, description) in predefinedRoles)
        {
            if (existingRoles.All(r => r.Name != roleName))
            {
                var role = new Role { Profile = profile, Name = roleName, Description = description };
                _dbContext.Roles.Add(role);
                existingRoles.Add(role);
                _logger.LogInformation("Created new predefined role: {RoleName}", roleName);
            }
        }

        await _dbContext.SaveChangesAsync(ct);

        // Link roles with their default permissions (all roles in the system)
        var allRoles = await _dbContext.Roles
            .Where(r => !r.IsDeleted)
            .ToListAsync(ct);

        foreach (var role in allRoles)
        {
            var permissions = DefaultRolePermissions.GetDefaultPermissions(role.Name);
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

            _logger.LogInformation("Added {Count} permissions to role {RoleName}", missing.Count, role.Name);
        }

        // Assign platform admin to Company Admin role
        var adminRole = existingRoles.FirstOrDefault(r => r.Name == CompanyRoles.CompanyAdmin);
        if (adminRole != null)
        {
            var hasRole = await _dbContext.UserTenantRoles
                .AnyAsync(utr => utr.UserId == adminUser.Id && utr.RoleName == adminRole.Name, ct);

            if (!hasRole)
            {
                _dbContext.UserTenantRoles.Add(new UserTenantRole
                {
                    User = adminUser,
                    Profile = profile,
                    RoleId = adminRole.Id,
                    RoleName = adminRole.Name
                });
            }
        }

        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Seeded default platform admin user and predefined roles.");
    }

    private async Task<bool> HasTableAsync(string tableName, CancellationToken ct)
    {
        var provider = _dbContext.Database.ProviderName ?? string.Empty;
        var sql = provider.Contains("Npgsql", StringComparison.OrdinalIgnoreCase)
            ? "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = @name LIMIT 1"
            : provider.Contains("SqlServer", StringComparison.OrdinalIgnoreCase)
                ? "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @name"
                : provider.Contains("MySql", StringComparison.OrdinalIgnoreCase)
                    ? "SELECT 1 FROM information_schema.tables WHERE table_schema = database() AND table_name = @name LIMIT 1"
                    : "SELECT 1 FROM information_schema.tables WHERE table_name = @name";

        var connection = _dbContext.Database.GetDbConnection();
        var shouldClose = connection.State != System.Data.ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(ct);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        var nameParameter = command.CreateParameter();
        nameParameter.ParameterName = "@name";
        nameParameter.Value = tableName;
        command.Parameters.Add(nameParameter);

        var result = await command.ExecuteScalarAsync(ct);
        if (shouldClose)
        {
            await connection.CloseAsync();
        }

        return result != null && result != DBNull.Value;
    }
}
