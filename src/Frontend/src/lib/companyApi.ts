import apiClient from "@/lib/api-client";

export const SubscriptionTier = {
  Free: 0,
  Pro: 1,
  Enterprise: 2,
} as const;

export type SubscriptionTier = typeof SubscriptionTier[keyof typeof SubscriptionTier];

export type CompanyListResponse = {
  id: number;
  name: string;
  companyName?: string;
  slug: string;
  clientId?: number;
  clientName?: string;
  inheritFromClient: boolean;
  tier: SubscriptionTier;
  isActive: boolean;
  createdAt: string;
  userCount: number;
  logoUrl?: string;
  country?: string;
  industry?: string;
};

export type CompanyDetailResponse = {
  id: number;
  name: string;
  companyName?: string;
  slug: string;
  clientId?: number;
  clientName?: string;
  inheritFromClient: boolean;
  inheritBasicInfo: boolean;
  inheritLogo: boolean;
  inheritContact: boolean;
  inheritAddress: boolean;
  inheritDetails: boolean;
  inheritAuthentication: boolean;
  inheritIntegrations: boolean;
  tier: SubscriptionTier;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  userCount: number;
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

export type CompanyCreateRequest = {
  name: string;
  companyName?: string;
  clientId: number;
  inheritFromClient?: boolean;
  inheritBasicInfo?: boolean;
  inheritLogo?: boolean;
  inheritContact?: boolean;
  inheritAddress?: boolean;
  inheritDetails?: boolean;
  inheritAuthentication?: boolean;
  inheritIntegrations?: boolean;
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

export type CompanyUpdateRequest = {
  name: string;
  companyName?: string;
  inheritFromClient: boolean;
  inheritBasicInfo: boolean;
  inheritLogo: boolean;
  inheritContact: boolean;
  inheritAddress: boolean;
  inheritDetails: boolean;
  inheritAuthentication: boolean;
  inheritIntegrations: boolean;
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

export const getCompanies = async (): Promise<CompanyListResponse[]> => {
  const response = await apiClient.get<CompanyListResponse[]>("/companies");
  return response.data;
};

export const getCompanyById = async (id: number): Promise<CompanyDetailResponse> => {
  const response = await apiClient.get<CompanyDetailResponse>(`/companies/${id}`);
  return response.data;
};

export const createCompany = async (data: CompanyCreateRequest): Promise<CompanyDetailResponse> => {
  const response = await apiClient.post<CompanyDetailResponse>("/companies", data);
  return response.data;
};

export const updateCompany = async (
  id: number,
  data: CompanyUpdateRequest
): Promise<CompanyDetailResponse> => {
  const response = await apiClient.put<CompanyDetailResponse>(`/companies/${id}`, data);
  return response.data;
};

export const deleteCompany = async (id: number): Promise<void> => {
  await apiClient.delete(`/companies/${id}`);
};
