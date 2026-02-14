import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import type { StudioCard, StudioDashboardDetail } from "@/types/studio";

type DashboardViewerProps = {
  dashboard: StudioDashboardDetail | null;
  cardsById: Record<number, StudioCard | undefined>;
  onEdit?: () => void;
  onShare?: () => void;
};

type DashboardLayoutPayload = {
  layout?: {
    columns?: string;
    gap?: string;
    rowHeight?: string;
    cardPadding?: string;
  };
  theme?: {
    background?: string;
    text?: string;
    accent?: string;
  };
};

const parseJson = <T,>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const withUnit = (value: string | number | undefined, fallback: string) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number") return `${value}px`;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? `${trimmed}px` : trimmed;
};

export function DashboardViewer({ dashboard, cardsById, onEdit, onShare }: DashboardViewerProps) {
  const { t } = useI18n();

  if (!dashboard) {
    return (
      <Card className="border-dashed border-border/70">
        <CardHeader>
          <CardTitle className="text-base">{t("dashboardsHubEmptyTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{t("dashboardsHubEmptyBody")}</CardContent>
      </Card>
    );
  }

  const payload = parseJson<DashboardLayoutPayload>(dashboard.layoutJson, {});
  const layout = payload.layout ?? {};
  const columns = Math.max(Number.parseInt(layout.columns ?? "12", 10) || 12, 1);
  const gap = withUnit(layout.gap, "16px");
  const rowHeight = withUnit(layout.rowHeight, "120px");
  const cardPadding = withUnit(layout.cardPadding, "16px");
  const sortedCards = [...dashboard.cards].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{dashboard.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {dashboard.description || t("dashboardsHubSubtitle")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onEdit ? (
              <Button variant="secondary" size="sm" onClick={onEdit}>
                {t("dashboardsHubActionEdit")}
              </Button>
            ) : null}
            {onShare ? (
              <Button variant="secondary" size="sm" onClick={onShare}>
                {t("dashboardsHubActionShare")}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="rounded-full border border-border px-2 py-0.5">
            {t("dashboardsHubCardsCount")}: {dashboard.cards.length}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5">
            {t("studioLayoutGrid")}: {dashboard.layoutType}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5">
            {t("dashboardsHubLastUpdated")}: {new Date(dashboard.updatedAt).toLocaleString()}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap,
            gridAutoRows: rowHeight,
          }}
        >
          {sortedCards.map((card) => {
            const layoutMeta = parseJson(card.layoutJson, { titleOverride: "", showTitle: true });
            const legacyTitle = layoutMeta.titleOverride ?? "";
            const legacyShowTitle = layoutMeta.showTitle;
            const refreshMeta = parseJson(card.refreshPolicyJson, { mode: "Inherit", interval: "" });
            const cardTitle =
              card.title?.trim() ||
              legacyTitle.trim() ||
              cardsById[card.cardId]?.title ||
              t("studioUntitledCard");
            const cardDescription = card.description ?? "";
            const showTitle = card.showTitle ?? legacyShowTitle ?? true;
            const showDescription = card.showDescription ?? true;
            const refreshLabel =
              refreshMeta.mode === "Inherit" ? t("studioRefreshInherit") : refreshMeta.interval || refreshMeta.mode;
            const showHeader = showTitle || (showDescription && cardDescription);

            return (
              <div
                key={card.id}
                className="rounded-xl border border-border bg-card text-card-foreground shadow-sm"
                style={{
                  gridColumn: `${card.positionX + 1} / span ${card.width}`,
                  gridRow: `${card.positionY + 1} / span ${card.height}`,
                  padding: cardPadding,
                }}
              >
                {showHeader ? (
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      {showTitle ? <span className="font-semibold">{cardTitle}</span> : null}
                      {showDescription && cardDescription ? (
                        <p className="text-xs text-muted-foreground mt-1">{cardDescription}</p>
                      ) : null}
                    </div>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {refreshLabel}
                    </span>
                  </div>
                ) : null}
                <div className="mt-3 h-full rounded-lg border border-dashed border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                  {t("dashboardsHubActionView")}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
