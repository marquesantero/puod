/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Helpers compartilhados entre os renderers de cards.
 * Nenhum componente React aqui — apenas funções utilitárias puras.
 */

// ────────────────────────────────────────────────────────────────
// Format helpers
// ────────────────────────────────────────────────────────────────

/** Converte snake_case para Title Case. */
export function formatColumnName(col: string): string {
  return col
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Extrai o tipo de um run_id do Airflow (ex.: "scheduled__2024-..." → "Scheduled"). */
export function formatRunId(value: any): string {
  if (!value) return "-";
  const valueStr = String(value);
  if (valueStr.includes("__")) {
    const type = valueStr.split("__")[0];
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
  return valueStr;
}

/** Formata valores de data para exibição. */
export function formatDateValue(value: any): string {
  if (!value || value === null || value === undefined) return "-";
  if (typeof value === "object" && value.toString() === "[object Object]") return "-";

  const valueStr = String(value);
  if (valueStr === "[object Object]" || valueStr === "null") return "-";

  try {
    const date = new Date(valueStr);
    if (isNaN(date.getTime())) return "-";

    const now = new Date();
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return "-";
  }
}

/** Formata valores genéricos para exibição em células da tabela. */
export function formatCellValue(value: any): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

/** Calcula duração legível entre duas datas. */
export function calculateDuration(startDate: any, endDate: any): string {
  if (!startDate || !endDate) return "-";

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "-";

    const diffMs = end.getTime() - start.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffHours > 0) {
      const remainingMins = diffMins % 60;
      return `${diffHours}h ${remainingMins}m`;
    } else if (diffMins > 0) {
      const remainingSecs = diffSecs % 60;
      return `${diffMins}m ${remainingSecs}s`;
    } else {
      return `${diffSecs}s`;
    }
  } catch {
    return "-";
  }
}
