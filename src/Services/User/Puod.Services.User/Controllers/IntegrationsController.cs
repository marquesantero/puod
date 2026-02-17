using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Puod.Services.User.Data;
using Puod.Services.User.DTOs;
using Puod.Services.User.Models;
using System.Net.Http;
using System.Text.Json;
using Puod.Services.User.Services;

namespace Puod.Services.User.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/integrations")]
[Asp.Versioning.ApiVersion(1.0)]
[Authorize]
public class IntegrationsController : ControllerBase
{
    private readonly PuodDbContext _dbContext;
    private readonly ILogger<IntegrationsController> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IAccessControlService _accessControlService;

    public IntegrationsController(
        PuodDbContext dbContext,
        ILogger<IntegrationsController> logger,
        IHttpClientFactory httpClientFactory,
        IAccessControlService accessControlService)
    {
        _dbContext = dbContext;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _accessControlService = accessControlService;
    }

    [HttpGet("companies")]
    [Authorize(Policy = "Permission:Integrations.View")]
    public async Task<ActionResult<List<CompanySummaryResponse>>> GetCompanies(CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var isSystemAdmin = _accessControlService.IsSystemAdmin(userId.Value);

        List<CompanySummaryResponse> profiles;

        if (isSystemAdmin)
        {
            profiles = await _dbContext.Profiles
                .Where(p => p.IsActive && !p.IsDeleted)
                .OrderBy(p => p.Name)
                .Select(p => new CompanySummaryResponse(p.Id, p.Name, p.Slug))
                .ToListAsync(ct);
        }
        else
        {
            var accessibleCompanyIds = await _accessControlService.GetAccessibleCompanyIdsAsync(userId.Value, ct);

            profiles = await _dbContext.Profiles
                .Where(p => accessibleCompanyIds.Contains(p.Id) && p.IsActive && !p.IsDeleted)
                .OrderBy(p => p.Name)
                .Select(p => new CompanySummaryResponse(p.Id, p.Name, p.Slug))
                .ToListAsync(ct);
        }

        return Ok(profiles);
    }

    [HttpGet("overview")]
    [Authorize(Policy = "Permission:Integrations.View")]
    public async Task<ActionResult<IntegrationOverviewResponse>> GetOverview([FromQuery] long companyId, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        if (!await _accessControlService.CanAccessCompanyAsync(userId.Value, companyId, ct)) return Forbid();

        var integrations = await _dbContext.Integrations
            .Where(i => !i.IsDeleted && (
                (i.OwnerType == OwnerType.Company && i.ProfileId == companyId) ||
                (i.OwnerType == OwnerType.Client && i.ClientId != null)
            ))
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(ct);

        var responseList = integrations.Select(i => ToResponse(i, companyId)).ToList();

        return Ok(new IntegrationOverviewResponse(new List<IntegrationGroupResponse>(), responseList));
    }

    [HttpPost]
    [Authorize(Policy = "Permission:Integrations.Create")]
    public async Task<ActionResult<IntegrationResponse>> CreateIntegration([FromBody] IntegrationCreateRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        if (!await _accessControlService.CanAccessCompanyAsync(userId.Value, request.CompanyId, ct)) return Forbid();

        if (!Enum.TryParse<IntegrationType>(request.Type, true, out var integrationType))
        {
            return BadRequest(new { message = "Invalid integration type." });
        }

        var status = IntegrationStatus.Pending;
        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<IntegrationStatus>(request.Status, true, out var parsedStatus))
        {
            status = parsedStatus;
        }

        var integration = new IntegrationConnection
        {
            ProfileId = request.CompanyId,
            Type = integrationType,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Status = status,
            ConfigJson = string.IsNullOrWhiteSpace(request.ConfigJson) ? "{}" : request.ConfigJson,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId,
            OwnerType = OwnerType.Company
        };

        _dbContext.Integrations.Add(integration);
        await _dbContext.SaveChangesAsync(ct);

        return Ok(ToResponse(integration, request.CompanyId));
    }

    [HttpPut("{id:long}")]
    [Authorize(Policy = "Permission:Integrations.Edit")]
    public async Task<ActionResult<IntegrationResponse>> UpdateIntegration(long id, [FromBody] IntegrationUpdateRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var integration = await _dbContext.Integrations.FirstOrDefaultAsync(i => i.Id == id && !i.IsDeleted, ct);
        if (integration == null) return NotFound();

        if (!await _accessControlService.CanAccessCompanyAsync(userId.Value, integration.ProfileId, ct)) return Forbid();

        integration.Name = request.Name.Trim();
        integration.Description = request.Description?.Trim();
        integration.ConfigJson = string.IsNullOrWhiteSpace(request.ConfigJson) ? "{}" : request.ConfigJson;
        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<IntegrationStatus>(request.Status, true, out var parsedStatus))
        {
            integration.Status = parsedStatus;
        }
        integration.UpdatedAt = DateTime.UtcNow;
        integration.UpdatedBy = userId;

        await _dbContext.SaveChangesAsync(ct);

        return Ok(ToResponse(integration, integration.ProfileId));
    }

    [HttpDelete("{id:long}")]
    [Authorize(Policy = "Permission:Integrations.Delete")]
    public async Task<IActionResult> DeleteIntegration(long id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var integration = await _dbContext.Integrations.FirstOrDefaultAsync(i => i.Id == id && !i.IsDeleted, ct);
        if (integration == null) return NotFound();

        if (!await _accessControlService.CanAccessCompanyAsync(userId.Value, integration.ProfileId, ct)) return Forbid();

        integration.IsDeleted = true;
        integration.DeletedAt = DateTime.UtcNow;
        integration.DeletedBy = userId;

        await _dbContext.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:long}/test")]
    [Authorize(Policy = "Permission:Integrations.Execute")]
    public async Task<ActionResult<IntegrationTestResponse>> TestIntegration(long id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var integration = await _dbContext.Integrations.FirstOrDefaultAsync(i => i.Id == id && !i.IsDeleted, ct);
        if (integration == null) return NotFound();

        try
        {
            var config = JsonSerializer.Deserialize<Dictionary<string, string>>(integration.ConfigJson) ?? new Dictionary<string, string>();
            var baseUrl = config.GetValueOrDefault("baseUrl");

            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                return Ok(new IntegrationTestResponse(false, "Base URL not configured", "error"));
            }

            using var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(10);

            var response = await httpClient.GetAsync(baseUrl, ct);

            integration.Status = response.IsSuccessStatusCode ? IntegrationStatus.Ready : IntegrationStatus.Error;
            await _dbContext.SaveChangesAsync(ct);

            return Ok(new IntegrationTestResponse(
                response.IsSuccessStatusCode,
                response.IsSuccessStatusCode ? "Connection successful!" : $"Connection failed: {response.StatusCode}",
                integration.Status.ToString().ToLowerInvariant()
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error testing integration {IntegrationId}", id);
            integration.Status = IntegrationStatus.Error;
            await _dbContext.SaveChangesAsync(ct);
            return Ok(new IntegrationTestResponse(false, $"Test failed: {ex.Message}", "error"));
        }
    }

    private static IntegrationResponse ToResponse(IntegrationConnection integration, long requestCompanyId)
    {
        return new IntegrationResponse(
            integration.Id,
            requestCompanyId,
            integration.OwnerType == OwnerType.Client,
            integration.Type.ToString().ToLowerInvariant(),
            integration.Name,
            integration.Description,
            integration.Status.ToString().ToLowerInvariant(),
            integration.ConfigJson,
            integration.CreatedAt);
    }

    private long? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return long.TryParse(userId, out var parsed) ? parsed : null;
    }
}
