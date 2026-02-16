using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Puod.Services.Studio.DTOs;
using Puod.Services.Studio.Models;
using Puod.Services.Studio.Services;

namespace Puod.Services.Studio.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/studio/cards")]
[Asp.Versioning.ApiVersion(1.0)]
[Authorize]
public class StudioCardsController : ControllerBase
{
    private readonly StudioCardService _cardService;
    private readonly StudioAccessService _accessService;
    private readonly StudioSampleSeeder _sampleSeeder;
    private readonly IWebHostEnvironment _environment;

    public StudioCardsController(
        StudioCardService cardService,
        StudioAccessService accessService,
        StudioSampleSeeder sampleSeeder,
        IWebHostEnvironment environment)
    {
        _cardService = cardService;
        _accessService = accessService;
        _sampleSeeder = sampleSeeder;
        _environment = environment;
    }

    [HttpGet]
    public async Task<ActionResult<List<StudioCardDto>>> ListCards(
        [FromQuery] StudioScope? scope,
        [FromQuery] long? clientId,
        [FromQuery] long? profileId,
        CancellationToken ct)
    {
        var userId = GetRequiredUserId();
        var cards = await _cardService.ListCardsAsync(scope, clientId, profileId, userId, IsPlatformAdmin(), ct);
        return Ok(cards);
    }

    [HttpGet("templates")]
    public async Task<ActionResult<List<StudioCardDto>>> GetTemplates(
        [FromQuery] long? integrationId,
        CancellationToken ct)
    {
        await _sampleSeeder.SeedAsync(ct);
        var userId = GetRequiredUserId();
        var templates = await _cardService.GetTemplatesAsync(integrationId, userId, IsPlatformAdmin(), ct);
        return Ok(templates);
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<StudioCardDetailDto>> GetCard(long id, CancellationToken ct)
    {
        var userId = GetRequiredUserId();
        if (!await _accessService.CanAccessCardAsync(id, userId, IsPlatformAdmin(), ct))
        {
            return Forbid();
        }

        var card = await _cardService.GetCardAsync(id, ct);
        return card == null ? NotFound() : Ok(card);
    }

    [HttpPost]
    public async Task<ActionResult<StudioCardDetailDto>> CreateCard([FromBody] CreateStudioCardRequest request, CancellationToken ct)
    {
        ValidateScope(request.Scope, request.ClientId, request.ProfileId);

        var userId = GetRequiredUserId();
        var card = await _cardService.CreateCardAsync(request, userId, ct);
        return Created($"/api/v1/studio/cards/{card.Id}", card);
    }

    [HttpPut("{id:long}")]
    public async Task<ActionResult<StudioCardDetailDto>> UpdateCard(long id, [FromBody] UpdateStudioCardRequest request, CancellationToken ct)
    {
        try
        {
            var userId = GetRequiredUserId();
            var card = await _cardService.UpdateCardAsync(id, request, userId, IsPlatformAdmin(), ct);
            return Ok(card);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> DeleteCard(long id, CancellationToken ct)
    {
        try
        {
            var userId = GetRequiredUserId();
            await _cardService.DeleteCardAsync(id, userId, IsPlatformAdmin(), ct);
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

    [HttpPost("{id:long}/clone")]
    public async Task<ActionResult<StudioCardDetailDto>> CloneCard(long id, CancellationToken ct)
    {
        try
        {
            var userId = GetRequiredUserId();
            var card = await _cardService.CloneCardAsync(id, userId, ct);
            return Ok(card);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("test")]
    public async Task<ActionResult<StudioCardTestResult>> TestCard([FromBody] StudioCardTestRequest request, CancellationToken ct)
    {
        var bearer = Request.Headers.Authorization.ToString();
        var result = await _cardService.TestCardAsync(request, bearer, ct);
        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
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
