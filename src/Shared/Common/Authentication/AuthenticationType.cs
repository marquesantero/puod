namespace Puod.Shared.Common.Authentication;

/// <summary>
/// Tipos de autenticação suportados pelos conectores
/// </summary>
public enum AuthenticationType
{
    /// <summary>
    /// Autenticação OAuth2 com Service Principal (Azure)
    /// Requer: tenant_id, client_id, client_secret
    /// </summary>
    OAuth2,

    /// <summary>
    /// Autenticação via cookies extraídos do browser
    /// Requer: browser_type (vivaldi/chrome/edge), cookie_domain
    /// </summary>
    BrowserCookies,

    /// <summary>
    /// Autenticação básica com usuário e senha
    /// Requer: username, password
    /// </summary>
    BasicAuth,

    /// <summary>
    /// Autenticação via token de acesso (Bearer token)
    /// Requer: access_token
    /// </summary>
    BearerToken
}

/// <summary>
/// Configuração de autenticação para conectores
/// </summary>
public class AuthenticationConfig
{
    public AuthenticationType Type { get; set; }
    public Dictionary<string, string> Parameters { get; set; } = new();

    /// <summary>
    /// Cria configuração OAuth2
    /// </summary>
    public static AuthenticationConfig CreateOAuth2(string tenantId, string clientId, string clientSecret)
    {
        return new AuthenticationConfig
        {
            Type = AuthenticationType.OAuth2,
            Parameters = new Dictionary<string, string>
            {
                { "tenant_id", tenantId },
                { "client_id", clientId },
                { "client_secret", clientSecret }
            }
        };
    }

    /// <summary>
    /// Cria configuração de autenticação via cookies do browser
    /// </summary>
    public static AuthenticationConfig CreateBrowserCookies(
        BrowserCookieExtractor.Browser browser,
        string cookieDomain)
    {
        return new AuthenticationConfig
        {
            Type = AuthenticationType.BrowserCookies,
            Parameters = new Dictionary<string, string>
            {
                { "browser_type", browser.ToString().ToLower() },
                { "cookie_domain", cookieDomain }
            }
        };
    }

    /// <summary>
    /// Cria configuração de autenticação básica
    /// </summary>
    public static AuthenticationConfig CreateBasicAuth(string username, string password)
    {
        return new AuthenticationConfig
        {
            Type = AuthenticationType.BasicAuth,
            Parameters = new Dictionary<string, string>
            {
                { "username", username },
                { "password", password }
            }
        };
    }

    /// <summary>
    /// Cria configuração com Bearer token
    /// </summary>
    public static AuthenticationConfig CreateBearerToken(string accessToken)
    {
        return new AuthenticationConfig
        {
            Type = AuthenticationType.BearerToken,
            Parameters = new Dictionary<string, string>
            {
                { "access_token", accessToken }
            }
        };
    }
}
