export interface CardTemplate {
  id: string;
  name: string;
  nameKey: string; // i18n key
  description: string;
  descriptionKey: string; // i18n key
  cardType: "kpi" | "table" | "grid" | "chart" | "timeline";
  layoutType: string;
  category: "sales" | "operations" | "analytics" | "monitoring" | "general";
  icon: string;
  queryTemplate: string;
  requiredTables?: string[];
  placeholders?: { key: string; label: string; default: string }[];
  previewImage?: string;
}

export const cardTemplates: CardTemplate[] = [
  // ===== SALES TEMPLATES =====
  {
    id: "total-revenue-kpi",
    name: "Total Revenue",
    nameKey: "templateTotalRevenue",
    description: "Shows total revenue with percentage change",
    descriptionKey: "templateTotalRevenueDesc",
    cardType: "kpi",
    layoutType: "single",
    category: "sales",
    icon: "💰",
    queryTemplate: `SELECT
  SUM(revenue) as value,
  'Total Revenue' as label,
  ((SUM(revenue) - LAG(SUM(revenue)) OVER (ORDER BY period)) / LAG(SUM(revenue)) OVER (ORDER BY period) * 100) as change
FROM {{table_name}}
WHERE date >= CURRENT_DATE - INTERVAL '30 days'`,
    requiredTables: ["sales", "revenue", "transactions"],
    placeholders: [{ key: "table_name", label: "Sales Table", default: "fact_sales" }],
  },
  {
    id: "top-customers",
    name: "Top 10 Customers by Revenue",
    nameKey: "templateTopCustomers",
    description: "List of highest-revenue customers",
    descriptionKey: "templateTopCustomersDesc",
    cardType: "table",
    layoutType: "list",
    category: "sales",
    icon: "👥",
    queryTemplate: `SELECT
  customer_name,
  SUM(revenue) as total_revenue,
  COUNT(DISTINCT order_id) as total_orders,
  AVG(revenue) as avg_order_value
FROM {{table_name}}
WHERE date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY customer_name
ORDER BY total_revenue DESC
LIMIT 10`,
    requiredTables: ["customers", "orders"],
    placeholders: [{ key: "table_name", label: "Orders Table", default: "fact_orders" }],
  },
  {
    id: "monthly-revenue-trend",
    name: "Monthly Revenue Trend",
    nameKey: "templateMonthlyRevenue",
    description: "Revenue trends over the last 12 months",
    descriptionKey: "templateMonthlyRevenueDesc",
    cardType: "chart",
    layoutType: "line",
    category: "sales",
    icon: "📈",
    queryTemplate: `SELECT
  DATE_TRUNC('month', date) as month,
  SUM(revenue) as total_revenue
FROM {{table_name}}
WHERE date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', date)
ORDER BY month`,
    requiredTables: ["sales"],
    placeholders: [{ key: "table_name", label: "Sales Table", default: "fact_sales" }],
  },

  // ===== OPERATIONS TEMPLATES =====
  {
    id: "pipeline-success-rate",
    name: "Pipeline Success Rate",
    nameKey: "templatePipelineSuccess",
    description: "Success rate of data pipelines",
    descriptionKey: "templatePipelineSuccessDesc",
    cardType: "kpi",
    layoutType: "single",
    category: "operations",
    icon: "✅",
    queryTemplate: `SELECT
  ROUND((SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as value,
  'Success Rate' as label,
  (ROUND((SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) -
   LAG(ROUND((SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2)) OVER (ORDER BY period)) as change
FROM {{table_name}}
WHERE execution_date >= CURRENT_DATE - INTERVAL '7 days'`,
    requiredTables: ["dag_runs", "pipeline_executions"],
    placeholders: [{ key: "table_name", label: "Pipeline Table", default: "airflow_dag_runs" }],
  },
  {
    id: "recent-dag-runs",
    name: "Recent DAG Runs",
    nameKey: "templateRecentDags",
    description: "Latest pipeline execution status",
    descriptionKey: "templateRecentDagsDesc",
    cardType: "table",
    layoutType: "list",
    category: "operations",
    icon: "🔄",
    queryTemplate: `SELECT
  dag_id,
  execution_date,
  state,
  duration,
  start_date
FROM {{table_name}}
WHERE execution_date >= CURRENT_DATE - INTERVAL '24 hours'
ORDER BY execution_date DESC
LIMIT 20`,
    requiredTables: ["dag_runs"],
    placeholders: [{ key: "table_name", label: "DAG Runs Table", default: "airflow_dag_runs" }],
  },
  {
    id: "pipeline-timeline",
    name: "Pipeline Execution Timeline",
    nameKey: "templatePipelineTimeline",
    description: "Timeline of recent pipeline executions",
    descriptionKey: "templatePipelineTimelineDesc",
    cardType: "timeline",
    layoutType: "vertical",
    category: "operations",
    icon: "⏱️",
    queryTemplate: `SELECT
  dag_id as title,
  execution_date as time,
  CONCAT('Status: ', state, ' - Duration: ', duration, 's') as description,
  state as status
FROM {{table_name}}
WHERE execution_date >= CURRENT_DATE - INTERVAL '24 hours'
ORDER BY execution_date DESC
LIMIT 10`,
    requiredTables: ["dag_runs"],
    placeholders: [{ key: "table_name", label: "DAG Runs Table", default: "airflow_dag_runs" }],
  },

  // ===== ANALYTICS TEMPLATES =====
  {
    id: "daily-active-users",
    name: "Daily Active Users",
    nameKey: "templateDailyActiveUsers",
    description: "User activity over time",
    descriptionKey: "templateDailyActiveUsersDesc",
    cardType: "chart",
    layoutType: "bar",
    category: "analytics",
    icon: "👤",
    queryTemplate: `SELECT
  DATE_TRUNC('day', event_timestamp) as date,
  COUNT(DISTINCT user_id) as active_users
FROM {{table_name}}
WHERE event_timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', event_timestamp)
ORDER BY date`,
    requiredTables: ["user_events", "analytics_events"],
    placeholders: [{ key: "table_name", label: "Events Table", default: "user_events" }],
  },
  {
    id: "conversion-rate",
    name: "Conversion Rate",
    nameKey: "templateConversionRate",
    description: "Percentage of users completing goal",
    descriptionKey: "templateConversionRateDesc",
    cardType: "kpi",
    layoutType: "single",
    category: "analytics",
    icon: "🎯",
    queryTemplate: `SELECT
  ROUND((COUNT(DISTINCT CASE WHEN event_type = 'conversion' THEN user_id END) * 100.0 /
         COUNT(DISTINCT user_id)), 2) as value,
  'Conversion Rate' as label
FROM {{table_name}}
WHERE event_timestamp >= CURRENT_DATE - INTERVAL '7 days'`,
    requiredTables: ["user_events"],
    placeholders: [{ key: "table_name", label: "Events Table", default: "user_events" }],
  },

  // ===== MONITORING TEMPLATES =====
  {
    id: "error-rate",
    name: "Error Rate",
    nameKey: "templateErrorRate",
    description: "System error rate percentage",
    descriptionKey: "templateErrorRateDesc",
    cardType: "kpi",
    layoutType: "single",
    category: "monitoring",
    icon: "⚠️",
    queryTemplate: `SELECT
  ROUND((SUM(CASE WHEN level = 'ERROR' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as value,
  'Error Rate' as label
FROM {{table_name}}
WHERE timestamp >= CURRENT_DATE - INTERVAL '1 hour'`,
    requiredTables: ["logs", "application_logs"],
    placeholders: [{ key: "table_name", label: "Logs Table", default: "application_logs" }],
  },
  {
    id: "recent-errors",
    name: "Recent Errors",
    nameKey: "templateRecentErrors",
    description: "Latest error messages",
    descriptionKey: "templateRecentErrorsDesc",
    cardType: "table",
    layoutType: "list",
    category: "monitoring",
    icon: "🔴",
    queryTemplate: `SELECT
  timestamp,
  level,
  message,
  source
FROM {{table_name}}
WHERE level IN ('ERROR', 'FATAL')
  AND timestamp >= CURRENT_DATE - INTERVAL '24 hours'
ORDER BY timestamp DESC
LIMIT 50`,
    requiredTables: ["logs"],
    placeholders: [{ key: "table_name", label: "Logs Table", default: "application_logs" }],
  },

  // ===== GENERAL TEMPLATES =====
  {
    id: "record-count",
    name: "Total Records",
    nameKey: "templateRecordCount",
    description: "Total count of records in table",
    descriptionKey: "templateRecordCountDesc",
    cardType: "kpi",
    layoutType: "single",
    category: "general",
    icon: "🔢",
    queryTemplate: `SELECT
  COUNT(*) as value,
  'Total Records' as label
FROM {{table_name}}`,
    placeholders: [{ key: "table_name", label: "Table Name", default: "your_table" }],
  },
  {
    id: "table-preview",
    name: "Table Preview",
    nameKey: "templateTablePreview",
    description: "Preview first rows of any table",
    descriptionKey: "templateTablePreviewDesc",
    cardType: "table",
    layoutType: "grid",
    category: "general",
    icon: "📋",
    queryTemplate: `SELECT *
FROM {{table_name}}
LIMIT {{limit}}`,
    placeholders: [
      { key: "table_name", label: "Table Name", default: "your_table" },
      { key: "limit", label: "Row Limit", default: "100" },
    ],
  },
];

// Helper functions
export function getTemplatesByCategory(category: CardTemplate["category"]) {
  return cardTemplates.filter((t) => t.category === category);
}

export function getTemplateById(id: string) {
  return cardTemplates.find((t) => t.id === id);
}

export function fillTemplate(template: CardTemplate, values: Record<string, string>): string {
  let query = template.queryTemplate;
  Object.entries(values).forEach(([key, value]) => {
    query = query.replace(new RegExp(`{{${key}}}`, "g"), value);
  });
  return query;
}

export const categoryLabels: Record<CardTemplate["category"], { label: string; icon: string }> = {
  sales: { label: "Sales & Revenue", icon: "💰" },
  operations: { label: "Operations & Pipelines", icon: "⚙️" },
  analytics: { label: "Analytics & Metrics", icon: "📊" },
  monitoring: { label: "Monitoring & Logs", icon: "🔍" },
  general: { label: "General Purpose", icon: "📁" },
};
