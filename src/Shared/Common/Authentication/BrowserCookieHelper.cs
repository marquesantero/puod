using System;
using System.Collections.Generic;

namespace Puod.Shared.Common.Authentication;

public static class BrowserCookieHelper
{
    private static readonly BrowserCookieExtractor.Browser[] AutoBrowsers =
    {
        BrowserCookieExtractor.Browser.Vivaldi,
        BrowserCookieExtractor.Browser.Chrome,
        BrowserCookieExtractor.Browser.Edge
    };

    public static bool TryGetCookieHeader(
        IDictionary<string, string> config,
        string defaultDomain,
        out string cookieHeader,
        out string? usedBrowser,
        out string? errorMessage)
    {
        cookieHeader = string.Empty;
        usedBrowser = null;
        errorMessage = null;

        var cookieDomain = GetValue(config, "cookie_domain");
        if (string.IsNullOrWhiteSpace(cookieDomain))
        {
            cookieDomain = defaultDomain;
        }

        var browserProfile = GetValue(config, "browser_profile");
        if (string.IsNullOrWhiteSpace(browserProfile))
        {
            browserProfile = "Default";
        }

        var userDataDir = GetValue(config, "browser_user_data_dir");
        var browserTypeRaw = GetValue(config, "browser_type");
        var candidates = ResolveBrowsers(browserTypeRaw);

        foreach (var browser in candidates)
        {
            try
            {
                var extractor = new BrowserCookieExtractor(browser, browserProfile, userDataDir);
                var header = extractor.ExtractCookieHeader(cookieDomain);
                if (!string.IsNullOrWhiteSpace(header))
                {
                    cookieHeader = header;
                    usedBrowser = browser.ToString().ToLowerInvariant();
                    return true;
                }

                errorMessage = $"No cookies found for domain {cookieDomain} in profile {browserProfile}.";
            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
            }
        }

        return false;
    }

    private static IEnumerable<BrowserCookieExtractor.Browser> ResolveBrowsers(string? browserTypeRaw)
    {
        if (string.IsNullOrWhiteSpace(browserTypeRaw))
        {
            return AutoBrowsers;
        }

        var normalized = browserTypeRaw.Trim().ToLowerInvariant();
        return normalized switch
        {
            "vivaldi" => new[] { BrowserCookieExtractor.Browser.Vivaldi },
            "chrome" => new[] { BrowserCookieExtractor.Browser.Chrome },
            "edge" => new[] { BrowserCookieExtractor.Browser.Edge },
            "auto" => AutoBrowsers,
            _ => AutoBrowsers
        };
    }

    private static string? GetValue(IDictionary<string, string> config, string key)
    {
        return config.TryGetValue(key, out var value) ? value : null;
    }
}
