namespace Puod.Services.User.Services;

/// <summary>
/// Service to manage role hierarchy and permissions
/// Implements the role permission rules defined in the system
/// </summary>
public interface IRoleHierarchyService
{
    /// <summary>
    /// Check if a user can grant a specific role to another user
    /// </summary>
    /// <param name="grantorUserId">User who wants to grant the role</param>
    /// <param name="roleToGrant">Role to be granted</param>
    /// <param name="targetCompanyId">Company ID (for company roles)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>True if user can grant the role</returns>
    Task<bool> CanGrantRoleAsync(
        long grantorUserId,
        string roleToGrant,
        long? targetCompanyId = null,
        CancellationToken ct = default);

    /// <summary>
    /// Check if a user is a Company Admin of a specific company
    /// </summary>
    Task<bool> IsCompanyAdminAsync(long userId, long companyId, CancellationToken ct = default);

    /// <summary>
    /// Check if a user has access to a company (either as Company Admin or System Admin)
    /// </summary>
    Task<bool> HasCompanyAccessAsync(long userId, long companyId, bool isSystemAdmin, CancellationToken ct = default);

    /// <summary>
    /// Get all companies a user has access to (as System Admin or Company Admin)
    /// </summary>
    Task<List<long>> GetAccessibleCompanyIdsAsync(long userId, bool isSystemAdmin, CancellationToken ct = default);
}
