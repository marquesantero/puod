using Microsoft.EntityFrameworkCore;
using Puod.Services.User.Data;
using Puod.Services.User.Models;

namespace Puod.Services.User.Services;

public class AccessControlService : IAccessControlService
{
    private readonly PuodDbContext _dbContext;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AccessControlService(
        PuodDbContext dbContext,
        IHttpContextAccessor httpContextAccessor)
    {
        _dbContext = dbContext;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task<List<long>> GetAccessibleClientIdsAsync(long userId, CancellationToken ct)
    {
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted, ct);

        if (user == null)
        {
            return new List<long>();
        }

        // Platform Admin can see all clients
        if (user.Roles.Contains(SystemRoles.PlatformAdmin))
        {
            return await _dbContext.Clients
                .Where(c => !c.IsDeleted)
                .Select(c => c.Id)
                .ToListAsync(ct);
        }

        // Client roles assigned directly
        var clientIds = await _dbContext.UserTenantRoles
            .Where(utr => utr.UserId == userId && utr.ClientId.HasValue)
            .Select(utr => utr.ClientId!.Value)
            .Distinct()
            .ToListAsync(ct);

        // Company roles -> derive client from profile
        var companyClientIds = await _dbContext.UserTenantRoles
            .Where(utr => utr.UserId == userId && utr.ProfileId.HasValue)
            .Join(_dbContext.Profiles,
                utr => utr.ProfileId,
                p => p.Id,
                (utr, p) => p.ClientId)
            .Where(clientId => clientId.HasValue)
            .Select(clientId => clientId!.Value)
            .Distinct()
            .ToListAsync(ct);

        // Group roles -> derive client from profile
        var groupClientIds = await _dbContext.GroupTenantRoles
            .Join(_dbContext.UserGroups.Where(ug => ug.UserId == userId),
                gtr => gtr.GroupId,
                ug => ug.GroupId,
                (gtr, ug) => gtr.ProfileId)
            .Join(_dbContext.Profiles,
                profileId => profileId,
                p => p.Id,
                (profileId, p) => p.ClientId)
            .Where(clientId => clientId.HasValue)
            .Select(clientId => clientId!.Value)
            .Distinct()
            .ToListAsync(ct);

        clientIds.AddRange(companyClientIds);
        clientIds.AddRange(groupClientIds);

        clientIds = clientIds.Distinct().ToList();

        return clientIds;
    }

    public async Task<bool> CanAccessClientAsync(long userId, long clientId, CancellationToken ct)
    {
        var accessibleClientIds = await GetAccessibleClientIdsAsync(userId, ct);
        return accessibleClientIds.Contains(clientId);
    }

    public async Task<bool> CanManageClientAsync(long userId, long clientId, CancellationToken ct)
    {
        if (IsSystemAdmin(userId))
        {
            return true;
        }

        var adminRoleNames = ClientRoles.AdminRoles;

        var hasDirectRole = await _dbContext.UserTenantRoles
            .Where(utr => utr.UserId == userId && utr.ClientId == clientId)
            .Join(_dbContext.Roles.Where(r => !r.IsDeleted),
                utr => utr.RoleId,
                r => r.Id,
                (utr, r) => r.Name)
            .AnyAsync(roleName => adminRoleNames.Contains(roleName), ct);

        if (!hasDirectRole)
        {
            hasDirectRole = await _dbContext.UserTenantRoles
                .Where(utr => utr.UserId == userId && utr.ClientId == clientId)
                .AnyAsync(utr => adminRoleNames.Contains(utr.RoleName), ct);
        }

        if (hasDirectRole)
        {
            return true;
        }

        var hasGroupRole = await _dbContext.GroupTenantRoles
            .Where(gtr => gtr.ClientId == clientId)
            .Join(_dbContext.UserGroups.Where(ug => ug.UserId == userId),
                gtr => gtr.GroupId,
                ug => ug.GroupId,
                (gtr, ug) => gtr)
            .Join(_dbContext.Roles.Where(r => !r.IsDeleted),
                gtr => gtr.RoleId,
                r => r.Id,
                (gtr, r) => r.Name)
            .AnyAsync(roleName => adminRoleNames.Contains(roleName), ct);

        if (!hasGroupRole)
        {
            hasGroupRole = await _dbContext.GroupTenantRoles
                .Where(gtr => gtr.ClientId == clientId)
                .Join(_dbContext.UserGroups.Where(ug => ug.UserId == userId),
                    gtr => gtr.GroupId,
                    ug => ug.GroupId,
                    (gtr, ug) => gtr)
                .AnyAsync(gtr => adminRoleNames.Contains(gtr.RoleName), ct);
        }

        return hasGroupRole;
    }

    public async Task<List<long>> GetAccessibleCompanyIdsAsync(long userId, CancellationToken ct)
    {
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted, ct);

        if (user == null)
        {
            return new List<long>();
        }

        if (user.Roles.Contains(SystemRoles.PlatformAdmin))
        {
            return await _dbContext.Profiles
                .Where(p => !p.IsDeleted)
                .Select(p => p.Id)
                .ToListAsync(ct);
        }

        var companyIds = new HashSet<long>();

        var directCompanyIds = await _dbContext.UserTenantRoles
            .Where(utr => utr.UserId == userId && utr.ProfileId.HasValue)
            .Select(utr => utr.ProfileId!.Value)
            .ToListAsync(ct);

        foreach (var id in directCompanyIds)
        {
            companyIds.Add(id);
        }

        var groupCompanyIds = await _dbContext.GroupTenantRoles
            .Where(gtr => gtr.ProfileId.HasValue)
            .Join(_dbContext.UserGroups.Where(ug => ug.UserId == userId),
                gtr => gtr.GroupId,
                ug => ug.GroupId,
                (gtr, ug) => gtr.ProfileId!.Value)
            .ToListAsync(ct);

        foreach (var id in groupCompanyIds)
        {
            companyIds.Add(id);
        }

        var clientRoleScopes = await _dbContext.UserTenantRoles
            .Where(utr => utr.UserId == userId && utr.ClientId.HasValue)
            .Select(utr => new { ClientId = utr.ClientId!.Value, utr.CompanyIds })
            .ToListAsync(ct);

        var groupClientRoleScopes = await _dbContext.GroupTenantRoles
            .Where(gtr => gtr.ClientId.HasValue)
            .Join(_dbContext.UserGroups.Where(ug => ug.UserId == userId),
                gtr => gtr.GroupId,
                ug => ug.GroupId,
                (gtr, ug) => new { ClientId = gtr.ClientId!.Value, gtr.CompanyIds })
            .ToListAsync(ct);

        var combinedScopes = clientRoleScopes
            .Concat(groupClientRoleScopes)
            .ToList();

        var availabilityByClient = await _dbContext.ClientUserCompanyAvailability
            .Where(ca => ca.UserId == userId)
            .GroupBy(ca => ca.ClientId)
            .Select(group => new { ClientId = group.Key, CompanyIds = group.Select(ca => ca.CompanyId).ToList() })
            .ToListAsync(ct);

        var clientIdsNeedingAll = combinedScopes
            .Where(scope => scope.CompanyIds == null || scope.CompanyIds.Count == 0)
            .Select(scope => scope.ClientId)
            .Distinct()
            .ToList();

        var companiesByClient = await _dbContext.Profiles
            .Where(p => !p.IsDeleted && p.ClientId.HasValue && clientIdsNeedingAll.Contains(p.ClientId.Value))
            .Select(p => new { ClientId = p.ClientId!.Value, CompanyId = p.Id })
            .ToListAsync(ct);

        var companiesLookup = companiesByClient
            .GroupBy(item => item.ClientId)
            .ToDictionary(group => group.Key, group => group.Select(item => item.CompanyId).ToList());

        foreach (var scope in combinedScopes)
        {
            var availability = availabilityByClient.FirstOrDefault(a => a.ClientId == scope.ClientId);
            var scopedCompanyIds = scope.CompanyIds ?? new List<long>();
            List<long> finalIds;

            if (scopedCompanyIds.Count == 0)
            {
                if (availability != null && availability.CompanyIds.Count > 0)
                {
                    finalIds = availability.CompanyIds;
                }
                else if (companiesLookup.TryGetValue(scope.ClientId, out var clientCompanies))
                {
                    finalIds = clientCompanies;
                }
                else
                {
                    finalIds = new List<long>();
                }
            }
            else
            {
                if (availability != null && availability.CompanyIds.Count > 0)
                {
                    finalIds = scopedCompanyIds.Intersect(availability.CompanyIds).ToList();
                }
                else
                {
                    finalIds = scopedCompanyIds;
                }
            }

            foreach (var id in finalIds)
            {
                companyIds.Add(id);
            }
        }

        return companyIds.ToList();
    }

    public async Task<bool> CanAccessCompanyAsync(long userId, long companyId, CancellationToken ct)
    {
        if (IsSystemAdmin(userId))
        {
            return true;
        }

        var hasDirectRole = await _dbContext.UserTenantRoles
            .AnyAsync(utr => utr.UserId == userId && utr.ProfileId == companyId, ct);

        if (hasDirectRole)
        {
            return true;
        }

        var hasGroupRole = await _dbContext.GroupTenantRoles
            .Where(gtr => gtr.ProfileId == companyId)
            .Join(_dbContext.UserGroups.Where(ug => ug.UserId == userId),
                gtr => gtr.GroupId,
                ug => ug.GroupId,
                (gtr, ug) => gtr)
            .AnyAsync(ct);

        if (hasGroupRole)
        {
            return true;
        }

        var companyClientId = await _dbContext.Profiles
            .Where(p => p.Id == companyId && !p.IsDeleted)
            .Select(p => p.ClientId)
            .FirstOrDefaultAsync(ct);

        if (!companyClientId.HasValue)
        {
            return false;
        }

        var clientRoleScopes = await _dbContext.UserTenantRoles
            .Where(utr => utr.UserId == userId && utr.ClientId == companyClientId)
            .Select(utr => utr.CompanyIds)
            .ToListAsync(ct);

        var groupClientRoleScopes = await _dbContext.GroupTenantRoles
            .Where(gtr => gtr.ClientId == companyClientId)
            .Join(_dbContext.UserGroups.Where(ug => ug.UserId == userId),
                gtr => gtr.GroupId,
                ug => ug.GroupId,
                (gtr, ug) => gtr.CompanyIds)
            .ToListAsync(ct);

        var allScopes = clientRoleScopes.Concat(groupClientRoleScopes).ToList();

        if (allScopes.Count == 0)
        {
            return false;
        }

        var availabilityCompanyIds = await _dbContext.ClientUserCompanyAvailability
            .Where(ca => ca.UserId == userId && ca.ClientId == companyClientId)
            .Select(ca => ca.CompanyId)
            .ToListAsync(ct);

        foreach (var scopeIds in allScopes)
        {
            var scopedCompanyIds = scopeIds ?? new List<long>();
            var allowsAll = scopedCompanyIds.Count == 0;

            if (availabilityCompanyIds.Count > 0)
            {
                if (availabilityCompanyIds.Contains(companyId) && (allowsAll || scopedCompanyIds.Contains(companyId)))
                {
                    return true;
                }
            }
            else if (allowsAll || scopedCompanyIds.Contains(companyId))
            {
                return true;
            }
        }

        return false;
    }

    public bool IsSystemAdmin(long userId)
    {
        var user = _dbContext.Users
            .FirstOrDefault(u => u.Id == userId && !u.IsDeleted);

        return user?.Roles.Contains(SystemRoles.PlatformAdmin) == true;
    }
}
