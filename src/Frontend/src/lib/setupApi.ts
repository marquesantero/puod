import apiClient from "@/lib/api-client";

export type SetupStatus = {
  isConfigured: boolean;
  tenantCount: number;
  adminEmail?: string | null;
};

export type SetupInitializePayload = {
  tenantName?: string;
  tenantSlug?: string;
  companyName?: string;
  adminEmail: string;
  adminPassword?: string;
  adminName?: string;
  enableLocalAuth: boolean;
  enableWindowsAd: boolean;
  enableAzureAd: boolean;
  serviceGroupsCsv?: string;
  windowsAdDomain?: string;
  windowsAdLdapUrl?: string;
  windowsAdBaseDn?: string;
  windowsAdBindDn?: string;
  windowsAdBindPassword?: string;
  windowsAdUserFilter?: string;
  windowsAdGroupFilter?: string;
  windowsAdUseSsl?: boolean;
  windowsAdStartTls?: boolean;
  windowsAdTimeoutSeconds?: number;
  azureTenantId?: string;
  azureClientId?: string;
  azureClientSecret?: string;
  azureAuthUrl?: string;
  azureTokenUrl?: string;
  azureAuthority?: string;
  azureRedirectUri?: string;
  azureScopes?: string;
  azureIssuer?: string;
  azureUsePkce?: boolean;
};

export type SetupInitializeResponse = {
  tenantId: string;
  adminUserId: string;
  tenantSchema: string;
};

export type SetupStepState = {
  stepId: string;
  isCompleted: boolean;
  savedAt?: string | null;
  completedAt?: string | null;
  data: Record<string, string | null>;
};

export type SetupStepsResponse = {
  steps: SetupStepState[];
};

export type SetupStepSavePayload = {
  stepId: string;
  data: Record<string, string | null>;
  isCompleted: boolean;
};

export type SetupStepClearPayload = {
  stepId: string;
};

export type DatabaseBootstrapPayload = {
  provider: "postgres" | "postgres-docker" | "sqlserver" | "mysql";
  connectionString: string;
};

export type DatabaseBootstrapStatus = {
  provider: string;
  connectionStringMasked: string;
  updatedAt?: string | null;
  provisionedAt?: string | null;
};

export type DatabaseTestResponse = {
  success: boolean;
  message: string;
  elapsedMilliseconds: number;
};

export type DockerPostgresStartPayload = {
  connectionString: string;
  timeoutSeconds?: number;
};

export type DockerPostgresStartResponse = {
  success: boolean;
  message: string;
  elapsedMilliseconds: number;
};

export type DockerPostgresStatusResponse = {
  exists: boolean;
  running: boolean;
  status?: string;
  configured: boolean;
  username?: string;
};

export type DockerPostgresRecreatePayload = {
  connectionString: string;
  backup: boolean;
};

export type DockerPostgresRecreateResponse = {
  success: boolean;
  code: string;
  message: string;
  backupPath?: string;
};

export const getDockerPostgresBackupUrl = (fileName: string): string =>
  `/bootstrap/docker/postgres/backup?fileName=${encodeURIComponent(fileName)}`;

export const getSetupStatus = async (): Promise<SetupStatus> => {
  const response = await apiClient.get<SetupStatus>("/setup/status");
  return response.data;
};

export const getSetupSteps = async (): Promise<SetupStepsResponse> => {
  const response = await apiClient.get<SetupStepsResponse>("/setup/steps");
  return response.data;
};

export const saveSetupStep = async (payload: SetupStepSavePayload): Promise<void> => {
  await apiClient.post("/setup/steps/save", payload);
};

export const clearSetupStep = async (payload: SetupStepClearPayload): Promise<void> => {
  await apiClient.post("/setup/steps/clear", payload);
};

export const initializeSetup = async (
  payload: SetupInitializePayload
): Promise<SetupInitializeResponse> => {
  const response = await apiClient.post<SetupInitializeResponse>("/setup/initialize", payload);
  return response.data;
};

export const getDatabaseBootstrap = async (): Promise<DatabaseBootstrapStatus> => {
  const response = await apiClient.get<DatabaseBootstrapStatus>("/bootstrap/database");
  return response.data;
};

export const setDatabaseBootstrap = async (
  payload: DatabaseBootstrapPayload
): Promise<DatabaseBootstrapStatus> => {
  const response = await apiClient.post<DatabaseBootstrapStatus>("/bootstrap/database", payload);
  return response.data;
};

export const provisionDatabase = async (): Promise<DatabaseBootstrapStatus> => {
  const response = await apiClient.post<DatabaseBootstrapStatus>("/bootstrap/provision");
  return response.data;
};

export const testDatabaseConnection = async (
  payload: DatabaseBootstrapPayload
): Promise<DatabaseTestResponse> => {
  const response = await apiClient.post<DatabaseTestResponse>("/bootstrap/test-connection", payload);
  return response.data;
};

export const startDockerPostgres = async (
  payload: DockerPostgresStartPayload
): Promise<DockerPostgresStartResponse> => {
  const response = await apiClient.post<DockerPostgresStartResponse>("/bootstrap/docker/postgres", payload);
  return response.data;
};

export const getDockerPostgresStatus = async (): Promise<DockerPostgresStatusResponse> => {
  const response = await apiClient.get<DockerPostgresStatusResponse>("/bootstrap/docker/postgres/status");
  return response.data;
};

export const recreateDockerPostgres = async (
  payload: DockerPostgresRecreatePayload
): Promise<DockerPostgresRecreateResponse> => {
  const response = await apiClient.post<DockerPostgresRecreateResponse>("/bootstrap/docker/postgres/recreate", payload);
  return response.data;
};
