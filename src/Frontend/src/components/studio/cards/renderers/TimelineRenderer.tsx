// @ts-nocheck
import type { QueryResultDto } from "@/lib/biIntegrationApi";
import { formatCellValue } from "./shared";

export function TimelineRenderer({ data }: { data?: QueryResultDto }) {
  if (!data?.rows || data.rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  const events = data.rows.slice(0, 10); // Limit to 10 events
  const keys = Object.keys(events[0]);
  const titleKey =
    keys.find(
      (k) => k.toLowerCase().includes("title") || k.toLowerCase().includes("name"),
    ) || keys[0];
  const timeKey =
    keys.find(
      (k) => k.toLowerCase().includes("time") || k.toLowerCase().includes("date"),
    ) || keys[1];
  const descKey =
    keys.find(
      (k) => k.toLowerCase().includes("desc") || k.toLowerCase().includes("message"),
    ) || keys[2];

  return (
    <div className="p-3 space-y-3">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-purple-200 dark:bg-purple-800" />

        <div className="space-y-3">
          {events.map((event, i) => (
            <div key={i} className="flex gap-2 relative">
              {/* Dot */}
              <div className="relative z-10 flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-purple-500 dark:bg-purple-600 border-2 border-white dark:border-slate-900" />
              </div>

              {/* Content */}
              <div className="flex-1 pb-1">
                <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h5 className="text-[11px] font-semibold text-foreground">
                      {event[titleKey]}
                    </h5>
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                      {formatCellValue(event[timeKey])}
                    </span>
                  </div>
                  {descKey && (
                    <p className="text-[10px] text-muted-foreground">{event[descKey]}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
