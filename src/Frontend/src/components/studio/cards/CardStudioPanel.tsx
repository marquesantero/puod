import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import { FieldEditor, type StudioField } from "@/components/studio/shared/FieldEditor";
import { StyleEditor, type StudioStyle } from "@/components/studio/shared/StyleEditor";
import type { StudioCardStatus, StudioScope } from "@/types/studio";
import { validateCardDraft } from "@/lib/studioValidation";
import { getClients } from "@/lib/clientApi";
import { getCompanies } from "@/lib/companyApi";
import { getClientIntegrations, getCompanyAvailableIntegrations } from "@/lib/biIntegrationApi";
import type { ClientListResponse } from "@/lib/clientApi";
import type { CompanyListResponse } from "@/lib/companyApi";
import {
  useStudioCards,
  useStudioCard,
  useCreateStudioCard,
  useUpdateStudioCard,
  useDeleteStudioCard,
  useCloneStudioCard,
  useTestStudioCard,
} from "@/hooks/useStudioQueries";

type StudioCardDraft = {
  id?: number;
  title: string;
  description: string;
  scope: StudioScope;
  clientId?: number;
  profileId?: number;
  cardType: string;
  layoutType: string;
  integrationId?: number;
  query: string;
  refreshMode: "Manual" | "Interval" | "Inherit";
  refreshInterval: string;
  fields: StudioField[];
  style: StudioStyle;
  layout: Record<string, string>;
  dataSource: Record<string, string>;
};

const cardTemplateDefs = [
  { value: "kpi", labelKey: "studioCardTemplateKpi", layouts: ["kpi", "grid"] },
  { value: "table", labelKey: "studioCardTemplateTable", layouts: ["grid", "list"] },
  { value: "timeline", labelKey: "studioCardTemplateTimeline", layouts: ["timeline", "list"] },
  { value: "status", labelKey: "studioCardTemplateStatus", layouts: ["grid"] },
];

const refreshIntervals = ["1m", "5m", "15m", "1h", "6h"];

const defaultStyle: StudioStyle = {
  background: "#ffffff",
  text: "#0f172a",
  accent: "#2563eb",
  fontSize: "base",
  radius: "12px",
  shadow: "0 20px 45px rgba(15, 23, 42, 0.12)",
};

const defaultDraft = (scope: StudioScope, clientId?: number, profileId?: number): StudioCardDraft => ({
  title: "",
  description: "",
  scope,
  clientId,
  profileId,
  cardType: "kpi",
  layoutType: "grid",
  integrationId: undefined,
  query: "",
  refreshMode: "Interval",
  refreshInterval: "5m",
  fields: [],
  style: defaultStyle,
  layout: { density: "comfortable" },
  dataSource: {},
});

const parseJson = <T,>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const toJson = (value: unknown) => JSON.stringify(value ?? {});

export function CardStudioPanel() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState<StudioCardDraft>(() => defaultDraft("Company"));
  const [clients, setClients] = useState<ClientListResponse[]>([]);
  const [companies, setCompanies] = useState<CompanyListResponse[]>([]);
  const [integrations, setIntegrations] = useState<Array<{ id: number; name: string; type: string }>>([]);
  const [testPayloadSignature, setTestPayloadSignature] = useState<string | null>(null);
  const [testPayload, setTestPayload] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const scopeId = draft.scope === "Client" ? draft.clientId : draft.profileId;

  // ── TanStack Query: lista de cards ──
  const {
    data: cards = [],
    isLoading: loading,
  } = useStudioCards(draft.scope, draft.clientId, draft.profileId);

  // ── TanStack Query: detalhe do card selecionado ──
  const { data: activeCardData } = useStudioCard(activeId);

  // ── TanStack Query: mutations ──
  const createMutation = useCreateStudioCard();
  const updateMutation = useUpdateStudioCard();
  const deleteMutation = useDeleteStudioCard();
  const cloneMutation = useCloneStudioCard();
  const testMutation = useTestStudioCard();

  // ── Clients e companies (mantido local por enquanto) ──
  useEffect(() => {
    getClients().then(setClients).catch(() => setClients([]));
    getCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (draft.scope === "Client" && !draft.clientId && clients.length) {
      setDraft((prev) => ({ ...prev, clientId: clients[0].id }));
    }
    if (draft.scope === "Company" && !draft.profileId && companies.length) {
      setDraft((prev) => ({ ...prev, profileId: companies[0].id }));
    }
  }, [clients, companies, draft.scope, draft.clientId, draft.profileId]);

  // Auto-selecionar primeiro card quando a lista carrega
  useEffect(() => {
    if (!activeId && cards.length) {
      setActiveId(cards[0].id);
    }
  }, [cards, activeId]);

  // ── Integrations (mantido local por enquanto) ──
  useEffect(() => {
    const loadIntegrations = async () => {
      if (!scopeId) return;
      if (draft.scope === "Client") {
        const data = await getClientIntegrations(scopeId);
        setIntegrations(data.map((item) => ({ id: item.id, name: item.name, type: item.type })));
      } else {
        const data = await getCompanyAvailableIntegrations(scopeId);
        setIntegrations(data.map((item) => ({ id: item.id, name: item.name, type: item.type })));
      }
    };
    loadIntegrations().catch(() => setIntegrations([]));
  }, [draft.scope, scopeId]);

  // ── Preencher draft quando card detail é carregado via TanStack Query ──
  useEffect(() => {
    if (!activeCardData) return;
    const card = activeCardData;
    setDraft({
      id: card.id,
      title: card.title,
      description: card.description ?? "",
      scope: card.scope,
      clientId: card.clientId ?? undefined,
      profileId: card.profileId ?? undefined,
      cardType: card.cardType,
      layoutType: card.layoutType,
      integrationId: card.integrationId ?? undefined,
      query: card.query ?? "",
      refreshMode: (parseJson(card.refreshPolicyJson, { mode: "Interval" }).mode ?? "Interval") as "Manual" | "Interval" | "Inherit",
      refreshInterval: parseJson(card.refreshPolicyJson, { interval: "5m" }).interval ?? "5m",
      fields: parseJson(card.fieldsJson, []),
      style: parseJson(card.styleJson, defaultStyle),
      layout: parseJson(card.layoutJson, {}),
      dataSource: parseJson(card.dataSourceJson, {}),
    });
    setTestSuccess(Boolean(card.lastTestSucceeded));
    setTestPayloadSignature(card.lastTestSignature ?? null);
    setTestPayload(null);
    setTestMessage(null);
  }, [activeCardData]);

  const cardPayload = useMemo(
    () =>
      JSON.stringify({
        integrationId: draft.integrationId,
        query: draft.query,
        cardType: draft.cardType,
        layoutType: draft.layoutType,
        fields: draft.fields,
        style: draft.style,
        layout: draft.layout,
        refresh: { mode: draft.refreshMode, interval: draft.refreshInterval },
        dataSource: draft.dataSource,
      }),
    [draft]
  );

  useEffect(() => {
    if (testPayload && testPayload !== cardPayload) {
      setTestSuccess(false);
      setTestMessage(t("studioTestNeedsRerun"));
    }
  }, [cardPayload, testPayload, t]);

  const handleTest = async () => {
    setTestMessage(null);
    const result = await testMutation.mutateAsync({
      integrationId: draft.integrationId,
      query: draft.query,
      cardType: draft.cardType,
      layoutType: draft.layoutType,
      fieldsJson: toJson(draft.fields),
      styleJson: toJson(draft.style),
      layoutJson: toJson(draft.layout),
      refreshPolicyJson: toJson({ mode: draft.refreshMode, interval: draft.refreshInterval }),
      dataSourceJson: toJson(draft.dataSource),
    });

    if (!result.success || !result.signature) {
      setTestSuccess(false);
      setTestMessage(result.errorMessage ?? t("studioTestFailed"));
      showToast(result.errorMessage ?? t("studioTestFailed"), { variant: "error" });
      return;
    }

    setTestPayloadSignature(result.signature);
    setTestPayload(cardPayload);
    setTestSuccess(true);
    setTestMessage(t("studioTestSuccess"));
    showToast(t("studioTestSuccess"), { variant: "success" });
  };

  const handleSave = async () => {
    // Validate draft with Zod
    const validation = validateCardDraft(draft);
    if (!validation.success) {
      setValidationErrors(validation.errors);
      const firstError = Object.values(validation.errors)[0];
      showToast(firstError, { variant: "error" });
      return;
    }
    setValidationErrors({});

    const requiresTest = Boolean(draft.integrationId && draft.query.trim());
    if (requiresTest && (!testSuccess || !testPayloadSignature)) {
      showToast(t("studioTestRequired"), { variant: "error" });
      return;
    }

    const payloadBase = {
      title: draft.title || t("studioUntitledCard"),
      description: draft.description,
      scope: draft.scope,
      clientId: draft.clientId ?? null,
      profileId: draft.profileId ?? null,
      cardType: draft.cardType,
      layoutType: draft.layoutType,
      integrationId: draft.integrationId ?? null,
      query: draft.query,
      fieldsJson: toJson(draft.fields),
      styleJson: toJson(draft.style),
      layoutJson: toJson(draft.layout),
      refreshPolicyJson: toJson({ mode: draft.refreshMode, interval: draft.refreshInterval }),
      dataSourceJson: toJson(draft.dataSource),
      testSignature: testPayloadSignature,
      testedAt: testSuccess ? new Date().toISOString() : null,
    };

    try {
      if (draft.id) {
        const updated = await updateMutation.mutateAsync({ id: draft.id, payload: payloadBase });
        setActiveId(updated.id);
        showToast(t("studioCardSaved"), { variant: "success" });
      } else {
        const created = await createMutation.mutateAsync(payloadBase);
        setActiveId(created.id);
        showToast(t("studioCardCreated"), { variant: "success" });
      }
      // TanStack Query invalida automaticamente a lista de cards
    } catch (error: unknown) {
      const errMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(errMsg ?? t("studioCardSaveFailed"), { variant: "error" });
    }
  };

  const handleDelete = async () => {
    if (!draft.id) return;
    try {
      await deleteMutation.mutateAsync(draft.id);
      setActiveId(null);
      setDraft(defaultDraft(draft.scope, draft.clientId, draft.profileId));
      showToast(t("studioCardDeleted"), { variant: "info" });
      // TanStack Query invalida automaticamente a lista de cards
    } catch {
      showToast(t("studioCardDeleteFailed"), { variant: "error" });
    } finally {
      setConfirmDeleteOpen(false);
    }
  };

  const handleClone = async () => {
    if (!draft.id) return;
    try {
      const cloned = await cloneMutation.mutateAsync(draft.id);
      setActiveId(cloned.id);
      showToast(t("studioCardCloned"), { variant: "success" });
      // TanStack Query invalida automaticamente a lista de cards
    } catch {
      showToast(t("studioCardCloneFailed"), { variant: "error" });
    }
  };

  const scopeOptions = [
    { value: "Client" as StudioScope, label: t("studioScopeClient") },
    { value: "Company" as StudioScope, label: t("studioScopeCompany") },
  ];

  const layoutOptions = useMemo(() => {
    const template = cardTemplateDefs.find((item) => item.value === draft.cardType);
    return template?.layouts ?? ["grid", "list"];
  }, [draft.cardType]);

  const layoutLabels = useMemo(
    () => ({
      grid: t("layoutGrid"),
      list: t("layoutList"),
      timeline: t("layoutTimeline"),
      kpi: t("layoutKpi"),
    }),
    [t]
  );
  const statusLabels = useMemo(
    () => ({
      Draft: t("studioStatusDraft"),
      Published: t("studioStatusPublished"),
      Archived: t("studioStatusArchived"),
    }),
    [t]
  );
  const cardTypeLabels = useMemo(() => {
    return cardTemplateDefs.reduce(
      (acc, item) => {
        acc[item.value] = t(item.labelKey as never);
        return acc;
      },
      {} as Record<string, string>
    );
  }, [t]);
  const integrationTypeLabels = useMemo(
    () => ({
      airflow: t("integrationType_airflow"),
      adf: t("integrationType_adf"),
      api: t("integrationType_api"),
    }),
    [t]
  );

  const setStatusBadge = (status: StudioCardStatus) => {
    if (status === "Published") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200";
    if (status === "Archived") return "bg-slate-200 text-slate-600 dark:bg-slate-700/50 dark:text-slate-200";
    return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200";
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card className="h-fit">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">{t("studioCardsLibrary")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("studioCardsLibraryHint")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("studioScope")}</Label>
              <Select
                value={draft.scope}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, scope: value as StudioScope }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("studioScope")} />
                </SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {draft.scope === "Client" ? (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("client")}</Label>
                <Select
                  value={draft.clientId ? String(draft.clientId) : ""}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, clientId: Number(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("studioSelectClient")} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={String(client.id)}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("companies")}</Label>
                <Select
                  value={draft.profileId ? String(draft.profileId) : ""}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, profileId: Number(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("studioSelectCompany")} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={String(company.id)}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {loading && cards.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                {t("loading")}
              </div>
            ) : null}
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
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${setStatusBadge(card.status)}`}>
                    {statusLabels[card.status] ?? card.status}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {cardTypeLabels[card.cardType] ?? card.cardType}
                </p>
              </button>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => {
                setActiveId(null);
                setDraft(defaultDraft(draft.scope, draft.clientId, draft.profileId));
              }}
            >
              {t("studioNewCard")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">{t("studioCardBuilder")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("studioCardBuilderHint")}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>{t("name")}</Label>
                <Input
                  value={draft.title}
                  onChange={(event) => {
                    setDraft((prev) => ({ ...prev, title: event.target.value }));
                    if (validationErrors.title) setValidationErrors((prev) => ({ ...prev, title: "" }));
                  }}
                  placeholder={t("studioCardNamePlaceholder")}
                  className={validationErrors.title ? "border-red-500" : ""}
                />
                {validationErrors.title && (
                  <p className="text-xs text-red-500">{validationErrors.title}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>{t("description")}</Label>
                <Input
                  value={draft.description}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder={t("studioCardDescPlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("studioCardTemplate")}</Label>
                <Select
                  value={draft.cardType}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, cardType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("studioCardTemplate")} />
                  </SelectTrigger>
                  <SelectContent>
                    {cardTemplateDefs.map((template) => (
                      <SelectItem key={template.value} value={template.value}>
                        {t(template.labelKey as never)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("studioCardLayout")}</Label>
                <Select
                  value={draft.layoutType}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, layoutType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("studioCardLayout")} />
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
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>{t("studioIntegration")}</Label>
                <Select
                  value={draft.integrationId ? String(draft.integrationId) : ""}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, integrationId: Number(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("studioSelectIntegration")} />
                  </SelectTrigger>
                  <SelectContent>
                    {integrations.map((integration) => (
                      <SelectItem key={integration.id} value={String(integration.id)}>
                        {integration.name} - {integrationTypeLabels[integration.type] ?? integration.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("studioQuery")}</Label>
                <Input
                  value={draft.query}
                  onChange={(event) => setDraft((prev) => ({ ...prev, query: event.target.value }))}
                  placeholder={t("studioQueryPlaceholder")}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>{t("studioRefreshMode")}</Label>
                <Select
                  value={draft.refreshMode}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, refreshMode: value as StudioCardDraft["refreshMode"] }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("studioRefreshMode")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Interval">{t("studioRefreshInterval")}</SelectItem>
                    <SelectItem value="Manual">{t("refreshManual")}</SelectItem>
                    <SelectItem value="Inherit">{t("studioRefreshInherit")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("studioRefreshInterval")}</Label>
                <Select
                  value={draft.refreshInterval}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, refreshInterval: value }))}
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

            <FieldEditor
              fields={draft.fields}
              onChange={(fields) => setDraft((prev) => ({ ...prev, fields }))}
            />

            <StyleEditor
              value={draft.style}
              onChange={(style) => setDraft((prev) => ({ ...prev, style }))}
            />

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{t("studioTestStatus")}</span>
              <span>{testSuccess ? t("studioTestOk") : t("studioTestPending")}</span>
              {testMessage ? <span className="text-muted-foreground">{testMessage}</span> : null}
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="secondary" onClick={handleTest}>
                  {t("studioTestConnection")}
                </Button>
                <Button type="button" onClick={handleSave}>
                  {t("save")}
                </Button>
              </div>
            </div>

            {draft.id ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={handleClone}>
                  {t("studioCloneCard")}
                </Button>
                <Button type="button" variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
                  {t("delete")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t("studioDeleteCardTitle")}
        description={t("studioDeleteCardConfirm")}
        confirmLabel={t("delete")}
        onConfirm={handleDelete}
      />
    </div>
  );
}
