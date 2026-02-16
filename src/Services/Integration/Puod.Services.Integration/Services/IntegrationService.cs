using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Puod.Services.Integration.Connectors;
using Puod.Services.Integration.Data;
using Puod.Services.Integration.DTOs;
using Puod.Services.Integration.Models;

namespace Puod.Services.Integration.Services;

public interface IIntegrationService
{
    Task<IntegrationDto> CreateIntegrationAsync(long profileId, CreateIntegrationRequest request);
    Task<IntegrationDetailDto> GetIntegrationAsync(long id, long profileId, long? clientId, bool isPlatformAdmin);
    Task<List<IntegrationDto>> ListIntegrationsAsync(long profileId);
    Task<List<IntegrationDto>> ListClientIntegrationsAsync(long clientId);
    Task<List<IntegrationDto>> ListCompanyAvailableIntegrationsAsync(long profileId);
    Task<IntegrationDto> UpdateIntegrationAsync(long id, long profileId, long? clientId, bool isPlatformAdmin, UpdateIntegrationRequest request);
    Task<IntegrationDto> UpdateIntegrationCookieHeaderAsync(long id, long? profileId, bool isPlatformAdmin, UpdateIntegrationCookieRequest request);
    Task DeleteIntegrationAsync(long id, long profileId, long? clientId, bool isPlatformAdmin);
    Task<ConnectionResult> TestConnectionAsync(TestConnectionRequest request);
    Task<QueryResultDto> ExecuteQueryAsync(long profileId, ExecuteQueryRequest request, bool isPlatformAdmin);
    Task<List<string>> ListDatabasesAsync(long profileId, long integrationId, string? search = null, int? limit = null);
    Task<List<string>> ListTablesAsync(long profileId, long integrationId, string database);
}

/// <summary>
/// Serviço de gerenciamento de integrações com BI tools
/// </summary>
public class IntegrationService : IIntegrationService
{
    private readonly IntegrationDbContext _context;
    private readonly IConnectorFactory _connectorFactory;
    private readonly IDistributedCache _cache;
    private readonly ILogger<IntegrationService> _logger;

    private static readonly DistributedCacheEntryOptions CacheOptions = new()
    {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
        SlidingExpiration = TimeSpan.FromMinutes(2)
    };

    public IntegrationService(IntegrationDbContext context, IConnectorFactory connectorFactory, IDistributedCache cache, ILogger<IntegrationService> logger)
    {
        _context = context;
        _connectorFactory = connectorFactory;
        _cache = cache;
        _logger = logger;
    }

    public async Task<IntegrationDto> CreateIntegrationAsync(long profileId, CreateIntegrationRequest request)
    {
        // Determine owner type and set appropriate fields
        OwnerType ownerType;
        long? actualProfileId;
        long? clientId = null;
        List<long> companyIds = request.CompanyIds != null && request.CompanyIds.Count > 0
            ? request.CompanyIds
            : new List<long>();

        if (request.ClientId.HasValue)
        {
            // Creating at Client level
            ownerType = OwnerType.Client;
            clientId = request.ClientId.Value;
            actualProfileId = null;
        }
        else if (request.ProfileId.HasValue)
        {
            // Creating at Company level
            ownerType = OwnerType.Company;
            actualProfileId = request.ProfileId.Value;
        }
        else
        {
            // Fallback to using profileId from parameter (for backward compatibility)
            ownerType = OwnerType.Company;
            actualProfileId = profileId > 0 ? profileId : null;
        }

        if (ownerType == OwnerType.Company && !actualProfileId.HasValue)
            throw new InvalidOperationException("ProfileId is required for company integrations.");

        var integration = new Models.Integration
        {
            ProfileId = ownerType == OwnerType.Client ? null : actualProfileId,
            OwnerType = ownerType,
            ClientId = clientId,
            CompanyIds = companyIds,
            Name = request.Name,
            Type = request.Type,
            ConfigJson = JsonSerializer.Serialize(request.Configuration),
            Status = IntegrationStatus.Active,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Integrations.Add(integration);
        await _context.SaveChangesAsync();

        return MapToDto(integration);
    }

    public async Task<IntegrationDetailDto> GetIntegrationAsync(long id, long profileId, long? clientId, bool isPlatformAdmin)
    {
        Models.Integration? integration;

        // Platform Admin can access any integration
        if (isPlatformAdmin && !clientId.HasValue)
        {
            integration = await _context.Integrations
                .FirstOrDefaultAsync(i => i.Id == id && !i.IsDeleted);
        }
        else if (clientId.HasValue)
        {
            integration = await _context.Integrations
                .FirstOrDefaultAsync(i => i.Id == id && i.ClientId == clientId && i.OwnerType == OwnerType.Client && !i.IsDeleted);
        }
        else
        {
            integration = await _context.Integrations
                .FirstOrDefaultAsync(i => i.Id == id && i.ProfileId == profileId && !i.IsDeleted);
        }

        if (integration == null)
            throw new KeyNotFoundException("Integration not found");

        if (integration.OwnerType == OwnerType.Client && !clientId.HasValue && !isPlatformAdmin)
            throw new UnauthorizedAccessException("Not allowed to access this integration");

        return MapToDetailDto(integration);
    }

    public async Task<List<IntegrationDto>> ListIntegrationsAsync(long profileId)
    {
        var integrations = await _context.Integrations
            .Where(i => i.ProfileId == profileId && !i.IsDeleted)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();

        return integrations.Select(MapToDto).ToList();
    }

    public async Task<List<IntegrationDto>> ListClientIntegrationsAsync(long clientId)
    {
        var integrations = await _context.Integrations
            .Where(i => i.ClientId == clientId && i.OwnerType == OwnerType.Client && !i.IsDeleted)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();

        return integrations.Select(MapToDto).ToList();
    }

    public async Task<List<IntegrationDto>> ListCompanyAvailableIntegrationsAsync(long profileId)
    {
        var availableIntegrations = new List<Models.Integration>();

        // Get integrations owned by the company
        var ownedIntegrations = await _context.Integrations
            .Where(i => i.ProfileId == profileId && i.OwnerType == OwnerType.Company && !i.IsDeleted)
            .ToListAsync();

        availableIntegrations.AddRange(ownedIntegrations);

        // Get integrations inherited from client (where company is in CompanyIds)
        // Note: Cannot use .Contains() on jsonb List<long>, so we load all Client integrations and filter in memory
        var allClientIntegrations = await _context.Integrations
            .Where(i => i.OwnerType == OwnerType.Client && !i.IsDeleted)
            .ToListAsync();

        var inheritedIntegrations = allClientIntegrations
            .Where(i => i.CompanyIds != null && i.CompanyIds.Contains(profileId))
            .ToList();

        availableIntegrations.AddRange(inheritedIntegrations);

        return availableIntegrations
            .OrderBy(i => i.Name)
            .Select(MapToDto)
            .ToList();
    }

    public async Task<IntegrationDto> UpdateIntegrationAsync(long id, long profileId, long? clientId, bool isPlatformAdmin, UpdateIntegrationRequest request)
    {
        Models.Integration? integration;

        if (clientId.HasValue)
        {
            integration = await _context.Integrations
                .FirstOrDefaultAsync(i => i.Id == id && i.ClientId == clientId && i.OwnerType == OwnerType.Client);
        }
        else
        {
            integration = await _context.Integrations
                .FirstOrDefaultAsync(i => i.Id == id && i.ProfileId == profileId);
        }

        if (integration == null)
            throw new KeyNotFoundException("Integration not found");

        if (integration.OwnerType == OwnerType.Client && !clientId.HasValue && !isPlatformAdmin)
            throw new UnauthorizedAccessException("Not allowed to update this integration");

        if (!string.IsNullOrEmpty(request.Name))
            integration.Name = request.Name;

        if (request.Configuration != null)
        {
            integration.ConfigJson = JsonSerializer.Serialize(request.Configuration);
        }

        // Update CompanyIds if provided (for client-owned integrations)
        if (request.CompanyIds != null && integration.OwnerType == OwnerType.Client)
        {
            integration.CompanyIds = request.CompanyIds.Count > 0 ? request.CompanyIds : new List<long>();
        }

        if (request.IsActive.HasValue)
            integration.IsDeleted = !request.IsActive.Value;

        integration.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return MapToDto(integration);
    }

    public async Task<IntegrationDto> UpdateIntegrationCookieHeaderAsync(long id, long? profileId, bool isPlatformAdmin, UpdateIntegrationCookieRequest request)
    {
        var integration = await _context.Integrations
            .FirstOrDefaultAsync(i => i.Id == id && !i.IsDeleted);

        if (integration == null)
            throw new KeyNotFoundException("Integration not found");

        if (integration.OwnerType == OwnerType.Company)
        {
            if (!profileId.HasValue || integration.ProfileId != profileId.Value)
            {
                throw new UnauthorizedAccessException("Not allowed to update this integration");
            }
        }
        else if (integration.OwnerType == OwnerType.Client && !isPlatformAdmin)
        {
            throw new UnauthorizedAccessException("Not allowed to update this integration");
        }

        var config = DeserializeConfig(integration.ConfigJson);
        config["auth_type"] = "browser_cookies";
        config["cookie_header"] = request.CookieHeader;
        config["cookie_domain"] = request.CookieDomain;

        integration.ConfigJson = JsonSerializer.Serialize(config);
        integration.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return MapToDto(integration);
    }

    public async Task DeleteIntegrationAsync(long id, long profileId, long? clientId, bool isPlatformAdmin)
    {
        Models.Integration? integration;

        if (clientId.HasValue)
        {
            integration = await _context.Integrations
                .FirstOrDefaultAsync(i => i.Id == id && i.ClientId == clientId && i.OwnerType == OwnerType.Client);
        }
        else
        {
            integration = await _context.Integrations
                .FirstOrDefaultAsync(i => i.Id == id && i.ProfileId == profileId);
        }

        if (integration == null)
            throw new KeyNotFoundException("Integration not found");

        if (integration.OwnerType == OwnerType.Client && !clientId.HasValue && !isPlatformAdmin)
            throw new UnauthorizedAccessException("Not allowed to delete this integration");

        integration.IsDeleted = true;
        integration.DeletedAt = DateTime.UtcNow;
        integration.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    public async Task<ConnectionResult> TestConnectionAsync(TestConnectionRequest request)
    {
        var connector = _connectorFactory.CreateConnector(request.Type);
        return await connector.TestConnectionAsync(request.Configuration);
    }

    public async Task<QueryResultDto> ExecuteQueryAsync(long profileId, ExecuteQueryRequest request, bool isPlatformAdmin)
    {
        // Find integration by ID first
        var integration = await _context.Integrations
            .FirstOrDefaultAsync(i => i.Id == request.IntegrationId);

        if (integration == null)
            throw new KeyNotFoundException("Integration not found");

        if (integration.IsDeleted)
            throw new InvalidOperationException("Integration is not active");

        // Platform Admin has access to all integrations
        if (isPlatformAdmin)
        {
            // Platform admin - full access to any integration
        }
        else
        {
            // Regular user - validate access based on ownership
            if (integration.OwnerType == OwnerType.Company && integration.ProfileId.HasValue)
            {
                // Company-owned integration - must match user's profileId
                if (integration.ProfileId.Value != profileId)
                    throw new UnauthorizedAccessException("Not allowed to access this integration");
            }
            else if (integration.OwnerType == OwnerType.Client && integration.ClientId.HasValue)
            {
                // Client-owned integration - would need to verify user has access to this client
                // For now, allowing in dev mode, but should implement proper client access check
                // TODO: Implement client access validation based on user's permissions
            }
            else if (integration.OwnerType == OwnerType.Group)
            {
                // Group-owned integration - would need to verify user belongs to this group
                // TODO: Implement group membership validation
            }
        }

        var connector = _connectorFactory.CreateConnector(integration.Type);

        // Apply data source settings to query if provided
        var processedQuery = request.Query;
        _logger.LogInformation($"[ExecuteQueryAsync] Original query: {request.Query}");
        _logger.LogInformation($"[ExecuteQueryAsync] DataSourceJson: {request.DataSourceJson}");

        if (!string.IsNullOrWhiteSpace(request.DataSourceJson))
        {
            processedQuery = integration.Type switch
            {
                ConnectorType.Airflow => DataSourceSettingsHelper.ApplyAirflowSettings(request.Query, request.DataSourceJson),
                _ => request.Query
            };
            _logger.LogInformation($"[ExecuteQueryAsync] Processed query after ApplyAirflowSettings: {processedQuery}");
        }

        // Pass dataSourceJson to connector via config
        var config = DeserializeConfig(integration.ConfigJson);
        if (!string.IsNullOrWhiteSpace(request.DataSourceJson))
        {
            config["dataSourceJson"] = request.DataSourceJson;
        }

        var result = await connector.ExecuteQueryAsync(processedQuery, config);

        // Apply post-execution filtering based on data source settings
        if (result.Success && result.Rows != null && !string.IsNullOrWhiteSpace(request.DataSourceJson))
        {
            _logger.LogInformation($"[ExecuteQueryAsync] Applying post-execution filtering. Rows before: {result.Rows.Count}");

            var filteredRows = integration.Type switch
            {
                ConnectorType.Airflow => DataSourceSettingsHelper.FilterAirflowResults(result.Rows, request.DataSourceJson),
                ConnectorType.Databricks => DataSourceSettingsHelper.FilterDatabricksResults(result.Rows, request.DataSourceJson),
                ConnectorType.AzureDataFactory => DataSourceSettingsHelper.FilterAdfResults(result.Rows, request.DataSourceJson),
                _ => result.Rows
            };

            _logger.LogInformation($"[ExecuteQueryAsync] Rows after filtering: {filteredRows?.Count ?? 0}");

            // Log a sample of DAG IDs if available
            if (filteredRows != null && filteredRows.Any())
            {
                var sampleDagIds = filteredRows.Take(5)
                    .Select(r => r.TryGetValue("dag_id", out var dagId) ? dagId?.ToString() : "N/A")
                    .ToList();
                _logger.LogInformation($"[ExecuteQueryAsync] Sample dag_ids in filtered results: {string.Join(", ", sampleDagIds)}");
            }

            result = new QueryResult
            {
                Success = result.Success,
                ErrorMessage = result.ErrorMessage,
                Rows = filteredRows,
                RowCount = filteredRows?.Count ?? 0,
                ExecutionTime = result.ExecutionTime
            };
        }

        await _context.SaveChangesAsync();

        return new QueryResultDto(
            result.Success,
            result.ErrorMessage,
            result.Rows,
            result.RowCount,
            result.ExecutionTime.TotalMilliseconds
        );
    }

    public async Task<List<string>> ListDatabasesAsync(long profileId, long integrationId, string? search = null, int? limit = null)
    {
        _logger.LogInformation($"[ListDatabasesAsync] Called with integrationId={integrationId}, search='{search}', limit={limit}");

        // Try to find integration - allow access to company-owned or client-owned (if user has access)
        var integration = await _context.Integrations
            .FirstOrDefaultAsync(i => i.Id == integrationId && !i.IsDeleted);

        if (integration == null)
            throw new KeyNotFoundException("Integration not found");

        // Validate access based on ownership
        if (integration.OwnerType == OwnerType.Company && integration.ProfileId.HasValue)
        {
            // Company-owned - must match profileId
            if (integration.ProfileId.Value != profileId)
                throw new UnauthorizedAccessException("Not allowed to access this integration");
        }
        else if (integration.OwnerType == OwnerType.Client && integration.ClientId.HasValue)
        {
            // Client-owned - check if company belongs to this client
            // For now, allow access in dev mode (TODO: implement proper validation)
            // In production, should verify user's company belongs to this client
        }

        var config = DeserializeConfig(integration.ConfigJson);

        // Apply search-specific config
        if (!string.IsNullOrWhiteSpace(search))
        {
            // Pass search term to connector to use native API filtering (much faster!)
            config["search_pattern"] = search;
            config["max_dags"] = (limit ?? 500).ToString(); // Lower limit since API filters
            _logger.LogInformation($"[ListDatabasesAsync] Searching with pattern '{search}', max_dags={config["max_dags"]}");
        }
        else
        {
            // When not searching, limit to avoid slow initial load
            config["max_dags"] = (limit ?? 200).ToString();
            _logger.LogInformation($"[ListDatabasesAsync] No search, limiting to max_dags={config["max_dags"]}");
        }

        var cacheKey = $"databases:{integrationId}:{search ?? "all"}:{limit ?? 0}";
        var cached = await _cache.GetStringAsync(cacheKey);
        if (cached != null)
        {
            _logger.LogInformation("[ListDatabasesAsync] Cache hit for key {CacheKey}", cacheKey);
            return JsonSerializer.Deserialize<List<string>>(cached) ?? [];
        }

        var connector = _connectorFactory.CreateConnector(integration.Type);
        var results = await connector.ListDatabasesAsync(config);
        _logger.LogInformation("[ListDatabasesAsync] Received {Count} results from connector", results.Count);

        await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(results), CacheOptions);
        return results;
    }

    public async Task<List<string>> ListTablesAsync(long profileId, long integrationId, string database)
    {
        // Try to find integration - allow access to company-owned or client-owned (if user has access)
        var integration = await _context.Integrations
            .FirstOrDefaultAsync(i => i.Id == integrationId && !i.IsDeleted);

        if (integration == null)
            throw new KeyNotFoundException("Integration not found");

        // Validate access based on ownership
        if (integration.OwnerType == OwnerType.Company && integration.ProfileId.HasValue)
        {
            // Company-owned - must match profileId
            if (integration.ProfileId.Value != profileId)
                throw new UnauthorizedAccessException("Not allowed to access this integration");
        }
        else if (integration.OwnerType == OwnerType.Client && integration.ClientId.HasValue)
        {
            // Client-owned - check if company belongs to this client
            // For now, allow access in dev mode (TODO: implement proper validation)
            // In production, should verify user's company belongs to this client
        }

        var cacheKey = $"tables:{integrationId}:{database}";
        var cached = await _cache.GetStringAsync(cacheKey);
        if (cached != null)
        {
            _logger.LogInformation("[ListTablesAsync] Cache hit for key {CacheKey}", cacheKey);
            return JsonSerializer.Deserialize<List<string>>(cached) ?? [];
        }

        var connector = _connectorFactory.CreateConnector(integration.Type);
        var results = await connector.ListTablesAsync(database, DeserializeConfig(integration.ConfigJson));

        await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(results), CacheOptions);
        return results;
    }

    private static IntegrationDto MapToDto(Models.Integration integration) => new(
        integration.Id,
        integration.ProfileId ?? 0,
        integration.OwnerType,
        integration.CompanyIds,
        integration.ClientId,
        integration.Name,
        integration.Type,
        integration.Status,
        integration.CreatedAt,
        null,
        !integration.IsDeleted
    );

    private static IntegrationDetailDto MapToDetailDto(Models.Integration integration) => new(
        integration.Id,
        integration.ProfileId ?? 0,
        integration.OwnerType,
        integration.CompanyIds,
        integration.ClientId,
        integration.Name,
        integration.Type,
        integration.Status,
        DeserializeConfig(integration.ConfigJson),
        integration.CreatedAt,
        integration.UpdatedAt,
        null,
        !integration.IsDeleted
    );

    private static Dictionary<string, string> DeserializeConfig(string? configJson)
    {
        if (string.IsNullOrWhiteSpace(configJson))
        {
            return new Dictionary<string, string>();
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(configJson)
                   ?? new Dictionary<string, string>();
        }
        catch (JsonException)
        {
            return new Dictionary<string, string>();
        }
    }
}
