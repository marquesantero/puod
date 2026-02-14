using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Puod.Services.Studio.Data;
using Puod.Services.Studio.DTOs;
using Puod.Services.Studio.Models;

namespace Puod.Services.Studio.Services;

public class StudioCardService
{
    private readonly StudioDbContext _dbContext;
    private readonly StudioAccessService _accessService;
    private readonly StudioIntegrationClient _integrationClient;

    public StudioCardService(
        StudioDbContext dbContext,
        StudioAccessService accessService,
        StudioIntegrationClient integrationClient)
    {
        _dbContext = dbContext;
        _accessService = accessService;
        _integrationClient = integrationClient;
    }

    public async Task<List<StudioCardDto>> ListCardsAsync(
        StudioScope? scope,
        long? clientId,
        long? profileId,
        long userId,
        bool isPlatformAdmin,
        CancellationToken ct)
    {
        var query = _dbContext.StudioCards.AsNoTracking().Where(card => !card.IsDeleted);

        if (scope.HasValue)
        {
            query = query.Where(card => card.Scope == scope);
        }

        if (scope == StudioScope.Client && clientId.HasValue)
        {
            query = query.Where(card => card.ClientId == clientId);
        }

        if (scope == StudioScope.Company && profileId.HasValue)
        {
            query = query.Where(card => card.ProfileId == profileId);
        }

        var cards = await query
            .OrderByDescending(card => card.UpdatedAt)
            .ToListAsync(ct);

        if (!isPlatformAdmin)
        {
            var sharedIds = await _accessService.GetAccessibleCardIdsAsync(userId, ct);
            cards = cards.Where(card =>
                card.OwnerUserId == userId
                || sharedIds.Contains(card.Id)
                || (card.DataSourceJson != null && card.DataSourceJson.Contains("\"seedKey\""))
            ).ToList();
        }

        return cards.Select(card => new StudioCardDto(
                card.Id,
                card.Title,
                card.CardType,
                card.LayoutType,
                card.Status,
                card.Scope,
                card.ClientId,
                card.ProfileId,
                card.IntegrationId,
                card.CreatedAt,
                card.UpdatedAt,
                card.LastTestedAt,
                card.LastTestSucceeded))
            .ToList();
    }

    public async Task<List<StudioCardDto>> GetTemplatesAsync(
        long? integrationId,
        long userId,
        bool isPlatformAdmin,
        CancellationToken ct)
    {
        var query = _dbContext.StudioCards
            .AsNoTracking()
            .Where(card => !card.IsDeleted && card.Status == StudioCardStatus.Published);

        if (integrationId.HasValue)
        {
            query = query.Where(card => card.IntegrationId == integrationId);
        }

        var cards = await query
            .OrderBy(card => card.IntegrationId)
            .ThenBy(card => card.CardType)
            .ThenBy(card => card.Title)
            .ToListAsync(ct);

        if (!isPlatformAdmin)
        {
            var sharedIds = await _accessService.GetAccessibleCardIdsAsync(userId, ct);
            cards = cards.Where(card =>
                card.OwnerUserId == userId
                || sharedIds.Contains(card.Id)
                || (card.DataSourceJson != null && card.DataSourceJson.Contains("\"seedKey\""))
            ).ToList();
        }

        return cards.Select(card => new StudioCardDto(
                card.Id,
                card.Title,
                card.CardType,
                card.LayoutType,
                card.Status,
                card.Scope,
                card.ClientId,
                card.ProfileId,
                card.IntegrationId,
                card.CreatedAt,
                card.UpdatedAt,
                card.LastTestedAt,
                card.LastTestSucceeded))
            .ToList();
    }

    public async Task<StudioCardDetailDto?> GetCardAsync(long id, CancellationToken ct)
    {
        return await _dbContext.StudioCards
            .AsNoTracking()
            .Where(card => card.Id == id && !card.IsDeleted)
            .Select(card => new StudioCardDetailDto(
                card.Id,
                card.Title,
                card.Description,
                card.CardType,
                card.LayoutType,
                card.Status,
                card.Scope,
                card.ClientId,
                card.ProfileId,
                card.IntegrationId,
                card.Query,
                card.FieldsJson,
                card.StyleJson,
                card.LayoutJson,
                card.RefreshPolicyJson,
                card.DataSourceJson,
                card.CreatedAt,
                card.UpdatedAt,
                card.LastTestedAt,
                card.LastTestSucceeded,
                card.LastTestSignature))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<StudioCardDetailDto> CreateCardAsync(
        CreateStudioCardRequest request,
        long userId,
        CancellationToken ct)
    {
        var signature = ComputeSignature(request.IntegrationId, request.Query, request.CardType, request.LayoutType,
            request.FieldsJson, request.StyleJson, request.LayoutJson, request.RefreshPolicyJson, request.DataSourceJson);

        var requiresTest = request.IntegrationId.HasValue && !string.IsNullOrWhiteSpace(request.Query);

        if (requiresTest && !IsValidTestSignature(signature, request.TestSignature, request.TestedAt))
        {
            throw new InvalidOperationException("Card must be tested successfully before saving.");
        }

        var now = DateTime.UtcNow;
        var card = new StudioCard
        {
            OwnerUserId = userId,
            Scope = request.Scope,
            ClientId = request.ClientId,
            ProfileId = request.ProfileId,
            Title = request.Title,
            Description = request.Description,
            CardType = request.CardType,
            LayoutType = request.LayoutType,
            IntegrationId = request.IntegrationId,
            Query = request.Query,
            FieldsJson = request.FieldsJson,
            StyleJson = request.StyleJson,
            LayoutJson = request.LayoutJson,
            RefreshPolicyJson = request.RefreshPolicyJson,
            DataSourceJson = request.DataSourceJson,
            Status = StudioCardStatus.Draft,
            CreatedAt = now,
            UpdatedAt = now,
            LastTestedAt = requiresTest ? request.TestedAt : null,
            LastTestSucceeded = requiresTest,
            LastTestSignature = requiresTest ? signature : null
        };

        _dbContext.StudioCards.Add(card);
        await _dbContext.SaveChangesAsync(ct);

        return await GetCardAsync(card.Id, ct) ?? throw new InvalidOperationException("Card not found after create.");
    }

    public async Task<StudioCardDetailDto> UpdateCardAsync(
        long id,
        UpdateStudioCardRequest request,
        long userId,
        bool isPlatformAdmin,
        CancellationToken ct)
    {
        var card = await _dbContext.StudioCards.FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);
        if (card == null)
        {
            throw new KeyNotFoundException("Card not found.");
        }

        if (!isPlatformAdmin && card.OwnerUserId != userId)
        {
            throw new UnauthorizedAccessException();
        }

        // Track if query-related fields changed
        var originalIntegrationId = card.IntegrationId;
        var originalQuery = card.Query;

        card.Title = request.Title ?? card.Title;
        card.Description = request.Description ?? card.Description;
        card.Status = request.Status ?? card.Status;
        card.CardType = request.CardType ?? card.CardType;
        card.LayoutType = request.LayoutType ?? card.LayoutType;
        card.IntegrationId = request.IntegrationId ?? card.IntegrationId;
        card.Query = request.Query ?? card.Query;
        card.FieldsJson = request.FieldsJson ?? card.FieldsJson;
        card.StyleJson = request.StyleJson ?? card.StyleJson;
        card.LayoutJson = request.LayoutJson ?? card.LayoutJson;
        card.RefreshPolicyJson = request.RefreshPolicyJson ?? card.RefreshPolicyJson;
        card.DataSourceJson = request.DataSourceJson ?? card.DataSourceJson;

        var signature = ComputeSignature(card.IntegrationId, card.Query, card.CardType, card.LayoutType,
            card.FieldsJson, card.StyleJson, card.LayoutJson, card.RefreshPolicyJson, card.DataSourceJson);

        var requiresTest = card.IntegrationId.HasValue && !string.IsNullOrWhiteSpace(card.Query);
        var queryChanged = originalIntegrationId != card.IntegrationId || originalQuery != card.Query;

        if (requiresTest)
        {
            var hasValidExistingTest = card.LastTestSucceeded && card.LastTestSignature == signature;
            var hasNewValidTest = IsValidTestSignature(signature, request.TestSignature, request.TestedAt);

            // Only require test validation if query changed OR if there's no existing valid test
            if (queryChanged || !card.LastTestSucceeded)
            {
                if (!hasValidExistingTest && !hasNewValidTest)
                {
                    throw new InvalidOperationException("Card must be tested successfully before saving changes.");
                }
            }

            if (hasNewValidTest)
            {
                card.LastTestedAt = request.TestedAt;
                card.LastTestSucceeded = true;
                card.LastTestSignature = signature;
            }
        }
        else
        {
            card.LastTestedAt = null;
            card.LastTestSucceeded = false;
            card.LastTestSignature = null;
        }

        card.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        return await GetCardAsync(card.Id, ct) ?? throw new InvalidOperationException("Card not found after update.");
    }

    public async Task DeleteCardAsync(long id, long userId, bool isPlatformAdmin, CancellationToken ct)
    {
        var card = await _dbContext.StudioCards.FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);
        if (card == null)
        {
            throw new KeyNotFoundException("Card not found.");
        }

        if (!isPlatformAdmin && card.OwnerUserId != userId)
        {
            throw new UnauthorizedAccessException();
        }

        card.IsDeleted = true;
        card.DeletedAt = DateTime.UtcNow;
        card.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(ct);
    }

    public async Task<StudioCardDetailDto> CloneCardAsync(long id, long userId, CancellationToken ct)
    {
        var original = await _dbContext.StudioCards.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);
        if (original == null)
        {
            throw new KeyNotFoundException("Card not found.");
        }

        var now = DateTime.UtcNow;
        var card = new StudioCard
        {
            OwnerUserId = userId,
            Scope = original.Scope,
            ClientId = original.ClientId,
            ProfileId = original.ProfileId,
            Title = $"Copy of {original.Title}",
            Description = original.Description,
            CardType = original.CardType,
            LayoutType = original.LayoutType,
            IntegrationId = null,
            Query = original.Query,
            FieldsJson = original.FieldsJson,
            StyleJson = original.StyleJson,
            LayoutJson = original.LayoutJson,
            RefreshPolicyJson = original.RefreshPolicyJson,
            DataSourceJson = null,
            Status = StudioCardStatus.Draft,
            CreatedAt = now,
            UpdatedAt = now,
            LastTestedAt = null,
            LastTestSucceeded = false,
            LastTestSignature = null
        };

        _dbContext.StudioCards.Add(card);
        await _dbContext.SaveChangesAsync(ct);

        return await GetCardAsync(card.Id, ct) ?? throw new InvalidOperationException("Card not found after clone.");
    }

    public async Task<StudioCardTestResult> TestCardAsync(
        StudioCardTestRequest request,
        string? bearerToken,
        CancellationToken ct)
    {
        if (!request.IntegrationId.HasValue || string.IsNullOrWhiteSpace(request.Query))
        {
            return new StudioCardTestResult(false, "IntegrationId and Query are required for testing.", null, null);
        }

        var result = await _integrationClient.ExecuteQueryAsync(
            request.IntegrationId.Value,
            request.Query,
            bearerToken,
            ct);

        if (!result.Success)
        {
            return new StudioCardTestResult(false, result.ErrorMessage, null, result.ExecutionTimeMs);
        }

        var signature = ComputeSignature(
            request.IntegrationId,
            request.Query,
            request.CardType ?? string.Empty,
            request.LayoutType ?? string.Empty,
            request.FieldsJson,
            request.StyleJson,
            request.LayoutJson,
            request.RefreshPolicyJson,
            request.DataSourceJson);

        return new StudioCardTestResult(true, null, signature, result.ExecutionTimeMs);
    }

    private static string ComputeSignature(
        long? integrationId,
        string? query,
        string cardType,
        string layoutType,
        string? fieldsJson,
        string? styleJson,
        string? layoutJson,
        string? refreshPolicyJson,
        string? dataSourceJson)
    {
        // Normalize values: use empty string instead of null for consistency
        var payload = new
        {
            integrationId,
            query = query ?? string.Empty,
            cardType = cardType ?? string.Empty,
            layoutType = layoutType ?? string.Empty,
            fieldsJson = fieldsJson ?? string.Empty,
            styleJson = styleJson ?? string.Empty,
            layoutJson = layoutJson ?? string.Empty,
            refreshPolicyJson = refreshPolicyJson ?? string.Empty,
            dataSourceJson = dataSourceJson ?? string.Empty
        };

        return StudioHashService.ComputeSignature(payload);
    }

    private static bool IsValidTestSignature(string signature, string? requestSignature, DateTime? testedAt)
    {
        if (string.IsNullOrWhiteSpace(requestSignature) || !testedAt.HasValue)
        {
            return false;
        }

        var withinWindow = testedAt.Value >= DateTime.UtcNow.AddMinutes(-30);
        return withinWindow && string.Equals(signature, requestSignature, StringComparison.OrdinalIgnoreCase);
    }
}
