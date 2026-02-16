using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Puod.Services.Integration.DTOs;
using Puod.Services.Integration.Services;

namespace Puod.Services.Integration.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[Asp.Versioning.ApiVersion(1.0)]
public class IntegrationController : ControllerBase
{
    private readonly IIntegrationService _integrationService;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<IntegrationController> _logger;

    public IntegrationController(IIntegrationService integrationService, IWebHostEnvironment environment, ILogger<IntegrationController> logger)
    {
        _integrationService = integrationService;
        _environment = environment;
        _logger = logger;
    }

    /// <summary>
    /// Cria nova integração
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<IntegrationDto>> CreateIntegration([FromBody] CreateIntegrationRequest request)
    {
        try
        {
            var profileId = GetProfileId();
            if (!profileId.HasValue && !request.ClientId.HasValue)
            {
                return Unauthorized();
            }
            var integration = await _integrationService.CreateIntegrationAsync(profileId ?? 0, request);
            return Created($"/api/v1/integration/{integration.Id}", integration);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
        {
            return BadRequest(new { message = ex.InnerException?.Message ?? ex.Message });
        }
    }

    /// <summary>
    /// Lista todas as integrações do perfil
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<IntegrationDto>>> ListIntegrations([FromQuery] long? clientId)
    {
        // If clientId is provided, get integrations for that client
        if (clientId.HasValue)
        {
            var clientIntegrations = await _integrationService.ListClientIntegrationsAsync(clientId.Value);
            return Ok(clientIntegrations);
        }

        // Otherwise, get integrations for the user's profile
        var profileId = GetProfileId();
        if (!profileId.HasValue)
        {
            return Unauthorized();
        }
        var integrations = await _integrationService.ListIntegrationsAsync(profileId.Value);
        return Ok(integrations);
    }

    /// <summary>
    /// Obtém integrações disponíveis para uma empresa (próprias + herdadas do cliente)
    /// </summary>
    [HttpGet("company/{profileId}/available")]
    public async Task<ActionResult<List<IntegrationDto>>> GetCompanyAvailableIntegrations(long profileId)
    {
        var integrations = await _integrationService.ListCompanyAvailableIntegrationsAsync(profileId);
        return Ok(integrations);
    }

    /// <summary>
    /// Obtém integração por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<IntegrationDetailDto>> GetIntegration(long id, [FromQuery] long? clientId)
    {
        try
        {
            var profileId = GetProfileId();
            var isPlatformAdmin = IsPlatformAdmin();

            if (!profileId.HasValue)
            {
                return Unauthorized();
            }
            var integration = await _integrationService.GetIntegrationAsync(id, profileId.Value, clientId, isPlatformAdmin);
            return Ok(integration);
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

    /// <summary>
    /// Atualiza integração
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<IntegrationDto>> UpdateIntegration(long id, [FromBody] UpdateIntegrationRequest request, [FromQuery] long? clientId)
    {
        try
        {
            var profileId = GetProfileId();
            if (!profileId.HasValue)
            {
                return Unauthorized();
            }
            var integration = await _integrationService.UpdateIntegrationAsync(id, profileId.Value, clientId, IsPlatformAdmin(), request);
            return Ok(integration);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    /// <summary>
    /// Remove integração (soft delete)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteIntegration(long id, [FromQuery] long? clientId)
    {
        try
        {
            var profileId = GetProfileId();
            if (!profileId.HasValue)
            {
                return Unauthorized();
            }
            await _integrationService.DeleteIntegrationAsync(id, profileId.Value, clientId, IsPlatformAdmin());
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

    /// <summary>
    /// Testa conexão com BI tool
    /// </summary>
    [HttpPost("test-connection")]
    public async Task<IActionResult> TestConnection([FromBody] TestConnectionRequest request)
    {
        var result = await _integrationService.TestConnectionAsync(request);

        if (result.Success)
            return Ok(result);

        return BadRequest(result);
    }

    /// <summary>
    /// Atualiza o cookie header para integrações baseadas em cookies
    /// </summary>
    [HttpPost("{id}/cookie-header")]
    public async Task<ActionResult<IntegrationDto>> UpdateCookieHeader(long id, [FromBody] UpdateIntegrationCookieRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CookieHeader) || string.IsNullOrWhiteSpace(request.CookieDomain))
        {
            return BadRequest(new { message = "CookieHeader and CookieDomain are required." });
        }

        try
        {
            var profileId = GetProfileId();
            var isPlatformAdmin = IsPlatformAdmin();
            var integration = await _integrationService.UpdateIntegrationCookieHeaderAsync(id, profileId, isPlatformAdmin, request);
            return Ok(integration);
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

    /// <summary>
    /// Executa query em uma integração
    /// </summary>
    [HttpPost("execute-query")]
    public async Task<ActionResult<QueryResultDto>> ExecuteQuery([FromBody] ExecuteQueryRequest request)
    {
        try
        {
            var profileId = GetProfileId();
            if (!profileId.HasValue)
            {
                return Unauthorized();
            }
            var result = await _integrationService.ExecuteQueryAsync(profileId.Value, request, IsPlatformAdmin());
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    /// <summary>
    /// Lista recursos principais da integracao (ex: DAGs, Pipelines)
    /// </summary>
    [HttpGet("{id}/databases")]
    public async Task<ActionResult<List<string>>> ListDatabases(long id, [FromQuery] string? search = null, [FromQuery] int? limit = null)
    {
        try
        {
            var profileId = GetProfileId();
            if (!profileId.HasValue)
            {
                return Unauthorized();
            }
            var databases = await _integrationService.ListDatabasesAsync(profileId.Value, id, search, limit);
            return Ok(databases);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Lista sub-recursos de um recurso principal (ex: tasks/activities)
    /// </summary>
    [HttpGet("{id}/tables/{database}")]
    public async Task<ActionResult<List<string>>> ListTables(long id, string database)
    {
        try
        {
            var profileId = GetProfileId();
            if (!profileId.HasValue)
            {
                return Unauthorized();
            }
            var tables = await _integrationService.ListTablesAsync(profileId.Value, id, database);
            return Ok(tables);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private long? GetProfileId()
    {
        var profileIdClaim = User.FindFirst("profile_id")?.Value;
        if (profileIdClaim == null)
        {
            // In development mode, return default profileId when no claim exists
            if (_environment.IsDevelopment())
            {
                return 1; // Default development profile
            }
            return null;
        }

        return long.TryParse(profileIdClaim, out var parsed) ? parsed : null;
    }

    private bool IsPlatformAdmin()
    {
        // In development mode, treat as admin when no user claims exist
        if (_environment.IsDevelopment() && !(User.Identity?.IsAuthenticated ?? false))
        {
            return true; // Default to admin in development
        }

        return User.IsInRole("Platform Admin") || User.IsInRole("system_admin");
    }
}
