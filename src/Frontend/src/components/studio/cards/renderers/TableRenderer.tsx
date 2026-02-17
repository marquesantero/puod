import { Fragment, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { QueryResultDto } from "@/lib/biIntegrationApi";
import { executeQuery } from "@/lib/biIntegrationApi";
import { useI18n } from "@/contexts/I18nContext";
import { StatusBadge } from "./StatusBadge";
import {
  formatColumnName,
  formatRunId,
  formatDateValue,
  formatCellValue,
  calculateDuration,
} from "./shared";

// ────────────────────────────────────────────────────────────────
// Airflow caches (module-level singletons, igual ao original)
// ────────────────────────────────────────────────────────────────
const airflowHistoryCache = new Map<string, any[]>();
const airflowLatestCache = new Map<string, any>();
const buildAirflowCacheKey = (integrationId: number, dagId: string) =>
  `${integrationId}::${dagId}`;

// ────────────────────────────────────────────────────────────────
// Helpers internos
// ────────────────────────────────────────────────────────────────
const getDagRunId = (row: any): string | undefined => {
  const raw = row["dag_run_id"] ?? row["run_id"];
  if (raw === undefined || raw === null) return undefined;
  return String(raw).trim();
};

const parseRowDate = (row: any): number => {
  const candidates = [
    row.end_date,
    row.start_date,
    row.execution_date,
    row.logical_date,
    row.data_interval_end,
    row.data_interval_start,
  ];
  for (const value of candidates) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return 0;
};

const sortRunsDesc = (rows: any[]) =>
  [...rows].sort((a, b) => parseRowDate(b) - parseRowDate(a));

// ────────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────────
export function TableRenderer({
  data,
  integrationId,
  dataSourceJson,
}: {
  data?: QueryResultDto;
  integrationId?: number;
  dataSourceJson?: string | null;
}) {
  const { t } = useI18n();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [taskData, setTaskData] = useState<Record<string, any[]>>({});
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [historyData, setHistoryData] = useState<Record<string, any[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<Set<string>>(new Set());
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [dagRunsByDag, setDagRunsByDag] = useState<
    Record<string, { latestRun: any; historyRuns: any[] }>
  >({});

  const configuredDagIds = useMemo(() => {
    if (!dataSourceJson) return [];
    try {
      const parsed = JSON.parse(dataSourceJson);
      if (Array.isArray(parsed?.dagIds)) {
        return parsed.dagIds.map((id: any) => String(id)).filter(Boolean);
      }
    } catch {
      return [];
    }
    return [];
  }, [dataSourceJson]);

  const hasConfiguredDagIds = configuredDagIds.length > 0;

  if (!data?.rows || data.rows.length === 0) {
    if (hasConfiguredDagIds) {
      data = { rows: [], rowCount: 0, success: true, errorMessage: null, executionTimeMs: 0 };
    } else {
      return (
        <div className="h-full flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">No data available</p>
        </div>
      );
    }
  }

  const allColumns = data.rows.length > 0 ? Object.keys(data.rows[0]) : [];
  const importantColumns = ["dag_id", "dag_run_id", "state", "start_date", "end_date"];
  const isAirflowData =
    (allColumns.includes("dag_id") && allColumns.includes("state")) || hasConfiguredDagIds;

  const hiddenColumns = [
    "conf",
    "note",
    "last_scheduling_decision",
    "external_trigger",
    "data_interval_start",
    "data_interval_end",
    "logical_date",
    "run_type",
    "execution_date",
  ];

  const columns = isAirflowData
    ? importantColumns.filter(
        (col) => col === "dag_id" || allColumns.includes(col) || col === "dag_run_id",
      )
    : allColumns.filter((col) => !hiddenColumns.includes(col));

  if (isAirflowData) columns.push("duration");

  const buildRowKey = (dagId: string, dagRunId: string) => `${dagId}::${dagRunId}`;

  // ── Airflow history cache update ──
  const updateHistoryCache = (
    cacheKey: string,
    previousLatest: any,
    latestRun: any,
    fallbackHistory: any[],
  ) => {
    const previousId = previousLatest ? getDagRunId(previousLatest) : undefined;
    const latestId = latestRun ? getDagRunId(latestRun) : undefined;
    let history = airflowHistoryCache.get(cacheKey);

    if (!history || history.length === 0) {
      history = fallbackHistory;
    } else if (previousId && latestId && previousId !== latestId) {
      const cleaned = history.filter((row) => {
        const rowId = getDagRunId(row);
        return rowId && rowId !== previousId && rowId !== latestId;
      });
      history = [previousLatest, ...cleaned].slice(0, 5);
    }

    airflowHistoryCache.set(cacheKey, history);
    return history;
  };

  // ── Grouped Airflow runs ──
  const groupedAirflowRuns = useMemo(() => {
    if (!isAirflowData) return [];

    const groups = new Map<string, any[]>();
    for (const row of data?.rows ?? []) {
      const dagId = row["dag_id"];
      if (!dagId) continue;
      const list = groups.get(dagId) ?? [];
      list.push(row);
      groups.set(dagId, list);
    }

    for (const dagId of configuredDagIds) {
      if (!groups.has(dagId)) groups.set(dagId, []);
    }

    return Array.from(groups.entries())
      .map(([dagId, runs]) => {
        const sortedRuns = sortRunsDesc(runs);
        const latestRun = sortedRuns[0] ?? { dag_id: dagId, state: "no_runs" };
        const historyRuns = sortedRuns.slice(1, 6);
        return { dagId, latestRun, historyRuns };
      })
      .sort((a, b) => a.dagId.localeCompare(b.dagId));
  }, [data, isAirflowData, configuredDagIds]);

  const resolvedAirflowRuns = useMemo(() => {
    if (!isAirflowData) return [];
    return groupedAirflowRuns.map((group) => {
      const override = dagRunsByDag[group.dagId];
      if (!override) return group;
      return {
        dagId: group.dagId,
        latestRun: override.latestRun ?? group.latestRun,
        historyRuns: override.historyRuns ?? group.historyRuns,
      };
    });
  }, [groupedAirflowRuns, dagRunsByDag, isAirflowData]);

  // ── Fetch latest runs effect ──
  useEffect(() => {
    if (!isAirflowData || !integrationId) return;

    const dagIds = hasConfiguredDagIds
      ? configuredDagIds
      : Array.from(
          new Set(
            (data?.rows ?? []).map((row: any) => row["dag_id"]).filter(Boolean),
          ),
        );

    if (dagIds.length === 0) return;

    const fetchLatestRuns = async () => {
      await Promise.all(
        dagIds.map(async (dagId) => {
          const encodedDagId = encodeURIComponent(String(dagId));
          const query = `/api/v1/dags/${encodedDagId}/dagRuns?order_by=-end_date&limit=30`;
          const result = await executeQuery({ integrationId, query });

          const sortedRuns =
            result.success && result.rows ? sortRunsDesc(result.rows) : [];
          const latestRun = sortedRuns[0] ?? { dag_id: dagId, state: "no_runs" };
          const fallbackHistory = sortedRuns.slice(1, 6);
          const cacheKey = buildAirflowCacheKey(integrationId, String(dagId));
          const previousLatest = airflowLatestCache.get(cacheKey);
          const historyRuns = updateHistoryCache(
            cacheKey,
            previousLatest,
            latestRun,
            fallbackHistory,
          );

          airflowLatestCache.set(cacheKey, latestRun);
          setDagRunsByDag((prev) => ({
            ...prev,
            [dagId]: { latestRun, historyRuns },
          }));
          setHistoryData((prev) => ({
            ...prev,
            [dagId]: historyRuns,
          }));
        }),
      );
    };

    fetchLatestRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, integrationId, isAirflowData, configuredDagIds, hasConfiguredDagIds]);

  // ── Task fetcher ──
  const fetchTasksForRow = async (
    _row: any,
    dagId: string,
    dagRunId: string,
  ) => {
    if (!integrationId) return;
    const rowKey = buildRowKey(dagId, dagRunId);
    if (taskData[rowKey]) return;

    setLoadingTasks((prev) => new Set(prev).add(rowKey));

    try {
      const encodedDagId = encodeURIComponent(dagId);
      const encodedRunId = encodeURIComponent(dagRunId);
      const primaryQuery = `/api/v1/dags/${encodedDagId}/dagRuns/${encodedRunId}/taskInstances`;
      const primaryResult = await executeQuery({ integrationId, query: primaryQuery });
      const taskInstances = primaryResult.success ? primaryResult.rows || [] : [];

      if (!primaryResult.success) {
        console.error("Failed to fetch tasks:", primaryResult.errorMessage);
      }

      const tasksQuery = `/api/v1/dags/${encodedDagId}/tasks`;
      const tasksResult = await executeQuery({ integrationId, query: tasksQuery });
      const taskDefinitions = tasksResult.success ? tasksResult.rows || [] : [];

      if (!tasksResult.success) {
        console.error("Failed to fetch task definitions:", tasksResult.errorMessage);
      }

      const merged = buildTaskDisplayRows(taskDefinitions, taskInstances);
      setTaskData((prev) => ({ ...prev, [rowKey]: merged }));
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoadingTasks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(rowKey);
        return newSet;
      });
    }
  };

  // ── History fetcher ──
  const fetchHistoryForDag = async (
    dagId: string,
    latestRunId?: string,
    force = false,
  ) => {
    if (!integrationId) return;

    const cacheKey = buildAirflowCacheKey(integrationId, dagId);
    const cachedHistory = airflowHistoryCache.get(cacheKey);
    if (!force && cachedHistory && cachedHistory.length > 0) {
      setHistoryData((prev) => ({ ...prev, [dagId]: cachedHistory }));
      return;
    }

    if (!force && historyData[dagId]) return;

    const currentGroup = resolvedAirflowRuns.find((g) => g.dagId === dagId);
    if (
      !force &&
      currentGroup?.historyRuns?.length &&
      currentGroup.historyRuns.length >= 5
    ) {
      setHistoryData((prev) => ({
        ...prev,
        [dagId]: currentGroup.historyRuns.slice(0, 5),
      }));
      airflowHistoryCache.set(cacheKey, currentGroup.historyRuns.slice(0, 5));
      return;
    }

    setLoadingHistory((prev) => new Set(prev).add(dagId));

    try {
      const limit = 6;
      const encodedDagId = encodeURIComponent(dagId);
      const query = `/api/v1/dags/${encodedDagId}/dagRuns?order_by=-execution_date&limit=${limit}`;
      const result = await executeQuery({ integrationId, query });

      if (result.success && result.rows) {
        const sorted = sortRunsDesc(result.rows);
        const filtered = latestRunId
          ? sorted.filter((row) => row["dag_run_id"] !== latestRunId)
          : sorted.slice(1);
        airflowHistoryCache.set(cacheKey, filtered.slice(0, 5));
        setHistoryData((prev) => ({ ...prev, [dagId]: filtered.slice(0, 5) }));
      }
    } catch (error) {
      console.error("Failed to fetch DAG history:", error);
    } finally {
      setLoadingHistory((prev) => {
        const newSet = new Set(prev);
        newSet.delete(dagId);
        return newSet;
      });
    }
  };

  // ── Full Airflow refresh ──
  const refreshAirflowData = async () => {
    if (!isAirflowData || !integrationId) return;
    const dagIds = hasConfiguredDagIds
      ? configuredDagIds
      : Array.from(
          new Set(
            (data?.rows ?? []).map((row: any) => row["dag_id"]).filter(Boolean),
          ),
        );

    if (dagIds.length === 0) return;

    setLoadingRefresh(true);
    try {
      const latestByDag = new Map<string, any>();

      await Promise.all(
        dagIds.map(async (dagId) => {
          const encodedDagId = encodeURIComponent(String(dagId));
          const query = `/api/v1/dags/${encodedDagId}/dagRuns?order_by=-end_date&limit=30`;
          const result = await executeQuery({ integrationId, query });
          const sortedRuns =
            result.success && result.rows ? sortRunsDesc(result.rows) : [];
          const latestRun = sortedRuns[0] ?? { dag_id: dagId, state: "no_runs" };
          const fallbackHistory = sortedRuns.slice(1, 6);
          const cacheKey = buildAirflowCacheKey(integrationId, String(dagId));
          const previousLatest = airflowLatestCache.get(cacheKey);
          const historyRuns = updateHistoryCache(
            cacheKey,
            previousLatest,
            latestRun,
            fallbackHistory,
          );

          latestByDag.set(String(dagId), latestRun);
          airflowLatestCache.set(cacheKey, latestRun);
          setDagRunsByDag((prev) => ({
            ...prev,
            [dagId]: { latestRun, historyRuns },
          }));
          setHistoryData((prev) => ({ ...prev, [dagId]: historyRuns }));
        }),
      );

      await Promise.all(
        dagIds.map(async (dagId) => {
          const latestRun = latestByDag.get(String(dagId));
          const latestRunId = latestRun ? getDagRunId(latestRun) : undefined;
          await fetchHistoryForDag(String(dagId), latestRunId, true);
        }),
      );
    } finally {
      setLoadingRefresh(false);
    }
  };

  // ── Column helpers ──
  const getColumnName = (col: string): string => {
    const colMap: Record<string, string> = {
      dag_id: t("tableColDagId"),
      dag_run_id: t("tableColExecutionType"),
      state: t("tableColState"),
      start_date: t("tableColStarted"),
      end_date: t("tableColEnded"),
      duration: t("tableColDuration"),
    };
    return colMap[col] || formatColumnName(col);
  };

  const getColumnWidth = (col: string): string => {
    const widthMap: Record<string, string> = {
      dag_id: "min-w-[200px] max-w-[300px]",
      dag_run_id: "min-w-[120px] w-[140px]",
      state: "min-w-[100px] w-[110px]",
      start_date: "min-w-[140px] w-[150px]",
      end_date: "min-w-[140px] w-[150px]",
      duration: "min-w-[110px] w-[120px]",
    };
    return widthMap[col] || "min-w-[100px]";
  };

  // ── Cell renderer ──
  const renderCell = (
    col: string,
    row: any,
    rowKey: string,
    dagId?: string,
    isHistoryRow?: boolean,
    latestRunId?: string,
  ) => {
    if (col === "duration") {
      return calculateDuration(row["start_date"], row["end_date"]);
    }

    if (col === "dag_id" && isAirflowData) {
      const isExpanded = expandedRows.has(rowKey);
      const hasRunId = Boolean(getDagRunId(row));
      const isHistoryExpanded = dagId ? expandedHistory.has(dagId) : false;
      const hasHistory = dagId
        ? (historyData[dagId]?.length ?? 0) > 0 ||
          (groupedAirflowRuns.find((g) => g.dagId === dagId)?.historyRuns
            ?.length ?? 0) > 0
        : false;

      return (
        <div className="flex items-center gap-1.5">
          {!isHistoryRow && dagId && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!hasHistory && !historyData[dagId]) {
                  await fetchHistoryForDag(dagId, latestRunId);
                }
                const newExpanded = new Set(expandedHistory);
                if (isHistoryExpanded) {
                  newExpanded.delete(dagId);
                } else {
                  newExpanded.add(dagId);
                }
                setExpandedHistory(newExpanded);
              }}
              className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700"
              disabled={loadingHistory.has(dagId)}
            >
              {loadingHistory.has(dagId)
                ? "..."
                : isHistoryExpanded
                  ? "H-"
                  : "H+"}
            </button>
          )}
          {hasRunId && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                const newExpanded = new Set(expandedRows);
                if (isExpanded) {
                  newExpanded.delete(rowKey);
                } else {
                  newExpanded.add(rowKey);
                  const dagIdValue = row["dag_id"];
                  const dagRunId = getDagRunId(row);
                  if (dagIdValue && dagRunId) {
                    await fetchTasksForRow(row, dagIdValue, dagRunId);
                  }
                }
                setExpandedRows(newExpanded);
              }}
              className={`px-1.5 py-0.5 ${isHistoryRow ? "text-[9px]" : "text-[10px]"} font-semibold rounded bg-indigo-600 text-white border border-indigo-600 hover:bg-indigo-700 ${
                isHistoryRow ? "ml-1" : ""
              }`}
            >
              {isExpanded ? "T-" : "T+"}
            </button>
          )}
          <span
            className={`truncate ${
              isHistoryRow
                ? "ml-1 text-muted-foreground text-xs"
                : "font-semibold text-sm"
            }`}
          >
            {row[col]}
          </span>
        </div>
      );
    }

    const value = row[col];

    if (col.toLowerCase() === "state" || col.toLowerCase() === "status") {
      return <StatusBadge status={value} />;
    }

    if (col.toLowerCase() === "dag_run_id" || col.toLowerCase() === "run_id") {
      return formatRunId(value);
    }

    if (
      col.toLowerCase().includes("date") ||
      col.toLowerCase().includes("time")
    ) {
      return formatDateValue(value);
    }

    return formatCellValue(value);
  };

  // ── Task instance sub-table ──
  const renderTasksTable = (tasks: any[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] border-collapse">
        <thead className="bg-slate-100/50 dark:bg-slate-800/50">
          <tr>
            <th className="text-left p-1.5 font-semibold border-b border-slate-200 dark:border-slate-700 min-w-[120px]">
              Task
            </th>
            <th className="text-left p-1.5 font-semibold border-b border-slate-200 dark:border-slate-700 min-w-[80px]">
              {t("tableColState")}
            </th>
            <th className="text-left p-1.5 font-semibold border-b border-slate-200 dark:border-slate-700 min-w-[110px]">
              {t("tableColStarted")}
            </th>
            <th className="text-left p-1.5 font-semibold border-b border-slate-200 dark:border-slate-700 min-w-[110px]">
              {t("tableColEnded")}
            </th>
            <th className="text-left p-1.5 font-semibold border-b border-slate-200 dark:border-slate-700 min-w-[90px]">
              {t("tableColDuration")}
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task: any, taskIdx: number) => (
            <tr
              key={taskIdx}
              className="hover:bg-slate-100/30 dark:hover:bg-slate-800/30"
            >
              <td className="p-1.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-col">
                  <span className="font-medium">{task.task_id}</span>
                  {Number(task._try_total ?? 0) > 0 && (
                    <span className="text-[9px] text-muted-foreground mt-0.5">
                      Try {task._try_number}/{task._try_total}
                    </span>
                  )}
                  {task.upstream_task_ids &&
                    task.upstream_task_ids.length > 0 && (
                      <span className="text-[9px] text-muted-foreground mt-0.5">
                        &uarr;{" "}
                        {Array.isArray(task.upstream_task_ids)
                          ? task.upstream_task_ids.join(", ")
                          : task.upstream_task_ids}
                      </span>
                    )}
                </div>
              </td>
              <td className="p-1.5 border-b border-slate-100 dark:border-slate-800">
                <StatusBadge status={task.state} />
              </td>
              <td className="p-1.5 border-b border-slate-100 dark:border-slate-800">
                {formatDateValue(task.start_date)}
              </td>
              <td className="p-1.5 border-b border-slate-100 dark:border-slate-800">
                {formatDateValue(task.end_date)}
              </td>
              <td className="p-1.5 border-b border-slate-100 dark:border-slate-800">
                {calculateDuration(task.start_date, task.end_date)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ── Expanded row panel ──
  const renderExpandedRow = (rowKey: string) => {
    const isLoadingTasks = loadingTasks.has(rowKey);
    const tasks = taskData[rowKey];

    return (
      <div className="pl-8 pr-4 py-3">
        {isLoadingTasks ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading tasks...
          </div>
        ) : tasks && tasks.length > 0 ? (
          renderTasksTable(tasks)
        ) : (
          <div className="text-xs text-muted-foreground italic py-2">
            No tasks found for this DAG run
          </div>
        )}
      </div>
    );
  };

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      {isAirflowData && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted-foreground">Airflow</span>
          <button
            type="button"
            onClick={refreshAirflowData}
            className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
            disabled={loadingRefresh}
          >
            {loadingRefresh ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      )}
      <div className="overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className={`text-left p-2 font-semibold border-b-2 border-slate-200 dark:border-slate-700 ${getColumnWidth(col)}`}
                >
                  {getColumnName(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isAirflowData
              ? resolvedAirflowRuns.flatMap(
                  ({ dagId, latestRun, historyRuns }) => {
                    const historyRows = expandedHistory.has(dagId)
                      ? historyData[dagId] || historyRuns
                      : [];
                    const latestRunId = getDagRunId(latestRun);

                    const rowsToRender = [
                      {
                        row: latestRun,
                        rowKey: buildRowKey(dagId, latestRunId ?? "no_run"),
                        isHistory: false,
                      },
                      ...historyRows
                        .map((row) => {
                          const historyRunId = getDagRunId(row);
                          if (!historyRunId) return null;
                          return {
                            row,
                            rowKey: buildRowKey(dagId, historyRunId),
                            isHistory: true,
                          };
                        })
                        .filter(
                          (
                            entry,
                          ): entry is {
                            row: any;
                            rowKey: string;
                            isHistory: boolean;
                          } => Boolean(entry),
                        ),
                    ];

                    return rowsToRender.map(({ row, rowKey, isHistory }) => {
                      const expanded = expandedRows.has(rowKey);

                      return (
                        <Fragment key={rowKey}>
                          <tr
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                              isHistory
                                ? "text-xs text-muted-foreground"
                                : "text-sm"
                            }`}
                          >
                            {columns.map((col) => (
                              <td
                                key={`${rowKey}-${col}`}
                                className={`p-2 border-b border-slate-100 dark:border-slate-800 ${getColumnWidth(col)}`}
                              >
                                {renderCell(
                                  col,
                                  row,
                                  rowKey,
                                  dagId,
                                  isHistory,
                                  latestRunId,
                                )}
                              </td>
                            ))}
                          </tr>
                          {expanded && (
                            <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                              <td
                                colSpan={columns.length}
                                className="p-0 border-b border-slate-200 dark:border-slate-700"
                              >
                                {renderExpandedRow(rowKey)}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    });
                  },
                )
              : data.rows.map((row, i) => {
                  const expanded = expandedRows.has(String(i));
                  return (
                    <Fragment key={String(i)}>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {columns.map((col) => (
                          <td
                            key={col}
                            className={`p-2 border-b border-slate-100 dark:border-slate-800 ${getColumnWidth(col)}`}
                          >
                            {renderCell(col, row, String(i))}
                          </td>
                        ))}
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                          <td
                            colSpan={columns.length}
                            className="p-0 border-b border-slate-200 dark:border-slate-700"
                          >
                            {renderExpandedRow(String(i))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-2">{data.rowCount} rows</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Topological sort + task display builder (extraído para fora do render)
// ────────────────────────────────────────────────────────────────
function buildTaskDisplayRows(definitions: any[], instances: any[]) {
  const groups = new Map<string, any[]>();
  for (const instance of instances) {
    const taskId = instance?.task_id ? String(instance.task_id) : "";
    if (!taskId) continue;
    const list = groups.get(taskId) ?? [];
    list.push(instance);
    groups.set(taskId, list);
  }

  const sortAttempts = (attempts: any[]) =>
    [...attempts].sort((a, b) => {
      const tryA = Number(a?.try_number ?? 0);
      const tryB = Number(b?.try_number ?? 0);
      if (tryA !== tryB) return tryB - tryA;
      return parseRowDate(b) - parseRowDate(a);
    });

  const getLatestInstance = (taskId: string) => {
    const attempts = groups.get(taskId) ?? [];
    return sortAttempts(attempts)[0];
  };

  const orderTaskDefinitions = (defs: any[]) => {
    if (!defs.length) return defs;

    const nodes = new Map<string, any>();
    const inDegree = new Map<string, number>();
    const outgoing = new Map<string, Set<string>>();

    for (const def of defs) {
      const taskId = def?.task_id ? String(def.task_id) : "";
      if (!taskId) continue;
      nodes.set(taskId, def);
      inDegree.set(taskId, 0);
      outgoing.set(taskId, new Set());
    }

    for (const def of defs) {
      const taskId = def?.task_id ? String(def.task_id) : "";
      if (!taskId) continue;
      const upstream = Array.isArray(def?.upstream_task_ids)
        ? def.upstream_task_ids
        : [];
      for (const upstreamId of upstream) {
        const upstreamStr = String(upstreamId);
        if (!nodes.has(upstreamStr)) continue;
        outgoing.get(upstreamStr)?.add(taskId);
        inDegree.set(taskId, (inDegree.get(taskId) ?? 0) + 1);
      }
    }

    const sortQueue = (a: string, b: string) => {
      const aInstance = getLatestInstance(a);
      const bInstance = getLatestInstance(b);
      const aDate = aInstance ? parseRowDate(aInstance) : 0;
      const bDate = bInstance ? parseRowDate(bInstance) : 0;
      if (aDate !== bDate) return aDate - bDate;
      return a.localeCompare(b);
    };

    const queue = Array.from(inDegree.entries())
      .filter(([, degree]) => degree === 0)
      .map(([taskId]) => taskId)
      .sort(sortQueue);

    const result: any[] = [];
    while (queue.length) {
      const currentId = queue.shift()!;
      const node = nodes.get(currentId);
      if (node) result.push(node);
      const neighbors = Array.from(outgoing.get(currentId) ?? []).sort(
        sortQueue,
      );
      for (const neighbor of neighbors) {
        const degree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, degree);
        if (degree === 0) {
          queue.push(neighbor);
          queue.sort(sortQueue);
        }
      }
    }

    if (result.length !== nodes.size) {
      return [...defs].sort((a, b) => {
        const aId = a?.task_id ? String(a.task_id) : "";
        const bId = b?.task_id ? String(b.task_id) : "";
        return aId.localeCompare(bId);
      });
    }
    return result;
  };

  if (definitions.length > 0) {
    const orderedDefinitions = orderTaskDefinitions(definitions);
    return orderedDefinitions.map((definition: any) => {
      const taskId = definition?.task_id ? String(definition.task_id) : "";
      const attempts = groups.get(taskId) ?? [];
      const sortedAttempts = sortAttempts(attempts);
      const latest = sortedAttempts[0];
      if (latest) {
        return {
          ...latest,
          _try_number: Number(latest?.try_number ?? 0),
          _try_total: attempts.length,
        };
      }
      return {
        task_id: taskId,
        state: "not_run",
        start_date: null,
        end_date: null,
        _try_number: 0,
        _try_total: 0,
      };
    });
  }

  const rows: any[] = [];
  for (const [, attempts] of groups.entries()) {
    const sortedAttempts = sortAttempts(attempts);
    const latest = sortedAttempts[0];
    if (!latest) continue;
    rows.push({
      ...latest,
      _try_number: Number(latest?.try_number ?? 0),
      _try_total: attempts.length,
    });
  }
  return rows;
}
