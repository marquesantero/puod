import apiClient from "@/lib/api-client";

export const StudioScope = {
  Client: 1,
  Company: 2,
} as const;

export type StudioScope = typeof StudioScope[keyof typeof StudioScope];

export const StudioDashboardStatus = {
  Draft: 1,
  Published: 2,
  Archived: 3,
} as const;

export type StudioDashboardStatus = typeof StudioDashboardStatus[keyof typeof StudioDashboardStatus];

export type StudioDashboardDto = {
  id: number;
  name: string;
  status: StudioDashboardStatus;
  scope: StudioScope;
  clientId?: number;
  profileId?: number;
  layoutType: string;
  createdAt: string;
  updatedAt: string;
};

export type StudioDashboardDetailDto = {
  id: number;
  name: string;
  description?: string;
  status: StudioDashboardStatus;
  scope: StudioScope;
  clientId?: number;
  profileId?: number;
  layoutType: string;
  layoutJson?: string;
  refreshPolicyJson?: string;
  createdAt: string;
  updatedAt: string;
  cards: StudioDashboardCardDto[];
};

export type StudioDashboardCardDto = {
  id: number;
  cardId: number;
  title?: string | null;
  description?: string | null;
  showTitle?: boolean;
  showDescription?: boolean;
  integrationId?: number | null;
  orderIndex: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  layoutJson?: string;
  refreshPolicyJson?: string;
  dataSourceJson?: string | null;
};

export type CreateStudioDashboardRequest = {
  name: string;
  description?: string;
  scope: StudioScope;
  clientId?: number;
  profileId?: number;
  layoutType: string;
  layoutJson?: string;
  refreshPolicyJson?: string;
};

export type UpdateStudioDashboardRequest = {
  name?: string;
  description?: string;
  status?: StudioDashboardStatus;
  layoutType?: string;
  layoutJson?: string;
  refreshPolicyJson?: string;
  cards?: UpsertStudioDashboardCardRequest[];
};

export type UpsertStudioDashboardCardRequest = {
  id?: number;
  cardId: number;
  title?: string | null;
  description?: string | null;
  showTitle?: boolean;
  showDescription?: boolean;
  integrationId?: number | null;
  orderIndex: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  layoutJson?: string;
  refreshPolicyJson?: string;
  dataSourceJson?: string | null;
};

// Get all dashboards for the user
export async function getDashboards(
  scope?: StudioScope,
  clientId?: number,
  profileId?: number
): Promise<StudioDashboardDto[]> {
  const response = await apiClient.get<StudioDashboardDto[]>("/studio/dashboards", {
    params: { scope, clientId, profileId },
  });
  return response.data;
}

// Get a specific dashboard by ID
export async function getDashboard(id: number): Promise<StudioDashboardDetailDto> {
  const response = await apiClient.get<StudioDashboardDetailDto>(`/studio/dashboards/${id}`);
  return response.data;
}

// Create a new dashboard
export async function createDashboard(data: CreateStudioDashboardRequest): Promise<StudioDashboardDetailDto> {
  const response = await apiClient.post<StudioDashboardDetailDto>("/studio/dashboards", data);
  return response.data;
}

// Update an existing dashboard
export async function updateDashboard(id: number, data: UpdateStudioDashboardRequest): Promise<StudioDashboardDetailDto> {
  const response = await apiClient.put<StudioDashboardDetailDto>(`/studio/dashboards/${id}`, data);
  return response.data;
}

// Delete a dashboard
export async function deleteDashboard(id: number): Promise<void> {
  await apiClient.delete(`/studio/dashboards/${id}`);
}
