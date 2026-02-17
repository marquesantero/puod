using Azure.Identity;
using Microsoft.Graph;
using Microsoft.Graph.Models;
using Microsoft.Kiota.Abstractions.Authentication;
using Puod.Services.User.DTOs;

namespace Puod.Services.User.Services.Identity;

using DtoIdentitySource = Puod.Services.User.DTOs.IdentitySource;

public class AzureAdIdentityProvider : IIdentityProvider
{
    private readonly ILogger<AzureAdIdentityProvider> _logger;

    public AzureAdIdentityProvider(ILogger<AzureAdIdentityProvider> logger)
    {
        _logger = logger;
    }

    public DtoIdentitySource Source => DtoIdentitySource.AzureAd;

    public async Task<List<IdentityUserResult>> SearchUsersAsync(string term, object? config = null, CancellationToken ct = default)
    {
        if (config is not AzureAdConfig azureConfig)
        {
            return new List<IdentityUserResult>();
        }

        try
        {
            var graphClient = CreateGraphClient(azureConfig);
            if (graphClient == null) return new List<IdentityUserResult>();

            var result = await graphClient.Users.GetAsync(requestConfiguration =>
            {
                requestConfiguration.QueryParameters.Filter = $"(startswith(displayName,'{term}') or startswith(userPrincipalName,'{term}') or startswith(mail,'{term}')) and accountEnabled eq true";
                requestConfiguration.QueryParameters.Select = new[] { "id", "displayName", "userPrincipalName", "mail", "accountEnabled" };
                requestConfiguration.QueryParameters.Top = 20;
            }, ct);

            var users = new List<IdentityUserResult>();
            if (result?.Value != null)
            {
                foreach (var user in result.Value)
                {
                    users.Add(new IdentityUserResult(
                        user.Id ?? string.Empty,
                        user.UserPrincipalName ?? user.Mail ?? string.Empty,
                        user.DisplayName ?? "Unknown",
                        DtoIdentitySource.AzureAd,
                        false
                    ));
                }
            }

            return users;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Azure Graph Search failed");
            return new List<IdentityUserResult>();
        }
    }

    public async Task<List<IdentityGroupResult>> SearchGroupsAsync(string term, object? config = null, CancellationToken ct = default)
    {
        if (config is not AzureAdConfig azureConfig)
        {
            return new List<IdentityGroupResult>();
        }

        try
        {
            var graphClient = CreateGraphClient(azureConfig);
            if (graphClient == null) return new List<IdentityGroupResult>();

            var result = await graphClient.Groups.GetAsync(requestConfiguration =>
            {
                requestConfiguration.QueryParameters.Filter = $"startswith(displayName,'{term}') or startswith(mailNickname,'{term}')";
                requestConfiguration.QueryParameters.Select = new[] { "id", "displayName", "description" };
                requestConfiguration.QueryParameters.Top = 20;
            }, ct);

            var groups = new List<IdentityGroupResult>();
            if (result?.Value != null)
            {
                foreach (var group in result.Value)
                {
                    groups.Add(new IdentityGroupResult(
                        group.Id ?? string.Empty,
                        group.DisplayName ?? "Unknown",
                        DtoIdentitySource.AzureAd,
                        false
                    ));
                }
            }

            return groups;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Azure Graph Search Groups failed");
            return new List<IdentityGroupResult>();
        }
    }

    public Task<bool> ValidateCredentialsAsync(string username, string password, object? config = null, CancellationToken ct = default)
    {
        return Task.FromResult(false);
    }

    /// <summary>
    /// Creates a GraphServiceClient using either a pre-authenticated access token
    /// or ClientSecret credentials from the AzureAdConfig.
    /// </summary>
    private GraphServiceClient? CreateGraphClient(AzureAdConfig config)
    {
        // If an access token is provided, use it directly
        if (!string.IsNullOrWhiteSpace(config.AccessToken))
        {
            var tokenProvider = new StaticTokenProvider(config.AccessToken);
            var authProvider = new BaseBearerTokenAuthenticationProvider(tokenProvider);
            return new GraphServiceClient(authProvider);
        }

        // Otherwise, use ClientSecret credential
        if (string.IsNullOrWhiteSpace(config.ClientSecret))
        {
            _logger.LogWarning("AzureAD config missing both AccessToken and ClientSecret");
            return null;
        }

        var credential = new ClientSecretCredential(config.TenantId, config.ClientId, config.ClientSecret);
        return new GraphServiceClient(credential);
    }

    private class StaticTokenProvider : IAccessTokenProvider
    {
        private readonly string _token;
        public StaticTokenProvider(string token) => _token = token;
        public Task<string> GetAuthorizationTokenAsync(Uri uri, Dictionary<string, object>? additionalAuthenticationContext = default, CancellationToken cancellationToken = default) => Task.FromResult(_token);
        public AllowedHostsValidator AllowedHostsValidator { get; } = new AllowedHostsValidator();
    }
}
