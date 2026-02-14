import { Fragment, useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import type { QueryResultDto } from "@/lib/biIntegrationApi";
import { executeQuery } from "@/lib/biIntegrationApi";
import { useI18n } from "@/contexts/I18nContext";

const airflowHistoryCache = new Map<string, any[]>();
const airflowLatestCache = new Map<string, any>();
const buildAirflowCacheKey = (integrationId: number, dagId: string) => `${integrationId}::${dagId}`;

interface CardDataRendererProps {
  cardType: string;
  layoutType: string;
  title: string;
  integrationId?: number;
  dataSourceJson?: string | null;
  queryData?: QueryResultDto;
  loading: boolean;
  error?: string;
}

export function CardDataRenderer({
  cardType,
  layoutType,
  title: _title,
  integrationId,
  dataSourceJson,
  queryData,
  loading,
  error,
}: CardDataRendererProps) {
  // Loading State
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-center p-4">
        <div>
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  // No Integration
  if (!integrationId) {
    return (
      <div className="h-full flex items-center justify-center text-center p-4">
        <div>
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-semibold">Integration Not Configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure an integration to see live data
          </p>
        </div>
      </div>
    );
  }

  // Render based on card type
  const renderCardContent = () => {
    switch (cardType?.toLowerCase()) {
      case "kpi":
        return <KPIRenderer data={queryData} />;
      case "grid":
      case "table":
        return <TableRenderer data={queryData} integrationId={integrationId} dataSourceJson={dataSourceJson} />;
      case "chart":
        return <ChartRenderer data={queryData} layoutType={layoutType} />;
      case "timeline":
        return <TimelineRenderer data={queryData} />;
      default:
        return (
          <div className="p-3">
            <p className="text-xs text-muted-foreground">
              Data loaded: {queryData?.rowCount || 0} rows
            </p>
          </div>
        );
    }
  };

  return <div className="h-full overflow-auto">{renderCardContent()}</div>;
}

// KPI Renderer
function KPIRenderer({ data }: { data?: QueryResultDto }) {
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
  const labelKey = keys.find((k) => k.toLowerCase().includes("label") || k.toLowerCase().includes("name"));
  const label = labelKey ? row[labelKey] : valueKey;

  // Try to find change/trend data
  const changeKey = keys.find((k) => k.toLowerCase().includes("change") || k.toLowerCase().includes("diff"));
  const change = changeKey ? row[changeKey] : null;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      <p className="text-5xl font-bold text-foreground mb-2">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {change !== null && (
        <div className={`flex items-center gap-1 text-sm ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{Math.abs(change)}%</span>
        </div>
      )}
    </div>
  );
}

// Table Renderer
function TableRenderer({
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
  const [dagRunsByDag, setDagRunsByDag] = useState<Record<string, { latestRun: any; historyRuns: any[] }>>({});
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

  // For Airflow DAG runs, show only the most important columns
  const importantColumns = ["dag_id", "dag_run_id", "state", "start_date", "end_date"];

  // Check if this looks like Airflow data
  const isAirflowData = (allColumns.includes("dag_id") && allColumns.includes("state")) || hasConfiguredDagIds;

  // Use only important columns if Airflow, otherwise show all except hidden ones
  const hiddenColumns = ["conf", "note", "last_scheduling_decision", "external_trigger", "data_interval_start", "data_interval_end", "logical_date", "run_type", "execution_date"];
  const columns = isAirflowData
    ? importantColumns.filter(col => col === "dag_id" || allColumns.includes(col) || col === "dag_run_id")
    : allColumns.filter(col => !hiddenColumns.includes(col));

  // Add duration column for Airflow data
  if (isAirflowData) {
    columns.push("duration");
  }

  const buildRowKey = (dagId: string, dagRunId: string) => `${dagId}::${dagRunId}`;

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
      if (!Number.isNaN(date.getTime())) {
        return date.getTime();
      }
    }

    return 0;
  };

  const sortRunsDesc = (rows: any[]) =>
    [...rows].sort((a, b) => parseRowDate(b) - parseRowDate(a));

  const updateHistoryCache = (cacheKey: string, previousLatest: any, latestRun: any, fallbackHistory: any[]) => {
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
      if (!groups.has(dagId)) {
        groups.set(dagId, []);
      }
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

  useEffect(() => {
    if (!isAirflowData || !integrationId) return;

    const dagIds = hasConfiguredDagIds
      ? configuredDagIds
      : Array.from(
          new Set((data?.rows ?? []).map((row: any) => row["dag_id"]).filter(Boolean))
        );

    if (dagIds.length === 0) return;

    const fetchLatestRuns = async (forceHistory = false) => {
      await Promise.all(
        dagIds.map(async (dagId) => {
          const encodedDagId = encodeURIComponent(String(dagId));
          const query = `/api/v1/dags/${encodedDagId}/dagRuns?order_by=-end_date&limit=30`;
          const result = await executeQuery({ integrationId, query });

          const sortedRuns = result.success && result.rows ? sortRunsDesc(result.rows) : [];
          const latestRun = sortedRuns[0] ?? { dag_id: dagId, state: "no_runs" };
          const fallbackHistory = sortedRuns.slice(1, 6);
          const cacheKey = buildAirflowCacheKey(integrationId, String(dagId));
          const previousLatest = airflowLatestCache.get(cacheKey);
          const historyRuns = updateHistoryCache(cacheKey, previousLatest, latestRun, fallbackHistory);

          airflowLatestCache.set(cacheKey, latestRun);
          setDagRunsByDag((prev) => ({
            ...prev,
            [dagId]: {
              latestRun,
              historyRuns,
            },
          }));
          setHistoryData((prev) => ({
            ...prev,
            [dagId]: historyRuns,
          }));

          if (forceHistory) {
            await fetchHistoryForDag(String(dagId), getDagRunId(latestRun), true);
          }
        })
      );
    };

    fetchLatestRuns();
  }, [data, integrationId, isAirflowData, configuredDagIds, hasConfiguredDagIds]);

  // Fetch tasks for a DAG run when expanded
  const fetchTasksForRow = async (row: any, dagId: string, dagRunId: string) => {
    if (!integrationId) return;

    const rowKey = buildRowKey(dagId, dagRunId);

    // Check if tasks already loaded
    if (taskData[rowKey]) return;

    setLoadingTasks(prev => new Set(prev).add(rowKey));

    try {
      const encodedDagId = encodeURIComponent(dagId);
      const encodedRunId = encodeURIComponent(dagRunId);
      const primaryQuery = `/api/v1/dags/${encodedDagId}/dagRuns/${encodedRunId}/taskInstances`;
      const primaryResult = await executeQuery({ integrationId, query: primaryQuery });

      const taskInstances = primaryResult.success ? (primaryResult.rows || []) : [];

      if (!primaryResult.success) {
        console.error("Failed to fetch tasks:", primaryResult.errorMessage);
      }

      const tasksQuery = `/api/v1/dags/${encodedDagId}/tasks`;
      const tasksResult = await executeQuery({ integrationId, query: tasksQuery });

      const taskDefinitions = tasksResult.success ? (tasksResult.rows || []) : [];
      if (!tasksResult.success) {
        console.error("Failed to fetch task definitions:", tasksResult.errorMessage);
      }

      const buildTaskDisplayRows = (definitions: any[], instances: any[]) => {
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
          const sortedAttempts = sortAttempts(attempts);
          return sortedAttempts[0];
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
            const upstream = Array.isArray(def?.upstream_task_ids) ? def.upstream_task_ids : [];
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
            if (node) {
              result.push(node);
            }
            const neighbors = Array.from(outgoing.get(currentId) ?? []).sort(sortQueue);
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
        for (const [taskId, attempts] of groups.entries()) {
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
      };

      const merged = buildTaskDisplayRows(taskDefinitions, taskInstances);

      setTaskData(prev => ({
        ...prev,
        [rowKey]: merged
      }));
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoadingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(rowKey);
        return newSet;
      });
    }
  };

  const fetchHistoryForDag = async (dagId: string, latestRunId?: string, force = false) => {
    if (!integrationId) return;

    const cacheKey = buildAirflowCacheKey(integrationId, dagId);
    const cachedHistory = airflowHistoryCache.get(cacheKey);
    if (!force && cachedHistory && cachedHistory.length > 0) {
      setHistoryData((prev) => ({
        ...prev,
        [dagId]: cachedHistory,
      }));
      return;
    }

    if (!force && historyData[dagId]) return;

    const currentGroup = resolvedAirflowRuns.find(group => group.dagId === dagId);
    if (!force && currentGroup?.historyRuns?.length && currentGroup.historyRuns.length >= 5) {
      setHistoryData(prev => ({
        ...prev,
        [dagId]: currentGroup.historyRuns.slice(0, 5),
      }));
      airflowHistoryCache.set(cacheKey, currentGroup.historyRuns.slice(0, 5));
      return;
    }

    setLoadingHistory(prev => new Set(prev).add(dagId));

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
        setHistoryData(prev => ({
          ...prev,
          [dagId]: filtered.slice(0, 5),
        }));
      }
    } catch (error) {
      console.error("Failed to fetch DAG history:", error);
    } finally {
      setLoadingHistory(prev => {
        const newSet = new Set(prev);
        newSet.delete(dagId);
        return newSet;
      });
    }
  };

  const refreshAirflowData = async () => {
    if (!isAirflowData || !integrationId) return;
    const dagIds = hasConfiguredDagIds
      ? configuredDagIds
      : Array.from(
          new Set((data?.rows ?? []).map((row: any) => row["dag_id"]).filter(Boolean))
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
          const sortedRuns = result.success && result.rows ? sortRunsDesc(result.rows) : [];
          const latestRun = sortedRuns[0] ?? { dag_id: dagId, state: "no_runs" };
          const fallbackHistory = sortedRuns.slice(1, 6);
          const cacheKey = buildAirflowCacheKey(integrationId, String(dagId));
          const previousLatest = airflowLatestCache.get(cacheKey);
          const historyRuns = updateHistoryCache(cacheKey, previousLatest, latestRun, fallbackHistory);

          latestByDag.set(String(dagId), latestRun);
          airflowLatestCache.set(cacheKey, latestRun);
          setDagRunsByDag((prev) => ({
            ...prev,
            [dagId]: {
              latestRun,
              historyRuns,
            },
          }));
          setHistoryData((prev) => ({
            ...prev,
            [dagId]: historyRuns,
          }));
        })
      );

      await Promise.all(
        dagIds.map(async (dagId) => {
          const latestRun = latestByDag.get(String(dagId));
          const latestRunId = latestRun ? getDagRunId(latestRun) : undefined;
          await fetchHistoryForDag(String(dagId), latestRunId, true);
        })
      );
    } finally {
      setLoadingRefresh(false);
    }
  };

  // Helper to calculate duration
  const calculateDuration = (startDate: any, endDate: any): string => {
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
  };

  // Helper to get column name with i18n
  const getColumnName = (col: string): string => {
    const colMap: Record<string, string> = {
      "dag_id": t("tableColDagId"),
      "dag_run_id": t("tableColExecutionType"),
      "state": t("tableColState"),
      "start_date": t("tableColStarted"),
      "end_date": t("tableColEnded"),
      "duration": t("tableColDuration"),
    };
    return colMap[col] || formatColumnName(col);
  };

  // Helper to get column width class
  const getColumnWidth = (col: string): string => {
    const widthMap: Record<string, string> = {
      "dag_id": "min-w-[200px] max-w-[300px]",
      "dag_run_id": "min-w-[120px] w-[140px]",
      "state": "min-w-[100px] w-[110px]",
      "start_date": "min-w-[140px] w-[150px]",
      "end_date": "min-w-[140px] w-[150px]",
      "duration": "min-w-[110px] w-[120px]",
    };
    return widthMap[col] || "min-w-[100px]";
  };

  // Helper to render cell with special formatting
  const renderCell = (col: string, row: any, rowKey: string, dagId?: string, isHistoryRow?: boolean, latestRunId?: string) => {
    // Duration column - calculate from start and end dates
    if (col === "duration") {
      return calculateDuration(row["start_date"], row["end_date"]);
    }

    // DAG ID column - add expand/collapse button
    if (col === "dag_id" && isAirflowData) {
      const isExpanded = expandedRows.has(rowKey);
      const hasRunId = Boolean(getDagRunId(row));
      const isHistoryExpanded = dagId ? expandedHistory.has(dagId) : false;
      const hasHistory = dagId
        ? (historyData[dagId]?.length ?? 0) > 0 || (groupedAirflowRuns.find(group => group.dagId === dagId)?.historyRuns?.length ?? 0) > 0
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
              {loadingHistory.has(dagId) ? "..." : isHistoryExpanded ? "H-" : "H+"}
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

    // Status/State column - render with colored badge
    if (col.toLowerCase() === "state" || col.toLowerCase() === "status") {
      return <StatusBadge status={value} />;
    }

    // DAG Run ID - extract type only (scheduled, manual, etc.)
    if (col.toLowerCase() === "dag_run_id" || col.toLowerCase() === "run_id") {
      return formatRunId(value);
    }

    // Date columns - format nicely
    if (col.toLowerCase().includes("date") || col.toLowerCase().includes("time")) {
      return formatDateValue(value);
    }

    // Default formatting
    return formatCellValue(value);
  };

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
              ? resolvedAirflowRuns.flatMap(({ dagId, latestRun, historyRuns }) => {
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
                    ...historyRows.map((row) => {
                      const historyRunId = getDagRunId(row);
                      if (!historyRunId) {
                        return null;
                      }
                      return {
                        row,
                        rowKey: buildRowKey(dagId, historyRunId),
                        isHistory: true,
                      };
                    }),
                  ].filter((entry): entry is { row: any; rowKey: string; isHistory: boolean } => Boolean(entry));

                  return rowsToRender.map(({ row, rowKey, isHistory }) => {
                    const expanded = expandedRows.has(rowKey);
                    const rowDagId = row["dag_id"];
                    const rowDagRunId = getDagRunId(row);
                    const tasks = taskData[rowKey];
                    const isLoadingTasks = loadingTasks.has(rowKey);

                    return (
                      <Fragment key={rowKey}>
                        <tr
                          key={rowKey}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                            isHistory ? "text-xs text-muted-foreground" : "text-sm"
                          }`}
                        >
                          {columns.map((col) => (
                            <td
                              key={`${rowKey}-${col}`}
                              className={`p-2 border-b border-slate-100 dark:border-slate-800 ${getColumnWidth(col)}`}
                            >
                              {renderCell(col, row, rowKey, dagId, isHistory, latestRunId)}
                            </td>
                          ))}
                        </tr>
                        {expanded && (
                          <tr key={`expanded-${rowKey}`} className="bg-slate-50/50 dark:bg-slate-900/30">
                            <td colSpan={columns.length} className="p-0 border-b border-slate-200 dark:border-slate-700">
                              <div className="pl-8 pr-4 py-3">
                                {isLoadingTasks ? (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Loading tasks...
                                  </div>
                                ) : tasks && tasks.length > 0 ? (
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
                                          <tr key={taskIdx} className="hover:bg-slate-100/30 dark:hover:bg-slate-800/30">
                                            <td className="p-1.5 border-b border-slate-100 dark:border-slate-800">
                                              <div className="flex flex-col">
                                                <span className="font-medium">{task.task_id}</span>
                                                {Number(task._try_total ?? 0) > 0 && (
                                                  <span className="text-[9px] text-muted-foreground mt-0.5">
                                                    Try {task._try_number}/{task._try_total}
                                                  </span>
                                                )}
                                                {task.upstream_task_ids && task.upstream_task_ids.length > 0 && (
                                                  <span className="text-[9px] text-muted-foreground mt-0.5">
                                                    ↑ {Array.isArray(task.upstream_task_ids)
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
                                ) : (
                                  <div className="text-xs text-muted-foreground italic py-2">
                                    No tasks found for this DAG run
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  });
                })
              : data.rows.map((row, i) => (
              <Fragment key={String(i)}>
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  {columns.map((col) => (
                    <td
                      key={col}
                      className={`p-2 border-b border-slate-100 dark:border-slate-800 ${getColumnWidth(col)}`}
                    >
                      {renderCell(col, row, String(i))}
                    </td>
                  ))}
                </tr>
                {/* Expanded Row - Tasks */}
                {expandedRows.has(String(i)) && (
                  <tr key={`expanded-${i}`} className="bg-slate-50/50 dark:bg-slate-900/30">
                    <td colSpan={columns.length} className="p-0 border-b border-slate-200 dark:border-slate-700">
                      <div className="pl-8 pr-4 py-3">
                        {loadingTasks.has(String(i)) ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading tasks...
                          </div>
                        ) : taskData[String(i)] && taskData[String(i)].length > 0 ? (
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
                                {taskData[String(i)].map((task: any, taskIdx: number) => (
                                  <tr key={taskIdx} className="hover:bg-slate-100/30 dark:hover:bg-slate-800/30">
                                    <td className="p-1.5 border-b border-slate-100 dark:border-slate-800">
                                      <div className="flex flex-col">
                                        <span className="font-medium">{task.task_id}</span>
                                        {Number(task._try_total ?? 0) > 0 && (
                                          <span className="text-[9px] text-muted-foreground mt-0.5">
                                            Try {task._try_number}/{task._try_total}
                                          </span>
                                        )}
                                        {task.upstream_task_ids && task.upstream_task_ids.length > 0 && (
                                          <span className="text-[9px] text-muted-foreground mt-0.5">
                                            ↑ {Array.isArray(task.upstream_task_ids)
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
                        ) : (
                          <div className="text-xs text-muted-foreground italic py-2">
                            No tasks found for this DAG run
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-2">{data.rowCount} rows</p>
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: any }) {
  const statusStr = String(status).toLowerCase();

  let bgColor = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
  let dotColor = "bg-slate-400";

  if (statusStr === "success" || statusStr === "succeeded") {
    bgColor = "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400";
    dotColor = "bg-emerald-500";
  } else if (statusStr === "failed" || statusStr === "failure" || statusStr === "error") {
    bgColor = "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
    dotColor = "bg-red-500";
  } else if (statusStr === "running" || statusStr === "in_progress") {
    bgColor = "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400";
    dotColor = "bg-blue-500";
  } else if (statusStr === "queued" || statusStr === "pending") {
    bgColor = "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
    dotColor = "bg-amber-500";
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium ${bgColor}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {status}
    </div>
  );
}

// Format column name (convert snake_case to Title Case)
function formatColumnName(col: string): string {
  return col
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Format Run ID - extract type only
function formatRunId(value: any): string {
  if (!value) return "-";

  const valueStr = String(value);

  // Extract the type from run_id (e.g., "scheduled__2024-06-11..." -> "scheduled")
  if (valueStr.includes("__")) {
    const type = valueStr.split("__")[0];
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  return valueStr;
}

// Format date values
function formatDateValue(value: any): string {
  // Handle null, undefined, or [object Object]
  if (!value || value === null || value === undefined) return "-";
  if (typeof value === "object" && value.toString() === "[object Object]") return "-";

  const valueStr = String(value);
  if (valueStr === "[object Object]" || valueStr === "null") return "-";

  try {
    // Try to parse as date
    const date = new Date(valueStr);
    if (isNaN(date.getTime())) return "-";

    const now = new Date();

    // Show formatted date/time consistently
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    return `${dateStr}, ${timeStr}`;
  } catch {
    return "-";
  }
}

// Chart Renderer
function ChartRenderer({ data, layoutType: _layoutType }: { data?: QueryResultDto; layoutType: string }) {
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
          {chartData.map((data, i) => (
            <div key={i} className="flex-1 flex flex-col items-center group relative max-w-[60px]">
              <div
                className="w-full bg-gradient-to-t from-blue-500 to-blue-400 dark:from-blue-600 dark:to-blue-500 rounded-t shadow transition-all hover:from-blue-600 hover:to-blue-500"
                style={{ height: `${data.value}%` }}
              />
              <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[9px] px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
                {data.display}
              </div>
            </div>
          ))}
        </div>

        {/* X-axis */}
        <div className="absolute bottom-0 left-12 right-2 flex justify-around text-[9px] text-muted-foreground">
          {chartData.map((data, i) => (
            <span key={i} className="flex-1 text-center max-w-[60px] truncate">
              {data.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Timeline Renderer
function TimelineRenderer({ data }: { data?: QueryResultDto }) {
  if (!data?.rows || data.rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  const events = data.rows.slice(0, 10); // Limit to 10 events
  const keys = Object.keys(events[0]);
  const titleKey = keys.find((k) => k.toLowerCase().includes("title") || k.toLowerCase().includes("name")) || keys[0];
  const timeKey = keys.find((k) => k.toLowerCase().includes("time") || k.toLowerCase().includes("date")) || keys[1];
  const descKey = keys.find((k) => k.toLowerCase().includes("desc") || k.toLowerCase().includes("message")) || keys[2];

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
                    <h5 className="text-[11px] font-semibold text-foreground">{event[titleKey]}</h5>
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

// Helper to format cell values
function formatCellValue(value: any): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}
