import apiClient from "@/lib/api-client";

export const StudioScope = {
  Client: 1,
  Company: 2,
} as const;

export type StudioScope = typeof StudioScope[keyof typeof StudioScope];

export const StudioCardStatus = {
  Draft: 1,
  Published: 2,
  Archived: 3,
} as const;

export type StudioCardStatus = typeof StudioCardStatus[keyof typeof StudioCardStatus];

export type StudioCardDto = {
  id: number;
  title: string;
  cardType: string;
  layoutType: string;
  status: StudioCardStatus;
  scope: StudioScope;
  clientId?: number;
  profileId?: number;
  integrationId?: number;
  createdAt: string;
  updatedAt: string;
  lastTestedAt?: string;
  lastTestSucceeded: boolean;
};

export type StudioCardDetailDto = {
  id: number;
  title: string;
  description?: string;
  cardType: string;
  layoutType: string;
  status: StudioCardStatus;
  scope: StudioScope;
  clientId?: number;
  profileId?: number;
  integrationId?: number;
  query?: string;
  fieldsJson?: string;
  styleJson?: string;
  layoutJson?: string;
  refreshPolicyJson?: string;
  dataSourceJson?: string;
  createdAt: string;
  updatedAt: string;
  lastTestedAt?: string;
  lastTestSucceeded: boolean;
  lastTestSignature?: string;
};

export type CreateStudioCardRequest = {
  title: string;
  description?: string;
  scope: StudioScope;
  clientId?: number;
  profileId?: number;
  cardType: string;
  layoutType: string;
  integrationId?: number;
  query?: string;
  fieldsJson?: string;
  styleJson?: string;
  layoutJson?: string;
  refreshPolicyJson?: string;
  dataSourceJson?: string;
  testSignature?: string;
  testedAt?: string;
};

export type UpdateStudioCardRequest = {
  title?: string;
  description?: string;
  status?: StudioCardStatus;
  cardType?: string;
  layoutType?: string;
  integrationId?: number;
  query?: string;
  fieldsJson?: string;
  styleJson?: string;
  layoutJson?: string;
  refreshPolicyJson?: string;
  dataSourceJson?: string;
  testSignature?: string;
  testedAt?: string;
};

export type StudioCardTestRequest = {
  integrationId?: number;
  query?: string;
  cardType?: string;
  layoutType?: string;
  fieldsJson?: string;
  styleJson?: string;
  layoutJson?: string;
  refreshPolicyJson?: string;
  dataSourceJson?: string;
};

export type StudioCardTestResult = {
  success: boolean;
  errorMessage?: string;
  signature?: string;
  executionTimeMs?: number;
};

// Get all cards for the user
export async function getCards(
  scope?: StudioScope,
  clientId?: number,
  profileId?: number
): Promise<StudioCardDto[]> {
  const response = await apiClient.get<StudioCardDto[]>("/studio/cards", {
    params: { scope, clientId, profileId },
  });
  return response.data;
}

// Get template cards (published cards that can be cloned)
export async function getTemplates(integrationId?: number): Promise<StudioCardDto[]> {
  const response = await apiClient.get<StudioCardDto[]>("/studio/cards/templates", {
    params: integrationId ? { integrationId } : undefined,
  });
  return response.data;
}

// Get a specific card by ID
export async function getCard(id: number): Promise<StudioCardDetailDto> {
  const response = await apiClient.get<StudioCardDetailDto>(`/studio/cards/${id}`);
  return response.data;
}

// Create a new card
export async function createCard(data: CreateStudioCardRequest): Promise<StudioCardDetailDto> {
  const response = await apiClient.post<StudioCardDetailDto>("/studio/cards", data);
  return response.data;
}

// Update an existing card
export async function updateCard(id: number, data: UpdateStudioCardRequest): Promise<StudioCardDetailDto> {
  const response = await apiClient.put<StudioCardDetailDto>(`/studio/cards/${id}`, data);
  return response.data;
}

// Delete a card
export async function deleteCard(id: number): Promise<void> {
  await apiClient.delete(`/studio/cards/${id}`);
}

// Clone a card (create a copy)
export async function cloneCard(id: number): Promise<StudioCardDetailDto> {
  const response = await apiClient.post<StudioCardDetailDto>(`/studio/cards/${id}/clone`);
  return response.data;
}

// Test a card configuration
export async function testCard(data: StudioCardTestRequest): Promise<StudioCardTestResult> {
  const response = await apiClient.post<StudioCardTestResult>("/studio/cards/test", data);
  return response.data;
}
