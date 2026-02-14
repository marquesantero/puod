using Microsoft.EntityFrameworkCore;
using Puod.Services.Studio.Data;
using Puod.Services.Studio.Models;

namespace Puod.Services.Studio.Services;

public class StudioAccessService
{
    private readonly StudioDbContext _dbContext;

    public StudioAccessService(StudioDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<long>> GetAccessibleCardIdsAsync(long userId, CancellationToken ct)
    {
        var groupIds = await GetUserGroupIdsAsync(userId, ct);

        return await _dbContext.StudioShares
            .Where(share => share.TargetType == StudioShareTarget.Card
                            && ((share.SubjectType == StudioShareSubject.User && share.SubjectId == userId)
                                || (share.SubjectType == StudioShareSubject.Group && groupIds.Contains(share.SubjectId))))
            .Select(share => share.TargetId)
            .Distinct()
            .ToListAsync(ct);
    }

    public async Task<List<long>> GetAccessibleDashboardIdsAsync(long userId, CancellationToken ct)
    {
        var groupIds = await GetUserGroupIdsAsync(userId, ct);

        return await _dbContext.StudioShares
            .Where(share => share.TargetType == StudioShareTarget.Dashboard
                            && ((share.SubjectType == StudioShareSubject.User && share.SubjectId == userId)
                                || (share.SubjectType == StudioShareSubject.Group && groupIds.Contains(share.SubjectId))))
            .Select(share => share.TargetId)
            .Distinct()
            .ToListAsync(ct);
    }

    public async Task<bool> CanAccessCardAsync(long cardId, long userId, bool isPlatformAdmin, CancellationToken ct)
    {
        if (isPlatformAdmin)
        {
            return true;
        }

        if (await _dbContext.StudioCards.AnyAsync(card => card.Id == cardId && !card.IsDeleted && card.OwnerUserId == userId, ct))
        {
            return true;
        }

        var shareIds = await GetAccessibleCardIdsAsync(userId, ct);
        return shareIds.Contains(cardId);
    }

    public async Task<bool> CanAccessDashboardAsync(long dashboardId, long userId, bool isPlatformAdmin, CancellationToken ct)
    {
        if (isPlatformAdmin)
        {
            return true;
        }

        if (await _dbContext.StudioDashboards.AnyAsync(d => d.Id == dashboardId && !d.IsDeleted && d.OwnerUserId == userId, ct))
        {
            return true;
        }

        var shareIds = await GetAccessibleDashboardIdsAsync(userId, ct);
        return shareIds.Contains(dashboardId);
    }

    private async Task<List<long>> GetUserGroupIdsAsync(long userId, CancellationToken ct)
    {
        return await _dbContext.UserGroupLinks
            .Where(link => link.UserId == userId && !link.IsDeleted)
            .Select(link => link.GroupId)
            .Distinct()
            .ToListAsync(ct);
    }
}
