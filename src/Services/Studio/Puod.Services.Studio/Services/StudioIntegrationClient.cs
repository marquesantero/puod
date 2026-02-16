using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Puod.Services.Studio.Services;

public class StudioIntegrationClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<StudioIntegrationClient> _logger;

    public StudioIntegrationClient(IHttpClientFactory httpClientFactory, ILogger<StudioIntegrationClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<(bool Success, string? ErrorMessage, double? ExecutionTimeMs)> ExecuteQueryAsync(
        long integrationId,
        string query,
        string? bearerToken,
        CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient("IntegrationService");

        if (!string.IsNullOrWhiteSpace(bearerToken))
        {
            client.DefaultRequestHeaders.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
        }

        var payload = JsonSerializer.Serialize(new
        {
            integrationId,
            query
        });

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var start = DateTime.UtcNow;

        try
        {
            using var response = await client.PostAsync("/api/v1/integration/execute-query", content, ct);

            var elapsed = DateTime.UtcNow - start;
            if (response.IsSuccessStatusCode)
            {
                return (true, null, elapsed.TotalMilliseconds);
            }

            var body = await response.Content.ReadAsStringAsync(ct);
            return (false, $"Integration query failed: {body}", elapsed.TotalMilliseconds);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            var elapsed = DateTime.UtcNow - start;
            _logger.LogError(ex, "Integration service call failed after resilience retries");
            return (false, $"Integration service unavailable: {ex.Message}", elapsed.TotalMilliseconds);
        }
    }
}
