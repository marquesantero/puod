namespace Puod.Services.User.Services;

public interface IAccessControlService
{
    /// <summary>
    /// Gets all Client IDs that the current user has access to
    /// SystemAdmin: All clients
    /// ClientAdmin: Only their assigned clients
    /// </summary>
    Task<List<long>> GetAccessibleClientIdsAsync(long userId, CancellationToken ct);

    /// <summary>
    /// Checks if the user has access to a specific client
    /// </summary>
    Task<bool> CanAccessClientAsync(long userId, long clientId, CancellationToken ct);

    /// <summary>
    /// Checks if the user can manage a client (client admin privileges)
    /// </summary>
    Task<bool> CanManageClientAsync(long userId, long clientId, CancellationToken ct);

    /// <summary>
    /// Gets all Company IDs that the user has access to
    /// </summary>
    Task<List<long>> GetAccessibleCompanyIdsAsync(long userId, CancellationToken ct);

    /// <summary>
    /// Checks if the user has access to a specific company
    /// </summary>
    Task<bool> CanAccessCompanyAsync(long userId, long companyId, CancellationToken ct);

    /// <summary>
    /// Checks if the user is a SystemAdmin
    /// </summary>
    bool IsSystemAdmin(long userId);
}
