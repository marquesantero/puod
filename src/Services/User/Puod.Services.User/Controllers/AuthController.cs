using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Puod.Services.User.DTOs;
using Puod.Services.User.Services;

namespace Puod.Services.User.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/auth")]
[Asp.Versioning.ApiVersion(1.0)]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    [Authorize(Policy = "SystemAdmin")]
    public async Task<ActionResult<LoginResponse>> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        var response = await _authService.RegisterAsync(request, ct);
        return Ok(response);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        try
        {
            var response = await _authService.LoginAsync(request, ct);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("discovery")]
    [AllowAnonymous]
    public async Task<ActionResult<DiscoveryResponse>> Discovery([FromBody] DiscoveryRequest request, CancellationToken ct)
    {
        var response = await _authService.DiscoverAsync(request.Email, ct);
        return Ok(response);
    }

    [HttpPost("callback")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Callback([FromBody] CallbackRequest request, CancellationToken ct)
    {
        try
        {
            var response = await _authService.CallbackAsync(request, ct);
            return Ok(response);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Callback Exception: {ex}");
            return Unauthorized(new { message = ex.Message, details = ex.ToString() });
        }
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Refresh([FromBody] RefreshTokenRequest request, CancellationToken ct)
    {
        try
        {
            var response = await _authService.RefreshAsync(request.RefreshToken, ct);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest request, CancellationToken ct)
    {
        await _authService.RevokeAsync(request.RefreshToken, ct);
        return NoContent();
    }

    [HttpGet("azure-profiles")]
    [AllowAnonymous]
    public async Task<ActionResult<List<AzureProfileInfo>>> GetAzureProfiles(CancellationToken ct)
    {
        var profiles = await _authService.GetAzureProfilesAsync(ct);
        return Ok(profiles);
    }

    [HttpGet("check-user")]
    [AllowAnonymous]
    public async Task<ActionResult<CheckUserResponse>> CheckUser([FromQuery] string email, CancellationToken ct)
    {
        var exists = await _authService.CheckUserExistsAsync(email, ct);
        return Ok(new CheckUserResponse(exists));
    }
}

public record CheckUserResponse(bool Exists);
