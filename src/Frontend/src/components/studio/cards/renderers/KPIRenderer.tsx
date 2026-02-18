// @ts-nocheck
import { TrendingUp, TrendingDown } from "lucide-react";
import type { QueryResultDto } from "@/lib/biIntegrationApi";

export function KPIRenderer({ data }: { data?: QueryResultDto }) {
  if (!data?.rows || data.rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  // Get first row and first numeric column
  const row = data.rows[0];
  const keys = Object.keys(row);
  const valueKey = keys.find((k) => typeof row[k] === "number") || keys[0];
  const value = row[valueKey];

  // Try to find a label or name column
  const labelKey = keys.find(
    (k) => k.toLowerCase().includes("label") || k.toLowerCase().includes("name"),
  );
  const label = labelKey ? row[labelKey] : valueKey;

  // Try to find change/trend data
  const changeKey = keys.find(
    (k) => k.toLowerCase().includes("change") || k.toLowerCase().includes("diff"),
  );
  const change = changeKey ? row[changeKey] : null;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      <p className="text-5xl font-bold text-foreground mb-2">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {change !== null && (
        <div
          className={`flex items-center gap-1 text-sm ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}
        >
          {change >= 0 ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span>{Math.abs(change)}%</span>
        </div>
      )}
    </div>
  );
}
