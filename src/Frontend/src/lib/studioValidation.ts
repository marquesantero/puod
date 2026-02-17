import { z } from "zod";

// =============================================
// Card Validation
// =============================================

export const cardDraftSchema = z.object({
  title: z
    .string()
    .min(1, "O título é obrigatório")
    .max(200, "O título deve ter no máximo 200 caracteres"),
  description: z
    .string()
    .max(1000, "A descrição deve ter no máximo 1000 caracteres")
    .optional()
    .default(""),
  scope: z.enum(["Client", "Company"]),
  clientId: z.number().positive().optional(),
  profileId: z.number().positive().optional(),
  cardType: z.enum(["kpi", "table", "timeline", "status"], {
    message: "Selecione um tipo de card válido",
  }),
  layoutType: z.string().min(1, "Selecione um layout"),
  integrationId: z.number().positive().optional(),
  query: z.string().max(10000, "A query deve ter no máximo 10.000 caracteres").optional().default(""),
  refreshMode: z.enum(["Manual", "Interval", "Inherit"]),
  refreshInterval: z.enum(["1m", "5m", "15m", "1h", "6h"]),
}).refine(
  (data) => {
    if (data.scope === "Client") return data.clientId != null;
    return true;
  },
  { message: "Selecione um cliente", path: ["clientId"] }
).refine(
  (data) => {
    if (data.scope === "Company") return data.profileId != null;
    return true;
  },
  { message: "Selecione uma empresa", path: ["profileId"] }
);

export type CardDraftValidation = z.infer<typeof cardDraftSchema>;

// =============================================
// Dashboard Validation
// =============================================

export const dashboardDraftSchema = z.object({
  name: z
    .string()
    .min(1, "O nome é obrigatório")
    .max(200, "O nome deve ter no máximo 200 caracteres"),
  description: z
    .string()
    .max(1000, "A descrição deve ter no máximo 1000 caracteres")
    .optional()
    .default(""),
  scope: z.enum(["Client", "Company"]),
  clientId: z.number().positive().optional(),
  profileId: z.number().positive().optional(),
  layoutType: z.string().min(1, "Selecione um layout"),
  refreshMode: z.enum(["Manual", "Interval"]),
  refreshInterval: z.enum(["1m", "5m", "15m", "1h"]),
}).refine(
  (data) => {
    if (data.scope === "Client") return data.clientId != null;
    return true;
  },
  { message: "Selecione um cliente", path: ["clientId"] }
).refine(
  (data) => {
    if (data.scope === "Company") return data.profileId != null;
    return true;
  },
  { message: "Selecione uma empresa", path: ["profileId"] }
);

export type DashboardDraftValidation = z.infer<typeof dashboardDraftSchema>;

// =============================================
// Dashboard Card Position Validation
// =============================================

export const dashboardCardPositionSchema = z.object({
  positionX: z.number().min(0, "Posição X não pode ser negativa"),
  positionY: z.number().min(0, "Posição Y não pode ser negativa"),
  width: z.number().min(1, "Largura mínima é 1").max(24, "Largura máxima é 24"),
  height: z.number().min(1, "Altura mínima é 1").max(24, "Altura máxima é 24"),
});

// =============================================
// Helper: validate and return errors
// =============================================

export function validateCardDraft(draft: Record<string, unknown>): {
  success: boolean;
  errors: Record<string, string>;
} {
  const result = cardDraftSchema.safeParse(draft);
  if (result.success) {
    return { success: true, errors: {} };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return { success: false, errors };
}

export function validateDashboardDraft(draft: Record<string, unknown>): {
  success: boolean;
  errors: Record<string, string>;
} {
  const result = dashboardDraftSchema.safeParse(draft);
  if (result.success) {
    return { success: true, errors: {} };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return { success: false, errors };
}
