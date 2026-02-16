using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Distributed;

namespace Puod.Gateway.Middleware;

/// <summary>
/// Middleware that caches GET responses for specific routes using IDistributedCache (Redis).
/// Only caches successful responses (200 OK) for read-heavy, non-sensitive endpoints.
/// </summary>
public class ResponseCacheMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IDistributedCache _cache;
    private readonly ILogger<ResponseCacheMiddleware> _logger;

    private static readonly TimeSpan DefaultCacheDuration = TimeSpan.FromSeconds(60);

    /// <summary>
    /// Route prefixes that should be cached. Only GET requests to these routes will be cached.
    /// </summary>
    private static readonly string[] CacheableRoutePrefixes =
    {
        "/api/v1/clients",
        "/api/v1/integrations",
        "/api/v1/companies",
        "/api/v1/connectors",
        "/api/v1/roles",
        "/api/v1/groups",
        "/api/v1/permissions"
    };

    /// <summary>
    /// Route prefixes that should NEVER be cached, even if they match a cacheable prefix.
    /// </summary>
    private static readonly string[] NoCacheRoutePrefixes =
    {
        "/api/v1/auth",
        "/api/v1/bootstrap",
        "/api/v1/setup",
        "/api/v1/studio",
        "/health"
    };

    public ResponseCacheMiddleware(
        RequestDelegate next,
        IDistributedCache cache,
        ILogger<ResponseCacheMiddleware> logger)
    {
        _next = next;
        _cache = cache;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Only cache GET requests
        if (!HttpMethods.IsGet(context.Request.Method))
        {
            await _next(context);
            return;
        }

        var path = context.Request.Path.Value ?? string.Empty;

        // Check if route should be excluded
        if (IsNoCacheRoute(path))
        {
            await _next(context);
            return;
        }

        // Check if route is cacheable
        if (!IsCacheableRoute(path))
        {
            await _next(context);
            return;
        }

        var cacheKey = GenerateCacheKey(context.Request);

        try
        {
            // Try to get cached response
            var cachedResponse = await _cache.GetAsync(cacheKey);
            if (cachedResponse != null)
            {
                _logger.LogDebug("Cache HIT for {Path}", path);
                context.Response.Headers["X-Cache"] = "HIT";

                var cachedEntry = DeserializeCacheEntry(cachedResponse);
                if (cachedEntry != null)
                {
                    context.Response.StatusCode = cachedEntry.StatusCode;
                    context.Response.ContentType = cachedEntry.ContentType;
                    await context.Response.Body.WriteAsync(cachedEntry.Body);
                    return;
                }
            }
        }
        catch (Exception ex)
        {
            // If cache read fails, just proceed without cache
            _logger.LogWarning(ex, "Failed to read from cache for {Path}. Proceeding without cache.", path);
        }

        // Cache MISS — capture the response
        _logger.LogDebug("Cache MISS for {Path}", path);
        context.Response.Headers["X-Cache"] = "MISS";

        var originalBody = context.Response.Body;
        using var memoryStream = new MemoryStream();
        context.Response.Body = memoryStream;

        try
        {
            await _next(context);

            // Only cache successful (200 OK) responses
            if (context.Response.StatusCode == StatusCodes.Status200OK)
            {
                memoryStream.Seek(0, SeekOrigin.Begin);
                var responseBytes = memoryStream.ToArray();
                var contentType = context.Response.ContentType ?? "application/json";

                var entry = new CacheEntry
                {
                    StatusCode = context.Response.StatusCode,
                    ContentType = contentType,
                    Body = responseBytes
                };

                try
                {
                    await _cache.SetAsync(cacheKey, SerializeCacheEntry(entry), new DistributedCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = DefaultCacheDuration
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to write to cache for {Path}.", path);
                }
            }

            // Write the response to the original stream
            memoryStream.Seek(0, SeekOrigin.Begin);
            await memoryStream.CopyToAsync(originalBody);
        }
        finally
        {
            context.Response.Body = originalBody;
        }
    }

    private static bool IsCacheableRoute(string path)
    {
        foreach (var prefix in CacheableRoutePrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private static bool IsNoCacheRoute(string path)
    {
        foreach (var prefix in NoCacheRoutePrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private static string GenerateCacheKey(HttpRequest request)
    {
        var sb = new StringBuilder();
        sb.Append("gw:");
        sb.Append(request.Path.Value?.ToLowerInvariant() ?? "/");

        if (request.QueryString.HasValue)
        {
            sb.Append(request.QueryString.Value);
        }

        // Include auth token hash so different users get different cached results
        var authHeader = request.Headers.Authorization.FirstOrDefault();
        if (!string.IsNullOrEmpty(authHeader))
        {
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(authHeader));
            sb.Append(":u:");
            sb.Append(Convert.ToHexString(hash)[..16]); // First 16 chars of hash
        }
        else
        {
            sb.Append(":anon");
        }

        return sb.ToString();
    }

    private static byte[] SerializeCacheEntry(CacheEntry entry)
    {
        using var ms = new MemoryStream();
        using var writer = new BinaryWriter(ms);
        writer.Write(entry.StatusCode);
        writer.Write(entry.ContentType);
        writer.Write(entry.Body.Length);
        writer.Write(entry.Body);
        return ms.ToArray();
    }

    private static CacheEntry? DeserializeCacheEntry(byte[] data)
    {
        try
        {
            using var ms = new MemoryStream(data);
            using var reader = new BinaryReader(ms);
            return new CacheEntry
            {
                StatusCode = reader.ReadInt32(),
                ContentType = reader.ReadString(),
                Body = reader.ReadBytes(reader.ReadInt32())
            };
        }
        catch
        {
            return null;
        }
    }

    private sealed class CacheEntry
    {
        public int StatusCode { get; init; }
        public string ContentType { get; init; } = "application/json";
        public byte[] Body { get; init; } = Array.Empty<byte>();
    }
}
