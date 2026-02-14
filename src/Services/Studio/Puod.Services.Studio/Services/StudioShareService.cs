using Microsoft.EntityFrameworkCore;
using Puod.Services.Studio.Data;
using Puod.Services.Studio.DTOs;
using Puod.Services.Studio.Models;

namespace Puod.Services.Studio.Services;

public class StudioShareService
{
    private readonly StudioDbContext _dbContext;

    public StudioShareService(StudioDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<StudioShareDto>> ListSharesAsync(StudioShareTarget targetType, long targetId, CancellationToken ct)
    {
        return await _dbContext.StudioShares
            .AsNoTracking()
            .Where(share => share.TargetType == targetType && share.TargetId == targetId)
            .OrderByDescending(share => share.CreatedAt)
            .Select(share => new StudioShareDto(
                share.Id,
                share.TargetType,
                share.TargetId,
                share.SubjectType,
                share.SubjectId,
                share.AccessLevel,
                share.CreatedAt))
            .ToListAsync(ct);
    }

    public async Task<StudioShareDto> CreateShareAsync(StudioShareRequest request, long userId, CancellationToken ct)
    {
        var existing = await _dbContext.StudioShares.FirstOrDefaultAsync(share =>
            share.TargetType == request.TargetType &&
            share.TargetId == request.TargetId &&
            share.SubjectType == request.SubjectType &&
            share.SubjectId == request.SubjectId, ct);

        if (existing != null)
        {
            existing.AccessLevel = request.AccessLevel;
            existing.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(ct);

            return new StudioShareDto(
                existing.Id,
                existing.TargetType,
                existing.TargetId,
                existing.SubjectType,
                existing.SubjectId,
                existing.AccessLevel,
                existing.CreatedAt);
        }

        var share = new StudioShare
        {
            TargetType = request.TargetType,
            TargetId = request.TargetId,
            SubjectType = request.SubjectType,
            SubjectId = request.SubjectId,
            AccessLevel = request.AccessLevel,
            SharedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.StudioShares.Add(share);
        await _dbContext.SaveChangesAsync(ct);

        return new StudioShareDto(
            share.Id,
            share.TargetType,
            share.TargetId,
            share.SubjectType,
            share.SubjectId,
            share.AccessLevel,
            share.CreatedAt);
    }

    public async Task DeleteShareAsync(long id, CancellationToken ct)
    {
        var share = await _dbContext.StudioShares.FindAsync(new object[] { id }, ct);
        if (share == null)
        {
            throw new KeyNotFoundException("Share not found.");
        }

        _dbContext.StudioShares.Remove(share);
        await _dbContext.SaveChangesAsync(ct);
    }
}
