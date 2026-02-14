using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Puod.Services.Studio.DTOs;
using Puod.Services.Studio.Models;
using Puod.Services.Studio.Services;

namespace Puod.Services.Studio.Controllers;

[ApiController]
[Route("api/studio/shares")]
[Authorize]
public class StudioSharesController : ControllerBase
{
    private readonly StudioShareService _shareService;
    private readonly StudioAccessService _accessService;

    public StudioSharesController(StudioShareService shareService, StudioAccessService accessService)
    {
        _shareService = shareService;
        _accessService = accessService;
    }

    [HttpGet]
    public async Task<ActionResult<List<StudioShareDto>>> ListShares(
        [FromQuery] StudioShareTarget targetType,
        [FromQuery] long targetId,
        CancellationToken ct)
    {
        var userId = GetRequiredUserId();
        var isPlatformAdmin = IsPlatformAdmin();

        var canAccess = targetType switch
        {
            StudioShareTarget.Card => await _accessService.CanAccessCardAsync(targetId, userId, isPlatformAdmin, ct),
            StudioShareTarget.Dashboard => await _accessService.CanAccessDashboardAsync(targetId, userId, isPlatformAdmin, ct),
            _ => false
        };

        if (!canAccess)
        {
            return Forbid();
        }

        var shares = await _shareService.ListSharesAsync(targetType, targetId, ct);
        return Ok(shares);
    }

    [HttpPost]
    public async Task<ActionResult<StudioShareDto>> CreateShare([FromBody] StudioShareRequest request, CancellationToken ct)
    {
        var userId = GetRequiredUserId();
        var share = await _shareService.CreateShareAsync(request, userId, ct);
        return Ok(share);
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> DeleteShare(long id, CancellationToken ct)
    {
        try
        {
            await _shareService.DeleteShareAsync(id, ct);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    private long GetRequiredUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(userId) || !long.TryParse(userId, out var parsed))
        {
            throw new InvalidOperationException("UserId claim missing.");
        }

        return parsed;
    }

    private bool IsPlatformAdmin()
    {
        return User.IsInRole("Platform Admin") || User.IsInRole("system_admin");
    }
}
