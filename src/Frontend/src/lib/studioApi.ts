import apiClient from "@/lib/api-client";
import type {
  StudioCard,
  StudioCardCreateRequest,
  StudioCardDetail,
  StudioCardTestRequest,
  StudioCardTestResult,
  StudioCardUpdateRequest,
  StudioDashboard,
  StudioDashboardCreateRequest,
  StudioDashboardDetail,
  StudioDashboardUpdateRequest,
  StudioScope,
  StudioShare,
  StudioShareRequest,
} from "@/types/studio";

export async function listStudioCards(scope?: StudioScope, clientId?: number, profileId?: number): Promise<StudioCard[]> {
  const response = await apiClient.get<StudioCard[]>("/studio/cards", {
    params: {
      scope,
      clientId,
      profileId,
    },
  });
  return response.data;
}

export async function getStudioCard(id: number): Promise<StudioCardDetail> {
  const response = await apiClient.get<StudioCardDetail>(`/studio/cards/${id}`);
  return response.data;
}

export async function createStudioCard(payload: StudioCardCreateRequest): Promise<StudioCardDetail> {
  const response = await apiClient.post<StudioCardDetail>("/studio/cards", payload);
  return response.data;
}

export async function updateStudioCard(id: number, payload: StudioCardUpdateRequest): Promise<StudioCardDetail> {
  const response = await apiClient.put<StudioCardDetail>(`/studio/cards/${id}`, payload);
  return response.data;
}

export async function deleteStudioCard(id: number): Promise<void> {
  await apiClient.delete(`/studio/cards/${id}`);
}

export async function cloneStudioCard(id: number): Promise<StudioCardDetail> {
  const response = await apiClient.post<StudioCardDetail>(`/studio/cards/${id}/clone`);
  return response.data;
}

export async function testStudioCard(payload: StudioCardTestRequest): Promise<StudioCardTestResult> {
  const response = await apiClient.post<StudioCardTestResult>("/studio/cards/test", payload, {
    validateStatus: () => true,
  });

  if (response.status >= 200 && response.status < 300) {
    return response.data;
  }

  const data = response.data as any;
  const errorMessage =
    (typeof data === "string" && data.trim()) ||
    data?.message ||
    data?.errorMessage ||
    data?.title ||
    (data ? JSON.stringify(data) : "");

  return {
    success: false,
    errorMessage,
  };
}

export async function listStudioDashboards(scope?: StudioScope, clientId?: number, profileId?: number): Promise<StudioDashboard[]> {
  const response = await apiClient.get<StudioDashboard[]>("/studio/dashboards", {
    params: {
      scope,
      clientId,
      profileId,
    },
  });
  return response.data;
}

export async function getStudioDashboard(id: number): Promise<StudioDashboardDetail> {
  const response = await apiClient.get<StudioDashboardDetail>(`/studio/dashboards/${id}`);
  return response.data;
}

export async function createStudioDashboard(payload: StudioDashboardCreateRequest): Promise<StudioDashboardDetail> {
  const response = await apiClient.post<StudioDashboardDetail>("/studio/dashboards", payload);
  return response.data;
}

export async function updateStudioDashboard(id: number, payload: StudioDashboardUpdateRequest): Promise<StudioDashboardDetail> {
  const response = await apiClient.put<StudioDashboardDetail>(`/studio/dashboards/${id}`, payload);
  return response.data;
}

export async function deleteStudioDashboard(id: number): Promise<void> {
  await apiClient.delete(`/studio/dashboards/${id}`);
}

export async function listStudioShares(targetType: string, targetId: number): Promise<StudioShare[]> {
  const response = await apiClient.get<StudioShare[]>("/studio/shares", {
    params: {
      targetType,
      targetId,
    },
  });
  return response.data;
}

export async function createStudioShare(payload: StudioShareRequest): Promise<StudioShare> {
  const response = await apiClient.post<StudioShare>("/studio/shares", payload);
  return response.data;
}

export async function deleteStudioShare(id: number): Promise<void> {
  await apiClient.delete(`/studio/shares/${id}`);
}
