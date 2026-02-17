using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Puod.Services.User.Data;
using Puod.Services.User.DTOs;
using Puod.Services.User.Models;
using Puod.Services.User.Services;
using Puod.Services.User.Services.Identity;

namespace Puod.Services.User.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/security")]
[Asp.Versioning.ApiVersion(1.0)]
[Authorize]
public class SecurityController : ControllerBase
{
    private readonly PuodDbContext _dbContext;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SecurityController> _logger;
    private readonly IAccessControlService _accessControlService;

    public SecurityController(
        PuodDbContext dbContext,
        IServiceProvider serviceProvider,
        ILogger<SecurityController> logger,
        IAccessControlService accessControlService)
    {
        _dbContext = dbContext;
        _serviceProvider = serviceProvider;
        _logger = logger;
        _accessControlService = accessControlService;
    }

    [HttpGet("search/users")]
    [Authorize(Policy = "Permission:Security.Users.View")]
    public async Task<ActionResult<List<IdentityUserResult>>> SearchUsers(
        [FromQuery] string term, 
        [FromQuery] IdentitySource source, 
        [FromQuery] long? authProfileId,
        CancellationToken ct)
    {
        if (source == IdentitySource.Local)
        {
            return Ok(new List<IdentityUserResult>());
        }

        IIdentityProvider provider = ResolveProvider(source);
        object? config = null;

        if (authProfileId.HasValue && source != IdentitySource.Local)
        {
            var authProfile = await _dbContext.AuthProfiles.FindAsync(new object[] { authProfileId.Value }, ct);
            if (authProfile != null)
            {
                if (authProfile.OwnerType == OwnerType.Client && authProfile.ClientId.HasValue)
                {
                    if (!await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), authProfile.ClientId.Value, ct))
                    {
                        return Forbid();
                    }
                }
                else if (authProfile.OwnerType == OwnerType.Company && authProfile.ProfileId.HasValue)
                {
                    if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), authProfile.ProfileId.Value, ct))
                    {
                        return Forbid();
                    }
                }

                if (source == IdentitySource.WindowsAd && authProfile.ProviderType == AuthProviderType.WindowsAd)
                {
                    config = JsonSerializer.Deserialize<WindowsAdConfig>(authProfile.ConfigJson);
                }
                else if (source == IdentitySource.AzureAd && authProfile.ProviderType == AuthProviderType.AzureAd)
                {
                    config = JsonSerializer.Deserialize<AzureAdConfig>(authProfile.ConfigJson);
                }
            }
        }

        var results = await provider.SearchUsersAsync(term ?? "", config, ct);
        return Ok(results);
    }

    [HttpGet("users")]
    [Authorize(Policy = "Permission:Security.Users.View")]
    public async Task<ActionResult<List<IdentityUserResult>>> GetUsers([FromQuery] long? profileId, [FromQuery] long? clientId, CancellationToken ct)
    {
        List<Models.User> users;

        if (clientId.HasValue)
        {
            if (!await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), clientId.Value, ct))
            {
                return Forbid();
            }

            // Get all users for a client (client-level users only)
            users = await _dbContext.Users
                .Where(u => u.ClientId == clientId && !u.ProfileId.HasValue && !u.IsDeleted)
                .ToListAsync(ct);
        }
        else if (profileId.HasValue)
        {
            if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), profileId.Value, ct))
            {
                return Forbid();
            }

            var scopedProfileId = profileId.Value;

            var userIds = await _dbContext.UserTenantRoles
                .Where(utr => utr.ProfileId == scopedProfileId)
                .Select(utr => utr.UserId)
                .Union(_dbContext.ClientUserCompanyAvailability
                    .Where(ca => ca.CompanyId == scopedProfileId)
                    .Select(ca => ca.UserId))
                .Distinct()
                .ToListAsync(ct);

            users = await _dbContext.Users
                .Where(u => userIds.Contains(u.Id) && !u.IsDeleted)
                .ToListAsync(ct);
        }
        else
        {
            return BadRequest("Either profileId or clientId is required.");
        }

        var results = users.Select(u => {
            IdentitySource source;
            if (!Enum.TryParse<IdentitySource>(u.AuthProvider, true, out source))
            {
                source = IdentitySource.Local;
            }

            return new IdentityUserResult(
                u.Id.ToString(),
                u.Email,
                u.Email, // TODO: Store DisplayName
                source,
                true
            ) { ProfileId = profileId ?? 0, IsActive = u.IsActive };
        }).ToList();

        return Ok(results);
    }

    [HttpGet("users/detail/{id:long}")]
    [Authorize(Policy = "Permission:Security.Users.View")]
    public async Task<ActionResult<IdentityUserResult>> GetUserDetail(long id, CancellationToken ct)
    {
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted, ct);

        if (user == null) return NotFound();

        if (user.ClientId.HasValue)
        {
            if (!await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), user.ClientId.Value, ct))
            {
                return Forbid();
            }
        }

        if (user.ProfileId.HasValue)
        {
            if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), user.ProfileId.Value, ct))
            {
                return Forbid();
            }
        }

        IdentitySource source;
        if (!Enum.TryParse<IdentitySource>(user.AuthProvider, true, out source))
        {
            source = IdentitySource.Local;
        }

        return Ok(new IdentityUserResult(
            user.Id.ToString(),
            user.Email,
            user.Email,
            source,
            true
        ) { ProfileId = user.ProfileId ?? 0, IsActive = user.IsActive });
    }

    [HttpPut("users/{id:long}/status")]
    [Authorize(Policy = "Permission:Security.Users.Manage")]
    public async Task<IActionResult> UpdateUserStatus(long id, [FromBody] UpdateUserStatusRequest request, CancellationToken ct)
    {
        var user = await _dbContext.Users.FindAsync(new object[] { id }, ct);
        if (user == null) return NotFound();

        if (user.ClientId.HasValue)
        {
            if (!await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), user.ClientId.Value, ct))
            {
                return Forbid();
            }
        }

        if (user.ProfileId.HasValue)
        {
            if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), user.ProfileId.Value, ct))
            {
                return Forbid();
            }
        }

        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("users/{id:long}")]
    [Authorize(Policy = "Permission:Security.Users.Manage")]
    public async Task<IActionResult> DeleteUser(long id, CancellationToken ct)
    {
        var user = await _dbContext.Users.FindAsync(new object[] { id }, ct);
        if (user == null) return NotFound();

        if (user.ClientId.HasValue)
        {
            if (!await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), user.ClientId.Value, ct))
            {
                return Forbid();
            }
        }

        if (user.ProfileId.HasValue)
        {
            if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), user.ProfileId.Value, ct))
            {
                return Forbid();
            }
        }

        user.IsDeleted = true;
        user.DeletedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("permissions")]
    [Authorize(Policy = "Permission:Security.Roles.Manage")]
    public async Task<ActionResult<List<PermissionDto>>> GetAllPermissions(CancellationToken ct)
    {
        var permissions = await _dbContext.Permissions
            .Select(p => new PermissionDto(p.Id, p.Category, p.Description))
            .ToListAsync(ct);
        
        _logger.LogInformation("Returning {Count} permissions from database.", permissions.Count);
        
        return Ok(permissions);
    }

    [HttpGet("roles")]
    [Authorize(Policy = "Permission:Security.Roles.Manage")]
    public async Task<ActionResult<List<RoleDto>>> GetRoles([FromQuery] long? profileId, [FromQuery] long? clientId, CancellationToken ct, [FromQuery] bool isCompanyLevel = false)
    {
        if (!profileId.HasValue && !clientId.HasValue)
        {
            return BadRequest("ProfileId or ClientId is required.");
        }

        if (profileId.HasValue && clientId.HasValue)
        {
            return BadRequest("Provide only one scope: profileId or clientId.");
        }

        var rolesQuery = _dbContext.Roles.Where(r => !r.IsDeleted);

        if (profileId.HasValue)
        {
            var scopeProfileId = profileId.GetValueOrDefault();
            if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), scopeProfileId, ct))
            {
                return Forbid();
            }
            rolesQuery = rolesQuery.Where(r => r.ProfileId == scopeProfileId);
        }
        else
        {
            var scopeClientId = clientId.GetValueOrDefault();
            if (!await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), scopeClientId, ct))
            {
                return Forbid();
            }
            rolesQuery = rolesQuery.Where(r => r.ClientId == scopeClientId);
        }

        var roles = await rolesQuery
            .Select(r => new RoleDto(
                r.Id,
                r.Name,
                r.Description,
                _dbContext.RolePermissions.Where(rp => rp.RoleId == r.Id).Select(rp => rp.PermissionId).ToList(),
                r.ClientId,
                r.ProfileId
            ))
            .ToListAsync(ct);

        return Ok(roles);
    }

    [HttpPost("roles")]
    [Authorize(Policy = "Permission:Security.Roles.Manage")]
    public async Task<ActionResult<RoleDto>> CreateRole([FromQuery] long? profileId, [FromQuery] long? clientId, [FromBody] CreateRoleRequest request, CancellationToken ct)
    {
        if (!profileId.HasValue && !clientId.HasValue)
        {
            return BadRequest("ProfileId or ClientId is required.");
        }

        if (profileId.HasValue && clientId.HasValue)
        {
            return BadRequest("Provide only one scope: profileId or clientId.");
        }

        var role = new Role
        {
            ProfileId = profileId,
            ClientId = clientId,
            Name = request.Name,
            Description = request.Description,
            CreatedAt = DateTime.UtcNow
        };

        if (profileId.HasValue)
        {
            if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), profileId.Value, ct))
            {
                return Forbid();
            }
        }
        else
        {
            if (!await _accessControlService.CanManageClientAsync(GetRequiredUserId(), clientId.GetValueOrDefault(), ct))
            {
                return Forbid();
            }
        }

        _dbContext.Roles.Add(role);
        
        if (request.PermissionIds != null && request.PermissionIds.Any())
        {
            foreach (var permId in request.PermissionIds)
            {
                _dbContext.RolePermissions.Add(new RolePermission { Role = role, PermissionId = permId });
            }
        }

        await _dbContext.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetRoles), new { profileId, clientId }, new RoleDto(role.Id, role.Name, role.Description, request.PermissionIds ?? new List<string>(), role.ClientId, role.ProfileId));
    }

    [HttpPut("roles/{id:long}")]
    [Authorize(Policy = "Permission:Security.Roles.Manage")]
    public async Task<ActionResult<RoleDto>> UpdateRole(long id, [FromBody] UpdateRoleRequest request, CancellationToken ct)
    {
        var role = await _dbContext.Roles.FindAsync(new object[] { id }, ct);
        if (role == null || role.IsDeleted) return NotFound();

        if (role.ProfileId.HasValue)
        {
            if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), role.ProfileId.Value, ct))
            {
                return Forbid();
            }
        }
        else if (role.ClientId.HasValue)
        {
            if (!await _accessControlService.CanManageClientAsync(GetRequiredUserId(), role.ClientId.Value, ct))
            {
                return Forbid();
            }
        }

        if (request.Description != null) role.Description = request.Description;
        role.UpdatedAt = DateTime.UtcNow;

        var existingLinks = await _dbContext.RolePermissions.Where(rp => rp.RoleId == id).ToListAsync(ct);
        _dbContext.RolePermissions.RemoveRange(existingLinks);

        if (request.PermissionIds != null)
        {
            foreach (var permId in request.PermissionIds)
            {
                _dbContext.RolePermissions.Add(new RolePermission { RoleId = id, PermissionId = permId });
            }
        }

        await _dbContext.SaveChangesAsync(ct);

        return Ok(new RoleDto(role.Id, role.Name, role.Description, request.PermissionIds ?? new List<string>(), role.ClientId, role.ProfileId));
    }

    [HttpDelete("roles/{id:long}")]
    [Authorize(Policy = "Permission:Security.Roles.Manage")]
    public async Task<IActionResult> DeleteRole(long id, CancellationToken ct)
    {
        var role = await _dbContext.Roles.FindAsync(new object[] { id }, ct);
        if (role == null) return NotFound();

        if (role.ProfileId.HasValue)
        {
            if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), role.ProfileId.Value, ct))
            {
                return Forbid();
            }
        }
        else if (role.ClientId.HasValue)
        {
            if (!await _accessControlService.CanManageClientAsync(GetRequiredUserId(), role.ClientId.Value, ct))
            {
                return Forbid();
            }
        }

        role.IsDeleted = true;
        role.DeletedAt = DateTime.UtcNow;
        
        await _dbContext.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("users/local")]
    [Authorize(Policy = "Permission:Security.Users.Manage")]
    public async Task<ActionResult> CreateLocalUser([FromBody] CreateLocalUserRequest request, CancellationToken ct)
    {
        // Validate username length
        if (string.IsNullOrWhiteSpace(request.Username) || request.Username.Length < 3)
        {
            return BadRequest(new { message = "Username must be at least 3 characters long." });
        }

        // Validate password strength
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
        {
            return BadRequest(new { message = "Password must be at least 8 characters long." });
        }

        // Check if username already exists
        var existingUser = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Email == request.Username && !u.IsDeleted, ct);

        if (existingUser != null)
        {
            return Conflict(new { message = "Username already exists." });
        }

        long? clientId = null;
        long? profileId = null;

        // Determine if creating at client level or company level
        if (request.IsClientLevel)
        {
            clientId = request.ProfileId;
            profileId = null;

            if (!clientId.HasValue || !await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), clientId.Value, ct))
            {
                return Forbid();
            }
        }
        else
        {
            profileId = request.ProfileId;
            var company = await _dbContext.Profiles.FindAsync(new object[] { request.ProfileId }, ct);
            if (company != null)
            {
                clientId = company.ClientId;
                if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), profileId.Value, ct))
                {
                    return Forbid();
                }
            }
        }

        var newUser = new Models.User
        {
            Email = request.Username,
            DisplayName = request.DisplayName,
            PhotoUrl = request.PhotoUrl,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            ClientId = clientId,
            ProfileId = profileId,
            ExternalId = null,
            AuthProvider = "Local",
            Roles = new List<string> { "user" },
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Users.Add(newUser);

        await _dbContext.SaveChangesAsync(ct);

        // Add company availability if client-level creation
        if (request.IsClientLevel && clientId.HasValue && request.CompanyIds != null && request.CompanyIds.Any())
        {
            foreach (var companyId in request.CompanyIds)
            {
                _dbContext.ClientUserCompanyAvailability.Add(new ClientUserCompanyAvailability
                {
                    UserId = newUser.Id,
                    ClientId = clientId.Value,
                    CompanyId = companyId,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }
        else if (!request.IsClientLevel && profileId.HasValue && clientId.HasValue)
        {
            // Company-level creation: automatically add availability for this company
            _dbContext.ClientUserCompanyAvailability.Add(new ClientUserCompanyAvailability
            {
                UserId = newUser.Id,
                ClientId = clientId.Value,
                CompanyId = profileId.Value,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync(ct);

        return Ok(new { id = newUser.Id, email = newUser.Email });
    }

    [HttpPost("import")]
    [Authorize(Policy = "Permission:Security.Users.Manage")]
    public async Task<ActionResult> ImportUser([FromBody] ImportUserRequest request, CancellationToken ct)
    {
        var existingUser = await _dbContext.Users
            .Include(u => u.Client)
            .Include(u => u.Profile)
            .FirstOrDefaultAsync(u =>
                (request.ExternalId != null && u.ExternalId == request.ExternalId) ||
                u.Email == request.Username, ct);

        if (existingUser != null && !existingUser.IsDeleted)
        {
            string existsAt = existingUser.ClientId.HasValue && !existingUser.ProfileId.HasValue
                ? "client"
                : existingUser.ProfileId.HasValue
                    ? "company"
                    : "system";

            string location = existsAt == "client"
                ? existingUser.Client?.Name ?? "client level"
                : existsAt == "company"
                    ? existingUser.Profile?.Name ?? "company level"
                    : "system";

            return Conflict(new {
                message = "User already exists.",
                existsAt = existsAt,
                location = location,
                userId = existingUser.Id
            });
        }

        long? clientId = null;
        long? profileId = null;

        // Determine if importing at client level or company level
        if (request.IsClientLevel)
        {
            // Client-level import
            clientId = request.ProfileId;
            profileId = null; // Client users don't have a specific profile

            if (!clientId.HasValue || !await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), clientId.Value, ct))
            {
                return Forbid();
            }
        }
        else
        {
            // Company-level import
            profileId = request.ProfileId;

            // Get the client ID from the company
            var company = await _dbContext.Profiles.FindAsync(new object[] { request.ProfileId }, ct);
            if (company != null)
            {
                clientId = company.ClientId;
                if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), profileId.Value, ct))
                {
                    return Forbid();
                }
            }
        }

        var newUser = new Models.User
        {
            Email = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()),
            ClientId = clientId,
            ProfileId = profileId,
            ExternalId = request.ExternalId,
            AuthProvider = request.Source.ToString(),
            Roles = new List<string> { "user" },
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Users.Add(newUser);

        await _dbContext.SaveChangesAsync(ct);

        // Add company availability if client-level import
        if (request.IsClientLevel && clientId.HasValue && request.CompanyIds != null && request.CompanyIds.Any())
        {
            foreach (var companyId in request.CompanyIds)
            {
                _dbContext.ClientUserCompanyAvailability.Add(new ClientUserCompanyAvailability
                {
                    UserId = newUser.Id,
                    ClientId = clientId.Value,
                    CompanyId = companyId,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }
        else if (!request.IsClientLevel && profileId.HasValue && clientId.HasValue)
        {
            // Company-level import: automatically add availability for this company
            _dbContext.ClientUserCompanyAvailability.Add(new ClientUserCompanyAvailability
            {
                UserId = newUser.Id,
                ClientId = clientId.Value,
                CompanyId = profileId.Value,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync(ct);

        return Ok(new { id = newUser.Id, email = newUser.Email });
    }

    [HttpGet("users/{id:long}")]
    [Authorize(Policy = "Permission:Security.Users.View")]
    public async Task<ActionResult<object>> GetUserById(long id, CancellationToken ct)
    {
        var user = await _dbContext.Users
            .Where(u => u.Id == id && !u.IsDeleted)
            .Select(u => new
            {
                u.Id,
                Username = u.Email,
                DisplayName = u.Email,
                Source = u.AuthProvider,
                IsImported = u.ExternalId != null,
                u.IsActive,
                u.ProfileId,
                u.ClientId
            })
            .FirstOrDefaultAsync(ct);

        if (user == null)
        {
            return NotFound();
        }

        if (user.ClientId.HasValue)
        {
            if (!await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), user.ClientId.Value, ct))
            {
                return Forbid();
            }
        }

        if (user.ProfileId.HasValue)
        {
            if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), user.ProfileId.Value, ct))
            {
                return Forbid();
            }
        }

        return Ok(user);
    }

    [HttpGet("users/{id:long}/roles")]
    [Authorize(Policy = "Permission:Security.Roles.Manage")]
    public async Task<ActionResult<List<long>>> GetUserRoles(
        long id,
        [FromQuery] long? profileId,
        [FromQuery] long? clientId,
        CancellationToken ct)
    {
        if (!profileId.HasValue && !clientId.HasValue)
        {
            return BadRequest("ProfileId or ClientId is required.");
        }

        if (profileId.HasValue && clientId.HasValue)
        {
            return BadRequest("Provide only one scope: profileId or clientId.");
        }

        if (clientId.HasValue)
        {
            if (!await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), clientId.Value, ct))
            {
                return Forbid();
            }

            var directRoleIds = await _dbContext.UserTenantRoles
                .Where(utr => utr.UserId == id && utr.ClientId == clientId)
                .Select(utr => utr.RoleId)
                .Where(roleId => roleId.HasValue)
                .Select(roleId => roleId!.Value)
                .Distinct()
                .ToListAsync(ct);

            if (directRoleIds.Count > 0)
            {
                return Ok(directRoleIds);
            }

            var roleNames = await _dbContext.UserTenantRoles
                .Where(utr => utr.UserId == id && utr.ClientId == clientId)
                .Select(utr => utr.RoleName)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Select(name => name!.Trim())
                .Distinct()
                .ToListAsync(ct);

            if (roleNames.Count == 0)
            {
                return Ok(new List<long>());
            }

            var roleIds = await _dbContext.Roles
                .Where(r => r.ClientId == clientId && roleNames.Contains(r.Name) && !r.IsDeleted)
                .Select(r => r.Id)
                .Distinct()
                .ToListAsync(ct);

            return Ok(roleIds);
        }

        if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), profileId.GetValueOrDefault(), ct))
        {
            return Forbid();
        }

        var scopedProfileId = profileId!.Value;
        var profileRoleNames = await _dbContext.UserTenantRoles
            .Where(utr => utr.UserId == id && utr.ProfileId == scopedProfileId)
            .Select(utr => utr.RoleName)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Select(name => name!.Trim())
            .Distinct()
            .ToListAsync(ct);

        if (profileRoleNames.Count == 0)
        {
            return Ok(new List<long>());
        }

        var profileRoleIds = await _dbContext.Roles
            .Where(r => r.ProfileId == scopedProfileId && profileRoleNames.Contains(r.Name) && !r.IsDeleted)
            .Select(r => r.Id)
            .Distinct()
            .ToListAsync(ct);

        return Ok(profileRoleIds);
    }

    [HttpPost("users/{id:long}/roles")]
    [Authorize(Policy = "Permission:Security.Roles.Manage")]
    public async Task<IActionResult> AssignUserRoles(long id, [FromBody] UserRoleAssignmentRequest request, CancellationToken ct)
    {
        var user = await _dbContext.Users.FindAsync(new object[] { id }, ct);
        if (user == null) return NotFound("User not found.");

        if (user.ClientId.HasValue)
        {
            if (!await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), user.ClientId.Value, ct))
            {
                return Forbid();
            }
        }

        if (user.ProfileId.HasValue)
        {
            if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), user.ProfileId.Value, ct))
            {
                return Forbid();
            }
        }

        // Check if this is client-level or company-level assignment
        bool isClientLevel = user.ClientId.HasValue && !user.ProfileId.HasValue;

        if (isClientLevel)
        {
            // Client-level role assignment with optional company scoping
            var clientId = user.ClientId!.Value;
            var companyProfileIds = await _dbContext.Profiles
                .Where(p => p.ClientId == clientId && !p.IsDeleted)
                .Select(p => p.Id)
                .ToListAsync(ct);

            var existingAssignments = await _dbContext.UserTenantRoles
                .Where(utr => utr.UserId == id &&
                              (utr.ClientId == clientId ||
                               (utr.ProfileId.HasValue && companyProfileIds.Contains(utr.ProfileId.Value))))
                .ToListAsync(ct);

            _dbContext.UserTenantRoles.RemoveRange(existingAssignments);

            var requestedRoleIds = request.RoleIds.Distinct().ToList();
            if (requestedRoleIds.Count == 0)
            {
                await _dbContext.SaveChangesAsync(ct);
                return NoContent();
            }

            var roles = await _dbContext.Roles
                .Where(r => requestedRoleIds.Contains(r.Id) && !r.IsDeleted)
                .ToListAsync(ct);

            foreach (var role in roles)
            {
                if (role.ClientId == clientId)
                {
                    var companyIds = request.RoleCompanies != null && request.RoleCompanies.TryGetValue(role.Id, out var scopedCompanies)
                        ? scopedCompanies
                        : new List<long>();

                    _dbContext.UserTenantRoles.Add(new UserTenantRole
                    {
                        UserId = id,
                        ClientId = clientId,
                        ProfileId = null,
                        RoleId = role.Id,
                        RoleName = role.Name,
                        CompanyIds = companyIds
                    });

                    continue;
                }

                if (role.ProfileId.HasValue && companyProfileIds.Contains(role.ProfileId.Value))
                {
                    var allowForCompany = request.RoleCompanies == null
                        || !request.RoleCompanies.TryGetValue(role.Id, out var scopedCompanies)
                        || scopedCompanies.Contains(role.ProfileId.Value);

                    if (!allowForCompany)
                    {
                        continue;
                    }

                    _dbContext.UserTenantRoles.Add(new UserTenantRole
                    {
                        UserId = id,
                        ProfileId = role.ProfileId,
                        RoleId = role.Id,
                        RoleName = role.Name
                    });
                }
            }
        }
        else
        {
            if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), request.ProfileId, ct))
            {
                return Forbid();
            }

            // Company-level role assignment (original behavior)
            var rolesToAssign = await _dbContext.Roles
                .Where(r => r.ProfileId == request.ProfileId && request.RoleIds.Contains(r.Id) && !r.IsDeleted)
                .ToListAsync(ct);

            var existingAssignments = await _dbContext.UserTenantRoles
                .Where(utr => utr.UserId == id && utr.ProfileId == request.ProfileId)
                .ToListAsync(ct);

            _dbContext.UserTenantRoles.RemoveRange(existingAssignments);

            foreach (var role in rolesToAssign)
            {
                _dbContext.UserTenantRoles.Add(new UserTenantRole
                {
                    UserId = id,
                    ProfileId = request.ProfileId,
                    RoleId = role.Id,
                    RoleName = role.Name
                });
            }
        }

        await _dbContext.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Get companies that a user is available to (for client-level users)
    /// </summary>
    [HttpGet("users/{userId:long}/companies")]
    [Authorize(Policy = "Permission:Security.Users.Manage")]
    public async Task<ActionResult<List<CompanyAvailabilityDto>>> GetUserCompanyAvailability(long userId, [FromQuery] long clientId, CancellationToken ct)
    {
        if (!await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), clientId, ct))
        {
            return Forbid();
        }

        var user = await _dbContext.Users.FindAsync(new object[] { userId }, ct);
        if (user == null) return NotFound("User not found.");

        // Get all companies for this client
        var allCompanies = await _dbContext.Profiles
            .Where(p => p.ClientId == clientId && !p.IsDeleted)
            .ToListAsync(ct);

        // Get companies the user is available to
        var availableCompanyIds = await _dbContext.ClientUserCompanyAvailability
            .Where(ca => ca.UserId == userId && ca.ClientId == clientId)
            .Select(ca => ca.CompanyId)
            .ToListAsync(ct);

        var result = allCompanies.Select(c => new CompanyAvailabilityDto(
            c.Id,
            c.Name,
            c.Slug,
            availableCompanyIds.Contains(c.Id)
        )).ToList();

        return Ok(result);
    }

    /// <summary>
    /// Update which companies a user is available to (for client-level users)
    /// </summary>
    [HttpPost("users/{userId:long}/companies")]
    [Authorize(Policy = "Permission:Security.Users.Manage")]
    public async Task<IActionResult> UpdateUserCompanyAvailability(long userId, [FromBody] UpdateUserCompanyAvailabilityRequest request, CancellationToken ct)
    {
        if (!await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), request.ClientId, ct))
        {
            return Forbid();
        }

        var user = await _dbContext.Users.FindAsync(new object[] { userId }, ct);
        if (user == null) return NotFound("User not found.");

        // Remove existing availability entries
        var existing = await _dbContext.ClientUserCompanyAvailability
            .Where(ca => ca.UserId == userId && ca.ClientId == request.ClientId)
            .ToListAsync(ct);

        _dbContext.ClientUserCompanyAvailability.RemoveRange(existing);

        // Add new availability entries
        foreach (var companyId in request.CompanyIds)
        {
            _dbContext.ClientUserCompanyAvailability.Add(new ClientUserCompanyAvailability
            {
                UserId = userId,
                ClientId = request.ClientId,
                CompanyId = companyId,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync(ct);
        return NoContent();
    }

    // ============ GROUPS ENDPOINTS ============

    [HttpGet("groups")]
    [Authorize(Policy = "Permission:Security.Groups.Manage")]
    public async Task<ActionResult<List<GroupDto>>> GetGroups([FromQuery] long profileId, CancellationToken ct)
    {
        if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), profileId, ct))
        {
            return Forbid();
        }

        var groups = await _dbContext.Groups
            .Where(g => g.ProfileId == profileId && !g.IsDeleted)
            .Include(g => g.UserGroups)
            .Include(g => g.GroupTenantRoles)
            .Select(g => new GroupDto(
                g.Id,
                g.Name,
                g.Description,
                g.Type.ToString(),
                g.ExternalId,
                g.UserGroups.Count(),
                g.GroupTenantRoles.Select(gtr => gtr.RoleName).ToList(),
                g.CreatedAt
            ))
            .ToListAsync(ct);

        return Ok(groups);
    }

    [HttpGet("groups/{id:long}")]
    [Authorize(Policy = "Permission:Security.Groups.Manage")]
    public async Task<ActionResult<GroupDto>> GetGroup(long id, CancellationToken ct)
    {
        var group = await _dbContext.Groups
            .Where(g => g.Id == id && !g.IsDeleted)
            .Include(g => g.UserGroups)
            .Include(g => g.GroupTenantRoles)
            .FirstOrDefaultAsync(ct);

        if (group == null) return NotFound();

        if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), group.ProfileId, ct))
        {
            return Forbid();
        }

        var dto = new GroupDto(
            group.Id,
            group.Name,
            group.Description,
            group.Type.ToString(),
            group.ExternalId,
            group.UserGroups.Count(),
            group.GroupTenantRoles.Select(gtr => gtr.RoleName).ToList(),
            group.CreatedAt
        );

        return Ok(dto);
    }

    [HttpPost("groups")]
    [Authorize(Policy = "Permission:Security.Groups.Manage")]
    public async Task<ActionResult<GroupDto>> CreateGroup([FromQuery] long profileId, [FromBody] CreateGroupRequest request, CancellationToken ct)
    {
        if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), profileId, ct))
        {
            return Forbid();
        }

        var group = new Group
        {
            ProfileId = profileId,
            Name = request.Name,
            Description = request.Description,
            Type = GroupType.Local,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Groups.Add(group);
        await _dbContext.SaveChangesAsync(ct);

        var dto = new GroupDto(
            group.Id,
            group.Name,
            group.Description,
            group.Type.ToString(),
            null,
            0,
            new List<string>(),
            group.CreatedAt
        );

        return CreatedAtAction(nameof(GetGroup), new { id = group.Id }, dto);
    }

    [HttpPut("groups/{id:long}")]
    [Authorize(Policy = "Permission:Security.Groups.Manage")]
    public async Task<ActionResult<GroupDto>> UpdateGroup(long id, [FromBody] UpdateGroupRequest request, CancellationToken ct)
    {
        var group = await _dbContext.Groups.FindAsync(new object[] { id }, ct);
        if (group == null || group.IsDeleted) return NotFound();

        if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), group.ProfileId, ct))
        {
            return Forbid();
        }

        group.Name = request.Name;
        group.Description = request.Description;
        group.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        var userCount = await _dbContext.UserGroups.CountAsync(ug => ug.GroupId == id, ct);
        var roleNames = await _dbContext.GroupTenantRoles
            .Where(gtr => gtr.GroupId == id)
            .Select(gtr => gtr.RoleName)
            .ToListAsync(ct);

        return Ok(new GroupDto(
            group.Id,
            group.Name,
            group.Description,
            group.Type.ToString(),
            group.ExternalId,
            userCount,
            roleNames,
            group.CreatedAt
        ));
    }

    [HttpDelete("groups/{id:long}")]
    [Authorize(Policy = "Permission:Security.Groups.Manage")]
    public async Task<IActionResult> DeleteGroup(long id, CancellationToken ct)
    {
        var group = await _dbContext.Groups.FindAsync(new object[] { id }, ct);
        if (group == null) return NotFound();

        if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), group.ProfileId, ct))
        {
            return Forbid();
        }

        group.IsDeleted = true;
        group.DeletedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("groups/{id:long}/members")]
    [Authorize(Policy = "Permission:Security.Groups.Manage")]
    public async Task<ActionResult<GroupMembersDto>> GetGroupMembers(long id, CancellationToken ct)
    {
        var group = await _dbContext.Groups.FindAsync(new object[] { id }, ct);
        if (group == null || group.IsDeleted) return NotFound();

        if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), group.ProfileId, ct))
        {
            return Forbid();
        }

        var userIds = await _dbContext.UserGroups
            .Where(ug => ug.GroupId == id)
            .Select(ug => ug.UserId)
            .ToListAsync(ct);

        var users = await _dbContext.Users
            .Where(u => userIds.Contains(u.Id) && !u.IsDeleted)
            .ToListAsync(ct);

        var members = users.Select(u =>
        {
            IdentitySource source;
            if (!Enum.TryParse<IdentitySource>(u.AuthProvider, true, out source))
            {
                source = IdentitySource.Local;
            }

            return new IdentityUserResult(
                u.Id.ToString(),
                u.Email,
                u.Email,
                source,
                true
            ) { IsActive = u.IsActive };
        }).ToList();

        return Ok(new GroupMembersDto(members));
    }

    [HttpPost("groups/{id:long}/members")]
    [Authorize(Policy = "Permission:Security.Groups.Manage")]
    public async Task<IActionResult> AddGroupMembers(long id, [FromBody] AddGroupMembersRequest request, CancellationToken ct)
    {
        var group = await _dbContext.Groups.FindAsync(new object[] { id }, ct);
        if (group == null || group.IsDeleted) return NotFound();

        if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), group.ProfileId, ct))
        {
            return Forbid();
        }

        var existingMemberIds = await _dbContext.UserGroups
            .Where(ug => ug.GroupId == id)
            .Select(ug => ug.UserId)
            .ToListAsync(ct);

        foreach (var userId in request.UserIds)
        {
            if (!existingMemberIds.Contains(userId))
            {
                _dbContext.UserGroups.Add(new UserGroup
                {
                    UserId = userId,
                    GroupId = id,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await _dbContext.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("groups/{id:long}/members/{userId:long}")]
    [Authorize(Policy = "Permission:Security.Groups.Manage")]
    public async Task<IActionResult> RemoveGroupMember(long id, long userId, CancellationToken ct)
    {
        var userGroup = await _dbContext.UserGroups
            .FirstOrDefaultAsync(ug => ug.GroupId == id && ug.UserId == userId, ct);

        if (userGroup == null) return NotFound();

        var group = await _dbContext.Groups.FindAsync(new object[] { id }, ct);
        if (group == null || group.IsDeleted) return NotFound();

        if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), group.ProfileId, ct))
        {
            return Forbid();
        }

        _dbContext.UserGroups.Remove(userGroup);

        await _dbContext.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("search/groups")]
    [Authorize(Policy = "Permission:Security.Groups.Manage")]
    public async Task<ActionResult<List<IdentityGroupResult>>> SearchGroups(
        [FromQuery] string term,
        [FromQuery] IdentitySource source,
        [FromQuery] long? authProfileId,
        [FromQuery] long profileId,
        CancellationToken ct)
    {
        if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), profileId, ct))
        {
            return Forbid();
        }

        IIdentityProvider provider = ResolveProvider(source);
        object? config = null;

        if (authProfileId.HasValue && source != IdentitySource.Local)
        {
            var authProfile = await _dbContext.AuthProfiles.FindAsync(new object[] { authProfileId.Value }, ct);
            if (authProfile != null)
            {
                if (authProfile.OwnerType == OwnerType.Client && authProfile.ClientId.HasValue)
                {
                    if (!await _accessControlService.CanAccessClientAsync(GetRequiredUserId(), authProfile.ClientId.Value, ct))
                    {
                        return Forbid();
                    }
                }
                else if (authProfile.OwnerType == OwnerType.Company && authProfile.ProfileId.HasValue)
                {
                    if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), authProfile.ProfileId.Value, ct))
                    {
                        return Forbid();
                    }
                }

                if (source == IdentitySource.WindowsAd && authProfile.ProviderType == AuthProviderType.WindowsAd)
                {
                    config = JsonSerializer.Deserialize<WindowsAdConfig>(authProfile.ConfigJson);
                }
                else if (source == IdentitySource.AzureAd && authProfile.ProviderType == AuthProviderType.AzureAd)
                {
                    config = JsonSerializer.Deserialize<AzureAdConfig>(authProfile.ConfigJson);
                }
            }
        }

        var results = await provider.SearchGroupsAsync(term ?? "", config, ct);

        // Mark groups as imported if they already exist
        var existingGroups = await _dbContext.Groups
            .Where(g => g.ProfileId == profileId && !g.IsDeleted)
            .Select(g => g.ExternalId)
            .ToListAsync(ct);

        var markedResults = results.Select(r => new IdentityGroupResult(
            r.Id,
            r.Name,
            r.Source,
            existingGroups.Contains(r.Id)
        ) { ProfileId = profileId }).ToList();

        return Ok(markedResults);
    }

    [HttpPost("import/group")]
    [Authorize(Policy = "Permission:Security.Groups.Manage")]
    public async Task<ActionResult> ImportGroup([FromBody] ImportGroupRequest request, CancellationToken ct)
    {
        if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), request.ProfileId, ct))
        {
            return Forbid();
        }

        var existingGroup = await _dbContext.Groups
            .FirstOrDefaultAsync(g => g.ProfileId == request.ProfileId && g.ExternalId == request.ExternalId && !g.IsDeleted, ct);

        if (existingGroup != null)
        {
            return Conflict(new { message = "Group already exists.", groupId = existingGroup.Id });
        }

        var group = new Group
        {
            ProfileId = request.ProfileId,
            Name = request.Name,
            ExternalId = request.ExternalId,
            Type = request.Source == IdentitySource.WindowsAd ? GroupType.WindowsAd : GroupType.AzureAd,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Groups.Add(group);
        await _dbContext.SaveChangesAsync(ct);

        return Ok(new { id = group.Id, name = group.Name });
    }

    [HttpGet("groups/{id:long}/roles")]
    [Authorize(Policy = "Permission:Security.Roles.Manage")]
    public async Task<ActionResult<List<long>>> GetGroupRoles(long id, [FromQuery] long profileId, CancellationToken ct)
    {
        if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), profileId, ct))
        {
            return Forbid();
        }

        var assignments = await _dbContext.GroupTenantRoles
            .Where(gtr => gtr.GroupId == id && gtr.ProfileId == profileId)
            .Select(gtr => new { gtr.RoleId, gtr.RoleName })
            .ToListAsync(ct);

        var roleIds = assignments
            .Where(a => a.RoleId.HasValue)
            .Select(a => a.RoleId!.Value)
            .Distinct()
            .ToList();

        var missingNames = assignments
            .Where(a => !a.RoleId.HasValue && !string.IsNullOrWhiteSpace(a.RoleName))
            .Select(a => a.RoleName)
            .Distinct()
            .ToList();

        if (missingNames.Count > 0)
        {
            var fallbackIds = await _dbContext.Roles
                .Where(r => r.ProfileId == profileId && missingNames.Contains(r.Name) && !r.IsDeleted)
                .Select(r => r.Id)
                .ToListAsync(ct);

            roleIds.AddRange(fallbackIds);
            roleIds = roleIds.Distinct().ToList();
        }

        return Ok(roleIds);
    }

    [HttpPost("groups/{id:long}/roles")]
    [Authorize(Policy = "Permission:Security.Roles.Manage")]
    public async Task<IActionResult> AssignGroupRoles(long id, [FromBody] GroupRoleAssignmentRequest request, CancellationToken ct)
    {
        var group = await _dbContext.Groups
            .Include(g => g.Profile)
            .FirstOrDefaultAsync(g => g.Id == id, ct);
        if (group == null) return NotFound("Group not found.");

        if (!await _accessControlService.CanAccessCompanyAsync(GetRequiredUserId(), group.ProfileId, ct))
        {
            return Forbid();
        }

        // Check if this is client-level or company-level assignment
        var roleCompanies = request.RoleCompanies ?? new Dictionary<long, List<long>>();
        bool isClientLevel = roleCompanies.Any();

        if (isClientLevel)
        {
            // Client-level role assignment with company selection
            var clientId = group.Profile?.ClientId;
            if (!clientId.HasValue) return BadRequest("Cannot assign client-level roles to a group without a client.");

            // Remove existing client-level role assignments
            var existingAssignments = await _dbContext.GroupTenantRoles
                .Where(gtr => gtr.GroupId == id && gtr.ClientId == clientId)
                .ToListAsync(ct);

            _dbContext.GroupTenantRoles.RemoveRange(existingAssignments);

            // Add new role assignments with company selection
            var roles = await _dbContext.Roles
                .Where(r => r.ClientId == clientId && roleCompanies.Keys.Contains(r.Id) && !r.IsDeleted)
                .ToListAsync(ct);

            foreach (var role in roles)
            {
                var companyIds = roleCompanies.ContainsKey(role.Id)
                    ? roleCompanies[role.Id]
                    : new List<long>();

                _dbContext.GroupTenantRoles.Add(new GroupTenantRole
                {
                    GroupId = id,
                    ClientId = clientId,
                    ProfileId = null,
                    RoleId = role.Id,
                    RoleName = role.Name,
                    CompanyIds = companyIds
                });
            }
        }
        else
        {
            // Company-level role assignment (original behavior)
            var rolesToAssign = await _dbContext.Roles
                .Where(r => r.ProfileId == request.ProfileId && request.RoleIds.Contains(r.Id) && !r.IsDeleted)
                .ToListAsync(ct);

            var existingAssignments = await _dbContext.GroupTenantRoles
                .Where(gtr => gtr.GroupId == id && gtr.ProfileId == request.ProfileId)
                .ToListAsync(ct);

            _dbContext.GroupTenantRoles.RemoveRange(existingAssignments);

            foreach (var role in rolesToAssign)
            {
                _dbContext.GroupTenantRoles.Add(new GroupTenantRole
                {
                    GroupId = id,
                    ProfileId = request.ProfileId,
                    RoleId = role.Id,
                    RoleName = role.Name
                });
            }
        }

        await _dbContext.SaveChangesAsync(ct);
        return NoContent();
    }

    private IIdentityProvider ResolveProvider(IdentitySource source)
    {
        return source switch
        {
            IdentitySource.Local => _serviceProvider.GetRequiredService<LocalIdentityProvider>(),
            IdentitySource.WindowsAd => _serviceProvider.GetRequiredService<WindowsAdIdentityProvider>(),
            IdentitySource.AzureAd => _serviceProvider.GetRequiredService<AzureAdIdentityProvider>(),
            _ => throw new ArgumentException("Invalid identity source")
        };
    }

    private long GetRequiredUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
                          ?? User.FindFirstValue("sub");
        if (!long.TryParse(userIdClaim, out var userId))
        {
            throw new InvalidOperationException("Authenticated user id is missing.");
        }

        return userId;
    }
}
