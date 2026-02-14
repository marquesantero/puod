import apiClient from "@/lib/api-client";
import type { IntegrationCompany, IntegrationGroup } from "@/types/integrations";

export type IntegrationOverviewResponse = {
  groups: IntegrationGroup[];
  integrations: Array<{
    id: number;
    companyId: number;
    groupId: number;
    type: string;
    name: string;
    description?: string | null;
    status: string;
    configJson: string;
    createdAt: string;
    isInherited?: boolean;
  }>;
};

export const getCompanies = async (): Promise<IntegrationCompany[]> => {
  const response = await apiClient.get<IntegrationCompany[]>("/integrations/companies");
  return response.data;
};

export const getIntegrationOverview = async (companyId: number): Promise<IntegrationOverviewResponse> => {
  const response = await apiClient.get<IntegrationOverviewResponse>("/integrations/overview", {
    params: { companyId },
  });
  return response.data;
};

export const createIntegrationGroup = async (payload: {
  companyId: number;
  name: string;
  description?: string;
}): Promise<IntegrationGroup> => {
  const response = await apiClient.post<IntegrationGroup>("/integrations/groups", payload);
  return response.data;
};

export const deleteIntegrationGroup = async (id: number): Promise<void> => {
  await apiClient.delete(`/integrations/groups/${id}`);
};

export const createIntegration = async (payload: {
  companyId: number;
  groupId: number;
  type: string;
  name: string;
  description?: string;
  configJson: string;
  status?: string;
}): Promise<IntegrationOverviewResponse["integrations"][number]> => {
  const response = await apiClient.post<IntegrationOverviewResponse["integrations"][number]>(
    "/integrations",
    payload
  );
  return response.data;
};

export const deleteIntegration = async (id: number): Promise<void> => {
  await apiClient.delete(`/integrations/${id}`);
};

export type IntegrationTestResponse = {
  success: boolean;
  message: string;
  status: string;
};

export const testIntegration = async (id: number): Promise<IntegrationTestResponse> => {
  const response = await apiClient.post<IntegrationTestResponse>(`/integrations/${id}/test`);
  return response.data;
};

export const updateIntegration = async (
  id: number,
  payload: {
    name: string;
    description?: string;
    configJson: string;
    status?: string;
  }
): Promise<IntegrationOverviewResponse["integrations"][number]> => {
  const response = await apiClient.put<IntegrationOverviewResponse["integrations"][number]>(
    `/integrations/${id}`,
    payload
  );
  return response.data;
};
