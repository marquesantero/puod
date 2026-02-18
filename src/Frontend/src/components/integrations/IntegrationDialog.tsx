// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import { testConnection, type ConnectorType, type IntegrationDetailResponse } from "@/lib/biIntegrationApi";
import { getAuthProfile, type AuthProfileListResponse } from "@/lib/authProfileApi";
import { useIntegrationFormState } from "@/components/integrations/useIntegrationFormState";
import { buildIntegrationConfig } from "@/components/integrations/integrationConfig";
import {
  AdfFields,
  AirflowFields,
  DatabricksFields,
  SynapseFields,
} from "@/components/integrations/IntegrationFormSections";

type IntegrationDialogProps = {
  open: boolean;
  authProfiles: AuthProfileListResponse[];
  initialDetail?: IntegrationDetailResponse | null;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    type: ConnectorType;
    isActive: boolean;
    configuration: Record<string, string>;
  }) => Promise<void>;
  extraFields?: React.ReactNode;
};

export const IntegrationDialog = ({
  open,
  authProfiles,
  initialDetail,
  onClose,
  onSave,
  extraFields,
}: IntegrationDialogProps) => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { state, setField, setFields, resetForm, applyConfiguration } = useIntegrationFormState();
  const [showSecret, setShowSecret] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const [lastTestKey, setLastTestKey] = useState<string | null>(null);
  const [lastTestSuccess, setLastTestSuccess] = useState(false);
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [syncingCookies, setSyncingCookies] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const pendingCookieRequest = useRef<string | null>(null);
  const pendingTimeout = useRef<number | null>(null);
  const extensionPath = "tools/puod-cookie-extension";
  const isAirflowCookie = state.connectorType === "Airflow" && state.airflowAuthType === "cookie";
  const isAdfCookie = state.connectorType === "AzureDataFactory" && state.adfAuthType === "cookie";
  const isDatabricksCookie = state.connectorType === "Databricks" && state.databricksAuthType === "cookie";
  const isCookieAuth = isAirflowCookie || isAdfCookie || isDatabricksCookie;
  const showSecretToggle = (() => {
    if (state.connectorType === "Airflow") {
      return state.airflowAuthType === "basic" || state.airflowAuthType === "bearer";
    }
    if (state.connectorType === "Synapse") {
      return state.synapseAuthType === "basic" || state.synapseAuthType === "bearer";
    }
    if (state.connectorType === "AzureDataFactory") {
      return state.adfAuthType === "service-principal";
    }
    if (state.connectorType === "Databricks") {
      return state.databricksAuthType === "pat";
    }
    return false;
  })();

  useEffect(() => {
    if (!open) return;

    setShowSecret(false);
    setTestFeedback(null);
    setLastTestKey(null);
    setLastTestSuccess(false);
    setSyncFeedback(null);

    if (initialDetail) {
      resetForm();
      setFields({
        name: initialDetail.name,
        connectorType: initialDetail.type,
        isActive: initialDetail.isActive,
      });
      applyConfiguration(initialDetail.type, initialDetail.configuration || {});
      return;
    }

    resetForm();
  }, [open, initialDetail, resetForm, setFields, applyConfiguration]);

  useEffect(() => {
    if (!open) return;

    const checkInstalled = () => {
      const marker = (window as typeof window & { __PUOD_COOKIE_BRIDGE__?: boolean }).__PUOD_COOKIE_BRIDGE__;
      const datasetFlag = document.documentElement.dataset.puodCookieBridge === "1";
      setExtensionInstalled(Boolean(marker || datasetFlag));
    };

    checkInstalled();
    window.addEventListener("puod-cookie-bridge-ready", checkInstalled);
    return () => {
      window.removeEventListener("puod-cookie-bridge-ready", checkInstalled);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "PUOD_COOKIE_RESPONSE") return;
      if (!pendingCookieRequest.current || data.requestId !== pendingCookieRequest.current) return;

      if (data.success && data.cookieHeader) {
        if (state.connectorType === "Airflow" && state.airflowAuthType === "cookie") {
          setField("airflowCookieHeader", data.cookieHeader);
        }
        if (state.connectorType === "AzureDataFactory" && state.adfAuthType === "cookie") {
          setField("adfCookieHeader", data.cookieHeader);
        }
        if (state.connectorType === "Databricks" && state.databricksAuthType === "cookie") {
          setField("databricksCookieHeader", data.cookieHeader);
        }
        showToast(t("integrationExtensionSyncSuccess"), { variant: "success" });
        setSyncFeedback({ variant: "success", message: t("integrationExtensionSyncSuccess") });
      } else {
        const message = data.error || t("integrationExtensionSyncFailed");
        showToast(message, { variant: "destructive" });
        setSyncFeedback({ variant: "error", message });
      }

      pendingCookieRequest.current = null;
      if (pendingTimeout.current) {
        window.clearTimeout(pendingTimeout.current);
        pendingTimeout.current = null;
      }
      setSyncingCookies(false);
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [open, state, setField, showToast, t]);

  const copyExtensionPath = async () => {
    try {
      await navigator.clipboard.writeText(extensionPath);
      showToast(t("integrationExtensionCopied"), { variant: "success" });
    } catch (error) {
      console.error(error);
      showToast(t("integrationExtensionCopyFailed"), { variant: "destructive" });
    }
  };

  const handleInstallExtension = async () => {
    await copyExtensionPath();
  };

  const handleSyncCookies = () => {
    if (!extensionInstalled) {
      showToast(t("integrationExtensionNotInstalled"), { variant: "destructive" });
      setSyncFeedback({ variant: "error", message: t("integrationExtensionNotInstalled") });
      return;
    }

    if (!isCookieAuth) {
      showToast(t("integrationExtensionCookieNotSelected"), { variant: "destructive" });
      setSyncFeedback({ variant: "error", message: t("integrationExtensionCookieNotSelected") });
      return;
    }

    let domain = "";
    if (isAirflowCookie) {
      domain = state.airflowCookieDomain.trim();
      if (!domain) {
        try {
          domain = new URL(state.airflowBaseUrl).hostname;
        } catch {
          domain = "";
        }
      }
    } else if (isAdfCookie) {
      domain = state.adfCookieDomain.trim() || "portal.azure.com";
    } else if (isDatabricksCookie) {
      domain = state.databricksCookieDomain.trim();
      if (!domain) {
        try {
          domain = new URL(state.databricksWorkspaceUrl).hostname;
        } catch {
          domain = "";
        }
      }
    }

    if (!domain) {
      showToast(t("integrationExtensionDomainRequired"), { variant: "destructive" });
      setSyncFeedback({ variant: "error", message: t("integrationExtensionDomainRequired") });
      return;
    }

    setSyncFeedback(null);
    setSyncingCookies(true);
    const requestId = crypto.randomUUID();
    pendingCookieRequest.current = requestId;
    if (pendingTimeout.current) {
      window.clearTimeout(pendingTimeout.current);
    }
    pendingTimeout.current = window.setTimeout(() => {
      pendingCookieRequest.current = null;
      pendingTimeout.current = null;
      setSyncingCookies(false);
      showToast(t("integrationExtensionSyncFailed"), { variant: "destructive" });
      setSyncFeedback({ variant: "error", message: t("integrationExtensionSyncFailed") });
    }, 4000);
    window.postMessage({ type: "PUOD_COOKIE_REQUEST", domain, requestId }, "*");
  };

  const buildConfig = async () => {
    try {
      const result = await buildIntegrationConfig(state, getAuthProfile);
      if ("errorKey" in result) {
        showToast(t(result.errorKey), { variant: "destructive" });
        return null;
      }
      return result.configuration;
    } catch (error) {
      console.error(error);
      showToast(t("integrationProfileLoadError"), { variant: "destructive" });
      return null;
    }
  };

  const buildConfigKey = (configuration: Record<string, string>) => {
    const entries = Object.keys(configuration)
      .sort()
      .map((key) => [key, configuration[key] ?? ""]);
    return JSON.stringify(entries);
  };

  const handleSave = async () => {
    const configuration = await buildConfig();
    if (!configuration) return;
    const currentKey = buildConfigKey(configuration);
    if (!lastTestSuccess || lastTestKey !== currentKey) {
      const message = t("databaseTestRequired");
      showToast(message, { variant: "destructive" });
      setTestFeedback({ variant: "error", message });
      return;
    }
    await onSave({
      name: state.name.trim(),
      type: state.connectorType,
      isActive: state.isActive,
      configuration,
    });
  };

  const handleTestConnection = async () => {
    const configuration = await buildConfig();
    if (!configuration) return;

    setTestFeedback(null);
    setTestingConnection(true);
    try {
      const currentKey = buildConfigKey(configuration);
      const result = await testConnection({
        type: state.connectorType,
        configuration,
      });

      if (result.success) {
        showToast(t("integrationConnectionSuccess"), { variant: "success" });
        setTestFeedback({ variant: "success", message: t("integrationConnectionSuccess") });
        setLastTestKey(currentKey);
        setLastTestSuccess(true);
      } else {
        const message = result.errorMessage || t("integrationConnectionFailed");
        showToast(message, { variant: "destructive" });
        setTestFeedback({ variant: "error", message });
        setLastTestKey(null);
        setLastTestSuccess(false);
      }
    } catch (error) {
      console.error(error);
      showToast(t("integrationConnectionFailed"), { variant: "destructive" });
      setTestFeedback({ variant: "error", message: t("integrationConnectionFailed") });
      setLastTestKey(null);
      setLastTestSuccess(false);
    } finally {
      setTestingConnection(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background rounded-lg border shadow-xl p-6">
        <h2 className="text-xl font-bold mb-4">
          {initialDetail ? t("integrationsUpdate") : t("integrationsCreate")}
        </h2>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("integrationsName")}</Label>
              <Input value={state.name} onChange={(e) => setField("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("integrationsType")}</Label>
              <select
                disabled={!!initialDetail}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
                value={state.connectorType}
                onChange={(e) => setField("connectorType", e.target.value as ConnectorType)}
              >
                <option value="Databricks">{t("integrationConnectorDatabricks")}</option>
                <option value="Synapse">{t("integrationConnectorSynapse")}</option>
                <option value="Airflow">{t("integrationConnectorAirflow")}</option>
                <option value="AzureDataFactory">{t("integrationConnectorAdf")}</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              {t("integrationsActive")}
              <button
                type="button"
                onClick={() => setField("isActive", !state.isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  state.isActive
                    ? "bg-blue-600 dark:bg-blue-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    state.isActive ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </Label>
          </div>

          <div className="space-y-4 border rounded p-4 bg-muted/20">
            <Label className="text-sm font-semibold">
              {t("integrationsConfiguration")}
            </Label>

            {state.connectorType === "Airflow" && (
              <AirflowFields
                state={state}
                setField={setField}
                showSecret={showSecret}
                authProfiles={authProfiles}
              />
            )}
            {state.connectorType === "Synapse" && (
              <SynapseFields
                state={state}
                setField={setField}
                showSecret={showSecret}
                authProfiles={authProfiles}
              />
            )}
            {state.connectorType === "AzureDataFactory" && (
              <AdfFields
                state={state}
                setField={setField}
                showSecret={showSecret}
                authProfiles={authProfiles}
              />
            )}
            {state.connectorType === "Databricks" && (
              <DatabricksFields
                state={state}
                setField={setField}
                showSecret={showSecret}
                authProfiles={authProfiles}
              />
            )}

            {showSecretToggle ? (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-input bg-background text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  checked={showSecret}
                  onChange={(event) => setShowSecret(event.target.checked)}
                />
                {t("showPassword")}
              </label>
            ) : null}

            {extraFields}

            <div className="rounded-md border border-dashed border-border bg-background/40 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t("integrationExtensionTitle")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("integrationExtensionBody")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isCookieAuth ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSyncCookies}
                      disabled={syncingCookies}
                    >
                      {syncingCookies ? t("integrationExtensionSyncing") : t("integrationExtensionSync")}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant={extensionInstalled ? "outline" : "default"}
                    onClick={handleInstallExtension}
                    disabled={extensionInstalled}
                  >
                    {extensionInstalled
                      ? t("integrationExtensionInstalled")
                      : t("integrationExtensionInstall")}
                  </Button>
                </div>
              </div>
              {syncFeedback ? (
                <p
                  className={`text-xs ${
                    syncFeedback.variant === "success"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  }`}
                >
                  {syncFeedback.message}
                </p>
              ) : null}
              {!extensionInstalled ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{t("integrationExtensionPathLabel")}</span>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-foreground">
                      {t("integrationExtensionPath")}
                    </code>
                    <Button type="button" size="sm" variant="ghost" onClick={copyExtensionPath}>
                      {t("integrationExtensionCopyPath")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end pt-2 border-t mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testingConnection}
              >
                {testingConnection ? t("integrationTestingConnection") : t("integrationTestConnection")}
              </Button>
            </div>
            {testFeedback ? (
              <p
                className={`text-xs mt-2 ${
                  testFeedback.variant === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {testFeedback.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={handleSave}>
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
};
