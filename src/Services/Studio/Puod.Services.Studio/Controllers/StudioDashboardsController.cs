using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Puod.Services.Studio.DTOs;
using Puod.Services.Studio.Models;
using Puod.Services.Studio.Services;

namespace Puod.Services.Studio.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/studio/dashboards")]
[Asp.Versioning.ApiVersion(1.0)]
[Authorize]
public class StudioDashboardsController : ControllerBase
{
    private readonly StudioDashboardService _dashboardService;
    private readonly StudioAccessService _accessService;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<StudioDashboardsController> _logger;

    public StudioDashboardsController(
        StudioDashboardService dashboardService,
        StudioAccessService accessService,
        IWebHostEnvironment environment,
        ILogger<StudioDashboardsController> logger)
    {
        _dashboardService = dashboardService;
        _accessService = accessService;
        _environment = environment;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<StudioDashboardDto>>> ListDashboards(
        [FromQuery] StudioScope? scope,
        [FromQuery] long? clientId,
        [FromQuery] long? profileId,
        CancellationToken ct)
    {
        _logger.LogInformation("ListDashboards called with Scope={Scope}, ClientId={ClientId}, ProfileId={ProfileId}", scope, clientId, profileId);
        try
        {
            var userId = GetRequiredUserId();
            var dashboards = await _dashboardService.ListDashboardsAsync(scope, clientId, profileId, userId, IsPlatformAdmin(), ct);
            return Ok(dashboards);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to list dashboards");
            return Problem(detail: ex.ToString(), title: "Internal Server Error");
        }
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<StudioDashboardDetailDto>> GetDashboard(long id, CancellationToken ct)
    {
        var userId = GetRequiredUserId();
        if (!await _accessService.CanAccessDashboardAsync(id, userId, IsPlatformAdmin(), ct))
        {
            return Forbid();
        }

        var dashboard = await _dashboardService.GetDashboardAsync(id, ct);
        return dashboard == null ? NotFound() : Ok(dashboard);
    }

    [HttpPost]
    public async Task<ActionResult<StudioDashboardDetailDto>> CreateDashboard([FromBody] CreateStudioDashboardRequest request, CancellationToken ct)
    {
        ValidateScope(request.Scope, request.ClientId, request.ProfileId);

        var userId = GetRequiredUserId();
        var dashboard = await _dashboardService.CreateDashboardAsync(request, userId, ct);
        return Created($"/api/v1/studio/dashboards/{dashboard.Id}", dashboard);
    }

    [HttpPut("{id:long}")]
    public async Task<ActionResult<StudioDashboardDetailDto>> UpdateDashboard(long id, [FromBody] UpdateStudioDashboardRequest request, CancellationToken ct)
    {
        try
        {
            var userId = GetRequiredUserId();
            var dashboard = await _dashboardService.UpdateDashboardAsync(id, request, userId, IsPlatformAdmin(), ct);
            return Ok(dashboard);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> DeleteDashboard(long id, CancellationToken ct)
    {
        try
        {
            var userId = GetRequiredUserId();
            await _dashboardService.DeleteDashboardAsync(id, userId, IsPlatformAdmin(), ct);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    private static void ValidateScope(StudioScope scope, long? clientId, long? profileId)
    {
        if (scope == StudioScope.Client && !clientId.HasValue)
        {
            throw new InvalidOperationException("ClientId is required for client scope.");
        }

        if (scope == StudioScope.Company && !profileId.HasValue)
        {
            throw new InvalidOperationException("ProfileId is required for company scope.");
        }
    }

    private long GetRequiredUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(userId) || !long.TryParse(userId, out var parsed))
        {
            // In development mode, return a default userId when no claim exists
            if (_environment.IsDevelopment())
            {
                return 1; // Default development user
            }
            throw new InvalidOperationException("UserId claim missing.");
        }

        return parsed;
    }

    private bool IsPlatformAdmin()
    {
        // In development mode, treat as admin when no user claims exist
        if (_environment.IsDevelopment() && !User.Identity?.IsAuthenticated == true)
        {
            return true; // Default to admin in development
        }
        return User.IsInRole("Platform Admin") || User.IsInRole("system_admin");
    }
}
