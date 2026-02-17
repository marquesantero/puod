using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Puod.Services.User.DTOs;
using Puod.Services.User.Models;
using Puod.Services.User.Services;

namespace Puod.Services.User.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/clients")]
[Asp.Versioning.ApiVersion(1.0)]
[Authorize]
public class ClientController : ControllerBase
{
    private readonly IClientService _clientService;
    private readonly IAccessControlService _accessControlService;
    private readonly ILogger<ClientController> _logger;

    public ClientController(
        IClientService clientService,
        IAccessControlService accessControlService,
        ILogger<ClientController> logger)
    {
        _clientService = clientService;
        _accessControlService = accessControlService;
        _logger = logger;
    }

    /// <summary>
    /// Get all clients
    /// SystemAdmin: Can see all clients
    /// ClientAdmin/Others: Can see clients they have access to
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<ClientListResponse>>> GetAll(CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        try
        {
            var accessibleClientIds = await _accessControlService.GetAccessibleClientIdsAsync(userId.Value, ct);

            if (!accessibleClientIds.Any())
            {
                return Ok(new List<ClientListResponse>());
            }

            var allClients = await _clientService.GetAllAsync(ct);
            var filteredClients = allClients.Where(c => accessibleClientIds.Contains(c.Id)).ToList();

            return Ok(filteredClients);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving clients");
            return StatusCode(500, new { message = "An error occurred while retrieving clients." });
        }
    }

    /// <summary>
    /// Get client details by ID
    /// </summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<ClientDetailResponse>> GetById(long id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        try
        {
            var canAccess = await _accessControlService.CanAccessClientAsync(userId.Value, id, ct);
            if (!canAccess)
            {
                return Forbid();
            }

            var client = await _clientService.GetByIdAsync(id, ct);
            if (client == null)
            {
                return NotFound(new { message = "Client not found." });
            }

            return Ok(client);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving client {ClientId}", id);
            return StatusCode(500, new { message = "An error occurred while retrieving the client." });
        }
    }

    /// <summary>
    /// Get client info preview for company creation
    /// Shows what information will be inherited
    /// </summary>
    [HttpGet("{id:long}/info-preview")]
    public async Task<ActionResult<ClientInfoPreview>> GetInfoPreview(long id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        try
        {
            var canAccess = await _accessControlService.CanAccessClientAsync(userId.Value, id, ct);
            if (!canAccess)
            {
                return Forbid();
            }

            var preview = await _clientService.GetInfoPreviewAsync(id, ct);
            if (preview == null)
            {
                return NotFound(new { message = "Client not found." });
            }

            return Ok(preview);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving client info preview for {ClientId}", id);
            return StatusCode(500, new { message = "An error occurred while retrieving client info." });
        }
    }

    /// <summary>
    /// Create a new client (SystemAdmin only)
    /// Automatically creates a default company group and assigns ClientAdmin role to creator
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ClientDetailResponse>> Create(
        [FromBody] ClientCreateRequest request,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        try
        {
            var isSystemAdmin = User.IsInRole(SystemRoles.PlatformAdmin);
            if (!isSystemAdmin)
            {
                return Forbid();
            }

            var client = await _clientService.CreateAsync(request, userId.Value, ct);
            return CreatedAtAction(nameof(GetById), new { id = client.Id }, client);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Invalid operation while creating client");
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating client");
            return StatusCode(500, new { message = "An error occurred while creating the client." });
        }
    }

    /// <summary>
    /// Update an existing client
    /// Note: Cannot update clients with IsAlterable=false (e.g., Platform)
    /// </summary>
    [HttpPut("{id:long}")]
    public async Task<ActionResult<ClientDetailResponse>> Update(
        long id,
        [FromBody] ClientUpdateRequest request,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        try
        {
            var canAccess = await _accessControlService.CanAccessClientAsync(userId.Value, id, ct);
            if (!canAccess)
            {
                return Forbid();
            }

            var canManage = await _accessControlService.CanManageClientAsync(userId.Value, id, ct);
            if (!canManage)
            {
                return Forbid();
            }

            var client = await _clientService.UpdateAsync(id, request, userId.Value, ct);
            return Ok(client);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Invalid operation while updating client {ClientId}", id);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating client {ClientId}", id);
            return StatusCode(500, new { message = "An error occurred while updating the client." });
        }
    }

    /// <summary>
    /// Delete a client (soft delete)
    /// Note: Cannot delete clients with IsAlterable=false (e.g., Platform)
    /// </summary>
    [HttpDelete("{id:long}")]
    public async Task<ActionResult> Delete(long id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        try
        {
            var isSystemAdmin = User.IsInRole(SystemRoles.PlatformAdmin);
            if (!isSystemAdmin)
            {
                return Forbid();
            }

            await _clientService.DeleteAsync(id, userId.Value, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Invalid operation while deleting client {ClientId}", id);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting client {ClientId}", id);
            return StatusCode(500, new { message = "An error occurred while deleting the client." });
        }
    }

    private long? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return userIdClaim != null ? long.Parse(userIdClaim) : null;
    }
}
