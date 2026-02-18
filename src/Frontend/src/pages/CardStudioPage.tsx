// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/rules-of-hooks, react-hooks/purity */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CardConfig, CardTemplate, DataSource } from "@/types/cards";
import { getCards, removeCard, upsertCard } from "@/lib/cardStore";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/contexts/I18nContext";
import { messages } from "@/i18n/messages";
import { TemplateGallery } from "@/components/studio/TemplateGallery";
import { Layers } from "lucide-react";

type TemplateMeta = {
  id: CardTemplate["id"];
  nameKey: keyof typeof messages.en;
  descKey: keyof typeof messages.en;
  supportedLayouts: CardTemplate["supportedLayouts"];
  defaultLayout: CardTemplate["defaultLayout"];
};

type SourceMeta = {
  id: number;
  nameKey: keyof typeof messages.en;
  authKey: keyof typeof messages.en;
  type: DataSource["type"];
  domain: string;
};

const templatesMeta: TemplateMeta[] = [
  {
    id: "airflow-dag-overview",
    nameKey: "templateAirflowOverviewName",
    descKey: "templateAirflowOverviewDesc",
    supportedLayouts: ["list", "grid", "timeline"],
    defaultLayout: "list",
  },
  {
    id: "airflow-dag-status",
    nameKey: "templateAirflowStatusName",
    descKey: "templateAirflowStatusDesc",
    supportedLayouts: ["grid"],
    defaultLayout: "grid",
  },
  {
    id: "adf-pipeline-status",
    nameKey: "templateAdfStatusName",
    descKey: "templateAdfStatusDesc",
    supportedLayouts: ["grid", "list"],
    defaultLayout: "grid",
  },
  {
    id: "kpi-strip",
    nameKey: "templateKpiName",
    descKey: "templateKpiDesc",
    supportedLayouts: ["kpi"],
    defaultLayout: "kpi",
  },
];

const sourcesMeta: SourceMeta[] = [
  {
    id: 1,
    type: "airflow",
    nameKey: "sourceBrewName",
    authKey: "sourceBrewAuth",
    domain: "brewdatflow.ab-inbev.com",
  },
  {
    id: 2,
    type: "airflow",
    nameKey: "sourcePartnerName",
    authKey: "sourcePartnerAuth",
    domain: "airflow.partner.net",
  },
  {
    id: 3,
    type: "adf",
    nameKey: "sourceAdfName",
    authKey: "sourceAdfAuth",
    domain: "management.azure.com",
  },
];

const refreshOptions = ["manual", "1m", "5m", "15m", "1h"] as const;

const getParamList = (params: Record<string, string | string[]>) => {
  const value = params.dags ?? params.pipelines ?? [];
  return Array.isArray(value) ? value : [value];
};

export default function CardStudioPage() {
  const [cards, setCards] = useState<CardConfig[]>(getCards());
  const [activeId, setActiveId] = useState<number>(cards[0]?.id ?? 0);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const { showToast } = useToast();
  const { t } = useI18n();

  const templates = useMemo(
    () =>
      templatesMeta.map((template) => ({
        id: template.id,
        name: t(template.nameKey),
        description: t(template.descKey),
        supportedLayouts: template.supportedLayouts,
        defaultLayout: template.defaultLayout,
      })),
    [t]
  );

  const sources = useMemo(
    () =>
      sourcesMeta.map((source) => ({
        id: source.id,
        name: t(source.nameKey),
        authLabel: t(source.authKey),
        type: source.type,
        domain: source.domain,
      })),
    [t]
  );

  const layoutLabels = useMemo(
    () => ({
      grid: t("layoutGrid"),
      list: t("layoutList"),
      timeline: t("layoutTimeline"),
      kpi: t("layoutKpi"),
    }),
    [t]
  );
  const sourceTypeLabels = useMemo(
    () => ({
      airflow: t("integrationType_airflow"),
      adf: t("integrationType_adf"),
      api: t("integrationType_api"),
    }),
    [t]
  );

  const refreshLabels = useMemo(
    () => ({
      manual: t("refreshManual"),
      "1m": t("refresh1m"),
      "5m": t("refresh5m"),
      "15m": t("refresh15m"),
      "1h": t("refresh1h"),
    }),
    [t]
  );

  const newCard = () => ({
    id: Date.now(),
    title: t("cardStudioNewCard"),
    templateId: "airflow-dag-overview" as const,
    layoutId: "list" as const,
    sourceId: 1,
    refresh: "5m" as const,
    params: {
      dags: ["saz_br_technology_auxiliary_sheets_transformation"],
    },
  });

  const activeCard = useMemo(
    () => cards.find((card) => card.id === activeId) ?? cards[0] ?? newCard(),
    [activeId, cards]
  );

  const activeTemplate = templates.find((item) => item.id === activeCard.templateId) ?? templates[0];
  const activeSource = sources.find((item) => item.id === activeCard.sourceId) ?? sources[0];

  const handleSave = (next: CardConfig) => {
    upsertCard(next);
    const updated = getCards();
    setCards(updated);
    setActiveId(next.id);
    showToast(t("toastCardSaved"), { title: t("toastCardTitle"), variant: "success" });
  };

  const handleRemove = (id: number) => {
    removeCard(id);
    const updated = getCards();
    setCards(updated);
    setActiveId(updated[0]?.id ?? 0);
    showToast(t("toastCardRemoved"), { title: t("toastCardTitle"), variant: "info" });
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-16 top-8 h-40 w-40 rounded-full bg-cyan-400/40 blur-3xl" />
          <div className="absolute right-12 top-4 h-36 w-36 rounded-full bg-amber-400/40 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-3 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-300">{t("cardStudioEyebrow")}</p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{t("cardStudioTitle")}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t("cardStudioSubtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={showTemplateGallery ? "default" : "secondary"}
              className="gap-2"
              onClick={() => setShowTemplateGallery(!showTemplateGallery)}
            >
              <Layers className="w-4 h-4" />
              Browse Templates
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              onClick={() => {
                const card = newCard();
                handleSave(card);
              }}
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {t("cardStudioNewCard")}
            </Button>
            <Button size="sm" variant="secondary" className="gap-2">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                <path d="M4 12h16M4 7h10M4 17h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {t("cardStudioExport")}
            </Button>
          </div>
        </div>
      </div>

      {/* Template Gallery */}
      {showTemplateGallery && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Template Gallery
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplateGallery(false)}
                className="h-8 w-8 p-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose a pre-built template to start building your dashboard
            </p>
          </CardHeader>
          <CardContent>
            <TemplateGallery
              onTemplateSelected={(_cardId) => {
                setShowTemplateGallery(false);
                showToast("Template added to your dashboard", {
                  variant: "success",
                });
              }}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                  <path d="M4 6h16M4 12h10M4 18h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              {t("cardStudioActiveCards")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t("cardStudioActiveCardsHint")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => setActiveId(card.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    card.id === activeId ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{card.title}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {card.refresh}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{card.templateId}</p>
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              {t("cardStudioDragHint")}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                    <path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                {t("cardStudioConfigTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                    <path d="M5 7h14M5 12h10M5 17h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  {t("cardStudioLabelTitle")}
                </span>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={activeCard.title}
                  onChange={(event) =>
                    handleSave({ ...activeCard, title: event.target.value })
                  }
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                    <path d="M4 12a8 8 0 0 1 14-5" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M18 4v6h-6" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  {t("cardStudioLabelRefresh")}
                </span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={activeCard.refresh}
                  onChange={(event) =>
                    handleSave({ ...activeCard, refresh: event.target.value as CardConfig["refresh"] })
                  }
                >
                  {refreshOptions.map((option) => (
                    <option key={option} value={option}>
                      {refreshLabels[option]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                    <rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  {t("cardStudioLabelTemplate")}
                </span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={activeCard.templateId}
                  onChange={(event) => {
                    const templateId = event.target.value as CardConfig["templateId"];
                    const template = templates.find((item) => item.id === templateId) ?? templates[0];
                    handleSave({
                      ...activeCard,
                      templateId,
                      layoutId: template.defaultLayout,
                    });
                  }}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                    <path d="M4 6h16v12H4z" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M4 10h16M9 10v8" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  {t("cardStudioLabelLayout")}
                </span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={activeCard.layoutId}
                  onChange={(event) =>
                    handleSave({
                      ...activeCard,
                      layoutId: event.target.value as CardConfig["layoutId"],
                    })
                  }
                >
                  {activeTemplate.supportedLayouts.map((layout) => (
                    <option key={layout} value={layout}>
                      {layoutLabels[layout]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                    <path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  {t("cardStudioLabelSource")}
                </span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={activeCard.sourceId}
                  onChange={(event) =>
                    handleSave({ ...activeCard, sourceId: parseInt(event.target.value) })
                  }
                >
                  {sources.map((source) => (
                    <option key={source.id} value={source.id.toString()}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm md:col-span-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                    <path d="M4 7h16M7 12h10M9 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  {t("cardStudioLabelFilters")}
                </span>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={getParamList(activeCard.params).join(", ")}
                  onChange={(event) => {
                    const values = event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean);
                    handleSave({
                      ...activeCard,
                      params: activeTemplate.id.startsWith("adf")
                        ? { pipelines: values }
                        : { dags: values },
                    });
                  }}
                />
              </label>

              <div className="flex items-end gap-2 md:col-span-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => handleRemove(activeCard.id)}
                >
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                    <path d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  {t("cardStudioRemoveCard")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                      <path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  {t("cardStudioPreview")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="rounded-xl border border-border/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">
                        {sourceTypeLabels[activeSource.type] ?? activeSource.type}
                      </p>
                      <h3 className="text-lg font-semibold">{activeCard.title}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs">
                      <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground">
                        {layoutLabels[activeCard.layoutId]}
                      </span>
                      <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground">
                        {activeCard.refresh}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {getParamList(activeCard.params).map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm"
                      >
                        <span className="truncate">{item}</span>
                        <span className="text-xs text-muted-foreground">{t("statusOk")}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 p-4 text-xs text-muted-foreground">
                  {t("cardStudioPreviewNote")}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                      <path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  {t("cardStudioSourceTemplate")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs uppercase text-muted-foreground">{t("cardStudioAuth")}</p>
                  <p className="text-sm font-medium">{activeSource.authLabel}</p>
                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    {t("cardStudioDomain")}: {activeSource.domain}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs uppercase text-muted-foreground">{t("cardStudioTemplateLabel")}</p>
                  <p className="text-sm font-medium">{activeTemplate.name}</p>
                  <p className="text-xs text-muted-foreground">{activeTemplate.description}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="rounded-md border border-border/60 px-2 py-1">
                      {t("cardStudioLayoutsLabel")}: {activeTemplate.supportedLayouts.length}
                    </div>
                    <div className="rounded-md border border-border/60 px-2 py-1">
                      {t("cardStudioDefaultLabel")}: {layoutLabels[activeTemplate.defaultLayout]}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
