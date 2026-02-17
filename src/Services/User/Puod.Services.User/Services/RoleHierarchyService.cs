using Microsoft.EntityFrameworkCore;
using Puod.Services.User.Data;
using Puod.Services.User.Models;

namespace Puod.Services.User.Services;

public class RoleHierarchyService : IRoleHierarchyService
{
    private readonly PuodDbContext _dbContext;

    public RoleHierarchyService(PuodDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> CanGrantRoleAsync(
        long grantorUserId,
        string roleToGrant,
        long? targetCompanyId = null,
        CancellationToken ct = default)
    {
        // Get grantor's system roles
        var grantor = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Id == grantorUserId && !u.IsDeleted, ct);

        if (grantor == null) return false;

        var isSystemAdmin = grantor.Roles.Contains(SystemRoles.PlatformAdmin);

        // System Admin can grant any role
        if (isSystemAdmin) return true;

        // Check system-level roles
        if (roleToGrant == SystemRoles.PlatformAdmin)
        {
            // Only System Admin can grant System Admin role
            return false;
        }

        // Check company-level roles
        if (CompanyRoles.BuiltInRoles.Contains(roleToGrant) && targetCompanyId.HasValue)
        {
            if (roleToGrant == CompanyRoles.CompanyAdmin)
            {
                // Only Platform Admin or Company Admin can grant Company Admin
                return await IsCompanyAdminAsync(grantorUserId, targetCompanyId.Value, ct);
            }

            // For other company roles, Company Admin can grant
            return await IsCompanyAdminAsync(grantorUserId, targetCompanyId.Value, ct);
        }

        return false;
    }

    public async Task<bool> IsCompanyAdminAsync(long userId, long companyId, CancellationToken ct = default)
    {
        var roleNames = await _dbContext.UserTenantRoles
            .Where(utr => utr.UserId == userId && utr.ProfileId == companyId)
            .Select(utr => utr.Role != null ? utr.Role.Name : utr.RoleName)
            .ToListAsync(ct);

        return roleNames.Any(role => CompanyRoles.AdminRoles.Contains(role));
    }

    public async Task<bool> HasCompanyAccessAsync(long userId, long companyId, bool isSystemAdmin, CancellationToken ct = default)
    {
        // System Admin has access to all companies
        if (isSystemAdmin) return true;

        // Check if user has any role in the company
        return await _dbContext.UserTenantRoles
            .AnyAsync(utr => utr.UserId == userId && utr.ProfileId == companyId, ct);
    }

    public async Task<List<long>> GetAccessibleCompanyIdsAsync(long userId, bool isSystemAdmin, CancellationToken ct = default)
    {
        if (isSystemAdmin)
        {
            // System Admin can access all companies
            return await _dbContext.Profiles
                .Where(p => !p.IsDeleted)
                .Select(p => p.Id)
                .ToListAsync(ct);
        }

        // Get companies where user has direct access (via UserTenantRole)
        return await _dbContext.UserTenantRoles
            .Where(utr => utr.UserId == userId && utr.ProfileId.HasValue)
            .Select(utr => utr.ProfileId.GetValueOrDefault())
            .Distinct()
            .ToListAsync(ct);
    }

}
