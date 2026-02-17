import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Save,
  Eye,
  Layers,
  Loader2,
  Wand2,
  LayoutDashboard,
  Undo2,
  Redo2,
  Grid3x3,
  Download,
  Upload,
  Maximize2,
  Minimize2
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

interface CanvasToolbarProps {
  // Dashboard info
  dashboardName: string;
  dashboardId?: number;
  cardsCount: number;
  canvasMode: string;
  gridSize: number;

  // States
  showTemplates: boolean;
  saving: boolean;

  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  onBack: () => void;
  onSave: () => void;
  onPreview: () => void;
  onToggleTemplates: () => void;
  onQuickAdd: () => void;
  onAutoArrange: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport?: () => void;
  onImport?: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function CanvasToolbar({
  dashboardName,
  dashboardId,
  cardsCount,
  canvasMode,
  gridSize,
  showTemplates,
  saving,
  canUndo,
  canRedo,
  onBack,
  onSave,
  onPreview,
  onToggleTemplates,
  onQuickAdd,
  onAutoArrange,
  onUndo,
  onRedo,
  onExport,
  onImport,
  isFullscreen,
  onToggleFullscreen,
}: CanvasToolbarProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      {/* Main Toolbar Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!showTemplates && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleTemplates}
              className="gap-2"
            >
              <Layers className="w-4 h-4" />
              Show Templates
            </Button>
          )}
          <div className="border-l pl-4">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg">{dashboardName}</h2>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={onToggleFullscreen}
                aria-label={isFullscreen ? t("studioDashboardExitFullscreen") : t("studioDashboardEnterFullscreen")}
                title={isFullscreen ? t("studioDashboardExitFullscreen") : t("studioDashboardEnterFullscreen")}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {cardsCount} card{cardsCount !== 1 ? "s" : ""} - {canvasMode} mode - Grid: {gridSize}px
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack} className="gap-2" disabled={saving}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button
            variant="outline"
            onClick={onPreview}
            className="gap-2"
            disabled={cardsCount === 0 || !dashboardId}
          >
            <Eye className="w-4 h-4" />
            Preview Dashboard
          </Button>
          <Button onClick={onSave} className="gap-2 shadow-lg" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Dashboard
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Secondary Toolbar - Canvas Tools */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2">
          {/* Quick Add Card */}
          <Button
            size="sm"
            onClick={onQuickAdd}
            className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <Wand2 className="w-4 h-4" />
            Quick Add Card
          </Button>

          <div className="h-6 w-px bg-border mx-1" />

          {/* Auto-Arrange */}
          <Button
            size="sm"
            variant="outline"
            onClick={onAutoArrange}
            className="gap-2"
            disabled={cardsCount === 0}
          >
            <LayoutDashboard className="w-4 h-4" />
            Auto-Arrange
          </Button>

          {/* Align to Grid */}
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={cardsCount === 0}
            title="Snap all cards to grid"
          >
            <Grid3x3 className="w-4 h-4" />
            Snap to Grid
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <div className="flex items-center gap-1 border rounded-md">
            <Button
              size="sm"
              variant="ghost"
              onClick={onUndo}
              disabled={!canUndo}
              className="gap-1.5 px-3"
              title={`${t("undoTooltip")}`}
            >
              <Undo2 className="w-4 h-4" />
              <span className="text-xs">Undo</span>
            </Button>
            <div className="h-6 w-px bg-border" />
            <Button
              size="sm"
              variant="ghost"
              onClick={onRedo}
              disabled={!canRedo}
              className="gap-1.5 px-3"
              title={`${t("redoTooltip")}`}
            >
              <Redo2 className="w-4 h-4" />
              <span className="text-xs">Redo</span>
            </Button>
          </div>

          {/* Export/Import */}
          {(onExport || onImport) && (
            <>
              <div className="h-6 w-px bg-border mx-1" />
              <div className="flex items-center gap-1">
                {onExport && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onExport}
                    className="gap-1.5"
                    title="Export dashboard as JSON"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                )}
                {onImport && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onImport}
                    className="gap-1.5"
                    title="Import dashboard from JSON"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="text-[10px] text-muted-foreground text-center py-1">
        <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[9px]">Ctrl+Z</kbd> undo{" "}
        <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[9px]">Ctrl+Shift+Z</kbd> redo{" "}
        <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[9px]">Ctrl+S</kbd> save{" "}
        <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[9px]">Del</kbd> remove{" "}
        <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[9px]">Ctrl+D</kbd> duplicate{" "}
        <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[9px]">Esc</kbd> deselect{" "}
        <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[9px]">F11</kbd> fullscreen
      </div>
    </div>
  );
}


