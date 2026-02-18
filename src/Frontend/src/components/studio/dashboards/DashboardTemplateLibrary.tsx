// @ts-nocheck
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/contexts/I18nContext";
import type { StudioDashboardDetail } from "@/types/studio";
import type { TemplateCard } from "./dashboardTypes";

type DashboardTemplateLibraryProps = {
  cards: TemplateCard[];
  dashboards: StudioDashboardDetail[];
  onAddCard: (cardId: number) => void;
  onUseDashboard: (dashboard: StudioDashboardDetail) => void;
};

export function DashboardTemplateLibrary({ cards, dashboards, onAddCard, onUseDashboard }: DashboardTemplateLibraryProps) {
  const { t } = useI18n();

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, cardId: number) => {
    event.dataTransfer.setData("text/plain", `template:${cardId}`);
    event.dataTransfer.effectAllowed = "copy";
  };

  const groups = cards.reduce<Record<string, TemplateCard[]>>((acc, card) => {
    const key = card.integrationType?.toLowerCase() || "other";
    acc[key] = acc[key] ? [...acc[key], card] : [card];
    return acc;
  }, {});

  const groupLabels: Record<string, string> = {
    airflow: t("studioTemplateGroupAirflow"),
    databricks: t("studioTemplateGroupDatabricks"),
    synapse: t("integrationConnectorSynapse"),
    azuredatafactory: t("studioTemplateGroupAdf"),
    adf: t("studioTemplateGroupAdf"),
    other: t("studioTemplateGroupOther"),
  };

  return (
    <Card className="h-fit">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{t("studioTemplatesTitle")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("studioTemplatesHint")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("studioTemplatesCards")}</p>
          {cards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              {t("studioTemplatesCardsEmpty")}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groups).map(([key, items]) => (
                <div key={key} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">{groupLabels[key] ?? key}</p>
                  <div className="space-y-2">
                    {items.map((card) => (
                      <div key={card.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground">{card.title}</p>
                            <p className="text-xs text-muted-foreground">{card.description ?? card.cardType}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button type="button" size="sm" variant="secondary" onClick={() => onAddCard(card.id)}>
                              {t("studioTemplatesAdd")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              draggable
                              onDragStart={(event) => handleDragStart(event, card.id)}
                              aria-label={t("studioTemplatesDrag")}
                            >
                              {t("studioTemplatesDrag")}
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full border border-border px-2 py-0.5">{card.cardType}</span>
                          {card.endpoint ? (
                            <span className="rounded-full border border-border px-2 py-0.5">{card.endpoint}</span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("studioTemplatesDashboards")}</p>
          {dashboards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              {t("studioTemplatesDashboardsEmpty")}
            </div>
          ) : (
            <div className="space-y-2">
              {dashboards.map((dashboard) => (
                <div key={dashboard.id} className="rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{dashboard.name}</p>
                      <p className="text-xs text-muted-foreground">{dashboard.layoutType}</p>
                    </div>
                    <Button type="button" size="sm" onClick={() => onUseDashboard(dashboard)}>
                      {t("studioTemplatesUse")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
