import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/contexts/I18nContext";
import { getClientIntegrations, getCompanyAvailableIntegrations } from "@/lib/biIntegrationApi";
import type { IntegrationListResponse } from "@/lib/biIntegrationApi";
import type { StudioCard } from "@/types/studio";
import type { DashboardCardDraft, DashboardDraft } from "./dashboardTypes";

type DashboardCanvasPanelProps = {
  draft: DashboardDraft;
  cards: StudioCard[];
  onDraftChange: (next: DashboardDraft) => void;
  onSave: () => void;
  onDelete?: () => void;
  onDropTemplate?: (templateId: number) => void;
  onRemoveCard: (index: number) => void;
};

const refreshIntervals = ["1m", "5m", "15m", "1h"] as const;

export function DashboardCanvasPanel({
  draft,
  cards,
  onDraftChange,
  onSave,
  onDelete,
  onDropTemplate,
  onRemoveCard,
}: DashboardCanvasPanelProps) {
  const { t } = useI18n();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationListResponse[]>([]);

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const selectedCard = selectedIndex !== null ? draft.cards[selectedIndex] : null;

  useEffect(() => {
    if (selectedIndex === null) return;
    if (selectedIndex >= draft.cards.length) {
      setSelectedIndex(null);
    }
  }, [draft.cards.length, selectedIndex]);

  useEffect(() => {
    let active = true;
    const loadIntegrations = async () => {
      if (draft.scope === "Client" && draft.clientId) {
        const list = await getClientIntegrations(draft.clientId);
        if (!active) return;
        setIntegrations(list);
        return;
      }
      if (draft.scope === "Company" && draft.profileId) {
        const list = await getCompanyAvailableIntegrations(draft.profileId);
        if (!active) return;
        setIntegrations(list);
        return;
      }
      setIntegrations([]);
    };

    loadIntegrations().catch(() => {
      if (!active) return;
      setIntegrations([]);
    });

    return () => {
      active = false;
    };
  }, [draft.scope, draft.clientId, draft.profileId]);

  const availableIntegrations = useMemo(() => {
    if (!selectedCard?.templateIntegrationType) return integrations;
    const needle = selectedCard.templateIntegrationType.toLowerCase();
    return integrations.filter((integration) => integration.type.toLowerCase() === needle);
  }, [integrations, selectedCard?.templateIntegrationType]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload.startsWith("template:")) return;
    const id = Number(payload.replace("template:", ""));
    if (!Number.isFinite(id)) return;
    onDropTemplate?.(id);
  };

  const updateCard = (index: number, update: Partial<DashboardCardDraft>) => {
    const nextCards = draft.cards.map((card, idx) => (idx === index ? { ...card, ...update } : card));
    onDraftChange({ ...draft, cards: nextCards });
  };

  const requiresDagList = Boolean(selectedCard?.templateEndpoint?.includes("{dagId}"));
  const dagValue = selectedCard?.params?.dagIds ?? "";

  return (
    <Card className="min-h-[620px]">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{t("studioDashboardCanvasTitle")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("studioDashboardCanvasHint")}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("studioDashboardName")}</Label>
            <Input
              value={draft.name}
              onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
              placeholder={t("studioDashboardNamePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("studioDashboardRefreshInterval")}</Label>
            <Select
              value={draft.refreshInterval}
              onValueChange={(value) => onDraftChange({ ...draft, refreshInterval: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("studioDashboardRefreshInterval")} />
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

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("studioDashboardCanvasMode")}</Label>
            <Select
              value={draft.layout.canvasMode}
              onValueChange={(value) =>
                onDraftChange({ ...draft, layout: { ...draft.layout, canvasMode: value as "responsive" | "fixed" } })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("studioDashboardCanvasMode")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="responsive">{t("studioDashboardCanvasResponsive")}</SelectItem>
                <SelectItem value="fixed">{t("studioDashboardCanvasFixed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("studioDashboardCanvasWidth")}</Label>
            <Input
              value={draft.layout.canvasWidth}
              onChange={(event) =>
                onDraftChange({ ...draft, layout: { ...draft.layout, canvasWidth: event.target.value } })
              }
              placeholder="1280"
              disabled={draft.layout.canvasMode === "responsive"}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("studioDashboardDesc")}</Label>
          <textarea
            value={draft.description}
            onChange={(event) => onDraftChange({ ...draft, description: event.target.value })}
            placeholder={t("studioDashboardDescPlaceholder")}
            className="w-full min-h-[110px] rounded-xl border border-input bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{t("studioDashboardDropHint")}</p>
            <p className="text-xs text-muted-foreground">{t("studioDashboardCanvasHelper")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onSave}>
              {t("save")}
            </Button>
            {onDelete && (
              <Button type="button" variant="outline" onClick={onDelete}>
                {t("delete")}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div
            className="min-h-[360px] rounded-2xl border border-dashed border-border bg-background/70 p-4"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            {draft.cards.length === 0 ? (
              <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                {t("studioDashboardEmptyCanvas")}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {draft.cards.map((item, index) => {
                  const card = cardById.get(item.cardId);
                  const title = item.title || item.templateTitle ?? card?.title ?? `Card ${item.cardId}`;
                  const type = item.templateCardType ?? card?.cardType ?? "-";
                  return (
                    <button
                      key={`${item.cardId}-${index}`}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        selectedIndex === index ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{title}</p>
                          <p className="text-xs text-muted-foreground">{type}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemoveCard(index);
                          }}
                        >
                          {t("studioDashboardRemoveCard")}
                        </Button>
                      </div>
                      {item.templateIntegrationType ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {t("studioDashboardTemplateSource", { source: item.templateIntegrationType })}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{t("studioDashboardCardSettings")}</p>
              <p className="text-xs text-muted-foreground">{t("studioDashboardCardSettingsHint")}</p>
            </div>

            {selectedCard ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t("studioDashboardTemplateLabel")}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedCard.title || selectedCard.templateTitle ?? cardById.get(selectedCard.cardId)?.title ?? t("studioUntitledCard")}
                  </p>
                  {selectedCard.templateEndpoint ? (
                    <p className="text-[11px] text-muted-foreground">{selectedCard.templateEndpoint}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>{t("studioSelectIntegration")}</Label>
                  <Select
                    value={selectedCard.integrationId ? String(selectedCard.integrationId) : ""}
                    onValueChange={(value) => {
                      updateCard(selectedIndex, { integrationId: Number(value) });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("studioSelectIntegration")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableIntegrations.map((integration) => (
                        <SelectItem key={integration.id} value={String(integration.id)}>
                          {integration.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableIntegrations.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">{t("studioDashboardNoIntegrations")}</p>
                  ) : null}
                </div>

                {requiresDagList ? (
                  <div className="space-y-2">
                    <Label>{t("studioDashboardDagList")}</Label>
                    <Input
                      value={dagValue}
                      onChange={(event) => {
                        const next = event.target.value;
                        updateCard(selectedIndex, {
                          params: { ...(selectedCard.params ?? {}), dagIds: next },
                        });
                      }}
                      placeholder={t("studioDashboardDagListPlaceholder")}
                    />
                    <p className="text-[11px] text-muted-foreground">{t("studioDashboardDagListHint")}</p>
                    {!dagValue.trim() ? (
                      <p className="text-[11px] text-amber-500">{t("studioDashboardDagListWarning")}</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label>{t("studioDashboardCardTitle")}</Label>
                  <Input
                    value={selectedCard.title}
                    onChange={(event) => updateCard(selectedIndex, { title: event.target.value })}
                    placeholder={t("studioDashboardCardTitlePlaceholder")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("studioDashboardCardDescription")}</Label>
                  <Input
                    value={selectedCard.description}
                    onChange={(event) => updateCard(selectedIndex, { description: event.target.value })}
                    placeholder={t("studioDashboardCardDescriptionPlaceholder")}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("studioDashboardCardWidth")}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={selectedCard.width}
                      onChange={(event) => updateCard(selectedIndex, { width: Number(event.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("studioDashboardCardHeight")}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={selectedCard.height}
                      onChange={(event) => updateCard(selectedIndex, { height: Number(event.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("studioDashboardShowTitle")}</Label>
                    <Select
                      value={selectedCard.showTitle ? "yes" : "no"}
                      onValueChange={(value) => updateCard(selectedIndex, { showTitle: value === "yes" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("studioDashboardShowTitle")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">{t("yes")}</SelectItem>
                        <SelectItem value="no">{t("no")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("studioDashboardShowDescription")}</Label>
                    <Select
                      value={selectedCard.showDescription ? "yes" : "no"}
                      onValueChange={(value) => updateCard(selectedIndex, { showDescription: value === "yes" })}
                    >
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
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                {t("studioDashboardCardSelectHint")}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
