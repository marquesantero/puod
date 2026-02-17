import { useState } from "react";
import { DashboardList } from "@/components/studio/dashboards/DashboardList";
import { DashboardWizard, type DashboardConfig } from "@/components/studio/dashboards/DashboardWizard";
import { DashboardCanvas } from "@/components/studio/dashboards/DashboardCanvasWithDragDrop";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/contexts/I18nContext";
import { deleteStudioDashboard as deleteDashboard, getStudioDashboard as getDashboard, updateStudioDashboard as updateDashboard } from "@/lib/studioApi";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ViewMode = "list" | "wizard" | "canvas";
type WizardMode = "create" | "edit";

export default function StudioDashboardsPageNew() {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [currentConfig, setCurrentConfig] = useState<DashboardConfig | null>(null);
  const [currentDashboardId, setCurrentDashboardId] = useState<number | null>(null);
  const [dashboardToDelete, setDashboardToDelete] = useState<number | null>(null);
  const [wizardMode, setWizardMode] = useState<WizardMode>("create");
  const [dashboardsRefreshToken, setDashboardsRefreshToken] = useState(0);

  const handleNewDashboard = () => {
    setCurrentConfig(null);
    setCurrentDashboardId(null);
    setWizardMode("create");
    setViewMode("wizard");
  };

  const handleEditDashboardCards = (dashboardId: number) => {
    // The canvas will load the dashboard via API
    setCurrentDashboardId(dashboardId);
    // Set a minimal config - the canvas will load the actual dashboard details
      setCurrentConfig({
        name: "",
        description: "",
        scope: "Company",
        profileId: 1,
        canvasMode: "responsive",
        canvasWidth: "1920",
        canvasHeight: "1080",
      });
    setViewMode("canvas");
  };

  const handleEditDashboardBasics = async (dashboardId: number) => {
    try {
      const dashboard = await getDashboard(dashboardId);
      let canvasMode: DashboardConfig["canvasMode"] = "responsive";
      let canvasWidth = "1920";
      let canvasHeight = "1080";

      if (dashboard.layoutJson) {
        try {
          const parsed = JSON.parse(dashboard.layoutJson);
          if (parsed?.canvasMode === "fixed" || parsed?.canvasMode === "responsive") {
            canvasMode = parsed.canvasMode;
          }
          if (parsed?.canvasWidth) {
            canvasWidth = String(parsed.canvasWidth);
          }
          if (parsed?.canvasHeight) {
            canvasHeight = String(parsed.canvasHeight);
          }
        } catch (error) {
          console.warn("Failed to parse dashboard layoutJson", error);
        }
      }

      const scope = dashboard.scope === 1 ? "Client" : "Company";

      setCurrentDashboardId(dashboardId);
      setCurrentConfig({
        name: dashboard.name,
        description: dashboard.description ?? "",
        scope,
        clientId: dashboard.clientId ?? undefined,
        profileId: dashboard.profileId ?? undefined,
        canvasMode,
        canvasWidth,
        canvasHeight,
      });
      setWizardMode("edit");
      setViewMode("wizard");
    } catch (error) {
      console.error("Failed to load dashboard for basic edit:", error);
      showToast(t("studioDashboardLoadFailed"), { variant: "destructive" });
    }
  };

  const handleDeleteDashboard = (dashboardId: number) => {
    setDashboardToDelete(dashboardId);
  };

  const confirmDeleteDashboard = async () => {
    if (!dashboardToDelete) return;

    try {
      await deleteDashboard(dashboardToDelete);
      showToast("Dashboard deleted successfully", { variant: "success" });
      setDashboardToDelete(null);
      setDashboardsRefreshToken((prev) => prev + 1);
      // Trigger a refresh of the list by switching views
      setViewMode("list");
    } catch (error) {
      console.error("Failed to delete dashboard:", error);
      showToast("Failed to delete dashboard", { variant: "destructive" });
    }
  };

  const handleWizardComplete = async (config: DashboardConfig) => {
    if (wizardMode === "edit" && currentDashboardId) {
      try {
        await updateDashboard(currentDashboardId, {
          name: config.name,
          description: config.description,
          layoutJson: JSON.stringify({
            canvasMode: config.canvasMode,
            canvasWidth: config.canvasWidth,
            canvasHeight: config.canvasHeight,
          }),
        });
        showToast("Dashboard updated successfully", { variant: "success" });
        setViewMode("list");
      } catch (error) {
        console.error("Failed to update dashboard:", error);
        showToast(t("studioDashboardSaveFailed"), { variant: "destructive" });
      }
      return;
    }

    setCurrentConfig(config);
    setViewMode("canvas");
  };

  const handleWizardCancel = () => {
    setViewMode("list");
  };

  const handleCanvasSave = (dashboardId: number) => {
    // The canvas component handles the actual save
    // Just update the current dashboard ID and return to list
    setCurrentDashboardId(dashboardId);
    setViewMode("list");
  };

  const handleCanvasBack = () => {
    if (currentDashboardId) {
      // Editing existing dashboard - go back to list
      setViewMode("list");
    } else {
      // Creating new dashboard - go back to wizard
      setViewMode("wizard");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header - Only show when in list view */}
      {viewMode === "list" && (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
          <div className="relative flex flex-col gap-2 px-6 py-6">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-300">
              PUOD STUDIO
            </p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
              Dashboards
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Build and manage your visual dashboards
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {viewMode === "list" && (
        <DashboardList
          onNewDashboard={handleNewDashboard}
          onEditDashboardBasics={handleEditDashboardBasics}
          onEditDashboardCards={handleEditDashboardCards}
          onDeleteDashboard={handleDeleteDashboard}
          refreshToken={dashboardsRefreshToken}
        />
      )}

      {viewMode === "wizard" && (
        <DashboardWizard
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
          initialConfig={currentConfig ?? undefined}
          disableScope={wizardMode === "edit"}
          mode={wizardMode}
        />
      )}

      {viewMode === "canvas" && currentConfig && (
        <DashboardCanvas
          config={currentConfig}
          dashboardId={currentDashboardId || undefined}
          onSave={handleCanvasSave}
          onBack={handleCanvasBack}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={dashboardToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setDashboardToDelete(null);
        }}
        title={t("confirm")}
        description={t("dashboardDeleteConfirm")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={confirmDeleteDashboard}
      />
    </div>
  );
}
