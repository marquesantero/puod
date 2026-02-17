using Microsoft.EntityFrameworkCore;
using Puod.Services.User.Data;
using Puod.Services.User.DTOs;

namespace Puod.Services.User.Services.Identity;

public class LocalIdentityProvider : IIdentityProvider
{
    private readonly PuodDbContext _dbContext;

    public IdentitySource Source => IdentitySource.Local;

    public LocalIdentityProvider(PuodDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<IdentityUserResult>> SearchUsersAsync(string term, object? config = null, CancellationToken ct = default)
    {
        // Busca usuários locais pelo email
        var users = await _dbContext.Users
            .Where(u => u.Email.Contains(term) && !u.IsDeleted)
            .Take(20)
            .Select(u => new IdentityUserResult(
                u.Id.ToString(),
                u.Email,
                u.Email, // Localmente, o display name é o email por enquanto
                IdentitySource.Local,
                true // Sempre true pois está no banco
            ))
            .ToListAsync(ct);

        return users;
    }

    public Task<List<IdentityGroupResult>> SearchGroupsAsync(string term, object? config = null, CancellationToken ct = default)
    {
        // Grupos locais são criados manualmente, não precisam de busca
        return Task.FromResult(new List<IdentityGroupResult>());
    }

    public async Task<bool> ValidateCredentialsAsync(string username, string password, object? config = null, CancellationToken ct = default)
    {
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Email == username.ToLower() && u.AuthProvider == "Local" && !u.IsDeleted, ct);

        if (user == null) return false;

        return BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
    }
}
