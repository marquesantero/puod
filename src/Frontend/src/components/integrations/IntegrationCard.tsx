import { useState } from "react";
import { Button } from "@/components/ui/button";
import { testIntegration } from "@/lib/integrationApi";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/contexts/I18nContext";

type IntegrationCardProps = {
  integration: {
    id: number;
    name: string;
    description?: string | null;
    type: string;
    status: string;
    createdAt: string;
    configJson?: string;
    isInherited?: boolean;
  };
  onDelete: () => void;
  onEdit: () => void;
  onStatusChange: (newStatus: string) => void;
};

const statusConfig = {
  pending: {
    label: "Pending",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-300",
    border: "border-yellow-300 dark:border-yellow-700",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  ready: {
    label: "Ready",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-300 dark:border-green-700",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
  error: {
    label: "Error",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-300 dark:border-red-700",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    ),
  },
};

const typeIcons = {
  airflow: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round" />
    </svg>
  ),
  adf: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 5h14v6H5zM5 13h8v6H5z" />
    </svg>
  ),
  api: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
    </svg>
  ),
};

export function IntegrationCard({ integration, onDelete, onEdit, onStatusChange }: IntegrationCardProps) {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [testing, setTesting] = useState(false);

  const status = integration.status as keyof typeof statusConfig;
  const config = statusConfig[status] || statusConfig.pending;
  const typeIcon = typeIcons[integration.type as keyof typeof typeIcons];

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await testIntegration(integration.id);

      if (result.success) {
        showToast(result.message, { variant: "success" });
        onStatusChange(result.status);
      } else {
        showToast(result.message, { variant: "destructive" });
        onStatusChange(result.status);
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || t("integrationTestFailed") || "Test failed", {
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={`group relative rounded-xl border p-5 transition-all hover:shadow-lg ${
      integration.isInherited
        ? 'bg-gradient-to-br from-blue-50/50 to-indigo-50/30 border-blue-200 dark:from-blue-950/20 dark:to-indigo-950/10 dark:border-blue-800'
        : 'bg-card border-border hover:border-blue-300 dark:hover:border-blue-700'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 mt-0.5 p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400">
            {typeIcon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base text-foreground truncate">{integration.name}</h3>
              {integration.isInherited && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="17 1 21 5 17 9"/>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  </svg>
                  Inherited from Client
                </span>
              )}
            </div>
            {integration.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{integration.description}</p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
          {config.icon}
          <span className="uppercase tracking-wide">{config.label}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="capitalize">{integration.type}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleTest}
            disabled={testing}
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs font-medium gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700"
          >
            {testing ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"/>
                {t("integrationTesting") || "Testing..."}
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                {t("integrationTest") || "Test"}
              </>
            )}
          </Button>

          <Button
            onClick={onEdit}
            variant="outline"
            size="sm"
            disabled={integration.isInherited}
            className="h-9 w-9 p-0 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title={integration.isInherited ? "Cannot edit inherited integrations" : "Edit integration"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </Button>

          <Button
            onClick={onDelete}
            variant="outline"
            size="sm"
            disabled={integration.isInherited}
            className="h-9 w-9 p-0 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title={integration.isInherited ? "Cannot delete inherited integrations" : "Delete integration"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
