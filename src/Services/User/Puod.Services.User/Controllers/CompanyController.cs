using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Puod.Services.User.Configuration;
using Puod.Services.User.Data;
using Puod.Services.User.DTOs;
using Puod.Services.User.Models;
using Puod.Services.User.Services;

namespace Puod.Services.User.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/companies")]
[Asp.Versioning.ApiVersion(1.0)]
[Authorize]
public class CompanyController : ControllerBase
{
    private readonly PuodDbContext _dbContext;
    private readonly ILogger<CompanyController> _logger;
    private readonly IAccessControlService _accessControlService;

    public CompanyController(
        PuodDbContext dbContext,
        ILogger<CompanyController> logger,
        IAccessControlService accessControlService)
    {
        _dbContext = dbContext;
        _logger = logger;
        _accessControlService = accessControlService;
    }

    [HttpGet]
    [Authorize(Policy = "Permission:Company.View")]
    public async Task<ActionResult<List<CompanyListResponse>>> GetAll(CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var isSystemAdmin = _accessControlService.IsSystemAdmin(userId.Value);

        IQueryable<Profile> query = _dbContext.Profiles.Where(p => !p.IsDeleted);

        // System admins can see all companies, others only see their own
        if (!isSystemAdmin)
        {
            var userCompanyIds = await _accessControlService.GetAccessibleCompanyIdsAsync(userId.Value, ct);
            query = query.Where(p => userCompanyIds.Contains(p.Id));
        }

        var companies = await query
            .OrderBy(p => p.Name)
            .Select(p => new CompanyListResponse(
                p.Id,
                p.Name,
                p.CompanyName,
                p.Slug,
                p.ClientId,
                p.Client != null ? p.Client.Name : null,
                p.InheritFromClient,
                p.Tier,
                p.IsActive,
                p.CreatedAt,
                _dbContext.UserTenantRoles
                    .Where(utr => utr.ProfileId == p.Id)
                    .Select(utr => utr.UserId)
                    .Union(_dbContext.ClientUserCompanyAvailability
                        .Where(ca => ca.CompanyId == p.Id)
                        .Select(ca => ca.UserId))
                    .Distinct()
                    .Count(),
                p.LogoUrl,
                p.Country,
                p.Industry))
            .ToListAsync(ct);

        return Ok(companies);
    }

    [HttpGet("{id:long}")]
    [Authorize(Policy = "Permission:Company.View")]
    public async Task<ActionResult<CompanyDetailResponse>> GetById(long id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var isSystemAdmin = _accessControlService.IsSystemAdmin(userId.Value);

        // Check if user has access to this company
        if (!isSystemAdmin && !await _accessControlService.CanAccessCompanyAsync(userId.Value, id, ct))
        {
            return Forbid();
        }

        var company = await _dbContext.Profiles
            .Where(p => p.Id == id && !p.IsDeleted)
            .Select(p => new CompanyDetailResponse(
                p.Id,
                p.Name,
                p.CompanyName,
                p.Slug,
                p.ClientId,
                p.Client != null ? p.Client.Name : null,
                p.InheritFromClient,
                p.InheritBasicInfo,
                p.InheritLogo,
                p.InheritContact,
                p.InheritAddress,
                p.InheritDetails,
                p.InheritAuthentication,
                p.InheritIntegrations,
                p.Tier,
                p.IsActive,
                p.CreatedAt,
                p.UpdatedAt,
                p.UserTenantRoles.Count(),
                p.LogoUrl,
                p.TaxId,
                p.Website,
                p.Email,
                p.Phone,
                p.Address,
                p.City,
                p.State,
                p.Country,
                p.PostalCode,
                p.Description,
                p.Industry,
                p.EmployeeCount,
                p.FoundedDate))
            .FirstOrDefaultAsync(ct);

        if (company == null)
        {
            return NotFound();
        }

        return Ok(company);
    }

    [HttpPost]
    [Authorize(Policy = "Permission:Company.Create")]
    public async Task<ActionResult<CompanyDetailResponse>> Create([FromBody] CompanyCreateRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        if (!await _accessControlService.CanAccessClientAsync(userId.Value, request.ClientId, ct))
        {
            return Forbid();
        }

        // Validate ClientId
        if (request.ClientId == 0)
        {
            return BadRequest(new { message = "Client is required. Please select a client." });
        }

        // Verify client exists
        var clientExists = await _dbContext.Clients.AnyAsync(c => c.Id == request.ClientId && !c.IsDeleted, ct);
        if (!clientExists)
        {
            return BadRequest(new { message = "Selected client does not exist." });
        }

        // Generate slug from name
        var slug = GenerateSlug(request.Name);

        // Check if slug already exists
        if (await _dbContext.Profiles.AnyAsync(p => p.Slug == slug && !p.IsDeleted, ct))
        {
            return BadRequest(new { message = $"A company with slug '{slug}' already exists." });
        }

        var schemaName = $"tenant_{slug}";

        // Get client to inherit tier
        var client = await _dbContext.Clients.FirstOrDefaultAsync(c => c.Id == request.ClientId && !c.IsDeleted, ct);
        if (client == null)
        {
            return BadRequest(new { message = "Client not found." });
        }

        var company = new Profile
        {
            Name = request.Name.Trim(),
            CompanyName = request.CompanyName?.Trim(),
            Slug = slug,
            SchemaName = schemaName,
            ClientId = request.ClientId,
            InheritFromClient = request.InheritFromClient,
            InheritBasicInfo = request.InheritBasicInfo,
            InheritLogo = request.InheritLogo,
            InheritContact = request.InheritContact,
            InheritAddress = request.InheritAddress,
            InheritDetails = request.InheritDetails,
            InheritAuthentication = request.InheritAuthentication,
            InheritIntegrations = request.InheritIntegrations,
            Tier = client.Tier, // Inherit tier from client
            IsActive = true,
            SetupCompleted = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId,
            // Use granular inheritance flags
            LogoUrl = request.InheritLogo ? client.LogoUrl : request.LogoUrl,
            TaxId = request.InheritBasicInfo ? client.TaxId : request.TaxId?.Trim(),
            Website = request.InheritContact ? client.Website : request.Website?.Trim(),
            Email = request.InheritContact ? client.Email : request.Email?.Trim(),
            Phone = request.InheritContact ? client.Phone : request.Phone?.Trim(),
            Address = request.InheritAddress ? client.Address : request.Address?.Trim(),
            City = request.InheritAddress ? client.City : request.City?.Trim(),
            State = request.InheritAddress ? client.State : request.State?.Trim(),
            Country = request.InheritAddress ? client.Country : request.Country?.Trim(),
            PostalCode = request.InheritAddress ? client.PostalCode : request.PostalCode?.Trim(),
            Description = request.InheritDetails ? client.Description : request.Description?.Trim(),
            Industry = request.InheritDetails ? client.Industry : request.Industry?.Trim(),
            EmployeeCount = request.InheritDetails ? client.EmployeeCount : request.EmployeeCount,
            FoundedDate = request.InheritDetails ? client.FoundedDate : request.FoundedDate
        };

        _dbContext.Profiles.Add(company);

        // Create default roles for this company
        await CreateDefaultRolesAsync(company, ct);

        await _dbContext.SaveChangesAsync(ct);

        // Try to create schema
        await TryCreateSchemaAsync(schemaName, ct);

        var response = new CompanyDetailResponse(
            company.Id,
            company.Name,
            company.CompanyName,
            company.Slug,
            company.ClientId,
            client.Name,
            company.InheritFromClient,
            company.InheritBasicInfo,
            company.InheritLogo,
            company.InheritContact,
            company.InheritAddress,
            company.InheritDetails,
            company.InheritAuthentication,
            company.InheritIntegrations,
            company.Tier,
            company.IsActive,
            company.CreatedAt,
            company.UpdatedAt,
            0,
            company.LogoUrl,
            company.TaxId,
            company.Website,
            company.Email,
            company.Phone,
            company.Address,
            company.City,
            company.State,
            company.Country,
            company.PostalCode,
            company.Description,
            company.Industry,
            company.EmployeeCount,
            company.FoundedDate);

        return CreatedAtAction(nameof(GetById), new { id = company.Id }, response);
    }

    [HttpPut("{id:long}")]
    [Authorize(Policy = "Permission:Company.Settings.Edit")]
    public async Task<ActionResult<CompanyDetailResponse>> Update(long id, [FromBody] CompanyUpdateRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var isSystemAdmin = _accessControlService.IsSystemAdmin(userId.Value);

        var company = await _dbContext.Profiles
            .Include(p => p.Client)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct);
        if (company == null)
        {
            return NotFound();
        }

        if (!isSystemAdmin && !await _accessControlService.CanAccessCompanyAsync(userId.Value, id, ct))
        {
            return Forbid();
        }

        var client = company.Client;
        if (client == null && company.ClientId.HasValue)
        {
            client = await _dbContext.Clients.FirstOrDefaultAsync(c => c.Id == company.ClientId.Value && !c.IsDeleted, ct);
        }

        company.Name = request.Name.Trim();
        company.CompanyName = request.CompanyName?.Trim();
        company.InheritFromClient = request.InheritFromClient;
        company.InheritBasicInfo = request.InheritBasicInfo;
        company.InheritLogo = request.InheritLogo;
        company.InheritContact = request.InheritContact;
        company.InheritAddress = request.InheritAddress;
        company.InheritDetails = request.InheritDetails;
        company.InheritAuthentication = request.InheritAuthentication;
        company.InheritIntegrations = request.InheritIntegrations;
        company.IsActive = request.IsActive;
        company.UpdatedAt = DateTime.UtcNow;
        company.UpdatedBy = userId;

        // Update individual fields using granular inheritance flags
        if (client != null)
        {
            company.Tier = client.Tier; // Always inherit tier from client
            company.LogoUrl = request.InheritLogo ? client.LogoUrl : request.LogoUrl;
            company.TaxId = request.InheritBasicInfo ? client.TaxId : request.TaxId?.Trim();
            company.Website = request.InheritContact ? client.Website : request.Website?.Trim();
            company.Email = request.InheritContact ? client.Email : request.Email?.Trim();
            company.Phone = request.InheritContact ? client.Phone : request.Phone?.Trim();
            company.Address = request.InheritAddress ? client.Address : request.Address?.Trim();
            company.City = request.InheritAddress ? client.City : request.City?.Trim();
            company.State = request.InheritAddress ? client.State : request.State?.Trim();
            company.Country = request.InheritAddress ? client.Country : request.Country?.Trim();
            company.PostalCode = request.InheritAddress ? client.PostalCode : request.PostalCode?.Trim();
            company.Description = request.InheritDetails ? client.Description : request.Description?.Trim();
            company.Industry = request.InheritDetails ? client.Industry : request.Industry?.Trim();
            company.EmployeeCount = request.InheritDetails ? client.EmployeeCount : request.EmployeeCount;
            company.FoundedDate = request.InheritDetails ? client.FoundedDate : request.FoundedDate;
        }
        else
        {
            // No client, use request values
            company.LogoUrl = request.LogoUrl;
            company.TaxId = request.TaxId?.Trim();
            company.Website = request.Website?.Trim();
            company.Email = request.Email?.Trim();
            company.Phone = request.Phone?.Trim();
            company.Address = request.Address?.Trim();
            company.City = request.City?.Trim();
            company.State = request.State?.Trim();
            company.Country = request.Country?.Trim();
            company.PostalCode = request.PostalCode?.Trim();
            company.Description = request.Description?.Trim();
            company.Industry = request.Industry?.Trim();
            company.EmployeeCount = request.EmployeeCount;
            company.FoundedDate = request.FoundedDate;
        }

        await _dbContext.SaveChangesAsync(ct);

        var userCount = await _dbContext.UserTenantRoles
            .Where(utr => utr.ProfileId == id)
            .Select(utr => utr.UserId)
            .Union(_dbContext.ClientUserCompanyAvailability
                .Where(ca => ca.CompanyId == id)
                .Select(ca => ca.UserId))
            .Distinct()
            .CountAsync(ct);

        var response = new CompanyDetailResponse(
            company.Id,
            company.Name,
            company.CompanyName,
            company.Slug,
            company.ClientId,
            client?.Name,
            company.InheritFromClient,
            company.InheritBasicInfo,
            company.InheritLogo,
            company.InheritContact,
            company.InheritAddress,
            company.InheritDetails,
            company.InheritAuthentication,
            company.InheritIntegrations,
            company.Tier,
            company.IsActive,
            company.CreatedAt,
            company.UpdatedAt,
            userCount,
            company.LogoUrl,
            company.TaxId,
            company.Website,
            company.Email,
            company.Phone,
            company.Address,
            company.City,
            company.State,
            company.Country,
            company.PostalCode,
            company.Description,
            company.Industry,
            company.EmployeeCount,
            company.FoundedDate);

        return Ok(response);
    }

    [HttpDelete("{id:long}")]
    [Authorize(Policy = "SystemAdmin")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var company = await _dbContext.Profiles.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct);
        if (company == null)
        {
            return NotFound();
        }

        // Check if there are users in this company
        var userCount = await _dbContext.UserTenantRoles
            .CountAsync(utr => utr.ProfileId == id, ct);

        if (userCount > 0)
        {
            return BadRequest(new { message = "Cannot delete company with active users. Please remove all users first." });
        }

        company.IsDeleted = true;
        company.DeletedAt = DateTime.UtcNow;
        company.DeletedBy = userId;

        await _dbContext.SaveChangesAsync(ct);

        return NoContent();
    }

    private async Task CreateDefaultRolesAsync(Profile profile, CancellationToken ct)
    {
        var existingRoles = await _dbContext.Roles
            .Where(r => r.ProfileId == profile.Id && !r.IsDeleted)
            .ToListAsync(ct);

        var rolesToEnsure = new Dictionary<string, string>
        {
            { CompanyRoles.CompanyAdmin, "Full access to the company - can manage users, roles, and all company resources" },
            { CompanyRoles.CompanyManager, "Elevated permissions - can manage integrations and company settings" },
            { CompanyRoles.CardStudioAdmin, "Full access to card management - create, edit, delete, and export cards" },
            { CompanyRoles.CardEditor, "Can create and edit cards - cannot delete cards" },
            { CompanyRoles.CardViewer, "Read-only access to cards" },
            { CompanyRoles.IntegrationManager, "Can create, edit, delete, and execute integrations" },
            { CompanyRoles.Analyst, "Read-only access to company info, cards, and monitoring" },
            { CompanyRoles.Viewer, "Minimal read-only access to company info, cards, and monitoring" }
        };

        foreach (var (roleName, description) in rolesToEnsure)
        {
            if (existingRoles.Any(r => r.Name == roleName))
            {
                continue;
            }

            var role = new Role { Profile = profile, Name = roleName, Description = description };
            _dbContext.Roles.Add(role);
            existingRoles.Add(role);
        }

        await _dbContext.SaveChangesAsync(ct);

        foreach (var role in existingRoles)
        {
            var permissions = DefaultRolePermissions.GetDefaultPermissions(role.Name);
            if (permissions.Count == 0)
            {
                continue;
            }

            var existingLinks = await _dbContext.RolePermissions
                .Where(rp => rp.RoleId == role.Id)
                .Select(rp => rp.PermissionId)
                .ToListAsync(ct);

            var missing = permissions.Where(p => !existingLinks.Contains(p)).ToList();
            if (missing.Count == 0)
            {
                continue;
            }

            _dbContext.RolePermissions.AddRange(missing.Select(permissionId =>
                new RolePermission { RoleId = role.Id, PermissionId = permissionId }));
        }

        await _dbContext.SaveChangesAsync(ct);
    }

    private async Task TryCreateSchemaAsync(string schemaName, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(schemaName))
        {
            return;
        }

        var provider = _dbContext.Database.ProviderName ?? string.Empty;

        try
        {
            if (provider.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
            {
                await _dbContext.Database.ExecuteSqlAsync(
                    $"DO $$ BEGIN EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', {schemaName}); END $$;", ct);
            }
            else if (provider.Contains("SqlServer", StringComparison.OrdinalIgnoreCase))
            {
                await _dbContext.Database.ExecuteSqlAsync($@"
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = {schemaName})
BEGIN
    DECLARE @schema sysname = {schemaName};
    EXEC('CREATE SCHEMA ' + QUOTENAME(@schema));
END", ct);
            }
            else
            {
                _logger.LogInformation("Schema provisioning skipped for provider {Provider}", provider);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create schema {Schema}", schemaName);
        }
    }

    private static string GenerateSlug(string value)
    {
        var slug = value.Trim().ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("_", "-");

        return new string(slug.Where(ch => char.IsLetterOrDigit(ch) || ch == '-').ToArray());
    }

    private long? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");
        return long.TryParse(userId, out var parsed) ? parsed : null;
    }
}
