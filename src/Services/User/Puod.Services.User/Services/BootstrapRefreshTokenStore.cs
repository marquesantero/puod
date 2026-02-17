using System.Collections.Concurrent;

namespace Puod.Services.User.Services;

public sealed class BootstrapRefreshTokenStore
{
    private readonly ConcurrentDictionary<string, RefreshEntry> _tokens = new();

    public void Store(string token, long userId, DateTime expiresAt)
    {
        _tokens[token] = new RefreshEntry(userId, expiresAt);
    }

    public bool TryUse(string token, out long userId)
    {
        userId = 0;
        if (!_tokens.TryRemove(token, out var entry))
        {
            return false;
        }

        if (entry.ExpiresAt <= DateTime.UtcNow)
        {
            return false;
        }

        userId = entry.UserId;
        return true;
    }

    public void Revoke(string token)
    {
        _tokens.TryRemove(token, out _);
    }

    private sealed record RefreshEntry(long UserId, DateTime ExpiresAt);
}
