// @ts-nocheck
import type { AuthProfileDetailResponse } from "@/lib/authProfileApi";
import type { IntegrationFormState } from "@/components/integrations/useIntegrationFormState";

export type IntegrationConfigResult =
  | { configuration: Record<string, string> }
  | { errorKey: string };

const buildProfileConfig = async (
  state: IntegrationFormState,
  getProfile: (id: number) => Promise<AuthProfileDetailResponse>
): Promise<{ profileConfig: Record<string, string> } | { errorKey: string }> => {
  if (!state.authProfileId) {
    return { errorKey: "integrationProfileRequired" };
  }

  const profile = await getProfile(state.authProfileId);
  const profileConfig = profile?.config || {};
  const profileTenantId = profileConfig.tenantId || "";
  const profileClientId = profileConfig.clientId || "";
  const profileClientSecret = profileConfig.clientSecret || "";

  if (!profileTenantId || !profileClientId || !profileClientSecret) {
    return { errorKey: "integrationProfileInvalid" };
  }

  const profileTokenUrl = profileConfig.tokenUrl || "";
  const profileScopes = profileConfig.scopes || "";

  return {
    profileConfig: {
      tenant_id: profileTenantId,
      client_id: profileClientId,
      client_secret: profileClientSecret,
      token_url: profileTokenUrl,
      scopes: profileScopes,
      auth_profile_id: String(state.authProfileId),
      auth_type: "profile",
    },
  };
};

export const buildIntegrationConfig = async (
  state: IntegrationFormState,
  getProfile: (id: number) => Promise<AuthProfileDetailResponse>
): Promise<IntegrationConfigResult> => {
  if (!state.name.trim()) {
    return { errorKey: "integrationNameRequired" };
  }

  if (!state.connectorType) {
    return { errorKey: "integrationTypeRequired" };
  }

  if (state.connectorType === "Airflow") {
    if (!state.airflowBaseUrl.trim()) {
      return { errorKey: "integrationBaseUrlRequired" };
    }

    const config: Record<string, string> = {
      base_url: state.airflowBaseUrl.trim(),
    };

    if (state.airflowAuthType === "company-profile") {
      const profileResult = await buildProfileConfig(state, getProfile);
      if ("errorKey" in profileResult) {
        return profileResult;
      }
      Object.assign(config, profileResult.profileConfig);
      return { configuration: config };
    }

    if (state.airflowAuthType === "basic") {
      if (!state.airflowUsername.trim() || !state.airflowPassword.trim()) {
        return { errorKey: "integrationCredentialsRequired" };
      }
      config.username = state.airflowUsername.trim();
      config.password = state.airflowPassword.trim();
    } else if (state.airflowAuthType === "bearer") {
      if (!state.airflowToken.trim()) {
        return { errorKey: "integrationTokenRequired" };
      }
      config.token = state.airflowToken.trim();
    } else {
      config.auth_type = "browser_cookies";
      if (state.airflowCookieHeader.trim()) {
        config.cookie_header = state.airflowCookieHeader.trim();
      }
      if (state.airflowCookieDomain.trim()) {
        config.cookie_domain = state.airflowCookieDomain.trim();
      }
      if (state.airflowBrowserType) {
        config.browser_type = state.airflowBrowserType;
      }
      if (state.airflowBrowserProfile.trim()) {
        config.browser_profile = state.airflowBrowserProfile.trim();
      }
      if (state.airflowBrowserUserDataDir.trim()) {
        config.browser_user_data_dir = state.airflowBrowserUserDataDir.trim();
      }
    }

    return { configuration: config };
  }

  if (state.connectorType === "Synapse") {
    if (!state.synapseServer.trim()) {
      return { errorKey: "integrationServerRequired" };
    }
    if (!state.synapseDatabase.trim()) {
      return { errorKey: "integrationDatabaseRequired" };
    }

    const config: Record<string, string> = {
      server: state.synapseServer.trim(),
      database: state.synapseDatabase.trim(),
    };

    if (state.synapseAuthType === "company-profile") {
      const profileResult = await buildProfileConfig(state, getProfile);
      if ("errorKey" in profileResult) {
        return profileResult;
      }
      Object.assign(config, profileResult.profileConfig);
      return { configuration: config };
    }

    if (state.synapseAuthType === "basic") {
      if (!state.synapseUsername.trim() || !state.synapsePassword.trim()) {
        return { errorKey: "integrationCredentialsRequired" };
      }
      config.username = state.synapseUsername.trim();
      config.password = state.synapsePassword.trim();
    } else {
      if (!state.synapseToken.trim()) {
        return { errorKey: "integrationTokenRequired" };
      }
      config.token = state.synapseToken.trim();
    }

    return { configuration: config };
  }

  if (state.connectorType === "AzureDataFactory") {
    if (!state.subscriptionId.trim() || !state.resourceGroup.trim() || !state.factoryName.trim()) {
      return { errorKey: "integrationAdfRequired" };
    }

    const config: Record<string, string> = {
      subscription_id: state.subscriptionId.trim(),
      resource_group: state.resourceGroup.trim(),
      factory_name: state.factoryName.trim(),
    };

    if (state.adfAuthType === "cookie") {
      config.auth_type = "browser_cookies";
      if (state.adfCookieHeader.trim()) {
        config.cookie_header = state.adfCookieHeader.trim();
      }
      if (state.adfCookieDomain.trim()) {
        config.cookie_domain = state.adfCookieDomain.trim();
      }
      if (state.adfBrowserType) {
        config.browser_type = state.adfBrowserType;
      }
      if (state.adfBrowserProfile.trim()) {
        config.browser_profile = state.adfBrowserProfile.trim();
      }
      if (state.adfBrowserUserDataDir.trim()) {
        config.browser_user_data_dir = state.adfBrowserUserDataDir.trim();
      }
      return { configuration: config };
    }

    if (state.adfAuthType === "company-profile") {
      const profileResult = await buildProfileConfig(state, getProfile);
      if ("errorKey" in profileResult) {
        return profileResult;
      }
      Object.assign(config, profileResult.profileConfig);
      return { configuration: config };
    }

    if (!state.tenantId.trim() || !state.clientId.trim() || !state.clientSecret.trim()) {
      return { errorKey: "integrationSpnRequired" };
    }

    config.tenant_id = state.tenantId.trim();
    config.client_id = state.clientId.trim();
    config.client_secret = state.clientSecret.trim();
    return { configuration: config };
  }

  const config: Record<string, string> = {};
  if (state.databricksWorkspaceUrl.trim()) config.workspace_url = state.databricksWorkspaceUrl.trim();
  if (state.databricksHttpPath.trim()) config.http_path = state.databricksHttpPath.trim();
  if (state.databricksAuthType === "company-profile") {
    const profileResult = await buildProfileConfig(state, getProfile);
    if ("errorKey" in profileResult) {
      return profileResult;
    }
    Object.assign(config, profileResult.profileConfig);
  } else if (state.databricksAuthType === "cookie") {
    config.auth_type = "browser_cookies";
    if (state.databricksCookieHeader.trim()) {
      config.cookie_header = state.databricksCookieHeader.trim();
    }
    if (state.databricksCookieDomain.trim()) {
      config.cookie_domain = state.databricksCookieDomain.trim();
    } else if (state.databricksWorkspaceUrl.trim()) {
      try {
        config.cookie_domain = new URL(state.databricksWorkspaceUrl.trim()).hostname;
      } catch {
        // leave unset to trigger validation error
      }
    }
    if (state.databricksBrowserType) {
      config.browser_type = state.databricksBrowserType;
    }
    if (state.databricksBrowserProfile.trim()) {
      config.browser_profile = state.databricksBrowserProfile.trim();
    }
    if (state.databricksBrowserUserDataDir.trim()) {
      config.browser_user_data_dir = state.databricksBrowserUserDataDir.trim();
    }
  } else if (state.databricksToken.trim()) {
    config.token = state.databricksToken.trim();
  }
  return { configuration: config };
};
