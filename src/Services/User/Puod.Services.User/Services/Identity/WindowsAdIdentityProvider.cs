using System.DirectoryServices.Protocols;
using Puod.Services.User.DTOs;

namespace Puod.Services.User.Services.Identity;

public class WindowsAdIdentityProvider : IIdentityProvider
{
    private readonly ILogger<WindowsAdIdentityProvider> _logger;

    public WindowsAdIdentityProvider(ILogger<WindowsAdIdentityProvider> logger)
    {
        _logger = logger;
    }

    public IdentitySource Source => IdentitySource.WindowsAd;

    public async Task<List<IdentityUserResult>> SearchUsersAsync(string term, object? config = null, CancellationToken ct = default)
    {
        if (config is not WindowsAdConfig adConfig)
        {
            return new List<IdentityUserResult>();
        }

        return await Task.Run(() =>
        {
            try
            {
                var identifier = new LdapDirectoryIdentifier(adConfig.LdapUrl);
                using var connection = new LdapConnection(identifier);

                connection.SessionOptions.ProtocolVersion = 3;
                if (adConfig.UseSsl)
                {
                    connection.SessionOptions.SecureSocketLayer = true;
                }

                if (!string.IsNullOrWhiteSpace(adConfig.BindDn) && !string.IsNullOrWhiteSpace(adConfig.BindPassword))
                {
                    connection.Credential = new System.Net.NetworkCredential(adConfig.BindDn, adConfig.BindPassword);
                }

                connection.Bind();

                var filter = string.IsNullOrWhiteSpace(adConfig.UserFilter)
                    ? $"(&(objectClass=user)(objectCategory=person)(|(cn=*{term}*)(sAMAccountName=*{term}*)(mail=*{term}*))(!(userAccountControl:1.2.840.113556.1.4.803:=2)))"
                    : adConfig.UserFilter.Replace("{term}", term);

                var searchRequest = new SearchRequest(
                    adConfig.BaseDn,
                    filter,
                    SearchScope.Subtree,
                    "objectSid", "sAMAccountName", "displayName", "mail", "userPrincipalName"
                );

                var response = (SearchResponse)connection.SendRequest(searchRequest);
                var results = new List<IdentityUserResult>();

                foreach (SearchResultEntry entry in response.Entries)
                {
                    var sid = GetAttributeValue(entry, "objectSid");
                    var samAccountName = GetAttributeValue(entry, "sAMAccountName");
                    var displayName = GetAttributeValue(entry, "displayName") ?? samAccountName ?? "Unknown";
                    var mail = GetAttributeValue(entry, "mail");
                    var upn = GetAttributeValue(entry, "userPrincipalName");

                    if (!string.IsNullOrWhiteSpace(samAccountName))
                    {
                        results.Add(new IdentityUserResult(
                            Id: sid ?? Guid.NewGuid().ToString(),
                            Username: upn ?? $"{adConfig.Domain}\\{samAccountName}",
                            DisplayName: displayName,
                            Source: IdentitySource.WindowsAd,
                            IsImported: false // TODO: Check if exists in Users table
                        ));
                    }
                }

                return results;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to search users in Windows AD");
                return new List<IdentityUserResult>();
            }
        }, ct);
    }

    public async Task<List<IdentityGroupResult>> SearchGroupsAsync(string term, object? config = null, CancellationToken ct = default)
    {
        if (config is not WindowsAdConfig adConfig)
        {
            return new List<IdentityGroupResult>();
        }

        return await Task.Run(() =>
        {
            try
            {
                var identifier = new LdapDirectoryIdentifier(adConfig.LdapUrl);
                using var connection = new LdapConnection(identifier);

                connection.SessionOptions.ProtocolVersion = 3;
                if (adConfig.UseSsl)
                {
                    connection.SessionOptions.SecureSocketLayer = true;
                }

                if (!string.IsNullOrWhiteSpace(adConfig.BindDn) && !string.IsNullOrWhiteSpace(adConfig.BindPassword))
                {
                    connection.Credential = new System.Net.NetworkCredential(adConfig.BindDn, adConfig.BindPassword);
                }

                connection.Bind();

                var filter = string.IsNullOrWhiteSpace(adConfig.GroupFilter)
                    ? $"(&(objectClass=group)(|(cn=*{term}*)(name=*{term}*)))"
                    : adConfig.GroupFilter.Replace("{term}", term);

                var searchRequest = new SearchRequest(
                    adConfig.BaseDn,
                    filter,
                    SearchScope.Subtree,
                    "objectSid", "cn", "name", "description"
                );

                var response = (SearchResponse)connection.SendRequest(searchRequest);
                var results = new List<IdentityGroupResult>();

                foreach (SearchResultEntry entry in response.Entries)
                {
                    var sid = GetAttributeValue(entry, "objectSid");
                    var cn = GetAttributeValue(entry, "cn");
                    var name = GetAttributeValue(entry, "name") ?? cn ?? "Unknown";

                    if (!string.IsNullOrWhiteSpace(name))
                    {
                        results.Add(new IdentityGroupResult(
                            Id: sid ?? Guid.NewGuid().ToString(),
                            Name: name,
                            Source: IdentitySource.WindowsAd,
                            IsImported: false
                        ));
                    }
                }

                return results;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to search groups in Windows AD");
                return new List<IdentityGroupResult>();
            }
        }, ct);
    }

    public async Task<bool> ValidateCredentialsAsync(string username, string password, object? config = null, CancellationToken ct = default)
    {
        if (config is not WindowsAdConfig adConfig)
        {
            return false;
        }

        return await Task.Run(() =>
        {
            try
            {
                var identifier = new LdapDirectoryIdentifier(adConfig.LdapUrl);
                using var connection = new LdapConnection(identifier);

                connection.SessionOptions.ProtocolVersion = 3;
                if (adConfig.UseSsl)
                {
                    connection.SessionOptions.SecureSocketLayer = true;
                }

                // Try to bind with the user credentials
                var userDn = username.Contains("@") || username.Contains("\\")
                    ? username // Already formatted as UPN or DOMAIN\user
                    : $"{username}@{adConfig.Domain}"; // Convert to UPN

                connection.Credential = new System.Net.NetworkCredential(userDn, password);
                connection.Bind();

                return true; // If bind succeeds, credentials are valid
            }
            catch (LdapException ex) when (ex.ErrorCode == 49) // LDAP_INVALID_CREDENTIALS
            {
                _logger.LogWarning("Invalid credentials for user {Username}", username);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to validate credentials in Windows AD for user {Username}", username);
                return false;
            }
        }, ct);
    }

    private string? GetAttributeValue(SearchResultEntry entry, string attrName)
    {
        if (entry.Attributes.Contains(attrName))
        {
            var attr = entry.Attributes[attrName];
            if (attr != null && attr.Count > 0)
            {
                var value = attr[0];
                if (value is string stringValue)
                {
                    return stringValue;
                }
                else if (value is byte[] byteValue)
                {
                    // For objectSid and similar binary attributes
                    return Convert.ToBase64String(byteValue);
                }
            }
        }
        return null;
    }
}
