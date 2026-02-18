import apiClient from "@/lib/api-client";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "User is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginData = z.infer<typeof loginSchema>;

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface DiscoveryResponse {
  authMethod: "Local" | "WindowsAd" | "AzureAd";
  redirectUrl?: string;
  config?: Record<string, unknown>;
  companyName?: string;
  providerDisplayName?: string;
}

export const login = async (data: LoginData): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>("/auth/login", data);
  return response.data;
};

export const discovery = async (email: string): Promise<DiscoveryResponse> => {
  const response = await apiClient.post<DiscoveryResponse>("/auth/discovery", { email });
  return response.data;
};

export const loginCallback = async (code: string, state: string): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>("/auth/callback", { code, state });
  return response.data;
};

export interface AzureProfileInfo {
  id: number;
  name: string;
  authUrl: string;
  companyName?: string;
}

export const getAzureProfiles = async (): Promise<AzureProfileInfo[]> => {
  const response = await apiClient.get<AzureProfileInfo[]>("/auth/azure-profiles");
  return response.data;
};

export interface CheckUserResponse {
  exists: boolean;
}

export const checkUserExists = async (email: string): Promise<boolean> => {
  const response = await apiClient.get<CheckUserResponse>(`/auth/check-user?email=${encodeURIComponent(email)}`);
  return response.data.exists;
};
