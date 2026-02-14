import apiClient from "@/lib/api-client";

export const SubscriptionTier = {
  Free: 0,
  Pro: 1,
  Enterprise: 2,
} as const;

export type SubscriptionTier = typeof SubscriptionTier[keyof typeof SubscriptionTier];

export type CompanyInfo = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
};

export type ClientListResponse = {
  id: number;
  name: string;
  slug: string;
  tier: SubscriptionTier;
  isAlterable: boolean;
  isActive: boolean;
  companyCount: number;
  companies?: CompanyInfo[];
  createdAt: string;
  updatedAt?: string;
};

export type ClientDetailResponse = {
  id: number;
  name: string;
  slug: string;
  tier: SubscriptionTier;
  isAlterable: boolean;
  isActive: boolean;
  logoUrl?: string;
  taxId?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  description?: string;
  industry?: string;
  employeeCount?: number;
  foundedDate?: string;
  companies: CompanyInfo[];
  createdAt: string;
  updatedAt?: string;
};

export type ClientInfoPreview = {
  id: number;
  name: string;
  tier: SubscriptionTier;
  logoUrl?: string;
  taxId?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  description?: string;
  industry?: string;
  employeeCount?: number;
  foundedDate?: string;
};

export type ClientCreateRequest = {
  name: string;
  tier?: SubscriptionTier;
  isAlterable?: boolean;
  logoUrl?: string;
  taxId?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  description?: string;
  industry?: string;
  employeeCount?: number;
  foundedDate?: string;
};

export type ClientUpdateRequest = {
  name: string;
  tier: SubscriptionTier;
  isActive: boolean;
  logoUrl?: string;
  taxId?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  description?: string;
  industry?: string;
  employeeCount?: number;
  foundedDate?: string;
};

export const getClients = async (): Promise<ClientListResponse[]> => {
  const response = await apiClient.get<ClientListResponse[]>("/clients");
  return response.data;
};

export const getClientById = async (id: number): Promise<ClientDetailResponse> => {
  const response = await apiClient.get<ClientDetailResponse>(`/clients/${id}`);
  return response.data;
};

export const getClientInfoPreview = async (id: number): Promise<ClientInfoPreview> => {
  const response = await apiClient.get<ClientInfoPreview>(`/clients/${id}/info-preview`);
  return response.data;
};

export const createClient = async (data: ClientCreateRequest): Promise<ClientDetailResponse> => {
  const response = await apiClient.post<ClientDetailResponse>("/clients", data);
  return response.data;
};

export const updateClient = async (
  id: number,
  data: ClientUpdateRequest
): Promise<ClientDetailResponse> => {
  const response = await apiClient.put<ClientDetailResponse>(`/clients/${id}`, data);
  return response.data;
};

export const deleteClient = async (id: number): Promise<void> => {
  await apiClient.delete(`/clients/${id}`);
};
