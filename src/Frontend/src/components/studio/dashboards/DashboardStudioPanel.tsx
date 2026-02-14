import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import type { ClientListResponse } from "@/lib/clientApi";
import type { CompanyListResponse } from "@/lib/companyApi";
import type { StudioCard, StudioCardDetail, StudioDashboardDetail } from "@/types/studio";
import {
  createStudioCard,
  createStudioDashboard,
  deleteStudioDashboard,
  getStudioCard,
  getStudioDashboard,
  listStudioCards,
  listStudioDashboards,
  updateStudioDashboard,
} from "@/lib/studioApi";
import { getClients } from "@/lib/clientApi";
import { getCompanies } from "@/lib/companyApi";
import { DashboardListPanel } from "./DashboardListPanel";
import { DashboardCanvasPanel } from "./DashboardCanvasPanel";
import { DashboardTemplateLibrary } from "./DashboardTemplateLibrary";
import type { DashboardCardDraft, DashboardDraft, DashboardLayoutSettings, TemplateCard } from "./dashboardTypes";

const defaultTheme = {
  background: "#f8fafc",
  text: "#0f172a",
  accent: "#6366f1",
  fontSize: "base",
  radius: "16px",
  shadow: "0 30px 60px rgba(15, 23, 42, 0.12)",
};

const defaultLayout: DashboardLayoutSettings = {
  columns: "12",
  gap: "16",
  rowHeight: "120",
  cardPadding: "16",
  headerStyle: "expanded",
  backgroundPattern: "dots",
  showFilters: true,
  showLegend: true,
  canvasMode: "responsive",
  canvasWidth: "1280",
};

const defaultDashboard = (scope: "Client" | "Company", clientId?: number, profileId?: number): DashboardDraft => ({
  name: "",
  description: "",
  status: "Draft",
  scope,
  clientId,
  profileId,
  layoutType: "grid",
  refreshMode: "Interval",
  refreshInterval: "5m",
  layout: defaultLayout,
  theme: defaultTheme,
  cards: [],
});

const parseJson = <T,>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const parseTemplateMeta = (value: string | null | undefined) => {
  const fallback = { seedKey: undefined, integrationType: undefined, endpoint: undefined };
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as { seedKey?: string; integrationType?: string; endpoint?: string };
    return {
      seedKey: typeof parsed.seedKey === "string" ? parsed.seedKey : undefined,
      integrationType: typeof parsed.integrationType === "string" ? parsed.integrationType : undefined,
      endpoint: typeof parsed.endpoint === "string" ? parsed.endpoint : undefined,
    };
  } catch {
    return fallback;
  }
};

const extractSeedKey = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { seedKey?: string };
    return typeof parsed.seedKey === "string" ? parsed.seedKey : null;
  } catch {
    return null;
  }
};

const toJson = (value: unknown) => JSON.stringify(value ?? {});

const toCardSummary = (card: StudioCardDetail): StudioCard => ({
  id: card.id,
  title: card.title,
  cardType: card.cardType,
  layoutType: card.layoutType,
  status: card.status,
  scope: card.scope,
  clientId: card.clientId ?? undefined,
  profileId: card.profileId ?? undefined,
  integrationId: card.integrationId ?? undefined,
  createdAt: card.createdAt,
  updatedAt: card.updatedAt,
  lastTestedAt: card.lastTestedAt ?? undefined,
  lastTestSucceeded: card.lastTestSucceeded,
});

export function DashboardStudioPanel() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [dashboards, setDashboards] = useState<StudioDashboardDetail[]>([]);
  const [cards, setCards] = useState<StudioCard[]>([]);
  const [templateCards, setTemplateCards] = useState<TemplateCard[]>([]);
  const [templateCardDetails, setTemplateCardDetails] = useState<Record<number, StudioCardDetail>>({});
  const [templateDashboards, setTemplateDashboards] = useState<StudioDashboardDetail[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DashboardDraft>(() => defaultDashboard("Company"));
  const [clients, setClients] = useState<ClientListResponse[]>([]);
  const [companies, setCompanies] = useState<CompanyListResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const scopeId = draft.scope === "Client" ? draft.clientId : draft.profileId;

  const buildDraftFromDashboard = (dashboard: StudioDashboardDetail, { keepId }: { keepId: boolean }) => {
    const payload = parseJson(dashboard.layoutJson, { layout: defaultLayout, theme: defaultTheme });
    const refreshPolicy = parseJson(dashboard.refreshPolicyJson, { mode: "Interval", interval: "5m" });
    const cardDrafts = dashboard.cards.map((card) => {
      const layout = parseJson(card.layoutJson, { template: {} as Record<string, unknown> });
      const refresh = parseJson(card.refreshPolicyJson, { mode: "Inherit", interval: "5m" });
      const template = (layout.template ?? {}) as {
        templateCardId?: number;
        templateSeedKey?: string;
        templateIntegrationType?: string;
        templateEndpoint?: string;
        templateTitle?: string;
        templateCardType?: string;
        integrationId?: number;
        params?: Record<string, string>;
      };
      const inferredTemplate = templateCardDetails[card.cardId];
      const legacyTitle = typeof (layout as { titleOverride?: string }).titleOverride === "string"
        ? (layout as { titleOverride?: string }).titleOverride
        : "";
      const legacyShowTitle = (layout as { showTitle?: boolean }).showTitle;
      const inferredMeta = inferredTemplate ? parseTemplateMeta(inferredTemplate.dataSourceJson) : null;
      return {
        id: keepId ? card.id : undefined,
        cardId: card.cardId,
        templateCardId: template.templateCardId ?? inferredTemplate?.id,
        templateSeedKey: template.templateSeedKey ?? inferredMeta?.seedKey,
        templateIntegrationType: template.templateIntegrationType ?? inferredMeta?.integrationType,
        templateEndpoint: template.templateEndpoint ?? inferredMeta?.endpoint,
        templateTitle: template.templateTitle ?? inferredTemplate?.title,
        templateCardType: template.templateCardType ?? inferredTemplate?.cardType,
        integrationId: template.integrationId,
        params: template.params,
        orderIndex: card.orderIndex,
        positionX: card.positionX,
        positionY: card.positionY,
        width: card.width,
        height: card.height,
        title: card.title ?? legacyTitle ?? inferredTemplate?.title ?? "",
        description: card.description ?? inferredTemplate?.description ?? "",
        showTitle: card.showTitle ?? legacyShowTitle ?? true,
        showDescription: card.showDescription ?? true,
        refreshMode: refresh.mode ?? "Inherit",
        refreshInterval: refresh.interval ?? "5m",
      };
    });

    return {
      id: keepId ? dashboard.id : undefined,
      name: dashboard.name,
      description: dashboard.description ?? "",
      status: dashboard.status,
      scope: dashboard.scope,
      clientId: dashboard.clientId ?? undefined,
      profileId: dashboard.profileId ?? undefined,
      layoutType: dashboard.layoutType,
      refreshMode: refreshPolicy.mode ?? "Interval",
      refreshInterval: refreshPolicy.interval ?? "5m",
      layout: payload.layout ?? defaultLayout,
      theme: payload.theme ?? defaultTheme,
      cards: cardDrafts,
    };
  };

  useEffect(() => {
    getClients().then(setClients).catch(() => setClients([]));
    getCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    const param = searchParams.get("dashboardId");
    if (!param) return;
    const parsed = Number(param);
    if (!Number.isFinite(parsed)) return;
    let active = true;
    getStudioDashboard(parsed)
      .then((dashboard) => {
        if (!active) return;
        setDraft((prev) => ({
          ...prev,
          scope: dashboard.scope,
          clientId: dashboard.clientId ?? undefined,
          profileId: dashboard.profileId ?? undefined,
        }));
        setActiveId(dashboard.id);
      })
      .catch(() => {
        if (!active) return;
        showToast(t("studioDashboardLoadFailed"), { variant: "error" });
      });
    return () => {
      active = false;
    };
  }, [searchParams, showToast, t]);

  useEffect(() => {
    if (draft.scope === "Client" && !draft.clientId && clients.length) {
      setDraft((prev) => ({ ...prev, clientId: clients[0].id }));
    }
    if (draft.scope === "Company" && !draft.profileId && companies.length) {
      setDraft((prev) => ({ ...prev, profileId: companies[0].id }));
    }
  }, [clients, companies, draft.scope, draft.clientId, draft.profileId]);

  const loadDashboards = async () => {
    if (!scopeId) return;
    setLoading(true);
    try {
      const list = await listStudioDashboards(draft.scope, draft.clientId, draft.profileId);
      const details = await Promise.all(list.map((item) => getStudioDashboard(item.id)));
      const userDashboards = details.filter((item) => !extractSeedKey(item.layoutJson));
      setDashboards(userDashboards);
      if (!activeId && userDashboards.length) {
        setActiveId(userDashboards[0].id);
      }
    } catch {
      showToast(t("studioDashboardsLoadFailed"), { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.scope, draft.clientId, draft.profileId]);

  useEffect(() => {
    if (!scopeId) return;
    let active = true;
    listStudioCards(draft.scope, draft.clientId, draft.profileId)
      .then(async (list) => {
        if (!active) return;
        setCards(list);
      })
      .catch(() => {
        if (!active) return;
        setCards([]);
      });
    return () => {
      active = false;
    };
  }, [draft.scope, draft.clientId, draft.profileId, scopeId]);

  useEffect(() => {
    let active = true;
    const loadTemplates = async () => {
      try {
        const [templateList, dashboardList] = await Promise.all([
          listStudioCards(),
          listStudioDashboards(),
        ]);
        if (!active) return;
        const cardDetails = await Promise.all(
          templateList.map((card) => getStudioCard(card.id).catch(() => null))
        );
        if (!active) return;
        const templateDetails = cardDetails.filter((item): item is StudioCardDetail => Boolean(item));
        const templateCards = templateDetails
          .filter((card) => Boolean(extractSeedKey(card.dataSourceJson)))
          .map((card) => {
            const meta = parseTemplateMeta(card.dataSourceJson);
            return {
              ...toCardSummary(card),
              description: card.description ?? null,
              seedKey: meta.seedKey,
              integrationType: meta.integrationType,
              endpoint: meta.endpoint,
            };
          });
        setTemplateCards(templateCards);
        setTemplateCardDetails(
          templateDetails.reduce<Record<number, StudioCardDetail>>((acc, card) => {
            acc[card.id] = card;
            return acc;
          }, {})
        );

        const dashboards = await Promise.all(
          dashboardList.map((item) => getStudioDashboard(item.id).catch(() => null))
        );
        if (!active) return;
        const templateDashboardsList = dashboards
          .filter((item): item is StudioDashboardDetail => Boolean(item))
          .filter((item) => Boolean(extractSeedKey(item.layoutJson)));
        setTemplateDashboards(templateDashboardsList);
      } catch {
        if (!active) return;
        setTemplateCards([]);
        setTemplateDashboards([]);
      }
    };

    loadTemplates();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    getStudioDashboard(activeId)
      .then((dashboard) => {
        setDraft(buildDraftFromDashboard(dashboard, { keepId: true }));
      })
      .catch(() => showToast(t("studioDashboardLoadFailed"), { variant: "error" }));
  }, [activeId, showToast, t]);

  const handleSave = async () => {
    if (!scopeId) return;
    const createdCards: StudioCardDetail[] = [];
    const cardDrafts = await Promise.all(
      draft.cards.map(async (card) => {
        const templateId = card.templateCardId ?? card.cardId;
        const isTemplate = Boolean(card.templateCardId && card.cardId === templateId);
        if (!isTemplate) return card;
        const templateDetail = templateCardDetails[templateId];
        if (!templateDetail) return card;
        const dataSource = parseJson<Record<string, unknown>>(templateDetail.dataSourceJson, {});
        const nextDataSource = {
          ...dataSource,
          integrationType: card.templateIntegrationType ?? (dataSource as any)?.integrationType,
          endpoint: card.templateEndpoint ?? (dataSource as any)?.endpoint,
          params: card.params ?? {},
        } as Record<string, unknown>;
        if ("seedKey" in nextDataSource) {
          delete nextDataSource.seedKey;
        }
        const created = await createStudioCard({
          title: card.title?.trim() || templateDetail.title,
          description: templateDetail.description ?? null,
          scope: draft.scope,
          clientId: draft.clientId ?? null,
          profileId: draft.profileId ?? null,
          cardType: templateDetail.cardType,
          layoutType: templateDetail.layoutType,
          integrationId: card.integrationId ?? null,
          query: templateDetail.query ?? null,
          fieldsJson: templateDetail.fieldsJson ?? null,
          styleJson: templateDetail.styleJson ?? null,
          layoutJson: templateDetail.layoutJson ?? null,
          refreshPolicyJson: templateDetail.refreshPolicyJson ?? null,
          dataSourceJson: toJson(nextDataSource),
          testSignature: templateDetail.lastTestSignature ?? null,
          testedAt: templateDetail.lastTestedAt ?? null,
        });
        createdCards.push(created);
        return {
          ...card,
          cardId: created.id,
        };
      })
    );

    const payload = {
      name: draft.name || t("studioDashboardUntitled"),
      description: draft.description,
      scope: draft.scope,
      clientId: draft.clientId ?? null,
      profileId: draft.profileId ?? null,
      layoutType: draft.layoutType,
      layoutJson: toJson({ layout: draft.layout, theme: draft.theme }),
      refreshPolicyJson: toJson({ mode: draft.refreshMode, interval: draft.refreshInterval }),
      status: draft.status,
      cards: cardDrafts.map((card, idx) => ({
        id: card.id ?? null,
        cardId: card.cardId,
        title: card.title,
        description: card.description,
        showTitle: card.showTitle,
        showDescription: card.showDescription,
        orderIndex: idx,
        positionX: card.positionX,
        positionY: card.positionY,
        width: card.width,
        height: card.height,
        layoutJson: toJson({
          template: card.templateCardId
            ? {
                templateCardId: card.templateCardId,
                templateSeedKey: card.templateSeedKey,
                templateIntegrationType: card.templateIntegrationType,
                templateEndpoint: card.templateEndpoint,
                templateTitle: card.templateTitle,
                templateCardType: card.templateCardType,
                integrationId: card.integrationId,
                params: card.params ?? {},
              }
            : undefined,
        }),
        refreshPolicyJson: toJson({ mode: card.refreshMode, interval: card.refreshInterval }),
      })),
    };

    try {
      if (draft.id) {
        await updateStudioDashboard(draft.id, payload);
        showToast(t("studioDashboardSaved"), { variant: "success" });
      } else {
        const created = await createStudioDashboard(payload);
        setActiveId(created.id);
        if (draft.status !== "Draft") {
          await updateStudioDashboard(created.id, { status: draft.status });
        }
        showToast(t("studioDashboardCreated"), { variant: "success" });
      }
      if (createdCards.length) {
        setCards((prev) => [...prev, ...createdCards.map(toCardSummary)]);
      }
      setDraft((prev) => ({ ...prev, cards: cardDrafts }));
      await loadDashboards();
    } catch {
      showToast(t("studioDashboardSaveFailed"), { variant: "error" });
    }
  };

  const handleDelete = async () => {
    if (!draft.id) return;
    try {
      await deleteStudioDashboard(draft.id);
      setActiveId(null);
      setDraft(defaultDashboard(draft.scope, draft.clientId, draft.profileId));
      showToast(t("studioDashboardDeleted"), { variant: "info" });
      await loadDashboards();
    } catch {
      showToast(t("studioDashboardDeleteFailed"), { variant: "error" });
    } finally {
      setConfirmDeleteOpen(false);
    }
  };

  const handleAddTemplate = (cardId: number) => {
    const template = templateCards.find((item) => item.id === cardId);
    if (!template) return;
    const orderIndex = draft.cards.length;
    const nextCard: DashboardCardDraft = {
      cardId: template.id,
      templateCardId: template.id,
      templateSeedKey: template.seedKey,
      templateIntegrationType: template.integrationType,
      templateEndpoint: template.endpoint,
      templateTitle: template.title,
      templateCardType: template.cardType,
      orderIndex,
      positionX: 0,
      positionY: orderIndex * 2,
      width: 4,
      height: 2,
      title: template.title,
      description: template.description ?? "",
      showTitle: true,
      showDescription: true,
      refreshMode: "Inherit",
      refreshInterval: "5m",
      params: {},
    };
    setDraft((prev) => ({
      ...prev,
      cards: [...prev.cards, nextCard],
    }));
  };

  const handleRemoveCard = (index: number) => {
    const updated = draft.cards.filter((_, idx) => idx !== index).map((card, idx) => ({ ...card, orderIndex: idx }));
    setDraft((prev) => ({ ...prev, cards: updated }));
  };

  const handleNewDashboard = () => {
    setActiveId(null);
    setDraft(defaultDashboard(draft.scope, draft.clientId, draft.profileId));
  };

  const handleUseTemplate = (dashboard: StudioDashboardDetail) => {
    const templateDraft = buildDraftFromDashboard(dashboard, { keepId: false });
    setActiveId(null);
    setDraft({
      ...templateDraft,
      name: `${dashboard.name} ${t("studioTemplateCopySuffix")}`,
      status: "Draft",
      scope: draft.scope,
      clientId: draft.clientId,
      profileId: draft.profileId,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <DashboardListPanel
          scope={draft.scope}
          clientId={draft.clientId}
          profileId={draft.profileId}
          clients={clients}
          companies={companies}
          dashboards={dashboards}
          activeId={activeId}
          loading={loading}
          onScopeChange={(value) => setDraft((prev) => ({ ...prev, scope: value }))}
          onClientChange={(value) => setDraft((prev) => ({ ...prev, clientId: value }))}
          onCompanyChange={(value) => setDraft((prev) => ({ ...prev, profileId: value }))}
          onSelect={setActiveId}
          onNew={handleNewDashboard}
        />
        <DashboardTemplateLibrary
          cards={templateCards}
          dashboards={templateDashboards}
          onAddCard={handleAddTemplate}
          onUseDashboard={handleUseTemplate}
        />
      </div>

      <div className="space-y-6">
        <DashboardCanvasPanel
          draft={draft}
          cards={cards}
          onDraftChange={setDraft}
          onSave={handleSave}
          onDelete={draft.id ? () => setConfirmDeleteOpen(true) : undefined}
          onDropTemplate={handleAddTemplate}
          onRemoveCard={handleRemoveCard}
        />
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t("studioDashboardDeleteTitle")}
        description={t("studioDashboardDeleteConfirm")}
        confirmLabel={t("delete")}
        onConfirm={handleDelete}
      />

    </div>
  );
}
