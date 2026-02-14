import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StyleEditor } from "@/components/studio/shared/StyleEditor";
import { useI18n } from "@/contexts/I18nContext";
import type { DashboardDraft, DashboardLayoutSettings } from "./dashboardTypes";

const layoutOptions = ["grid", "list", "masonry"];
const refreshIntervals = ["1m", "5m", "15m", "1h", "6h"];

type DashboardFormSectionProps = {
  draft: DashboardDraft;
  onChange: (next: DashboardDraft) => void;
  onSave: () => void;
  onDelete?: () => void;
};

export function DashboardFormSection({ draft, onChange, onSave, onDelete }: DashboardFormSectionProps) {
  const { t } = useI18n();
  const layoutLabels = {
    grid: t("studioLayoutGrid"),
    list: t("studioLayoutList"),
    masonry: t("studioLayoutMasonry"),
  };
  const statusLabels = {
    Draft: t("studioStatusDraft"),
    Published: t("studioStatusPublished"),
    Archived: t("studioStatusArchived"),
  };

  const setLayout = (patch: Partial<DashboardLayoutSettings>) => {
    onChange({ ...draft, layout: { ...draft.layout, ...patch } });
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{t("studioDashboardBuilder")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("studioDashboardBuilderHint")}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>{t("studioDashboardName")}</Label>
            <Input
              value={draft.name}
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
              placeholder={t("studioDashboardNamePlaceholder")}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("studioDashboardDesc")}</Label>
            <Input
              value={draft.description}
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
              placeholder={t("studioDashboardDescPlaceholder")}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("status")}</Label>
            <Select
              value={draft.status}
              onValueChange={(value) => onChange({ ...draft, status: value as DashboardDraft["status"] })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("status")} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("studioDashboardLayout")}</Label>
            <Select value={draft.layoutType} onValueChange={(value) => onChange({ ...draft, layoutType: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t("studioDashboardLayout")} />
              </SelectTrigger>
              <SelectContent>
                {layoutOptions.map((layout) => (
                  <SelectItem key={layout} value={layout}>
                    {layoutLabels[layout as keyof typeof layoutLabels] ?? layout}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("studioDashboardRefreshMode")}</Label>
            <Select
              value={draft.refreshMode}
              onValueChange={(value) => onChange({ ...draft, refreshMode: value as DashboardDraft["refreshMode"] })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("studioDashboardRefreshMode")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Interval">{t("studioRefreshInterval")}</SelectItem>
                <SelectItem value="Manual">{t("refreshManual")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("studioRefreshInterval")}</Label>
            <Select
              value={draft.refreshInterval}
              onValueChange={(value) => onChange({ ...draft, refreshInterval: value })}
              disabled={draft.refreshMode !== "Interval"}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("studioRefreshInterval")} />
              </SelectTrigger>
              <SelectContent>
                {refreshIntervals.map((interval) => (
                  <SelectItem key={interval} value={interval}>
                    {interval}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold">{t("studioDashboardLayoutSettings")}</Label>
            <p className="text-xs text-muted-foreground">{t("studioDashboardLayoutHint")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("studioDashboardColumns")}</Label>
              <Input value={draft.layout.columns} onChange={(event) => setLayout({ columns: event.target.value })} placeholder="12" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("studioDashboardGap")}</Label>
              <Input value={draft.layout.gap} onChange={(event) => setLayout({ gap: event.target.value })} placeholder="16" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("studioDashboardRowHeight")}</Label>
              <Input value={draft.layout.rowHeight} onChange={(event) => setLayout({ rowHeight: event.target.value })} placeholder="120" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("studioDashboardCardPadding")}</Label>
              <Input value={draft.layout.cardPadding} onChange={(event) => setLayout({ cardPadding: event.target.value })} placeholder="16" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("studioDashboardHeaderStyle")}</Label>
              <Select
                value={draft.layout.headerStyle}
                onValueChange={(value) => setLayout({ headerStyle: value as DashboardLayoutSettings["headerStyle"] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("studioDashboardHeaderStyle")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expanded">{t("studioHeaderExpanded")}</SelectItem>
                  <SelectItem value="compact">{t("studioHeaderCompact")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("studioDashboardBackgroundPattern")}</Label>
              <Select
                value={draft.layout.backgroundPattern}
                onValueChange={(value) => setLayout({ backgroundPattern: value as DashboardLayoutSettings["backgroundPattern"] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("studioDashboardBackgroundPattern")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("studioPatternNone")}</SelectItem>
                  <SelectItem value="grid">{t("studioPatternGrid")}</SelectItem>
                  <SelectItem value="dots">{t("studioPatternDots")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("studioDashboardShowFilters")}</Label>
              <Select
                value={draft.layout.showFilters ? "yes" : "no"}
                onValueChange={(value) => setLayout({ showFilters: value === "yes" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("studioDashboardShowFilters")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">{t("yes")}</SelectItem>
                  <SelectItem value="no">{t("no")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("studioDashboardShowLegend")}</Label>
              <Select
                value={draft.layout.showLegend ? "yes" : "no"}
                onValueChange={(value) => setLayout({ showLegend: value === "yes" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("studioDashboardShowLegend")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">{t("yes")}</SelectItem>
                  <SelectItem value="no">{t("no")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <StyleEditor value={draft.theme} onChange={(theme) => onChange({ ...draft, theme })} />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={onSave}>
            {t("save")}
          </Button>
          {onDelete ? (
            <Button type="button" variant="destructive" onClick={onDelete}>
              {t("delete")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
