/**
 * Dashboard Templates Library
 * Complete pre-built dashboards with multiple cards
 */

export interface DashboardTemplate {
  id: string;
  name: string;
  nameKey: string;
  description: string;
  descriptionKey: string;
  category: "sales" | "operations" | "analytics" | "executive" | "monitoring";
  icon: string;
  canvasMode: "responsive" | "fixed";
  canvasWidth?: number;
  cards: DashboardTemplateCard[];
  preview?: string;
}

export interface DashboardTemplateCard {
  templateCardId: string; // Reference to card template
  x: number;
  y: number;
  width: number;
  height: number;
}

export const dashboardTemplates: DashboardTemplate[] = [
  // ===== SALES DASHBOARD =====
  {
    id: "sales-dashboard",
    name: "Sales Performance Dashboard",
    nameKey: "dashboardTemplateSales",
    description: "Complete sales overview with KPIs, trends, and top customers",
    descriptionKey: "dashboardTemplateSalesDesc",
    category: "sales",
    icon: "💰",
    canvasMode: "fixed",
    canvasWidth: 1920,
    cards: [
      // Top row - 3 KPIs
      {
        templateCardId: "total-revenue-kpi",
        x: 20,
        y: 20,
        width: 600,
        height: 200,
      },
      {
        templateCardId: "conversion-rate",
        x: 640,
        y: 20,
        width: 600,
        height: 200,
      },
      {
        templateCardId: "record-count", // Total Orders
        x: 1260,
        y: 20,
        width: 600,
        height: 200,
      },
      // Second row - Revenue trend chart
      {
        templateCardId: "monthly-revenue-trend",
        x: 20,
        y: 240,
        width: 1240,
        height: 400,
      },
      // Right side - Top customers
      {
        templateCardId: "top-customers",
        x: 1280,
        y: 240,
        width: 600,
        height: 400,
      },
    ],
  },

  // ===== OPERATIONS DASHBOARD =====
  {
    id: "operations-dashboard",
    name: "Operations & Pipeline Monitoring",
    nameKey: "dashboardTemplateOps",
    description: "Monitor data pipelines, DAG runs, and system health",
    descriptionKey: "dashboardTemplateOpsDesc",
    category: "operations",
    icon: "⚙️",
    canvasMode: "fixed",
    canvasWidth: 1920,
    cards: [
      // Top row - KPIs
      {
        templateCardId: "pipeline-success-rate",
        x: 20,
        y: 20,
        width: 600,
        height: 200,
      },
      {
        templateCardId: "error-rate",
        x: 640,
        y: 20,
        width: 600,
        height: 200,
      },
      {
        templateCardId: "record-count", // Total Runs
        x: 1260,
        y: 20,
        width: 600,
        height: 200,
      },
      // Left - Timeline
      {
        templateCardId: "pipeline-timeline",
        x: 20,
        y: 240,
        width: 600,
        height: 600,
      },
      // Middle - Recent DAG runs
      {
        templateCardId: "recent-dag-runs",
        x: 640,
        y: 240,
        width: 620,
        height: 600,
      },
      // Right - Recent errors
      {
        templateCardId: "recent-errors",
        x: 1280,
        y: 240,
        width: 600,
        height: 600,
      },
    ],
  },

  // ===== ANALYTICS DASHBOARD =====
  {
    id: "analytics-dashboard",
    name: "User Analytics Dashboard",
    nameKey: "dashboardTemplateAnalytics",
    description: "Track user behavior, engagement, and conversions",
    descriptionKey: "dashboardTemplateAnalyticsDesc",
    category: "analytics",
    icon: "📊",
    canvasMode: "responsive",
    cards: [
      // Top row - KPIs
      {
        templateCardId: "daily-active-users",
        x: 20,
        y: 20,
        width: 900,
        height: 300,
      },
      {
        templateCardId: "conversion-rate",
        x: 940,
        y: 20,
        width: 440,
        height: 300,
      },
      // Bottom - Table
      {
        templateCardId: "table-preview",
        x: 20,
        y: 340,
        width: 1360,
        height: 400,
      },
    ],
  },

  // ===== EXECUTIVE DASHBOARD =====
  {
    id: "executive-dashboard",
    name: "Executive Overview",
    nameKey: "dashboardTemplateExecutive",
    description: "High-level metrics for executives and stakeholders",
    descriptionKey: "dashboardTemplateExecutiveDesc",
    category: "executive",
    icon: "📈",
    canvasMode: "fixed",
    canvasWidth: 1920,
    cards: [
      // Top row - 4 KPIs
      {
        templateCardId: "total-revenue-kpi",
        x: 20,
        y: 20,
        width: 450,
        height: 180,
      },
      {
        templateCardId: "conversion-rate",
        x: 490,
        y: 20,
        width: 450,
        height: 180,
      },
      {
        templateCardId: "pipeline-success-rate",
        x: 960,
        y: 20,
        width: 450,
        height: 180,
      },
      {
        templateCardId: "error-rate",
        x: 1430,
        y: 20,
        width: 450,
        height: 180,
      },
      // Second row - Charts
      {
        templateCardId: "monthly-revenue-trend",
        x: 20,
        y: 220,
        width: 920,
        height: 350,
      },
      {
        templateCardId: "daily-active-users",
        x: 960,
        y: 220,
        width: 920,
        height: 350,
      },
      // Bottom row - Tables
      {
        templateCardId: "top-customers",
        x: 20,
        y: 590,
        width: 920,
        height: 300,
      },
      {
        templateCardId: "recent-dag-runs",
        x: 960,
        y: 590,
        width: 920,
        height: 300,
      },
    ],
  },

  // ===== MONITORING DASHBOARD =====
  {
    id: "monitoring-dashboard",
    name: "System Monitoring",
    nameKey: "dashboardTemplateMonitoring",
    description: "Real-time system health, errors, and performance",
    descriptionKey: "dashboardTemplateMonitoringDesc",
    category: "monitoring",
    icon: "🔍",
    canvasMode: "responsive",
    cards: [
      // Top - Error rate
      {
        templateCardId: "error-rate",
        x: 20,
        y: 20,
        width: 400,
        height: 200,
      },
      {
        templateCardId: "pipeline-success-rate",
        x: 440,
        y: 20,
        width: 400,
        height: 200,
      },
      {
        templateCardId: "record-count",
        x: 860,
        y: 20,
        width: 400,
        height: 200,
      },
      // Recent errors - Full width
      {
        templateCardId: "recent-errors",
        x: 20,
        y: 240,
        width: 1240,
        height: 500,
      },
    ],
  },

  // ===== SIMPLE STARTER =====
  {
    id: "starter-dashboard",
    name: "Starter Dashboard",
    nameKey: "dashboardTemplateStarter",
    description: "Simple 2-card layout to get started quickly",
    descriptionKey: "dashboardTemplateStarterDesc",
    category: "executive",
    icon: "🚀",
    canvasMode: "responsive",
    cards: [
      {
        templateCardId: "record-count",
        x: 20,
        y: 20,
        width: 600,
        height: 200,
      },
      {
        templateCardId: "table-preview",
        x: 20,
        y: 240,
        width: 1240,
        height: 400,
      },
    ],
  },
];

export const dashboardCategoryLabels: Record<
  DashboardTemplate["category"],
  { label: string; icon: string }
> = {
  sales: { label: "Sales & Revenue", icon: "💰" },
  operations: { label: "Operations", icon: "⚙️" },
  analytics: { label: "Analytics", icon: "📊" },
  executive: { label: "Executive", icon: "📈" },
  monitoring: { label: "Monitoring", icon: "🔍" },
};

// Helper functions
export function getTemplatesByCategory(category: DashboardTemplate["category"]) {
  return dashboardTemplates.filter((t) => t.category === category);
}

export function getTemplateById(id: string) {
  return dashboardTemplates.find((t) => t.id === id);
}
