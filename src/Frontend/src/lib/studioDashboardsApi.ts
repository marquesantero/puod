/**
 * @deprecated This module is deprecated. Import directly from "@/lib/studioApi" instead.
 *
 * This file re-exports everything from studioApi for backward compatibility.
 * All new code should import from "@/lib/studioApi".
 */
export {
  // Functions
  getDashboards,
  getDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,

  // Type aliases
  type StudioDashboardDto,
  type StudioDashboardDetailDto,
  type StudioDashboardCardDto,
  type CreateStudioDashboardRequest,
  type UpsertStudioDashboardCardRequest,
} from "@/lib/studioApi";

export type { StudioDashboardUpdateRequest as UpdateStudioDashboardRequest } from "@/types/studio";
export type { StudioScope } from "@/types/studio";
