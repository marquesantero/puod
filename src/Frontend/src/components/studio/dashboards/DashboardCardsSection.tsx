// @ts-nocheck
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/contexts/I18nContext";
import type { StudioCard } from "@/types/studio";
import type { DashboardCardDraft } from "./dashboardTypes";
import { useMemo } from "react";

const refreshIntervals = ["1m", "5m", "15m", "1h", "6h"];

const toNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

type DashboardCardsSectionProps = {
  cards: StudioCard[];
  items: DashboardCardDraft[];
  onAdd: (cardId: number) => void;
  onUpdate: (index: number, patch: Partial<DashboardCardDraft>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onDropCard?: (cardId: number) => void;
};

export function DashboardCardsSection({
  cards,
  items,
  onAdd,
  onUpdate,
  onMove,
  onRemove,
  onDropCard,
}: DashboardCardsSectionProps) {
  const { t } = useI18n();

  const cardTypeLabels = useMemo(
    () => ({
      kpi: t("studioCardTemplateKpi"),
      table: t("studioCardTemplateTable"),
      timeline: t("studioCardTemplateTimeline"),
      status: t("studioCardTemplateStatus"),
    }),
    [t]
  );
  const cardOptions = cards.map((card) => ({
    id: card.id,
    label: `${card.title} - ${cardTypeLabels[card.cardType] ?? card.cardType}`,
  }));

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{t("studioDashboardCards")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("studioDashboardCardsHint")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {onDropCard ? (
          <div
            className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const payload = event.dataTransfer.getData("text/plain");
              if (!payload.startsWith("card:")) return;
              const cardId = Number(payload.replace("card:", ""));
              if (Number.isFinite(cardId)) {
                onDropCard(cardId);
              }
            }}
          >
            {t("studioTemplatesDropHint")}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_auto]">
          <Select value="" onValueChange={(value) => onAdd(Number(value))}>
            <SelectTrigger>
              <SelectValue placeholder={t("studioDashboardAddCard")} />
            </SelectTrigger>
            <SelectContent>
              {cardOptions.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
            {`${items.length} ${t("studioDashboardCardsCount")}`}
          </div>
          <Button type="button" variant="secondary" onClick={() => onAdd(cardOptions[0]?.id ?? 0)} disabled={!cardOptions.length}>
            {t("studioDashboardQuickAdd")}
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`${item.cardId}-${index}`} className="rounded-xl border border-border p-3">
              <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t("studioDashboardCard")}</Label>
                  <Select value={String(item.cardId)} onValueChange={(value) => onUpdate(index, { cardId: Number(value) })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("studioDashboardCard")} />
                    </SelectTrigger>
                    <SelectContent>
                      {cardOptions.map((option) => (
                        <SelectItem key={option.id} value={String(option.id)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t("studioDashboardCardTitle")}</Label>
                  <Input
                    value={item.title}
                    onChange={(event) => onUpdate(index, { title: event.target.value })}
                    placeholder={t("studioDashboardCardTitlePlaceholder")}
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <Label className="text-xs text-muted-foreground">{t("studioDashboardCardDescription")}</Label>
                <Input
                  value={item.description}
                  onChange={(event) => onUpdate(index, { description: event.target.value })}
                  placeholder={t("studioDashboardCardDescriptionPlaceholder")}
                />
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-6">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("studioPositionX")}</Label>
                  <Input
                    type="number"
                    value={item.positionX}
                    onChange={(event) => onUpdate(index, { positionX: toNumber(event.target.value, 0) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("studioPositionY")}</Label>
                  <Input
                    type="number"
                    value={item.positionY}
                    onChange={(event) => onUpdate(index, { positionY: toNumber(event.target.value, 0) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("studioDashboardCardWidth")}</Label>
                  <Input
                    type="number"
                    value={item.width}
                    onChange={(event) => onUpdate(index, { width: toNumber(event.target.value, 4) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("studioDashboardCardHeight")}</Label>
                  <Input
                    type="number"
                    value={item.height}
                    onChange={(event) => onUpdate(index, { height: toNumber(event.target.value, 2) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("studioDashboardShowTitle")}</Label>
                  <Select value={item.showTitle ? "yes" : "no"} onValueChange={(value) => onUpdate(index, { showTitle: value === "yes" })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("studioDashboardShowTitle")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{t("yes")}</SelectItem>
                      <SelectItem value="no">{t("no")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("studioDashboardShowDescription")}</Label>
                  <Select value={item.showDescription ? "yes" : "no"} onValueChange={(value) => onUpdate(index, { showDescription: value === "yes" })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("studioDashboardShowDescription")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{t("yes")}</SelectItem>
                      <SelectItem value="no">{t("no")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("studioCardRefreshOverride")}</Label>
                  <Select
                    value={item.refreshMode}
                    onValueChange={(value) => onUpdate(index, { refreshMode: value as DashboardCardDraft["refreshMode"] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("studioCardRefreshOverride")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inherit">{t("studioRefreshInherit")}</SelectItem>
                      <SelectItem value="Interval">{t("studioRefreshInterval")}</SelectItem>
                      <SelectItem value="Manual">{t("refreshManual")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("studioRefreshInterval")}</Label>
                  <Select
                    value={item.refreshInterval}
                    onValueChange={(value) => onUpdate(index, { refreshInterval: value })}
                    disabled={item.refreshMode !== "Interval"}
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
                <div className="flex items-end justify-end gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => onMove(index, -1)}>
                    {t("studioMoveUp")}
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => onMove(index, 1)}>
                    {t("studioMoveDown")}
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => onRemove(index)}>
                    {t("remove")}
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              {t("studioDashboardCardsEmpty")}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
