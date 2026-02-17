using Microsoft.EntityFrameworkCore;
using Puod.Services.User.Data;
using Puod.Services.User.DTOs;
using Puod.Services.User.Models;

namespace Puod.Services.User.Services;

public class ClientService : IClientService
{
    private readonly PuodDbContext _dbContext;
    private readonly ILogger<ClientService> _logger;

    public ClientService(
        PuodDbContext dbContext,
        ILogger<ClientService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<List<ClientListResponse>> GetAllAsync(CancellationToken ct)
    {
        return await _dbContext.Clients
            .Where(c => !c.IsDeleted)
            .Select(c => new ClientListResponse(
                c.Id,
                c.Name,
                c.Slug,
                c.Tier,
                c.IsAlterable,
                c.IsActive,
                c.Companies.Count(p => !p.IsDeleted),
                c.CreatedAt,
                c.LogoUrl,
                c.Country,
                c.Industry,
                c.Companies
                    .Where(p => !p.IsDeleted)
                    .Select(p => new ClientCompanyInfo(
                        p.Id,
                        p.Name,
                        p.Slug,
                        p.IsActive,
                        p.CreatedAt))
                    .ToList()))
            .ToListAsync(ct);
    }

    public async Task<ClientDetailResponse?> GetByIdAsync(long id, CancellationToken ct)
    {
        var client = await _dbContext.Clients
            .Where(c => c.Id == id && !c.IsDeleted)
            .Include(c => c.Companies.Where(p => !p.IsDeleted))
            .FirstOrDefaultAsync(ct);

        if (client == null)
        {
            return null;
        }

        var companies = client.Companies
            .Select(p => new ClientCompanyInfo(
                p.Id,
                p.Name,
                p.Slug,
                p.IsActive,
                p.CreatedAt))
            .ToList();

        return new ClientDetailResponse(
            client.Id,
            client.Name,
            client.Slug,
            client.Tier,
            client.IsAlterable,
            client.IsActive,
            client.LogoUrl,
            client.TaxId,
            client.Website,
            client.Email,
            client.Phone,
            client.Address,
            client.City,
            client.State,
            client.Country,
            client.PostalCode,
            client.Description,
            client.Industry,
            client.EmployeeCount,
            client.FoundedDate,
            companies,
            client.CreatedAt,
            client.UpdatedAt);
    }

    public async Task<ClientInfoPreview?> GetInfoPreviewAsync(long id, CancellationToken ct)
    {
        var client = await _dbContext.Clients
            .Where(c => c.Id == id && !c.IsDeleted)
            .FirstOrDefaultAsync(ct);

        if (client == null)
        {
            return null;
        }

        return new ClientInfoPreview(
            client.Id,
            client.Name,
            client.Tier,
            client.LogoUrl,
            client.TaxId,
            client.Website,
            client.Email,
            client.Phone,
            client.Address,
            client.City,
            client.State,
            client.Country,
            client.PostalCode,
            client.Description,
            client.Industry,
            client.EmployeeCount,
            client.FoundedDate);
    }

    public async Task<ClientDetailResponse> CreateAsync(ClientCreateRequest request, long userId, CancellationToken ct)
    {
        var client = new Client
        {
            Name = request.Name.Trim(),
            Slug = GenerateSlug(request.Name),
            Tier = request.Tier,
            IsAlterable = request.IsAlterable,
            IsActive = true,
            LogoUrl = request.LogoUrl,
            TaxId = request.TaxId,
            Website = request.Website,
            Email = request.Email,
            Phone = request.Phone,
            Address = request.Address,
            City = request.City,
            State = request.State,
            Country = request.Country,
            PostalCode = request.PostalCode,
            Description = request.Description,
            Industry = request.Industry,
            EmployeeCount = request.EmployeeCount,
            FoundedDate = request.FoundedDate,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId
        };

        _dbContext.Clients.Add(client);

        await _dbContext.SaveChangesAsync(ct);

        await CreateDefaultClientRolesAsync(client, ct);

        // Automatically assign creator as Client Admin (client scope)
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user != null)
        {
            var clientAdminRole = await _dbContext.Roles
                .Where(r => r.ClientId == client.Id && r.Name == ClientRoles.ClientAdmin && !r.IsDeleted)
                .FirstOrDefaultAsync(ct);

            if (clientAdminRole != null)
            {
                _dbContext.UserTenantRoles.Add(new UserTenantRole
                {
                    UserId = userId,
                    ClientId = client.Id,
                    RoleId = clientAdminRole.Id,
                    RoleName = clientAdminRole.Name,
                    CreatedAt = DateTime.UtcNow
                });
                await _dbContext.SaveChangesAsync(ct);
            }
        }

        _logger.LogInformation("Created client {ClientId} ({ClientName}) by user {UserId}",
            client.Id, client.Name, userId);

        return new ClientDetailResponse(
            client.Id,
            client.Name,
            client.Slug,
            client.Tier,
            client.IsAlterable,
            client.IsActive,
            client.LogoUrl,
            client.TaxId,
            client.Website,
            client.Email,
            client.Phone,
            client.Address,
            client.City,
            client.State,
            client.Country,
            client.PostalCode,
            client.Description,
            client.Industry,
            client.EmployeeCount,
            client.FoundedDate,
            new List<ClientCompanyInfo>(),
            client.CreatedAt,
            client.UpdatedAt);
    }

    private async Task CreateDefaultClientRolesAsync(Client client, CancellationToken ct)
    {
        var existingRoles = await _dbContext.Roles
            .Where(r => r.ClientId == client.Id && !r.IsDeleted)
            .ToListAsync(ct);

        var basicRoles = new Dictionary<string, string>
        {
            { ClientRoles.ClientAdmin, "Full access to client and all companies - can manage users, roles, companies, and all resources" },
            { ClientRoles.ClientManager, "Elevated permissions - can manage users and most resources with limited security permissions" },
            { ClientRoles.ClientAnalyst, "Read-only access to company data and monitoring dashboards" },
            { ClientRoles.ClientCardDesigner, "Specialized role for card creation and editing across all companies" }
        };

        foreach (var (roleName, description) in basicRoles)
        {
            if (existingRoles.All(r => r.Name != roleName))
            {
                var role = new Role { Client = client, Name = roleName, Description = description };
                _dbContext.Roles.Add(role);
                existingRoles.Add(role);
            }
        }

        await _dbContext.SaveChangesAsync(ct);

        foreach (var role in existingRoles)
        {
            var permissions = Configuration.DefaultRolePermissions.GetDefaultPermissions(role.Name);
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

    public async Task<ClientDetailResponse> UpdateAsync(long id, ClientUpdateRequest request, long userId, CancellationToken ct)
    {
        var client = await _dbContext.Clients
            .Include(c => c.Companies.Where(p => !p.IsDeleted))
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);

        if (client == null)
        {
            throw new InvalidOperationException("Client not found.");
        }

        if (!client.IsAlterable)
        {
            throw new InvalidOperationException("This client cannot be modified (IsAlterable=false).");
        }

        client.Name = request.Name.Trim();
        client.Tier = request.Tier;
        client.IsActive = request.IsActive;
        client.LogoUrl = request.LogoUrl;
        client.TaxId = request.TaxId;
        client.Website = request.Website;
        client.Email = request.Email;
        client.Phone = request.Phone;
        client.Address = request.Address;
        client.City = request.City;
        client.State = request.State;
        client.Country = request.Country;
        client.PostalCode = request.PostalCode;
        client.Description = request.Description;
        client.Industry = request.Industry;
        client.EmployeeCount = request.EmployeeCount;
        client.FoundedDate = request.FoundedDate;
        client.UpdatedAt = DateTime.UtcNow;
        client.UpdatedBy = userId;

        await _dbContext.SaveChangesAsync(ct);

        var companies = client.Companies
            .Select(p => new ClientCompanyInfo(
                p.Id,
                p.Name,
                p.Slug,
                p.IsActive,
                p.CreatedAt))
            .ToList();

        return new ClientDetailResponse(
            client.Id,
            client.Name,
            client.Slug,
            client.Tier,
            client.IsAlterable,
            client.IsActive,
            client.LogoUrl,
            client.TaxId,
            client.Website,
            client.Email,
            client.Phone,
            client.Address,
            client.City,
            client.State,
            client.Country,
            client.PostalCode,
            client.Description,
            client.Industry,
            client.EmployeeCount,
            client.FoundedDate,
            companies,
            client.CreatedAt,
            client.UpdatedAt);
    }

    public async Task DeleteAsync(long id, long userId, CancellationToken ct)
    {
        var client = await _dbContext.Clients
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);

        if (client == null)
        {
            throw new InvalidOperationException("Client not found.");
        }

        if (!client.IsAlterable)
        {
            throw new InvalidOperationException("This client cannot be deleted (IsAlterable=false).");
        }

        client.IsDeleted = true;
        client.DeletedAt = DateTime.UtcNow;
        client.DeletedBy = userId;

        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Client {ClientId} ({ClientName}) soft-deleted by user {UserId}",
            id, client.Name, userId);
    }

    private static string GenerateSlug(string name)
    {
        return name.ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("_", "-");
    }
}
