// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import type { QueryResultDto } from "@/lib/biIntegrationApi";

export function ChartRenderer({
  data,
  layoutType: _layoutType,
}: {
  data?: QueryResultDto;
  layoutType: string;
}) {
  if (!data?.rows || data.rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  const rows = data.rows.slice(0, 12); // Limit to 12 data points
  const keys = Object.keys(rows[0]);
  const labelKey = keys[0];
  const valueKey = keys.find((k) => typeof rows[0][k] === "number") || keys[1];

  // Calculate percentages for bar height
  const values = rows.map((r) => Number(r[valueKey]) || 0);
  const maxValue = Math.max(...values);
  const chartData = rows.map((r) => ({
    label: String(r[labelKey]).substring(0, 8),
    value: ((Number(r[valueKey]) || 0) / maxValue) * 100,
    display: r[valueKey],
  }));

  return (
    <div className="h-full p-4 flex flex-col">
      <div className="flex-1 relative">
        {/* Y-axis */}
        <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[9px] text-muted-foreground pr-2">
          <span>{Math.round(maxValue).toLocaleString()}</span>
          <span>{Math.round(maxValue * 0.5).toLocaleString()}</span>
          <span>0</span>
        </div>

        {/* Bars */}
        <div className="h-full pl-12 pr-2 pb-6 flex items-end justify-around gap-1">
          {chartData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center group relative max-w-[60px]">
              <div
                className="w-full bg-gradient-to-t from-blue-500 to-blue-400 dark:from-blue-600 dark:to-blue-500 rounded-t shadow transition-all hover:from-blue-600 hover:to-blue-500"
                style={{ height: `${d.value}%` }}
              />
              <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[9px] px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
                {d.display}
              </div>
            </div>
          ))}
        </div>

        {/* X-axis */}
        <div className="absolute bottom-0 left-12 right-2 flex justify-around text-[9px] text-muted-foreground">
          {chartData.map((d, i) => (
            <span key={i} className="flex-1 text-center max-w-[60px] truncate">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
