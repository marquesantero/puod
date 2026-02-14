export type IntegrationType = "airflow" | "adf" | "api";

export type IntegrationGroup = {
  id: number;
  companyId: number;
  name: string;
  description?: string;
  createdAt: string;
};

export type IntegrationConfig = {
  type: IntegrationType;
  name: string;
  description?: string;
  baseUrl?: string;
  authType?: string;
  clientId?: string;
  tenantId?: string;
  clientSecret?: string;
  subscriptionId?: string;
  resourceGroup?: string;
  factoryName?: string;
  token?: string;
};

export type IntegrationItem = {
  id: number;
  groupId: number;
  companyId: number;
  type: IntegrationType;
  name: string;
  description?: string;
  status: "pending" | "ready" | "error";
  createdAt: string;
  config: IntegrationConfig;
  isInherited?: boolean;
};

export type IntegrationState = {
  groups: IntegrationGroup[];
  integrations: IntegrationItem[];
};

export type IntegrationCompany = {
  id: number;
  name: string;
  slug: string;
};
