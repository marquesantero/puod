import apiClient from "@/lib/api-client";

export type ConnectorType = "Databricks" | "Synapse" | "Airflow" | "AzureDataFactory";
export type IntegrationStatus = "Pending" | "Active" | "Error" | "Disabled";
export type OwnerType = "Company" | "Group" | "Client";

export type IntegrationListResponse = {
  id: number;
  profileId: number;
  ownerType: OwnerType;
  companyIds: number[];
  clientId?: number;
  name: string;
  type: ConnectorType;
  status: IntegrationStatus;
  createdAt: string;
  lastSyncAt?: string;
  isActive: boolean;
};

export type IntegrationDetailResponse = {
  id: number;
  profileId: number;
  ownerType: OwnerType;
  companyIds: number[];
  clientId?: number;
  name: string;
  type: ConnectorType;
  status: IntegrationStatus;
  configuration: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  isActive: boolean;
};

export type IntegrationCreateRequest = {
  profileId?: number;
  clientId?: number;
  companyIds?: number[];
  name: string;
  type: ConnectorType;
  configuration: Record<string, string>;
};

export type IntegrationUpdateRequest = {
  name?: string;
  configuration?: Record<string, string>;
  companyIds?: number[];
  isActive?: boolean;
};

export type TestConnectionRequest = {
  type: ConnectorType;
  configuration: Record<string, string>;
};

export type ConnectionResult = {
  success: boolean;
  errorMessage?: string;
};

// Get integrations by company (profileId)
export async function getIntegrations(profileId?: number): Promise<IntegrationListResponse[]> {
  const response = await apiClient.get<IntegrationListResponse[]>("/integration", {
    params: profileId ? { profileId } : undefined,
  });
  return response.data;
}

// Get integrations by client
export async function getClientIntegrations(clientId: number): Promise<IntegrationListResponse[]> {
  const response = await apiClient.get<IntegrationListResponse[]>("/integration", {
    params: { clientId },
  });
  return response.data;
}

// Get all integrations available for a company (owned + inherited from client)
export async function getCompanyAvailableIntegrations(profileId: number): Promise<IntegrationListResponse[]> {
  const response = await apiClient.get<IntegrationListResponse[]>(`/integration/company/${profileId}/available`);
  return response.data;
}

export async function getIntegration(id: number, clientId?: number): Promise<IntegrationDetailResponse> {
  const response = await apiClient.get<IntegrationDetailResponse>(`/integration/${id}`, {
    params: clientId ? { clientId } : undefined,
  });
  return response.data;
}

export async function createIntegration(data: IntegrationCreateRequest): Promise<IntegrationDetailResponse> {
  const response = await apiClient.post<IntegrationDetailResponse>("/integration", data);
  return response.data;
}

export async function updateIntegration(
  id: number,
  data: IntegrationUpdateRequest,
  clientId?: number
): Promise<IntegrationDetailResponse> {
  const response = await apiClient.put<IntegrationDetailResponse>(`/integration/${id}`, data, {
    params: clientId ? { clientId } : undefined,
  });
  return response.data;
}

export async function deleteIntegration(id: number, clientId?: number): Promise<void> {
  await apiClient.delete(`/integration/${id}`, {
    params: clientId ? { clientId } : undefined,
  });
}

export async function testConnection(request: TestConnectionRequest): Promise<ConnectionResult> {
  const response = await apiClient.post<ConnectionResult>(
    "/integration/test-connection",
    request,
    { validateStatus: () => true }
  );

  if (response.status >= 200 && response.status < 300) {
    return response.data;
  }

  const data = response.data as unknown;
  const typedData = data as Record<string, unknown>;
  const errorMessage =
    (typeof data === "string" && data.trim()) ||
    typedData?.message ||
    typedData?.title ||
    (data ? JSON.stringify(data) : "");

  const statusText = response.statusText ? ` ${response.statusText}` : "";
  const formattedMessage = errorMessage
    ? `${response.status}${statusText}: ${errorMessage}`
    : `${response.status}${statusText}`;

  return {
    success: false,
    errorMessage: formattedMessage,
  };
}

export async function listDatabases(integrationId: number, search?: string, limit?: number): Promise<string[]> {
  const response = await apiClient.get<string[]>(`/integration/${integrationId}/databases`, {
    params: {
      ...(search && { search }),
      ...(limit && { limit }),
    },
  });
  return response.data;
}

export async function listTables(integrationId: number, database: string): Promise<string[]> {
  const response = await apiClient.get<string[]>(`/integration/${integrationId}/tables/${database}`);
  return response.data;
}

// Execute query on integration
export type ExecuteQueryRequest = {
  integrationId: number;
  query: string;
  dataSourceJson?: string | null;
};

export type QueryResultDto = {
  success: boolean;
  errorMessage?: string;
  rows?: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
};

export async function executeQuery(request: ExecuteQueryRequest): Promise<QueryResultDto> {
  const response = await apiClient.post<QueryResultDto>("/integration/execute-query", request);
  return response.data;
}
