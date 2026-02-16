import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type AuthProviderType = "Local" | "WindowsAd" | "AzureAd";
export type OwnerType = "Company" | "Client";

export type AuthProfileListResponse = {
  id: number;
  profileId: number;
  ownerType: OwnerType;
  companyIds: number[];
  clientId?: number;
  name: string;
  providerType: AuthProviderType;
  isActive: boolean;
  domains?: string[];
  createdAt: string;
  updatedAt?: string;
};

export type AuthProfileDetailResponse = {
  id: number;
  profileId: number;
  ownerType: OwnerType;
  companyIds: number[];
  clientId?: number;
  name: string;
  providerType: AuthProviderType;
  domains: string[];
  config: any;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type AuthProfileCreateRequest = {
  profileId?: number;
  clientId?: number;
  companyIds?: number[];
  name: string;
  providerType: AuthProviderType;
  domains: string[];
  config: any;
};

export type AuthProfileUpdateRequest = {
  name: string;
  domains: string[];
  companyIds?: number[];
  isActive?: boolean;
  config: any;
};

export type WindowsAdConfig = {
  domain: string;
  ldapUrl: string;
  baseDn: string;
  bindDn?: string;
  bindPassword?: string;
  userFilter?: string;
  groupFilter?: string;
  useSsl: boolean;
  startTls: boolean;
  timeoutSeconds: number;
};

export type AzureAdConfig = {
  tenantId: string;
  clientId: string;
  clientSecret?: string;
  authUrl: string;
  tokenUrl: string;
  authority: string;
  redirectUri: string;
  scopes: string;
  issuer: string;
  usePkce: boolean;
};

// Get auth profiles by company (profileId)
export async function getAuthProfiles(profileId: number): Promise<AuthProfileListResponse[]> {
  const response = await api.get<AuthProfileListResponse[]>("/auth-profiles", {
    params: { profileId },
  });
  return response.data;
}

// Get auth profiles by client
export async function getClientAuthProfiles(clientId: number): Promise<AuthProfileListResponse[]> {
  const response = await api.get<AuthProfileListResponse[]>("/auth-profiles", {
    params: { clientId },
  });
  return response.data;
}

export const getAuthProfilesForClient = getClientAuthProfiles;

// Get all auth profiles available for a company (owned + inherited from client)
export async function getCompanyAvailableAuthProfiles(profileId: number): Promise<AuthProfileListResponse[]> {
  const response = await api.get<AuthProfileListResponse[]>(`/auth-profiles/company/${profileId}/available`);
  return response.data;
}

export async function getAuthProfile(id: number): Promise<AuthProfileDetailResponse> {
  const response = await api.get<AuthProfileDetailResponse>(`/auth-profiles/${id}`);
  return response.data;
}

export async function createAuthProfile(data: AuthProfileCreateRequest): Promise<AuthProfileDetailResponse> {
  const response = await api.post<AuthProfileDetailResponse>("/auth-profiles", data);
  return response.data;
}

export async function updateAuthProfile(id: number, data: AuthProfileUpdateRequest): Promise<AuthProfileDetailResponse> {
  const response = await api.put<AuthProfileDetailResponse>(`/auth-profiles/${id}`, data);
  return response.data;
}

export async function deleteAuthProfile(id: number): Promise<void> {
  await api.delete(`/auth-profiles/${id}`);
}
