/**
 * @deprecated This module is deprecated. Import directly from "@/lib/studioApi" instead.
 *
 * This file re-exports everything from studioApi for backward compatibility.
 * All new code should import from "@/lib/studioApi".
 */
export {
  // Functions
  getCards,
  getCard,
  createCard,
  updateCard,
  deleteCard,
  cloneCard,
  testCard,
  getTemplates,

  // Type aliases
  type StudioCardDto,
  type StudioCardDetailDto,
  type CreateStudioCardRequest,
  type UpdateStudioCardRequest,
  type StudioCardTestResult,
} from "@/lib/studioApi";

export type { StudioCardTestRequest } from "@/types/studio";
