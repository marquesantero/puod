import { useCallback, useMemo, useState } from "react";
import type { ConnectorType } from "@/lib/biIntegrationApi";

export type AirflowAuthType = "cookie" | "basic" | "bearer" | "company-profile";
export type SynapseAuthType = "basic" | "bearer" | "company-profile";
export type AdfAuthType = "service-principal" | "company-profile" | "cookie";
export type DatabricksAuthType = "pat" | "company-profile" | "cookie";
export type BrowserType = "auto" | "vivaldi" | "chrome" | "edge";

export type IntegrationFormState = {
  name: string;
  connectorType: ConnectorType;
  isActive: boolean;
  airflowAuthType: AirflowAuthType;
  airflowBaseUrl: string;
  airflowUsername: string;
  airflowPassword: string;
  airflowToken: string;
  airflowCookieHeader: string;
  airflowCookieDomain: string;
  airflowBrowserType: BrowserType;
  airflowBrowserProfile: string;
  airflowBrowserUserDataDir: string;
  synapseAuthType: SynapseAuthType;
  synapseServer: string;
  synapseDatabase: string;
  synapseUsername: string;
  synapsePassword: string;
  synapseToken: string;
  adfAuthType: AdfAuthType;
  subscriptionId: string;
  resourceGroup: string;
  factoryName: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  adfCookieHeader: string;
  adfCookieDomain: string;
  adfBrowserType: BrowserType;
  adfBrowserProfile: string;
  adfBrowserUserDataDir: string;
  authProfileId: number;
  databricksAuthType: DatabricksAuthType;
  databricksWorkspaceUrl: string;
  databricksHttpPath: string;
  databricksToken: string;
  databricksCookieHeader: string;
  databricksCookieDomain: string;
  databricksBrowserType: BrowserType;
  databricksBrowserProfile: string;
  databricksBrowserUserDataDir: string;
};

const createInitialState = (connectorType: ConnectorType): IntegrationFormState => ({
  name: "",
  connectorType,
  isActive: true,
  airflowAuthType: "cookie",
  airflowBaseUrl: "",
  airflowUsername: "",
  airflowPassword: "",
  airflowToken: "",
  airflowCookieHeader: "",
  airflowCookieDomain: "",
  airflowBrowserType: "auto",
  airflowBrowserProfile: "",
  airflowBrowserUserDataDir: "",
  synapseAuthType: "basic",
  synapseServer: "",
  synapseDatabase: "",
  synapseUsername: "",
  synapsePassword: "",
  synapseToken: "",
  adfAuthType: "service-principal",
  subscriptionId: "",
  resourceGroup: "",
  factoryName: "",
  tenantId: "",
  clientId: "",
  clientSecret: "",
  adfCookieHeader: "",
  adfCookieDomain: "",
  adfBrowserType: "auto",
  adfBrowserProfile: "",
  adfBrowserUserDataDir: "",
  authProfileId: 0,
  databricksAuthType: "pat",
  databricksWorkspaceUrl: "",
  databricksHttpPath: "",
  databricksToken: "",
  databricksCookieHeader: "",
  databricksCookieDomain: "",
  databricksBrowserType: "auto",
  databricksBrowserProfile: "",
  databricksBrowserUserDataDir: "",
});

export const useIntegrationFormState = (initialType: ConnectorType = "Databricks") => {
  const initialState = useMemo(() => createInitialState(initialType), [initialType]);
  const [state, setState] = useState<IntegrationFormState>(initialState);

  const setField = useCallback(<K extends keyof IntegrationFormState>(
    key: K,
    value: IntegrationFormState[K]
  ) => {
    setState((current) => ({ ...current, [key]: value }));
  }, []);

  const setFields = useCallback((fields: Partial<IntegrationFormState>) => {
    setState((current) => ({ ...current, ...fields }));
  }, []);

  const resetForm = useCallback(() => {
    setState(createInitialState(initialType));
  }, [initialType]);

  const applyConfiguration = useCallback((type: ConnectorType, configuration: Record<string, string>) => {
    if (type === "Airflow") {
      const storedProfileId = Number(configuration.auth_profile_id || 0);
      setState((current) => ({
        ...current,
        connectorType: type,
        airflowBaseUrl: configuration.base_url || "",
        airflowUsername: configuration.username || "",
        airflowPassword: configuration.password || "",
        airflowToken: configuration.token || "",
        airflowCookieHeader: configuration.cookie_header || "",
        airflowCookieDomain: configuration.cookie_domain || "",
        airflowBrowserType: (configuration.browser_type as BrowserType) || "auto",
        airflowBrowserProfile: configuration.browser_profile || "",
        airflowBrowserUserDataDir: configuration.browser_user_data_dir || "",
        authProfileId: storedProfileId,
        airflowAuthType: storedProfileId
          ? "company-profile"
          : configuration.auth_type === "browser_cookies" || configuration.cookie_header
            ? "cookie"
            : configuration.username || configuration.password
              ? "basic"
              : configuration.token
                ? "bearer"
                : "cookie",
      }));
      return;
    }

    if (type === "Synapse") {
      const storedProfileId = Number(configuration.auth_profile_id || 0);
      setState((current) => ({
        ...current,
        connectorType: type,
        synapseServer: configuration.server || "",
        synapseDatabase: configuration.database || "",
        synapseUsername: configuration.username || "",
        synapsePassword: configuration.password || "",
        synapseToken: configuration.token || "",
        authProfileId: storedProfileId,
        synapseAuthType: storedProfileId
          ? "company-profile"
          : configuration.token
            ? "bearer"
            : "basic",
      }));
      return;
    }

    if (type === "AzureDataFactory") {
      const storedProfileId = Number(configuration.auth_profile_id || 0);
      setState((current) => ({
        ...current,
        connectorType: type,
        subscriptionId: configuration.subscription_id || "",
        resourceGroup: configuration.resource_group || "",
        factoryName: configuration.factory_name || "",
        tenantId: configuration.tenant_id || "",
        clientId: configuration.client_id || "",
        clientSecret: configuration.client_secret || "",
        adfCookieHeader: configuration.cookie_header || "",
        adfCookieDomain: configuration.cookie_domain || "",
        adfBrowserType: (configuration.browser_type as BrowserType) || "auto",
        adfBrowserProfile: configuration.browser_profile || "",
        adfBrowserUserDataDir: configuration.browser_user_data_dir || "",
        authProfileId: storedProfileId,
        adfAuthType: storedProfileId
          ? "company-profile"
          : configuration.auth_type === "browser_cookies" || configuration.cookie_header
            ? "cookie"
            : "service-principal",
      }));
      return;
    }

    const storedProfileId = Number(configuration.auth_profile_id || 0);
    setState((current) => ({
      ...current,
      connectorType: type,
      databricksWorkspaceUrl: configuration.workspace_url || "",
      databricksHttpPath: configuration.http_path || "",
      databricksToken: configuration.token || "",
      databricksCookieHeader: configuration.cookie_header || "",
      databricksCookieDomain: configuration.cookie_domain || "",
      databricksBrowserType: (configuration.browser_type as BrowserType) || "auto",
      databricksBrowserProfile: configuration.browser_profile || "",
      databricksBrowserUserDataDir: configuration.browser_user_data_dir || "",
      authProfileId: storedProfileId,
      databricksAuthType: storedProfileId
        ? "company-profile"
        : configuration.auth_type === "browser_cookies" || configuration.cookie_header
          ? "cookie"
          : "pat",
    }));
  }, []);

  return {
    state,
    setField,
    setFields,
    resetForm,
    applyConfiguration,
  };
};
