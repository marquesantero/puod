export type StudioScope = "Client" | "Company";
export type StudioCardStatus = "Draft" | "Published" | "Archived";
export type StudioDashboardStatus = "Draft" | "Published" | "Archived";
export type StudioShareTarget = "Card" | "Dashboard";
export type StudioShareSubject = "User" | "Group";
export type StudioShareAccess = "View" | "Edit";

export type StudioCard = {
  id: number;
  title: string;
  cardType: string;
  layoutType: string;
  status: StudioCardStatus;
  scope: StudioScope;
  clientId?: number | null;
  profileId?: number | null;
  integrationId?: number | null;
  createdAt: string;
  updatedAt: string;
  lastTestedAt?: string | null;
  lastTestSucceeded: boolean;
};

export type StudioCardDetail = StudioCard & {
  description?: string | null;
  query?: string | null;
  fieldsJson?: string | null;
  styleJson?: string | null;
  layoutJson?: string | null;
  refreshPolicyJson?: string | null;
  dataSourceJson?: string | null;
  lastTestSignature?: string | null;
};

export type StudioCardTestRequest = {
  integrationId?: number | null;
  query?: string | null;
  cardType?: string | null;
  layoutType?: string | null;
  fieldsJson?: string | null;
  styleJson?: string | null;
  layoutJson?: string | null;
  refreshPolicyJson?: string | null;
  dataSourceJson?: string | null;
};

export type StudioCardTestResult = {
  success: boolean;
  errorMessage?: string;
  signature?: string;
  executionTimeMs?: number;
};

export type StudioCardCreateRequest = {
  title: string;
  description?: string | null;
  scope: StudioScope;
  clientId?: number | null;
  profileId?: number | null;
  cardType: string;
  layoutType: string;
  integrationId?: number | null;
  query?: string | null;
  fieldsJson?: string | null;
  styleJson?: string | null;
  layoutJson?: string | null;
  refreshPolicyJson?: string | null;
  dataSourceJson?: string | null;
  testSignature?: string | null;
  testedAt?: string | null;
};

export type StudioCardUpdateRequest = {
  title?: string | null;
  description?: string | null;
  status?: StudioCardStatus;
  cardType?: string | null;
  layoutType?: string | null;
  integrationId?: number | null;
  query?: string | null;
  fieldsJson?: string | null;
  styleJson?: string | null;
  layoutJson?: string | null;
  refreshPolicyJson?: string | null;
  dataSourceJson?: string | null;
  testSignature?: string | null;
  testedAt?: string | null;
};

export type StudioDashboard = {
  id: number;
  name: string;
  status: StudioDashboardStatus;
  scope: StudioScope;
  clientId?: number | null;
  profileId?: number | null;
  layoutType: string;
  createdAt: string;
  updatedAt: string;
};

export type StudioDashboardCard = {
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
  layoutJson?: string | null;
  refreshPolicyJson?: string | null;
  dataSourceJson?: string | null;
};

export type StudioDashboardDetail = StudioDashboard & {
  description?: string | null;
  layoutJson?: string | null;
  refreshPolicyJson?: string | null;
  cards: StudioDashboardCard[];
};

export type StudioDashboardCreateRequest = {
  name: string;
  description?: string | null;
  scope: StudioScope;
  clientId?: number | null;
  profileId?: number | null;
  layoutType: string;
  layoutJson?: string | null;
  refreshPolicyJson?: string | null;
};

export type StudioDashboardUpdateRequest = {
  name?: string | null;
  description?: string | null;
  status?: StudioDashboardStatus;
  layoutType?: string | null;
  layoutJson?: string | null;
  refreshPolicyJson?: string | null;
  cards?: Array<{
    id?: number | null;
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
    layoutJson?: string | null;
    refreshPolicyJson?: string | null;
    dataSourceJson?: string | null;
  }>;
};

export type StudioShare = {
  id: number;
  targetType: StudioShareTarget;
  targetId: number;
  subjectType: StudioShareSubject;
  subjectId: number;
  accessLevel: StudioShareAccess;
  createdAt: string;
};

export type StudioShareRequest = {
  targetType: StudioShareTarget;
  targetId: number;
  subjectType: StudioShareSubject;
  subjectId: number;
  accessLevel: StudioShareAccess;
};
