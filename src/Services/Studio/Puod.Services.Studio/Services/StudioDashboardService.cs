using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Puod.Services.Studio.Data;
using Puod.Services.Studio.DTOs;
using Puod.Services.Studio.Models;

namespace Puod.Services.Studio.Services;

public class StudioDashboardService
{
    private readonly StudioDbContext _dbContext;
    private readonly StudioAccessService _accessService;
    private readonly ILogger<StudioDashboardService> _logger;

    public StudioDashboardService(
        StudioDbContext dbContext,
        StudioAccessService accessService,
        ILogger<StudioDashboardService> logger)
    {
        _dbContext = dbContext;
        _accessService = accessService;
        _logger = logger;
    }

    public async Task<List<StudioDashboardDto>> ListDashboardsAsync(
        StudioScope? scope,
        long? clientId,
        long? profileId,
        long userId,
        bool isPlatformAdmin,
        CancellationToken ct)
    {
        var query = _dbContext.StudioDashboards.AsNoTracking().Where(d => !d.IsDeleted);

        if (scope.HasValue)
        {
            query = query.Where(dashboard => dashboard.Scope == scope);
        }

        if (scope == StudioScope.Client && clientId.HasValue)
        {
            query = query.Where(dashboard => dashboard.ClientId == clientId);
        }

        if (scope == StudioScope.Company && profileId.HasValue)
        {
            query = query.Where(dashboard => dashboard.ProfileId == profileId);
        }

        var dashboards = await query
            .OrderByDescending(dashboard => dashboard.UpdatedAt)
            .ToListAsync(ct);

        if (!isPlatformAdmin)
        {
            var sharedIds = await _accessService.GetAccessibleDashboardIdsAsync(userId, ct);
            dashboards = dashboards.Where(dashboard =>
                dashboard.OwnerUserId == userId
                || sharedIds.Contains(dashboard.Id)
                || (dashboard.LayoutJson != null && dashboard.LayoutJson.Contains("\"seedKey\""))
            ).ToList();
        }

        return dashboards.Select(dashboard => new StudioDashboardDto(
                dashboard.Id,
                dashboard.Name,
                dashboard.Status,
                dashboard.Scope,
                dashboard.ClientId,
                dashboard.ProfileId,
                dashboard.LayoutType,
                dashboard.CreatedAt,
                dashboard.UpdatedAt))
            .ToList();
    }

    public async Task<StudioDashboardDetailDto?> GetDashboardAsync(long id, CancellationToken ct)
    {
        var dashboard = await _dbContext.StudioDashboards
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted, ct);

        if (dashboard == null)
        {
            return null;
        }

        var cards = await _dbContext.StudioDashboardCards
            .AsNoTracking()
            .Where(dc => dc.DashboardId == id)
            .OrderBy(dc => dc.OrderIndex)
            .Select(dc => new StudioDashboardCardDto(
                dc.Id,
                dc.CardId,
                dc.Title,
                dc.Description,
                dc.ShowTitle,
                dc.ShowDescription,
                dc.IntegrationId,
                dc.OrderIndex,
                dc.PositionX,
                dc.PositionY,
                dc.Width,
                dc.Height,
                dc.LayoutJson,
                dc.RefreshPolicyJson,
                dc.DataSourceJson))
            .ToListAsync(ct);

        return new StudioDashboardDetailDto(
            dashboard.Id,
            dashboard.Name,
            dashboard.Description,
            dashboard.Status,
            dashboard.Scope,
            dashboard.ClientId,
            dashboard.ProfileId,
            dashboard.LayoutType,
            dashboard.LayoutJson,
            dashboard.RefreshPolicyJson,
            dashboard.CreatedAt,
            dashboard.UpdatedAt,
            cards);
    }

    public async Task<StudioDashboardDetailDto> CreateDashboardAsync(
        CreateStudioDashboardRequest request,
        long userId,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var dashboard = new StudioDashboard
        {
            OwnerUserId = userId,
            Scope = request.Scope,
            ClientId = request.ClientId,
            ProfileId = request.ProfileId,
            Name = request.Name,
            Description = request.Description,
            LayoutType = request.LayoutType,
            LayoutJson = request.LayoutJson,
            RefreshPolicyJson = request.RefreshPolicyJson,
            Status = StudioDashboardStatus.Draft,
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.StudioDashboards.Add(dashboard);
        await _dbContext.SaveChangesAsync(ct);

        return await GetDashboardAsync(dashboard.Id, ct) ?? throw new InvalidOperationException("Dashboard not found after create.");
    }

    public async Task<StudioDashboardDetailDto> UpdateDashboardAsync(
        long id,
        UpdateStudioDashboardRequest request,
        long userId,
        bool isPlatformAdmin,
        CancellationToken ct)
    {
        var dashboard = await _dbContext.StudioDashboards.FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted, ct);
        if (dashboard == null)
        {
            throw new KeyNotFoundException("Dashboard not found.");
        }

        if (!isPlatformAdmin && dashboard.OwnerUserId != userId)
        {
            throw new UnauthorizedAccessException();
        }

        dashboard.Name = request.Name ?? dashboard.Name;
        dashboard.Description = request.Description ?? dashboard.Description;
        dashboard.Status = request.Status ?? dashboard.Status;
        dashboard.LayoutType = request.LayoutType ?? dashboard.LayoutType;
        dashboard.LayoutJson = request.LayoutJson ?? dashboard.LayoutJson;
        dashboard.RefreshPolicyJson = request.RefreshPolicyJson ?? dashboard.RefreshPolicyJson;
        dashboard.UpdatedAt = DateTime.UtcNow;

        if (request.Cards != null)
        {
            _logger.LogInformation("Updating dashboard {DashboardId} with {CardCount} cards.", id, request.Cards.Count);

            var deletedCount = await _dbContext.StudioDashboardCards
                .Where(dc => dc.DashboardId == id)
                .ExecuteDeleteAsync(ct);
            _logger.LogInformation("Deleted {DeletedCount} existing dashboard cards for {DashboardId}.", deletedCount, id);

            foreach (var card in request.Cards)
            {
                _dbContext.StudioDashboardCards.Add(new StudioDashboardCard
                {
                    DashboardId = id,
                    CardId = card.CardId,
                    Title = card.Title,
                    Description = card.Description,
                    ShowTitle = card.ShowTitle ?? true,
                    ShowDescription = card.ShowDescription ?? true,
                    IntegrationId = card.IntegrationId,
                    OrderIndex = card.OrderIndex,
                    PositionX = card.PositionX,
                    PositionY = card.PositionY,
                    Width = card.Width,
                    Height = card.Height,
                    LayoutJson = card.LayoutJson,
                    RefreshPolicyJson = card.RefreshPolicyJson,
                    DataSourceJson = card.DataSourceJson,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }

            _logger.LogInformation("Inserted {InsertedCount} dashboard cards for {DashboardId}.", request.Cards.Count, id);
        }

        await _dbContext.SaveChangesAsync(ct);

        return await GetDashboardAsync(id, ct) ?? throw new InvalidOperationException("Dashboard not found after update.");
    }

    public async Task DeleteDashboardAsync(long id, long userId, bool isPlatformAdmin, CancellationToken ct)
    {
        var dashboard = await _dbContext.StudioDashboards.FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted, ct);
        if (dashboard == null)
        {
            throw new KeyNotFoundException("Dashboard not found.");
        }

        if (!isPlatformAdmin && dashboard.OwnerUserId != userId)
        {
            throw new UnauthorizedAccessException();
        }

        dashboard.IsDeleted = true;
        dashboard.DeletedAt = DateTime.UtcNow;
        dashboard.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(ct);
    }
}
