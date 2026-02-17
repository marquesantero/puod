using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Puod.Services.User.Data;
using Puod.Services.User.DTOs;
using Puod.Services.User.Models;
using Puod.Services.User.Services;

namespace Puod.Services.User.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/auth-profiles")]
[Asp.Versioning.ApiVersion(1.0)]
[Authorize]
public class AuthProfileController : ControllerBase
{
    private readonly PuodDbContext _dbContext;
    private readonly ILogger<AuthProfileController> _logger;
    private readonly IAccessControlService _accessControlService;

    public AuthProfileController(
        PuodDbContext dbContext,
        ILogger<AuthProfileController> logger,
        IAccessControlService accessControlService)
    {
        _dbContext = dbContext;
        _logger = logger;
        _accessControlService = accessControlService;
    }

    [HttpGet]
    [Authorize(Policy = "Permission:Company.View")]
    public async Task<ActionResult<List<AuthProfileListResponse>>> GetAll(
        [FromQuery] long? profileId,
        [FromQuery] long? clientId,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var isSystemAdmin = _accessControlService.IsSystemAdmin(userId.Value);

        var query = _dbContext.AuthProfiles
            .Include(ap => ap.Profile)
            .Include(ap => ap.Client)
            .Where(ap => !ap.IsDeleted);

        if (profileId.HasValue)
        {
            // Check access to the specific company
            if (!isSystemAdmin && !await _accessControlService.CanAccessCompanyAsync(userId.Value, profileId.Value, ct))
            {
                return Forbid();
            }

            query = query.Where(ap => ap.ProfileId == profileId.Value);
        }
        else if (clientId.HasValue)
        {
            if (!isSystemAdmin && !await _accessControlService.CanAccessClientAsync(userId.Value, clientId.Value, ct))
            {
                return Forbid();
            }

            // Get auth profiles owned by client
            query = query.Where(ap => ap.ClientId == clientId.Value);
        }
        else if (!isSystemAdmin)
        {
            // Non-admin users can only see auth profiles for companies they have access to
            var userCompanyIds = await _accessControlService.GetAccessibleCompanyIdsAsync(userId.Value, ct);

            query = query.Where(ap => ap.ProfileId.HasValue && userCompanyIds.Contains(ap.ProfileId.Value));
        }

        var profiles = await query
            .OrderBy(ap => ap.Name)
            .Select(ap => new AuthProfileListResponse(
                ap.Id,
                ap.ProfileId,
                ap.OwnerType,
                ap.CompanyIds,
                ap.ClientId,
                ap.Name,
                ap.ProviderType.ToString(),
                ap.IsActive,
                ap.CreatedAt,
                ap.UpdatedAt))
            .ToListAsync(ct);

        return Ok(profiles);
    }

    [HttpGet("{id:long}")]
    [Authorize(Policy = "Permission:Company.View")]
    public async Task<ActionResult<AuthProfileDetailResponse>> GetById(long id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var authProfile = await _dbContext.AuthProfiles
            .FirstOrDefaultAsync(ap => ap.Id == id && !ap.IsDeleted, ct);

        if (authProfile == null)
        {
            return NotFound();
        }

        if (authProfile.OwnerType == OwnerType.Client && authProfile.ClientId.HasValue)
        {
            if (!await _accessControlService.CanAccessClientAsync(userId.Value, authProfile.ClientId.Value, ct))
            {
                return Forbid();
            }
        }
        else if (authProfile.OwnerType == OwnerType.Company && authProfile.ProfileId.HasValue)
        {
            if (!await _accessControlService.CanAccessCompanyAsync(userId.Value, authProfile.ProfileId.Value, ct))
            {
                return Forbid();
            }
        }

        object config = authProfile.ProviderType switch
        {
            AuthProviderType.WindowsAd => JsonSerializer.Deserialize<WindowsAdConfig>(authProfile.ConfigJson) ?? new object(),
            AuthProviderType.AzureAd => JsonSerializer.Deserialize<AzureAdConfig>(authProfile.ConfigJson) ?? new object(),
            _ => new object()
        };

        return Ok(new AuthProfileDetailResponse(
            authProfile.Id,
            authProfile.ProfileId,
            authProfile.OwnerType,
            authProfile.CompanyIds,
            authProfile.ClientId,
            authProfile.Name,
            authProfile.ProviderType,
            authProfile.Domains,
            config,
            authProfile.IsActive,
            authProfile.CreatedAt,
            authProfile.UpdatedAt));
    }

    [HttpGet("company/{profileId:long}/available")]
    [Authorize(Policy = "Permission:Company.View")]
    public async Task<ActionResult<List<AuthProfileListResponse>>> GetCompanyAvailableAuthProfiles(long profileId, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        // Check access to the company
        if (!await _accessControlService.CanAccessCompanyAsync(userId.Value, profileId, ct))
        {
            return Forbid();
        }

        // Get the company to find its client
        var company = await _dbContext.Profiles
            .FirstOrDefaultAsync(p => p.Id == profileId && !p.IsDeleted, ct);

        if (company == null)
        {
            return NotFound();
        }

        var availableProfiles = new List<AuthProfileListResponse>();

        // Get auth profiles owned by the company
        var ownedProfiles = await _dbContext.AuthProfiles
            .Where(ap => ap.ProfileId == profileId && ap.OwnerType == OwnerType.Company && !ap.IsDeleted)
            .Select(ap => new AuthProfileListResponse(
                ap.Id,
                ap.ProfileId,
                ap.OwnerType,
                ap.CompanyIds,
                ap.ClientId,
                ap.Name,
                ap.ProviderType.ToString(),
                ap.IsActive,
                ap.CreatedAt,
                ap.UpdatedAt))
            .ToListAsync(ct);

        availableProfiles.AddRange(ownedProfiles);

        // Get auth profiles inherited from client (if company has InheritAuthentication enabled)
        if (company.InheritAuthentication && company.ClientId.HasValue)
        {
            var inheritedProfiles = await _dbContext.AuthProfiles
                .Where(ap => ap.ClientId == company.ClientId
                    && ap.OwnerType == OwnerType.Client
                    && ap.CompanyIds.Contains(profileId)
                    && !ap.IsDeleted)
                .Select(ap => new AuthProfileListResponse(
                    ap.Id,
                    ap.ProfileId,
                    ap.OwnerType,
                    ap.CompanyIds,
                    ap.ClientId,
                    ap.Name,
                    ap.ProviderType.ToString(),
                    ap.IsActive,
                    ap.CreatedAt,
                    ap.UpdatedAt))
                .ToListAsync(ct);

            availableProfiles.AddRange(inheritedProfiles);
        }

        return Ok(availableProfiles.OrderBy(ap => ap.Name).ToList());
    }

    [HttpPost]
    [Authorize(Policy = "Permission:Company.Settings.Edit")]
    public async Task<ActionResult<AuthProfileDetailResponse>> Create([FromBody] AuthProfileCreateRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        _logger.LogInformation("Creating AuthProfile '{Name}' with Domains: {Domains}", request.Name, string.Join(", ", request.Domains ?? new List<string>()));

        // Determine owner type and validate access
        OwnerType ownerType;
        long? profileId = null;
        long? clientId = null;
        List<long> companyIds = request.CompanyIds ?? new List<long>();

        if (request.ClientId.HasValue)
        {
            // Creating at Client level
            ownerType = OwnerType.Client;
            clientId = request.ClientId.Value;
            profileId = null; // Client-level profiles don't have a profileId

            if (!await _accessControlService.CanManageClientAsync(userId.Value, clientId.Value, ct))
            {
                return Forbid();
            }
        }
        else if (request.ProfileId.HasValue)
        {
            // Creating at Company level
            ownerType = OwnerType.Company;
            profileId = request.ProfileId.Value;

            // Validate user access to the company
            if (!await _accessControlService.CanAccessCompanyAsync(userId.Value, profileId.Value, ct))
            {
                return Forbid();
            }
        }
        else
        {
            return BadRequest(new { message = "Either ProfileId or ClientId must be provided" });
        }

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        string configJson = JsonSerializer.Serialize(request.Config, jsonOptions);

        var authProfile = new AuthProfile
        {
            ProfileId = profileId,
            ClientId = clientId,
            OwnerType = ownerType,
            CompanyIds = companyIds,
            Name = request.Name,
            ProviderType = request.ProviderType,
            Domains = (request.Domains ?? new List<string>()).Select(d => d.Trim()).Where(d => !string.IsNullOrWhiteSpace(d)).ToList(),
            ConfigJson = configJson,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId
        };

        _dbContext.AuthProfiles.Add(authProfile);
        await _dbContext.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = authProfile.Id }, new AuthProfileDetailResponse(
            authProfile.Id,
            authProfile.ProfileId,
            authProfile.OwnerType,
            authProfile.CompanyIds,
            authProfile.ClientId,
            authProfile.Name,
            authProfile.ProviderType,
            authProfile.Domains,
            request.Config,
            authProfile.IsActive,
            authProfile.CreatedAt,
            null));
    }

    [HttpPut("{id:long}")]
    [Authorize(Policy = "Permission:Company.Settings.Edit")]
    public async Task<ActionResult<AuthProfileDetailResponse>> Update(long id, [FromBody] AuthProfileUpdateRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        _logger.LogInformation("Updating AuthProfile {Id} with Domains: {Domains}", id, string.Join(", ", request.Domains ?? new List<string>()));

        var authProfile = await _dbContext.AuthProfiles
            .FirstOrDefaultAsync(ap => ap.Id == id && !ap.IsDeleted, ct);

        if (authProfile == null)
        {
            return NotFound();
        }

        // Check access based on owner type
        if (authProfile.OwnerType == OwnerType.Client)
        {
            // For client-owned profiles, check if user has access to the client
            if (!authProfile.ClientId.HasValue || !await _accessControlService.CanManageClientAsync(userId.Value, authProfile.ClientId.Value, ct))
            {
                return Forbid();
            }
        }
        else
        {
            // For company-owned profiles, check access to the company
            if (authProfile.ProfileId.HasValue && !await _accessControlService.CanAccessCompanyAsync(userId.Value, authProfile.ProfileId.Value, ct))
            {
                return Forbid();
            }
        }

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        authProfile.Name = request.Name;
        authProfile.Domains = (request.Domains ?? new List<string>()).Select(d => d.Trim()).Where(d => !string.IsNullOrWhiteSpace(d)).ToList();
        authProfile.ConfigJson = JsonSerializer.Serialize(request.Config, jsonOptions);
        authProfile.UpdatedAt = DateTime.UtcNow;
        authProfile.UpdatedBy = userId;

        // Update CompanyIds if provided (for client-owned profiles)
        if (request.CompanyIds != null && authProfile.OwnerType == OwnerType.Client)
        {
            authProfile.CompanyIds = request.CompanyIds;
        }

        // Update IsActive if provided
        if (request.IsActive.HasValue)
        {
            authProfile.IsActive = request.IsActive.Value;
        }

        await _dbContext.SaveChangesAsync(ct);

        return Ok(new AuthProfileDetailResponse(
            authProfile.Id,
            authProfile.ProfileId,
            authProfile.OwnerType,
            authProfile.CompanyIds,
            authProfile.ClientId,
            authProfile.Name,
            authProfile.ProviderType,
            authProfile.Domains,
            request.Config,
            authProfile.IsActive,
            authProfile.CreatedAt,
            authProfile.UpdatedAt));
    }

    [HttpDelete("{id:long}")]
    [Authorize(Policy = "Permission:Company.Settings.Edit")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var authProfile = await _dbContext.AuthProfiles
            .FirstOrDefaultAsync(ap => ap.Id == id && !ap.IsDeleted, ct);

        if (authProfile == null)
        {
            return NotFound();
        }

        if (authProfile.OwnerType == OwnerType.Client && authProfile.ClientId.HasValue)
        {
            if (!await _accessControlService.CanManageClientAsync(userId.Value, authProfile.ClientId.Value, ct))
            {
                return Forbid();
            }
        }
        else if (authProfile.OwnerType == OwnerType.Company && authProfile.ProfileId.HasValue)
        {
            if (!await _accessControlService.CanAccessCompanyAsync(userId.Value, authProfile.ProfileId.Value, ct))
            {
                return Forbid();
            }
        }

        authProfile.IsDeleted = true;
        authProfile.DeletedAt = DateTime.UtcNow;
        authProfile.DeletedBy = userId;

        await _dbContext.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("test-azure")]
    public async Task<ActionResult<object>> TestAzureConnection([FromBody] TestAzureConnectionRequest request, CancellationToken ct)
    {
        try
        {
            // Try to get a token from Azure AD to validate credentials
            using var httpClient = new HttpClient();
            var tokenEndpoint = $"https://login.microsoftonline.com/{request.TenantId}/oauth2/v2.0/token";

            var tokenRequest = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("client_id", request.ClientId),
                new KeyValuePair<string, string>("client_secret", request.ClientSecret),
                new KeyValuePair<string, string>("scope", "https://graph.microsoft.com/.default"),
                new KeyValuePair<string, string>("grant_type", "client_credentials")
            });

            var response = await httpClient.PostAsync(tokenEndpoint, tokenRequest, ct);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Azure AD test connection failed: {Error}", errorContent);
                return BadRequest(new { message = "Failed to authenticate with Azure AD. Please check your credentials." });
            }

            var tokenResponse = await response.Content.ReadFromJsonAsync<JsonElement>(ct);
            var accessToken = tokenResponse.GetProperty("access_token").GetString();

            // Try to get tenant info from Microsoft Graph
            httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            var orgResponse = await httpClient.GetAsync("https://graph.microsoft.com/v1.0/organization", ct);

            string? extractedDomain = null;
            if (orgResponse.IsSuccessStatusCode)
            {
                var orgData = await orgResponse.Content.ReadFromJsonAsync<JsonElement>(ct);
                if (orgData.TryGetProperty("value", out var values) && values.GetArrayLength() > 0)
                {
                    var org = values[0];
                    if (org.TryGetProperty("verifiedDomains", out var domains) && domains.GetArrayLength() > 0)
                    {
                        // Get the first verified domain that is not onmicrosoft.com
                        foreach (var domain in domains.EnumerateArray())
                        {
                            if (domain.TryGetProperty("name", out var name))
                            {
                                var domainName = name.GetString();
                                if (!string.IsNullOrEmpty(domainName) && !domainName.EndsWith(".onmicrosoft.com"))
                                {
                                    extractedDomain = domainName;
                                    break;
                                }
                            }
                        }

                        // Fallback to first domain if no custom domain found
                        if (string.IsNullOrEmpty(extractedDomain) && domains[0].TryGetProperty("name", out var fallbackName))
                        {
                            extractedDomain = fallbackName.GetString();
                        }
                    }
                }
            }

            return Ok(new
            {
                message = "Azure AD connection successful!",
                domain = extractedDomain,
                success = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error testing Azure AD connection");
            return BadRequest(new { message = "Failed to connect to Azure AD. Please check your credentials and network connection." });
        }
    }

    private long? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");
        return long.TryParse(userId, out var parsed) ? parsed : null;
    }
}

public record TestAzureConnectionRequest(string TenantId, string ClientId, string ClientSecret);
