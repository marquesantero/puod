import apiClient from "@/lib/api-client";
import { type AuthProfileListResponse } from "./authProfileApi";

export type { AuthProfileListResponse };

export const IdentitySource = {
  Local: 0,
  WindowsAd: 1,
  AzureAd: 2,
} as const;

export type IdentitySource = typeof IdentitySource[keyof typeof IdentitySource];

export type IdentityUserResult = {
  id: number;
  username: string;
  displayName: string;
  source: IdentitySource;
  isImported: boolean;
  isActive: boolean;
  profileId: number;
};

export type IdentityGroupResult = {
  id: number;
  name: string;
  source: IdentitySource;
  isImported: boolean;
};

export type GroupDto = {
  id: number;
  name: string;
  description?: string;
  type: string; // Local, WindowsAd, AzureAd
  externalId?: string;
  userCount: number;
  roleNames: string[];
  createdAt: string;
};

export type CreateGroupRequest = {
  name: string;
  description?: string;
};

export type UpdateGroupRequest = {
  name: string;
  description?: string;
};

export type GroupMembersDto = {
  members: IdentityUserResult[];
};

export type AddGroupMembersRequest = {
  userIds: number[];
};

export type PermissionDto = {
  id: string;
  category: string;
  description: string;
};

export type RoleDto = {
  id: number;
  name: string;
  description?: string;
  permissionIds: string[];
  clientId?: number | null;
  profileId?: number | null;
};

export type CreateRoleRequest = {
  name: string;
  description?: string;
  permissionIds: string[];
};

export type UpdateRoleRequest = {
  description?: string;
  permissionIds: string[];
};

export type ImportUserRequest = {
  profileId: number;
  externalId: number;
  username: string;
  displayName: string;
  source: IdentitySource;
  isClientLevel?: boolean;
  companyIds?: string[];
};

export type CreateLocalUserRequest = {
  profileId: number;
  username: string;
  displayName: string;
  password: string;
  photoUrl?: string;
  isClientLevel?: boolean;
  companyIds?: string[];
};

export type ImportGroupRequest = {
  profileId: number;
  externalId: number;
  name: string;
  source: IdentitySource;
};

export async function searchUsers(term: string, source: IdentitySource, authProfileId?: string): Promise<IdentityUserResult[]> {
  const response = await apiClient.get<IdentityUserResult[]>("/security/search/users", {
    params: { term, source, authProfileId },
  });
  return response.data;
}

export async function importUser(data: ImportUserRequest): Promise<void> {
  await apiClient.post("/security/import", data);
}

export async function createLocalUser(data: CreateLocalUserRequest): Promise<void> {
  await apiClient.post("/security/users/local", data);
}

export async function getUsers(profileId: number): Promise<IdentityUserResult[]> {
  const response = await apiClient.get<IdentityUserResult[]>("/security/users", {
    params: { profileId },
  });
  return response.data;
}

export async function searchGroups(term: string, source: IdentitySource, authProfileId?: string): Promise<IdentityGroupResult[]> {
  const response = await apiClient.get<IdentityGroupResult[]>("/security/search/groups", {
    params: { term, source, authProfileId },
  });
  return response.data;
}

export async function importGroup(data: ImportGroupRequest): Promise<void> {
  await apiClient.post("/security/groups/import", data);
}

export async function getGroups(profileId: number): Promise<IdentityGroupResult[]> {
  const response = await apiClient.get<IdentityGroupResult[]>("/security/groups", {
    params: { profileId },
  });
  return response.data;
}

export async function getGroupDetail(groupId: number): Promise<IdentityGroupResult> {
  const response = await apiClient.get<IdentityGroupResult>(`/security/groups/${groupId}`);
  return response.data;
}

export async function getPermissions(): Promise<PermissionDto[]> {
  const response = await apiClient.get<PermissionDto[]>("/security/permissions");
  return response.data;
}

export async function getRoles(profileId: number, isCompanyLevel = false): Promise<RoleDto[]> {
  const response = await apiClient.get<RoleDto[]>("/security/roles", { params: { profileId, isCompanyLevel } });
  return response.data;
}

export async function createRole(profileId: number, data: CreateRoleRequest): Promise<RoleDto> {
  const response = await apiClient.post<RoleDto>("/security/roles", data, { params: { profileId } });
  return response.data;
}

export async function updateRole(id: number, data: UpdateRoleRequest): Promise<RoleDto> {
  const response = await apiClient.put<RoleDto>(`/security/roles/${id}`, data);
  return response.data;
}

export async function deleteRole(id: number): Promise<void> {
  await apiClient.delete(`/security/roles/${id}`);
}

export async function getUserRoles(userId: number, profileId: number): Promise<number[]> {
  const response = await apiClient.get<number[]>(`/security/users/${userId}/roles`, { params: { profileId } });
  return response.data;
}

export async function getUserRolesForClient(userId: number, clientId: number): Promise<number[]> {
  const response = await apiClient.get<number[]>(`/security/users/${userId}/roles`, { params: { clientId } });
  return response.data;
}

export async function assignUserRoles(userId: number, profileId: number, roleIds: number[], roleCompanies?: Record<number, number[]>): Promise<void> {
  await apiClient.post(`/security/users/${userId}/roles`, { profileId, roleIds, roleCompanies });
}

export async function updateUserRoles(userId: number, profileId: number, roleIds: number[]): Promise<void> {
  await apiClient.post(`/security/users/${userId}/roles`, { profileId, roleIds });
}

export async function deleteUser(userId: number): Promise<void> {
  await apiClient.delete(`/security/users/${userId}`);
}

export async function getGroupRoles(groupId: number, profileId: number): Promise<string[]> {
  const response = await apiClient.get<string[]>(`/security/groups/${groupId}/roles`, { params: { profileId } });
  return response.data;
}

export async function assignGroupRoles(groupId: number, profileId: number, roleIds: number[], roleCompanies?: Record<string, string[]>): Promise<void> {
  await apiClient.post(`/security/groups/${groupId}/roles`, { profileId, roleIds, roleCompanies });
}

// Client level role management
export async function getRolesForClient(clientId: number, isCompanyLevel = false): Promise<RoleDto[]> {
  const response = await apiClient.get<RoleDto[]>("/security/roles", { params: { clientId, isCompanyLevel } });
  return response.data;
}

export async function createRoleForClient(clientId: number, data: CreateRoleRequest): Promise<RoleDto> {
  const response = await apiClient.post<RoleDto>("/security/roles", data, { params: { clientId } });
  return response.data;
}

export async function updateRoleForClient(clientId: number, roleId: number, data: UpdateRoleRequest): Promise<RoleDto> {
  const response = await apiClient.put<RoleDto>(`/security/roles/${roleId}`, data, { params: { clientId } });
  return response.data;
}

export async function deleteRoleForClient(clientId: number, roleId: number): Promise<void> {
  await apiClient.delete(`/security/roles/${roleId}`, { params: { clientId } });
}

export async function getUsersForClient(clientId: number): Promise<IdentityUserResult[]> {
  const response = await apiClient.get<IdentityUserResult[]>("/security/users", { params: { clientId } });
  return response.data;
}

export async function getUserById(id: number): Promise<IdentityUserResult> {
  const response = await apiClient.get<IdentityUserResult>(`/security/users/${id}`);
  return response.data;
}

export async function updateUserStatus(id: number, isActive: boolean): Promise<void> {
  await apiClient.put(`/security/users/${id}/status`, { isActive });
}

export async function getAuthProfilesForClient(clientId: number): Promise<AuthProfileListResponse[]> {
  const response = await apiClient.get<AuthProfileListResponse[]>("/auth-profiles", { params: { clientId } });
  return response.data;
}

// Company Availability Management
export type CompanyAvailabilityDto = {
  companyId: number;
  companyName: string;
  companySlug: string;
  isAvailable: boolean;
};

export async function getUserCompanyAvailability(userId: number, clientId: number): Promise<CompanyAvailabilityDto[]> {
  const response = await apiClient.get<CompanyAvailabilityDto[]>(`/security/users/${userId}/companies`, {
    params: { clientId }
  });
  return response.data;
}

export async function updateUserCompanyAvailability(userId: number, clientId: number, companyIds: number[]): Promise<void> {
  await apiClient.post(`/security/users/${userId}/companies`, {
    clientId,
    companyIds
  });
}

// Groups Management
export async function createGroup(profileId: number, data: CreateGroupRequest): Promise<GroupDto> {
  const response = await apiClient.post<GroupDto>("/security/groups", data, { params: { profileId } });
  return response.data;
}

export async function updateGroup(id: number, data: UpdateGroupRequest): Promise<GroupDto> {
  const response = await apiClient.put<GroupDto>(`/security/groups/${id}`, data);
  return response.data;
}

export async function deleteGroup(id: number): Promise<void> {
  await apiClient.delete(`/security/groups/${id}`);
}

export async function getGroupMembers(groupId: number): Promise<GroupMembersDto> {
  const response = await apiClient.get<GroupMembersDto>(`/security/groups/${groupId}/members`);
  return response.data;
}

export async function addGroupMembers(groupId: number, userIds: number[]): Promise<void> {
  await apiClient.post(`/security/groups/${groupId}/members`, { userIds });
}

export async function removeGroupMember(groupId: number, userId: number): Promise<void> {
  await apiClient.delete(`/security/groups/${groupId}/members/${userId}`);
}
