using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Puod.Services.User.DTOs;
using Puod.Services.User.Services;

namespace Puod.Services.User.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/setup")]
[Asp.Versioning.ApiVersion(1.0)]
public class SetupController : ControllerBase
{
    private readonly ISetupService _setupService;
    private readonly ILogger<SetupController> _logger;

    public SetupController(ISetupService setupService, ILogger<SetupController> logger)
    {
        _setupService = setupService;
        _logger = logger;
    }

    [HttpGet("status")]
    [AllowAnonymous]
    public async Task<ActionResult<SetupStatusResponse>> Status(CancellationToken ct)
    {
        var status = await _setupService.GetStatusAsync(ct);
        return Ok(status);
    }

    [HttpPost("initialize")]
    [Authorize(Policy = "SystemAdmin")]
    public async Task<ActionResult<TenantCreateResponse>> Initialize([FromBody] TenantCreateRequest request, CancellationToken ct)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState
                    .Where(entry => entry.Value?.Errors.Count > 0)
                    .ToDictionary(
                        entry => entry.Key,
                        entry => entry.Value?.Errors.Select(error => error.ErrorMessage).ToArray() ?? Array.Empty<string>());

                _logger.LogWarning("Setup initialize payload invalid: {Errors}", errors);
                return BadRequest(new
                {
                    message = "Invalid setup payload.",
                    errors
                });
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue("sub");
            if (string.IsNullOrWhiteSpace(userId) || !long.TryParse(userId, out var actorUserId))
            {
                return Unauthorized();
            }

            var response = await _setupService.CreateTenantAsync(request, actorUserId, ct);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Setup initialize failed.");
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("steps")]
    [Authorize(Policy = "SystemAdmin")]
    public async Task<ActionResult<SetupStepsResponse>> GetSteps(CancellationToken ct)
    {
        var steps = await _setupService.GetStepsAsync(ct);
        return Ok(steps);
    }

    [HttpPost("steps/save")]
    [Authorize(Policy = "SystemAdmin")]
    public async Task<IActionResult> SaveStep([FromBody] SetupStepSaveRequest request, CancellationToken ct)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState
                    .Where(entry => entry.Value?.Errors.Count > 0)
                    .ToDictionary(
                        entry => entry.Key,
                        entry => entry.Value?.Errors.Select(error => error.ErrorMessage).ToArray() ?? Array.Empty<string>());

                _logger.LogWarning("Setup step save payload invalid: {Errors}", errors);
                return BadRequest(new
                {
                    message = "Invalid setup step payload.",
                    errors
                });
            }

            await _setupService.SaveStepAsync(request, ct);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Setup step save failed.");
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("steps/clear")]
    [Authorize(Policy = "SystemAdmin")]
    public async Task<IActionResult> ClearStep([FromBody] SetupStepClearRequest request, CancellationToken ct)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState
                    .Where(entry => entry.Value?.Errors.Count > 0)
                    .ToDictionary(
                        entry => entry.Key,
                        entry => entry.Value?.Errors.Select(error => error.ErrorMessage).ToArray() ?? Array.Empty<string>());

                _logger.LogWarning("Setup step clear payload invalid: {Errors}", errors);
                return BadRequest(new
                {
                    message = "Invalid setup step payload.",
                    errors
                });
            }

            await _setupService.ClearStepAsync(request, ct);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Setup step clear failed.");
            return BadRequest(new { message = ex.Message });
        }
    }
}
