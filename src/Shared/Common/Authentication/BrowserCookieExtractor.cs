using System.Data.SQLite;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;

namespace Puod.Shared.Common.Authentication;

/// <summary>
/// Extrai cookies de browsers baseados em Chromium (Vivaldi, Chrome, Edge)
/// para autenticação em APIs que usam sessão do browser
/// </summary>
public class BrowserCookieExtractor
{
    private readonly string _browserName;
    private readonly string _cookiesPath;
    private readonly string? _userDataDirOverride;

    public enum Browser
    {
        Vivaldi,
        Chrome,
        Edge
    }

    public BrowserCookieExtractor(Browser browser)
    {
        _browserName = browser.ToString();
        _userDataDirOverride = null;
        _cookiesPath = GetCookiesPath(browser, null, null);
    }

    public BrowserCookieExtractor(Browser browser, string? profileName)
    {
        _browserName = browser.ToString();
        _userDataDirOverride = null;
        _cookiesPath = GetCookiesPath(browser, profileName, null);
    }

    public BrowserCookieExtractor(Browser browser, string? profileName, string? userDataDirOverride)
    {
        _browserName = browser.ToString();
        _userDataDirOverride = string.IsNullOrWhiteSpace(userDataDirOverride) ? null : userDataDirOverride;
        _cookiesPath = GetCookiesPath(browser, profileName, _userDataDirOverride);
    }

    /// <summary>
    /// Retorna o caminho do arquivo de cookies do browser
    /// </summary>
    private static string GetCookiesPath(Browser browser, string? profileName, string? userDataDirOverride)
    {
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var profile = string.IsNullOrWhiteSpace(profileName) ? "Default" : profileName;

        var userDataDir = userDataDirOverride ?? browser switch
        {
            Browser.Vivaldi => Path.Combine(localAppData, "Vivaldi", "User Data"),
            Browser.Chrome => Path.Combine(localAppData, "Google", "Chrome", "User Data"),
            Browser.Edge => Path.Combine(localAppData, "Microsoft", "Edge", "User Data"),
            _ => throw new NotSupportedException($"Browser {browser} n?o suportado")
        };

        return Path.Combine(userDataDir, profile, "Network", "Cookies");
    }


    private static string? GetAlternateCookiesPath(string cookiesPath)
    {
        var marker = $"{Path.DirectorySeparatorChar}Network{Path.DirectorySeparatorChar}Cookies";
        if (!cookiesPath.EndsWith(marker, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return cookiesPath[..^marker.Length] + $"{Path.DirectorySeparatorChar}Cookies";
    }

    private static List<string> BuildDomainPatterns(string domain)
    {
        var results = new List<string>();
        if (string.IsNullOrWhiteSpace(domain))
        {
            return results;
        }

        var normalized = domain.Trim();
        if (normalized.StartsWith(".", StringComparison.Ordinal))
        {
            normalized = normalized.TrimStart('.');
        }

        void AddPattern(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return;
            }

            results.Add($"%{value}%");
            results.Add($"%.{value}%");
        }

        AddPattern(normalized);

        var parent = GetParentDomain(normalized);
        if (!string.IsNullOrWhiteSpace(parent))
        {
            AddPattern(parent);
        }

        return results;
    }

    private static string? GetParentDomain(string domain)
    {
        var parts = domain.Split('.', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 2)
        {
            return null;
        }

        return string.Join('.', parts, 1, parts.Length - 1);
    }

    /// <summary>
    /// Extrai cookies de um domínio específico
    /// </summary>
    /// <param name="domain">Domínio (ex: ".portal.azure.com", ".airflow.mydomain.com")</param>
    /// <returns>Dicionário com nome e valor dos cookies</returns>
    public Dictionary<string, string> ExtractCookies(string domain)
    {
        var cookiesPath = _cookiesPath;
        var alternateCookiesPath = GetAlternateCookiesPath(cookiesPath);

        if (!File.Exists(cookiesPath) && alternateCookiesPath != null && File.Exists(alternateCookiesPath))
        {
            cookiesPath = alternateCookiesPath;
        }

        if (!File.Exists(cookiesPath))
        {
            throw new FileNotFoundException($"Arquivo de cookies n?o encontrado: {cookiesPath}");
        }

        try
        {
            return ReadCookiesFromDatabase(cookiesPath, domain);
        }
        catch (Exception)
        {
            try
            {
                return ReadCookiesFromDatabase(cookiesPath, domain, true);
            }
            catch (Exception)
            {
            }
        }

        if (alternateCookiesPath != null && File.Exists(alternateCookiesPath))
        {
            try
            {
                return ReadCookiesFromDatabase(alternateCookiesPath, domain);
            }
            catch (Exception)
            {
            }
        }

        var tempCookiesPath = Path.Combine(Path.GetTempPath(), $"cookies_{Guid.NewGuid():N}.db");
        try
        {
            CopyFileAllowingRead(cookiesPath, tempCookiesPath);
        }
        catch (IOException) when (alternateCookiesPath != null &&
                                  File.Exists(alternateCookiesPath) &&
                                  !string.Equals(cookiesPath, alternateCookiesPath, StringComparison.OrdinalIgnoreCase))
        {
            CopyFileAllowingRead(alternateCookiesPath, tempCookiesPath);
            cookiesPath = alternateCookiesPath;
        }

        try
        {
            return ReadCookiesFromDatabase(tempCookiesPath, domain);
        }
        finally
        {
            if (File.Exists(tempCookiesPath))
            {
                File.Delete(tempCookiesPath);
            }
        }
    }

    /// <summary>
    /// Lê cookies do banco SQLite
    /// </summary>
    private Dictionary<string, string> ReadCookiesFromDatabase(string dbPath, string domain, bool useImmutable = false)
    {
        var cookies = new Dictionary<string, string>();
        var normalizedPath = dbPath.Replace('\\', '/');
        var connectionString = useImmutable
            ? $"Data Source=file:{normalizedPath}?immutable=1;Version=3;Read Only=True;Uri=True;Mode=ReadOnly;Cache=Shared;"
            : $"Data Source={dbPath};Version=3;Read Only=True;Mode=ReadOnly;Cache=Shared;";

        using var connection = new SQLiteConnection(connectionString);
        connection.Open();

        var domainPatterns = BuildDomainPatterns(domain);
        if (domainPatterns.Count == 0)
        {
            return cookies;
        }

        var whereClauses = new List<string>();
        for (var i = 0; i < domainPatterns.Count; i++)
        {
            whereClauses.Add($"host_key LIKE @domain{i}");
        }

        // Query para buscar cookies do dom?nio
        var query = $@"
            SELECT name, encrypted_value, value, host_key, expires_utc
            FROM cookies
            WHERE {string.Join(" OR ", whereClauses)}
            ORDER BY creation_utc DESC";

        using var command = new SQLiteCommand(query, connection);
        for (var i = 0; i < domainPatterns.Count; i++)
        {
            command.Parameters.AddWithValue($"@domain{i}", domainPatterns[i]);
        }

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var name = reader.GetString(0);
            var encryptedValue = reader["encrypted_value"] as byte[];
            var plainValue = reader["value"] as string;
            var expiresUtc = reader.GetInt64(4);

            // Verifica se cookie não expirou
            var expirationDate = DateTimeOffset.FromUnixTimeSeconds(expiresUtc / 1000000 - 11644473600);
            if (expirationDate < DateTimeOffset.UtcNow)
            {
                continue; // Cookie expirado
            }

            string cookieValue;

            // Tenta descriptografar valor encriptado
            if (encryptedValue != null && encryptedValue.Length > 0)
            {
                cookieValue = DecryptCookieValue(encryptedValue);
            }
            else
            {
                cookieValue = plainValue ?? string.Empty;
            }

            if (!string.IsNullOrEmpty(cookieValue))
            {
                cookies[name] = cookieValue;
            }
        }

        return cookies;
    }

    /// <summary>
    /// Copia arquivo permitindo leitura mesmo com lock do browser.
    /// </summary>
    private static void CopyFileAllowingRead(string sourcePath, string destinationPath)
    {
        const int maxAttempts = 3;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                using var sourceStream = new FileStream(
                    sourcePath,
                    FileMode.Open,
                    FileAccess.Read,
                    FileShare.ReadWrite | FileShare.Delete);

                using var destinationStream = new FileStream(
                    destinationPath,
                    FileMode.Create,
                    FileAccess.Write,
                    FileShare.None);

                sourceStream.CopyTo(destinationStream);
                return;
            }
            catch (IOException) when (attempt < maxAttempts)
            {
                Thread.Sleep(150 * attempt);
            }
        }
    }

    /// <summary>
    /// Descriptografa valor do cookie usando DPAPI (Windows)
    /// Chromium usa DPAPI para proteger cookies
    /// </summary>
    private string DecryptCookieValue(byte[] encryptedData)
    {
        try
        {
            if (!OperatingSystem.IsWindows())
            {
                return string.Empty;
            }

            // Chromium v80+ usa prefixo "v10" ou "v11" para AES encryption
            if (encryptedData.Length >= 3)
            {
                var prefix = Encoding.UTF8.GetString(encryptedData, 0, 3);

                if (prefix == "v10" || prefix == "v11")
                {
                    // Remove prefixo (3 bytes) e nonce (12 bytes)
                    var nonce = new byte[12];
                    Array.Copy(encryptedData, 3, nonce, 0, 12);

                    var ciphertext = new byte[encryptedData.Length - 15];
                    Array.Copy(encryptedData, 15, ciphertext, 0, ciphertext.Length);

                    // Busca chave de encriptação do browser
                    var key = GetEncryptionKey();
                    if (key != null)
                    {
                        return DecryptAesGcm(ciphertext, key, nonce);
                    }
                }
            }

            // Fallback para DPAPI (versões antigas do Chromium)
            var decryptedData = ProtectedData.Unprotect(encryptedData, null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(decryptedData);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Erro ao descriptografar cookie: {ex.Message}");
            return string.Empty;
        }
    }

    /// <summary>
    /// Busca chave de encriptação AES do browser (Local State file)
    /// </summary>
    private byte[]? GetEncryptionKey()
    {
        try
        {
            if (!OperatingSystem.IsWindows())
            {
                return null;
            }

            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var localStatePath = _userDataDirOverride != null
                ? Path.Combine(_userDataDirOverride, "Local State")
                : _browserName switch
                {
                    "Vivaldi" => Path.Combine(localAppData, @"Vivaldi\User Data\Local State"),
                    "Chrome" => Path.Combine(localAppData, @"Google\Chrome\User Data\Local State"),
                    "Edge" => Path.Combine(localAppData, @"Microsoft\Edge\User Data\Local State"),
                    _ => null
                };

            if (localStatePath == null || !File.Exists(localStatePath))
            {
                return null;
            }

            var localStateJson = File.ReadAllText(localStatePath);

            // Parsing simples do JSON para extrair encrypted_key
            var encryptedKeyMatch = System.Text.RegularExpressions.Regex.Match(
                localStateJson,
                @"""encrypted_key""\s*:\s*""([^""]+)""");

            if (!encryptedKeyMatch.Success)
            {
                return null;
            }

            var encryptedKeyBase64 = encryptedKeyMatch.Groups[1].Value;
            var encryptedKey = Convert.FromBase64String(encryptedKeyBase64);

            // Remove prefixo "DPAPI" (5 bytes)
            var keyWithoutPrefix = new byte[encryptedKey.Length - 5];
            Array.Copy(encryptedKey, 5, keyWithoutPrefix, 0, keyWithoutPrefix.Length);

            // Descriptografa usando DPAPI
            return ProtectedData.Unprotect(keyWithoutPrefix, null, DataProtectionScope.CurrentUser);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Descriptografa usando AES-GCM (Chromium v80+)
    /// </summary>
    private string DecryptAesGcm(byte[] ciphertext, byte[] key, byte[] nonce)
    {
        try
        {
            // Tag fica nos últimos 16 bytes do ciphertext
            var tag = new byte[16];
            var actualCiphertext = new byte[ciphertext.Length - 16];

            Array.Copy(ciphertext, 0, actualCiphertext, 0, actualCiphertext.Length);
            Array.Copy(ciphertext, actualCiphertext.Length, tag, 0, 16);

            var plaintext = new byte[actualCiphertext.Length];

            using var aesGcm = new AesGcm(key, 16);
            aesGcm.Decrypt(nonce, actualCiphertext, tag, plaintext);

            return Encoding.UTF8.GetString(plaintext);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Erro ao descriptografar AES-GCM: {ex.Message}");
            return string.Empty;
        }
    }

    /// <summary>
    /// Formata cookies para uso em header HTTP Cookie
    /// </summary>
    public static string FormatCookieHeader(Dictionary<string, string> cookies)
    {
        return string.Join("; ", cookies.Select(kvp => $"{SanitizeToken(kvp.Key)}={SanitizeCookieValue(kvp.Value)}"));
    }

    private static string SanitizeToken(string value)
    {
        return IsAsciiToken(value) ? value : Uri.EscapeDataString(value);
    }

    private static string SanitizeCookieValue(string value)
    {
        return IsAsciiToken(value) ? value : Uri.EscapeDataString(value);
    }

    private static bool IsAsciiToken(string value)
    {
        foreach (var ch in value)
        {
            if (ch < 0x20 || ch > 0x7E)
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>
    /// Extrai cookies e retorna já formatados para header HTTP
    /// </summary>
    public string ExtractCookieHeader(string domain)
    {
        var cookies = ExtractCookies(domain);
        return FormatCookieHeader(cookies);
    }
}
