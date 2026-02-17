using Puod.Services.User.DTOs;

namespace Puod.Services.User.Services.Identity;

public interface IIdentityProvider
{
    IdentitySource Source { get; }

    // Busca usuários (para autocompletar/pesquisa)
    Task<List<IdentityUserResult>> SearchUsersAsync(string term, object? config = null, CancellationToken ct = default);

    // Busca grupos (para autocompletar/pesquisa)
    Task<List<IdentityGroupResult>> SearchGroupsAsync(string term, object? config = null, CancellationToken ct = default);

    // Valida usuário e senha
    Task<bool> ValidateCredentialsAsync(string username, string password, object? config = null, CancellationToken ct = default);
}
