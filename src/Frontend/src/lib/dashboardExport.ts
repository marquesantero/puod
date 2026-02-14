/**
 * Dashboard Export/Import Utilities
 * Save and load dashboards as JSON files
 */

export interface ExportedDashboard {
  version: string;
  exportedAt: string;
  dashboard: {
    name: string;
    description?: string;
    layoutType: string;
    layoutJson: string;
    scope: number;
    clientId?: number;
    profileId?: number;
  };
  cards: ExportedCard[];
}

export interface ExportedCard {
  cardId: number;
  title: string;
  description?: string;
  showTitle?: boolean;
  showDescription?: boolean;
  cardType: string;
  layoutType: string;
  integrationId?: number;
  query?: string;
  dataSourceJson?: string | null;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
    orderIndex: number;
  };
}

/**
 * Export dashboard to JSON
 */
export function exportDashboard(
  dashboard: {
    name: string;
    description?: string;
    layoutType: string;
    layoutJson: string;
    scope: number;
    clientId?: number;
    profileId?: number;
  },
  cards: Array<{
    cardId: number;
    title: string;
    description?: string;
    showTitle?: boolean;
    showDescription?: boolean;
    cardType?: string;
    layoutType?: string;
    integrationId?: number;
    query?: string;
    dataSourceJson?: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    orderIndex: number;
  }>
): ExportedDashboard {
  return {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    dashboard,
    cards: cards.map((card) => ({
      cardId: card.cardId,
      title: card.title,
      description: card.description,
      showTitle: card.showTitle,
      showDescription: card.showDescription,
      cardType: card.cardType || "kpi",
      layoutType: card.layoutType || "single",
      integrationId: card.integrationId,
      query: card.query,
      dataSourceJson: card.dataSourceJson ?? null,
      position: {
        x: card.x,
        y: card.y,
        width: card.width,
        height: card.height,
        orderIndex: card.orderIndex,
      },
    })),
  };
}

/**
 * Download dashboard as JSON file
 */
export function downloadDashboardJSON(data: ExportedDashboard, filename?: string) {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `dashboard-${data.dashboard.name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import dashboard from JSON file
 */
export async function importDashboardJSON(): Promise<ExportedDashboard | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const text = await file.text();
        const data = JSON.parse(text) as ExportedDashboard;

        // Validate structure
        if (!data.version || !data.dashboard || !data.cards) {
          throw new Error("Invalid dashboard file format");
        }

        resolve(data);
      } catch (error) {
        console.error("Failed to parse dashboard JSON:", error);
        alert("Failed to import dashboard: Invalid file format");
        resolve(null);
      }
    };

    input.click();
  });
}

/**
 * Validate imported dashboard
 */
export function validateDashboard(data: ExportedDashboard): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check version
  if (!data.version) {
    errors.push("Missing version information");
  }

  // Check dashboard
  if (!data.dashboard) {
    errors.push("Missing dashboard configuration");
  } else {
    if (!data.dashboard.name) {
      errors.push("Dashboard must have a name");
    }
    if (!data.dashboard.layoutType) {
      errors.push("Dashboard must have a layout type");
    }
  }

  // Check cards
  if (!Array.isArray(data.cards)) {
    errors.push("Cards must be an array");
  } else if (data.cards.length === 0) {
    errors.push("Dashboard must have at least one card");
  } else {
    data.cards.forEach((card, index) => {
      if (!card.cardId) {
        errors.push(`Card ${index + 1}: Missing cardId`);
      }
      if (!card.title) {
        errors.push(`Card ${index + 1}: Missing title`);
      }
      if (!card.position) {
        errors.push(`Card ${index + 1}: Missing position`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a shareable dashboard link (for future use)
 */
export function createShareableLink(dashboardId: number): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/studio/dashboards/preview/${dashboardId}`;
}

/**
 * Copy to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}
