import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { discovery, getAzureProfiles, checkUserExists, type AzureProfileInfo } from "@/features/auth/api";
import { useLogin } from "@/features/auth/useLogin";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";

export default function LoginPage() {
  const { mutate: login, isPending: isLoggingIn } = useLogin();
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [step, setStep] = useState<"email" | "password">("email");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [authMethod, setAuthMethod] = useState<"Local" | "WindowsAd" | "AzureAd">("Local");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [providerDisplayName, setProviderDisplayName] = useState<string | null>(null);
  const [azureProfiles, setAzureProfiles] = useState<AzureProfileInfo[]>([]);
  const [isLoadingAzureProfiles, setIsLoadingAzureProfiles] = useState(true);
  const [attemptingSilentSSO, setAttemptingSilentSSO] = useState(false);

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const applyAzureHints = (authUrl: string, emailValue: string) => {
    if (!emailValue) return authUrl;
    try {
      const url = new URL(authUrl);
      url.searchParams.set("login_hint", emailValue);
      const domain = emailValue.split("@")[1];
      if (domain) {
        url.searchParams.set("domain_hint", domain);
      }
      return url.toString();
    } catch {
      return authUrl;
    }
  };

  const applyAzurePrompt = (authUrl: string, prompt: string) => {
    try {
      const url = new URL(authUrl);
      url.searchParams.set("prompt", prompt);
      return url.toString();
    } catch {
      return authUrl;
    }
  };

  // Load Azure profiles and attempt silent SSO on mount
  useEffect(() => {
    const loadAzureProfilesAndAttemptSSO = async () => {
      try {
        const profiles = await getAzureProfiles();
        setAzureProfiles(profiles);

        // Attempt silent SSO if there are Azure profiles
        if (profiles.length > 0) {
          await attemptSilentSSO(profiles);
        }
      } catch (error) {
        console.error("Failed to load Azure profiles:", error);
      } finally {
        setIsLoadingAzureProfiles(false);
      }
    };

    loadAzureProfilesAndAttemptSSO();
  }, []);

  const attemptSilentSSO = async (profiles: AzureProfileInfo[]) => {
    // Try silent SSO with each profile
    for (const profile of profiles) {
      try {
        setAttemptingSilentSSO(true);

        // Create a hidden iframe to try silent authentication
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = profile.authUrl;

        // Add to DOM
        document.body.appendChild(iframe);

        // Wait a bit for potential redirect
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Remove iframe
        document.body.removeChild(iframe);

        // If we get here without redirect, the silent auth failed
        // Continue to next profile
      } catch (error) {
        console.log("Silent SSO attempt failed for", profile.name, error);
      }
    }

    setAttemptingSilentSSO(false);
  };

  const handleMicrosoftLogin = async () => {
    if (azureProfiles.length === 0) {
      if (!email) {
        showToast(
          t("loginMicrosoftEnterEmail") || "Enter your email to continue with Microsoft.",
          { variant: "destructive" }
        );
        return;
      }

      try {
        setIsDiscovering(true);

        const exists = await checkUserExists(email);
        if (!exists) {
          showToast(
            t("userNotRegistered") || "Your account is not registered. Please contact your administrator to request access.",
            { variant: "destructive" }
          );
          return;
        }

        const result = await discovery(email);
        if (result.authMethod === "AzureAd" && result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }

        showToast(
          t("loginMicrosoftUnavailable") || "No Azure AD profile is configured for this account.",
          { variant: "destructive" }
        );
      } catch (error) {
        console.error("Error discovering Azure AD profile:", error);
        showToast(
          t("errorCheckingUser") || "Error verifying your account. Please try again.",
          { variant: "destructive" }
        );
      } finally {
        setIsDiscovering(false);
      }

      return;
    }

    // If email is provided, validate before redirecting
    // If no email, redirect directly to Microsoft (let Azure handle validation)
    if (email) {
      try {
        setIsDiscovering(true);

        // Check if user exists in the system
        const exists = await checkUserExists(email);

        if (!exists) {
          showToast(
            t("userNotRegistered") || "Your account is not registered. Please contact your administrator to request access.",
            { variant: "destructive" }
          );
          setIsDiscovering(false);
          return;
        }

        // User exists, proceed with Microsoft login
        const baseUrl = azureProfiles[0].authUrl.replace('prompt=none', 'prompt=select_account');
        const authUrl = applyAzureHints(baseUrl, email);
        sessionStorage.setItem("azureAuthUrl", authUrl);
        window.location.href = authUrl;
      } catch (error) {
        console.error("Error checking user:", error);
        showToast(
          t("errorCheckingUser") || "Error verifying your account. Please try again.",
          { variant: "destructive" }
        );
        setIsDiscovering(false);
      }
    } else {
      // No email provided, redirect directly to Microsoft
      const baseUrl = azureProfiles[0].authUrl.replace('prompt=none', 'prompt=select_account');
      const authUrl = applyAzureHints(baseUrl, email);
      sessionStorage.setItem("azureAuthUrl", authUrl);
      window.location.href = authUrl;
    }
  };

  const handleDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsDiscovering(true);
    try {
      const result = await discovery(email);

      if (result.authMethod === "AzureAd" && result.redirectUrl) {
        const baseUrl = applyAzurePrompt(result.redirectUrl, "select_account");
        const authUrl = applyAzureHints(baseUrl, email);
        sessionStorage.setItem("azureAuthUrl", authUrl);
        window.location.href = authUrl;
        return;
      }

      setAuthMethod(result.authMethod);
      setCompanyName(result.companyName || null);
      setProviderDisplayName(result.providerDisplayName || null);
      setStep("password");
    } catch (err) {
      console.warn("Discovery failed, falling back to local", err);
      setAuthMethod("Local");
      setCompanyName(null);
      setProviderDisplayName(null);
      setStep("password");
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  const handleBack = () => {
    setStep("email");
    setPassword("");
    setAuthMethod("Local");
    setCompanyName(null);
    setProviderDisplayName(null);
  };

  if (attemptingSilentSSO || isLoadingAzureProfiles) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-blue-800 dark:border-t-blue-400"></div>
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950 overflow-hidden">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Theme toggle */}
      <div className="absolute right-6 top-6 flex items-center gap-2 z-10">
        <Button onClick={toggleTheme} variant="outline" className="gap-2 backdrop-blur-sm bg-white/50 dark:bg-slate-900/50 border-white/20 dark:border-slate-700/20">
          {theme === "dark" ? (
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" fill="currentColor" />
              <path
                d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.5-7.5-1.4 1.4M6 18l-1.4 1.4M18 18l-1.4-1.4M6 6 4.6 4.6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
              <path
                d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z"
                fill="currentColor"
              />
            </svg>
          )}
          {theme === "dark" ? t("themeLight") : t("themeDark")}
        </Button>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md border-white/20 dark:border-slate-700/20 shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 relative z-10">
        <CardHeader className="space-y-3">
          <div className="flex justify-center mb-2">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur-lg opacity-50"></div>
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
                <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24">
                  <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M4 20c1.5-3 5-5 8-5s6.5 2 8 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            {t("loginTitle")}
          </CardTitle>
          <CardDescription className="text-center text-base">{t("loginSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "email" ? (
            <>
              <form onSubmit={handleDiscovery} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    {t("username")}
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
                        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M4 20c1.5-3 5-5 8-5s6.5 2 8 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </div>
                    <Input
                      id="email"
                      type="text"
                      placeholder={t("loginUsernamePlaceholder") || "user@example.com"}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-lg hover:shadow-xl transition-all"
                  disabled={isDiscovering}
                >
                  {isDiscovering ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      {t("loading")}
                    </span>
                  ) : (
                    t("continue") || "Next"
                  )}
                </Button>
              </form>

              {/* Divider */}
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white dark:bg-slate-900 px-4 text-muted-foreground">
                      {t("or") || "or"}
                    </span>
                  </div>
                </div>

                {/* Microsoft Login Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleMicrosoftLogin}
                  className="w-full h-11 border-2 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                >
                  <span className="flex items-center gap-3">
                    <svg width="20" height="20" viewBox="0 0 23 23">
                      <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                      <path fill="#f35325" d="M1 1h10v10H1z"/>
                      <path fill="#81bc06" d="M12 1h10v10H12z"/>
                      <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                      <path fill="#ffba08" d="M12 12h10v10H12z"/>
                    </svg>
                    <span className="font-medium">
                      {t("continueWithMicrosoft") || "Continue with Microsoft"}
                    </span>
                  </span>
                </Button>
              </>
            </>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* User info badge */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-3 border border-blue-200/50 dark:border-blue-800/50">
                  <button type="button" onClick={handleBack} className="rounded-full hover:bg-white/50 dark:hover:bg-slate-800/50 p-1.5 transition-colors">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
                      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <span className="font-medium text-foreground truncate flex-1" title={email}>{email}</span>
                </div>

                {companyName && (
                  <div className="flex items-center gap-2 px-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" className="text-muted-foreground">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="2"/>
                      <polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    <span className="text-sm font-semibold">{companyName}</span>
                  </div>
                )}

                {providerDisplayName && (
                  <div className="flex items-center gap-2 px-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${authMethod === 'WindowsAd' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {providerDisplayName}
                    </span>
                  </div>
                )}
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  {t("password")}
                </Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
                      <path d="M6 10h12v10H6z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M8 10V7a4 4 0 1 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    className="pl-10 h-11"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(event) => setShowPassword(event.target.checked)}
                    className="rounded border-gray-300"
                  />
                  {t("showPassword")}
                </label>
              </div>

              {/* Login button */}
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-lg hover:shadow-xl transition-all"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    {t("loggingIn")}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
                      <path d="M10 7V5a2 2 0 0 1 2-2h6v18h-6a2 2 0 0 1-2-2v-2" fill="none" stroke="currentColor" strokeWidth="2" />
                      <path d="M14 12H3m0 0 3-3m-3 3 3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    {t("login")}
                  </span>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
