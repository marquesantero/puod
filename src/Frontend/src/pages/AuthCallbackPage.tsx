import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loginCallback } from "@/features/auth/api";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/contexts/I18nContext";

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  const applyAzurePrompt = (authUrl: string, prompt: string) => {
    try {
      const url = new URL(authUrl);
      url.searchParams.set("prompt", prompt);
      return url.toString();
    } catch {
      return authUrl;
    }
  };

  useEffect(() => {
    const processCallback = async () => {
      // Check for errors from Azure AD in query params
      const azureError = searchParams.get("error");
      const azureErrorDescription = searchParams.get("error_description");
      const isInIframe = window.self !== window.top;

      if (azureError) {
        // Only log error if this is a fresh callback (not a page refresh)
        if (!error) {
          console.error("Azure AD returned error:", azureError, azureErrorDescription);
        }

        // Parse error description to extract useful info
        let friendlyMessage = "Authentication failed. Please try again or contact support.";

        if (azureError === "interaction_required") {
          if (!isInIframe) {
            const storedAuthUrl = sessionStorage.getItem("azureAuthUrl");
            if (storedAuthUrl) {
              window.location.href = applyAzurePrompt(storedAuthUrl, "login");
              return;
            }
            // Clean URL params before redirecting to avoid error on refresh
            navigate("/login", { replace: true });
          }
          return;
        }

        if (azureError === "access_denied") {
          friendlyMessage = "Access was denied. You may have cancelled the login or don't have permission to access this application.";
        } else if (azureErrorDescription?.includes("AADSTS50020")) {
          // User doesn't exist in tenant
          const tenantMatch = azureErrorDescription.match(/tenant '([^']+)'/);
          const tenantName = tenantMatch ? tenantMatch[1] : "the organization";
          friendlyMessage = `Your account is not registered with ${tenantName}. Please contact your administrator to request access.`;
        } else if (azureErrorDescription) {
          // Show a cleaned up version of the error
          friendlyMessage = azureErrorDescription.split('\r\n')[0]; // First line only
        }

        setError(friendlyMessage);
        // Clean URL to prevent error logs on refresh
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      const code = searchParams.get("code");
      const state = searchParams.get("state");

      if (!code || !state) {
        setError("Invalid callback parameters. Please try logging in again.");
        return;
      }

      try {
        const response = await loginCallback(code, state);

        // Save tokens
        localStorage.setItem("accessToken", response.accessToken);
        localStorage.setItem("refreshToken", response.refreshToken);

        sessionStorage.removeItem("azureAuthUrl");
        showToast(t("loginSuccess") || "Login successful", { variant: "success" });
        navigate("/dashboard");
      } catch (err: any) {
        console.error("Callback error", err);

        // Extract friendly error message
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          "Failed to process login. Please try again or contact support.";

        setError(errorMessage);
      }
    };

    processCallback();
  }, [searchParams, navigate, showToast, t]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950 p-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-4 border border-red-200 dark:border-red-800 p-8 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl">
            {/* Error Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-rose-600 rounded-full blur-lg opacity-50"></div>
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </div>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-foreground">
              {t("authenticationFailed") || "Authentication Failed"}
            </h1>

            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg p-4">
              <p className="text-sm text-foreground leading-relaxed">{error}</p>
            </div>

            <div className="pt-4 space-y-3">
              <button
                onClick={() => navigate("/login")}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
                {t("backToLogin") || "Back to Login"}
              </button>

              <p className="text-xs text-muted-foreground">
                {t("needHelp") || "Need help?"}{" "}
                <span className="font-medium">
                  {t("contactAdministrator") || "Contact your administrator"}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-blue-800 dark:border-t-blue-400"></div>
        <p className="text-sm text-muted-foreground">
          {t("authenticating") || "Authenticating..."}
        </p>
      </div>
    </div>
  );
}
