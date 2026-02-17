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
  StudioDashboardCard,
  StudioScope,
  StudioShare,
  StudioShareRequest,
} from "@/types/studio";

// Re-export all types from @/types/studio for centralized access
export type { StudioCard, StudioCardCreateRequest, StudioCardDetail, StudioCardTestRequest, StudioCardTestResult, StudioCardUpdateRequest } from "@/types/studio";
export type { StudioDashboard, StudioDashboardCreateRequest, StudioDashboardDetail, StudioDashboardUpdateRequest, StudioDashboardCard } from "@/types/studio";
export type { StudioScope, StudioShare, StudioShareRequest, StudioShareTarget, StudioShareSubject, StudioShareAccess } from "@/types/studio";
export type { StudioCardStatus, StudioDashboardStatus } from "@/types/studio";

// Type aliases for backward compatibility with studioCardsApi / studioDashboardsApi consumers
export type StudioCardDto = StudioCard;
export type StudioCardDetailDto = StudioCardDetail;
export type StudioDashboardDto = StudioDashboard;
export type StudioDashboardDetailDto = StudioDashboardDetail;
export type StudioDashboardCardDto = StudioDashboardCard;
export type CreateStudioCardRequest = StudioCardCreateRequest;
export type UpdateStudioCardRequest = StudioCardUpdateRequest;
export type CreateStudioDashboardRequest = StudioDashboardCreateRequest;
export type UpsertStudioDashboardCardRequest = NonNullable<StudioDashboardUpdateRequest["cards"]>[number];

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

// =============================================
// Templates
// =============================================

export async function getStudioTemplates(integrationId?: number): Promise<StudioCard[]> {
  const response = await apiClient.get<StudioCard[]>("/studio/cards/templates", {
    params: integrationId ? { integrationId } : undefined,
  });
  return response.data;
}

// =============================================
// Short aliases (backward compat with studioCardsApi / studioDashboardsApi)
// =============================================

/** @deprecated Use listStudioCards */
export const getCards = listStudioCards;
/** @deprecated Use getStudioCard */
export const getCard = getStudioCard;
/** @deprecated Use createStudioCard */
export const createCard = createStudioCard;
/** @deprecated Use updateStudioCard */
export const updateCard = updateStudioCard;
/** @deprecated Use deleteStudioCard */
export const deleteCard = deleteStudioCard;
/** @deprecated Use cloneStudioCard */
export const cloneCard = cloneStudioCard;
/** @deprecated Use testStudioCard */
export const testCard = testStudioCard;
/** @deprecated Use getStudioTemplates */
export const getTemplates = getStudioTemplates;

/** @deprecated Use listStudioDashboards */
export const getDashboards = listStudioDashboards;
/** @deprecated Use getStudioDashboard */
export const getDashboard = getStudioDashboard;
/** @deprecated Use createStudioDashboard */
export const createDashboard = createStudioDashboard;
/** @deprecated Use updateStudioDashboard */
export const updateDashboard = updateStudioDashboard;
/** @deprecated Use deleteStudioDashboard */
export const deleteDashboard = deleteStudioDashboard;
