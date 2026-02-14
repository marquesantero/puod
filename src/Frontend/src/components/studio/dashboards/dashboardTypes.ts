import type { StudioCard, StudioDashboardStatus } from "@/types/studio";

export type DashboardLayoutSettings = {
  columns: string;
  gap: string;
  rowHeight: string;
  cardPadding: string;
  headerStyle: "expanded" | "compact";
  backgroundPattern: "none" | "grid" | "dots";
  showFilters: boolean;
  showLegend: boolean;
  canvasMode: "responsive" | "fixed";
  canvasWidth: string;
};

export type DashboardCardDraft = {
  id?: number;
  cardId: number;
  templateCardId?: number;
  templateSeedKey?: string;
  templateIntegrationType?: string;
  templateEndpoint?: string;
  templateTitle?: string;
  templateCardType?: string;
  integrationId?: number;
  params?: Record<string, string>;
  orderIndex: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  title: string;
  description: string;
  showTitle: boolean;
  showDescription: boolean;
  refreshMode: "Inherit" | "Interval" | "Manual";
  refreshInterval: string;
};

export type TemplateCard = StudioCard & {
  seedKey?: string;
  integrationType?: string;
  endpoint?: string;
  description?: string | null;
};

export type DashboardDraft = {
  id?: number;
  name: string;
  description: string;
  status: StudioDashboardStatus;
  scope: "Client" | "Company";
  clientId?: number;
  profileId?: number;
  layoutType: string;
  refreshMode: "Manual" | "Interval";
  refreshInterval: string;
  layout: DashboardLayoutSettings;
  theme: {
    background: string;
    text: string;
    accent: string;
    fontSize: string;
    radius: string;
    shadow: string;
  };
  cards: DashboardCardDraft[];
};

export type ShareDraft = {
  subjectType: "User" | "Group";
  subjectId: string;
  accessLevel: "View" | "Edit";
};
