import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Calendar, Loader2, LayoutGrid } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/contexts/I18nContext";
import { listStudioDashboards as getDashboards, type StudioDashboard as StudioDashboardDto } from "@/lib/studioApi";

interface DashboardListProps {
  onNewDashboard: () => void;
  onEditDashboardBasics: (dashboardId: number) => void;
  onEditDashboardCards: (dashboardId: number) => void;
  onDeleteDashboard: (dashboardId: number) => void;
  refreshToken?: number;
}

export function DashboardList({
  onNewDashboard,
  onEditDashboardBasics,
  onEditDashboardCards,
  onDeleteDashboard,
  refreshToken,
}: DashboardListProps) {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [dashboards, setDashboards] = useState<StudioDashboardDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboards();
  }, [refreshToken]);

  const loadDashboards = async () => {
    try {
      setLoading(true);
      const data = await getDashboards();
      setDashboards(data);
    } catch (error) {
      console.error("Failed to load dashboards:", error);
      showToast("Failed to load dashboards", { variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Loading dashboards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with New Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">My Dashboards</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {dashboards.length} dashboard{dashboards.length !== 1 ? "s" : ""} available
          </p>
        </div>
        <Button onClick={onNewDashboard} className="gap-2 shadow-lg">
          <Plus className="w-4 h-4" />
          New Dashboard
        </Button>
      </div>

      {/* Dashboard Grid */}
      {dashboards.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No dashboards yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Get started by creating your first dashboard with pre-built templates
            </p>
            <Button onClick={onNewDashboard} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Your First Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboards.map((dashboard) => (
            <Card
              key={dashboard.id}
              className="group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden"
              onClick={() => onEditDashboardCards(dashboard.id)}
            >
              <div className={`h-2 w-full ${dashboard.status === "Published" ? "bg-emerald-500" : "bg-amber-500"}`} />

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{dashboard.name}</CardTitle>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                    {dashboard.layoutType}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(dashboard.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Badges */}
                <div className="flex gap-2 flex-wrap">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${
                    dashboard.status === 2 // Published
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  }`}>
                    {dashboard.status === 2 ? "Published" : "Draft"}
                  </span>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-accent border uppercase font-bold">
                    {dashboard.scope === 1 ? "Client" : "Company"}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditDashboardBasics(dashboard.id);
                      }}
                      className="gap-2"
                    >
                      <Edit className="w-3 h-3" />
                      {t("studioDashboardEditBasics")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditDashboardCards(dashboard.id);
                      }}
                      className="gap-2"
                    >
                      <LayoutGrid className="w-3 h-3" />
                      {t("studioDashboardEditCards")}
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDashboard(dashboard.id);
                    }}
                    className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
