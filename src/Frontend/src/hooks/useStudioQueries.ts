/**
 * TanStack Query hooks para as operações do Studio (cards, dashboards, shares).
 *
 * Benefícios sobre useEffect+useState manual:
 *  - Cache automático + deduplicação de requests
 *  - Revalidação em foco de janela
 *  - Estados de loading/error/data consistentes
 *  - Invalidação explícita após mutações
 *  - Retry automático em falhas de rede
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudioScope } from "@/types/studio";
import {
  listStudioCards,
  getStudioCard,
  createStudioCard,
  updateStudioCard,
  deleteStudioCard,
  cloneStudioCard,
  testStudioCard,
  listStudioDashboards,
  getStudioDashboard,
  createStudioDashboard,
  updateStudioDashboard,
  deleteStudioDashboard,
  getStudioTemplates,
  listStudioShares,
  createStudioShare,
  deleteStudioShare,
} from "@/lib/studioApi";
import type {
  StudioCardCreateRequest,
  StudioCardUpdateRequest,
  StudioCardTestRequest,
  StudioDashboardCreateRequest,
  StudioDashboardUpdateRequest,
  StudioShareRequest,
} from "@/lib/studioApi";

// ────────────────────────────────────────────────────────────────
// Query keys factory — evita strings duplicadas e facilita invalidação
// ────────────────────────────────────────────────────────────────
export const studioKeys = {
  all: ["studio"] as const,

  // Cards
  cards: () => [...studioKeys.all, "cards"] as const,
  cardList: (scope?: StudioScope, clientId?: number, profileId?: number) =>
    [...studioKeys.cards(), "list", { scope, clientId, profileId }] as const,
  cardDetail: (id: number) => [...studioKeys.cards(), "detail", id] as const,
  cardTemplates: (integrationId?: number) =>
    [...studioKeys.cards(), "templates", { integrationId }] as const,

  // Dashboards
  dashboards: () => [...studioKeys.all, "dashboards"] as const,
  dashboardList: (scope?: StudioScope, clientId?: number, profileId?: number) =>
    [...studioKeys.dashboards(), "list", { scope, clientId, profileId }] as const,
  dashboardDetail: (id: number) =>
    [...studioKeys.dashboards(), "detail", id] as const,

  // Shares
  shares: (targetType: string, targetId: number) =>
    [...studioKeys.all, "shares", { targetType, targetId }] as const,
};

// ────────────────────────────────────────────────────────────────
// Queries — Cards
// ────────────────────────────────────────────────────────────────

export function useStudioCards(
  scope?: StudioScope,
  clientId?: number,
  profileId?: number,
) {
  const scopeId = scope === "Client" ? clientId : profileId;
  return useQuery({
    queryKey: studioKeys.cardList(scope, clientId, profileId),
    queryFn: () => listStudioCards(scope, clientId, profileId),
    enabled: Boolean(scopeId),
    staleTime: 30_000, // 30s
  });
}

export function useStudioCard(id: number | null) {
  return useQuery({
    queryKey: studioKeys.cardDetail(id!),
    queryFn: () => getStudioCard(id!),
    enabled: id !== null && id > 0,
    staleTime: 60_000, // 1min
  });
}

export function useStudioTemplates(integrationId?: number) {
  return useQuery({
    queryKey: studioKeys.cardTemplates(integrationId),
    queryFn: () => getStudioTemplates(integrationId),
    staleTime: 5 * 60_000, // 5min - templates mudam pouco
  });
}

// ────────────────────────────────────────────────────────────────
// Queries — Dashboards
// ────────────────────────────────────────────────────────────────

export function useStudioDashboards(
  scope?: StudioScope,
  clientId?: number,
  profileId?: number,
) {
  const scopeId = scope === "Client" ? clientId : profileId;
  return useQuery({
    queryKey: studioKeys.dashboardList(scope, clientId, profileId),
    queryFn: () => listStudioDashboards(scope, clientId, profileId),
    enabled: Boolean(scopeId),
    staleTime: 30_000,
  });
}

export function useStudioDashboard(id: number | null) {
  return useQuery({
    queryKey: studioKeys.dashboardDetail(id!),
    queryFn: () => getStudioDashboard(id!),
    enabled: id !== null && id > 0,
    staleTime: 60_000,
  });
}

// ────────────────────────────────────────────────────────────────
// Queries — Shares
// ────────────────────────────────────────────────────────────────

export function useStudioShares(targetType: string, targetId: number) {
  return useQuery({
    queryKey: studioKeys.shares(targetType, targetId),
    queryFn: () => listStudioShares(targetType, targetId),
    enabled: Boolean(targetType && targetId),
    staleTime: 30_000,
  });
}

// ────────────────────────────────────────────────────────────────
// Mutations — Cards
// ────────────────────────────────────────────────────────────────

export function useCreateStudioCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StudioCardCreateRequest) => createStudioCard(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studioKeys.cards() });
    },
  });
}

export function useUpdateStudioCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: StudioCardUpdateRequest }) =>
      updateStudioCard(id, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: studioKeys.cards() });
      qc.invalidateQueries({ queryKey: studioKeys.cardDetail(variables.id) });
    },
  });
}

export function useDeleteStudioCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteStudioCard(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studioKeys.cards() });
    },
  });
}

export function useCloneStudioCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => cloneStudioCard(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studioKeys.cards() });
    },
  });
}

export function useTestStudioCard() {
  return useMutation({
    mutationFn: (payload: StudioCardTestRequest) => testStudioCard(payload),
  });
}

// ────────────────────────────────────────────────────────────────
// Mutations — Dashboards
// ────────────────────────────────────────────────────────────────

export function useCreateStudioDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StudioDashboardCreateRequest) =>
      createStudioDashboard(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studioKeys.dashboards() });
    },
  });
}

export function useUpdateStudioDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: StudioDashboardUpdateRequest }) =>
      updateStudioDashboard(id, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: studioKeys.dashboards() });
      qc.invalidateQueries({ queryKey: studioKeys.dashboardDetail(variables.id) });
    },
  });
}

export function useDeleteStudioDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteStudioDashboard(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studioKeys.dashboards() });
    },
  });
}

// ────────────────────────────────────────────────────────────────
// Mutations — Shares
// ────────────────────────────────────────────────────────────────

export function useCreateStudioShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StudioShareRequest) => createStudioShare(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: studioKeys.shares(variables.targetType, variables.targetId),
      });
    },
  });
}

export function useDeleteStudioShare(targetType: string, targetId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteStudioShare(id),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: studioKeys.shares(targetType, targetId),
      });
    },
  });
}
