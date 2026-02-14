using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace Puod.Services.Studio.Services;

public class StudioIntegrationClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public StudioIntegrationClient(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    public async Task<(bool Success, string? ErrorMessage, double? ExecutionTimeMs)> ExecuteQueryAsync(
        long integrationId,
        string query,
        string? bearerToken,
        CancellationToken ct)
    {
        var baseUrl = _configuration.GetValue<string>("IntegrationServiceUrl");
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return (false, "IntegrationServiceUrl is not configured.", null);
        }

        var client = _httpClientFactory.CreateClient();
        client.BaseAddress = new Uri(baseUrl);

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
        using var response = await client.PostAsync("/api/integration/execute-query", content, ct);

        var elapsed = DateTime.UtcNow - start;
        if (response.IsSuccessStatusCode)
        {
            return (true, null, elapsed.TotalMilliseconds);
        }

        var body = await response.Content.ReadAsStringAsync(ct);
        return (false, $"Integration query failed: {body}", elapsed.TotalMilliseconds);
    }
}
