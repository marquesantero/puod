using Microsoft.AspNetCore.Http;

namespace Puod.Services.User.Services;

public sealed class BootstrapState
{
    public BootstrapState(bool isDatabaseConfigured, bool isDatabaseProvisioned)
    {
        IsDatabaseConfigured = isDatabaseConfigured;
        IsDatabaseProvisioned = isDatabaseProvisioned;
    }

    public bool IsDatabaseConfigured { get; }
    public bool IsDatabaseProvisioned { get; }
}

public static class BootstrapRouteAllowList
{
    private static readonly PathString[] AllowedPrefixes =
    {
        new("/api/v1/auth"),
        new("/api/v1/bootstrap"),
        new("/api/v1/setup"),
        new("/swagger"),
        new("/health")
    };

    public static bool IsAllowed(PathString path)
    {
        foreach (var prefix in AllowedPrefixes)
        {
            if (path.StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
