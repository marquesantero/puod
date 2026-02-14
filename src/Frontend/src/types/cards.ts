export type DataSourceType = "airflow" | "adf" | "databricks" | "synapse";

export type CardTemplateId =
  | "airflow-dag-overview"
  | "airflow-dag-status"
  | "adf-pipeline-status"
  | "kpi-strip";

export type CardLayoutId =
  | "grid"
  | "list"
  | "timeline"
  | "kpi";

export type CardRefresh = "manual" | "1m" | "5m" | "15m" | "1h";

export type DataSource = {
  id: number;
  name: string;
  type: DataSourceType;
  authLabel: string;
  domain: string;
};

export type CardConfig = {
  id: number;
  title: string;
  templateId: CardTemplateId;
  layoutId: CardLayoutId;
  sourceId: number;
  refresh: CardRefresh;
  params: Record<string, string | string[]>;
};

export type CardTemplate = {
  id: CardTemplateId;
  name: string;
  description: string;
  supportedLayouts: CardLayoutId[];
  defaultLayout: CardLayoutId;
};
