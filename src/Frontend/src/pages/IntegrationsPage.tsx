/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import {
  createIntegration,
  deleteIntegration,
  updateIntegration,
  getCompanies,
  getIntegrationOverview,
} from "@/lib/integrationApi";
import { getAuthProfiles, type AuthProfileListResponse } from "@/lib/authProfileApi";
import type { IntegrationCompany, IntegrationItem, IntegrationType } from "@/types/integrations";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import React from "react";

type WizardStep = "company" | "type" | "config";

const integrationTypes: { id: IntegrationType; icon: React.ReactNode }[] = [
  {
    id: "airflow",
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
        <path d="M4 6h16M4 12h10M4 18h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "adf",
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
        <path d="M5 5h14v6H5zM5 13h8v6H5z" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "api",
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
        <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const parseConfig = (value: string) => {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
};

export default function IntegrationsPage() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("company");
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState<IntegrationCompany[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [authProfiles, setAuthProfiles] = useState<AuthProfileListResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(0);
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(null);
  const [integrationName, setIntegrationName] = useState("");
  const [integrationDescription, setIntegrationDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState("cookie");
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState("");
  const [resourceGroup, setResourceGroup] = useState("");
  const [factoryName, setFactoryName] = useState("");
  const [tokenValue, setTokenValue] = useState("");
  const [authProfileId, setAuthProfileId] = useState<number>(0);
  const [editingIntegration, setEditingIntegration] = useState<IntegrationItem | null>(null);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTypes, setFilterTypes] = useState<IntegrationType[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<Array<"pending" | "ready" | "error">>([]);

  // Filtered integrations based on search and filters
  const filteredIntegrations = useMemo(() => {
    return integrations.filter((integration) => {
      const matchesSearch = searchTerm === "" ||
        integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (integration.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

      const matchesType = filterTypes.length === 0 || filterTypes.includes(integration.type);
      const matchesStatus = filterStatuses.length === 0 || filterStatuses.includes(integration.status as any);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [integrations, searchTerm, filterTypes, filterStatuses]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    getCompanies()
      .then((data) => {
        if (!active) return;
        setCompanies(data);
        if (data.length > 0) {
          setSelectedCompanyId((current) => current || data[0].id);
        }
      })
      .catch(() => {
        if (!active) return;
        setError(t("integrationCompaniesError"));
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!selectedCompanyId) {
      return;
    }
    let active = true;
    setIsLoading(true);
    
    Promise.all([
        getIntegrationOverview(selectedCompanyId),
        getAuthProfiles(selectedCompanyId)
    ])
      .then(([overviewData, profilesData]) => {
        if (!active) return;
        setIntegrations(
          overviewData.integrations.map((item) => ({
            id: item.id,
            groupId: item.groupId,
            companyId: item.companyId,
            type: item.type as IntegrationType,
            name: item.name,
            description: item.description ?? undefined,
            status: item.status as "pending" | "ready" | "error",
            createdAt: item.createdAt,
            config: parseConfig(item.configJson),
            isInherited: item.isInherited,
          }))
        );
        setAuthProfiles(profilesData.filter(p => p.isActive && p.providerType === "AzureAd"));
      })
      .catch(() => {
        if (!active) return;
        setError(t("integrationOverviewError"));
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCompanyId, t]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const typeDropdown = document.getElementById('type-filter-dropdown');
      const statusDropdown = document.getElementById('status-filter-dropdown');
      const target = event.target as HTMLElement;

      if (typeDropdown && !typeDropdown.contains(target) && !target.closest('button[onclick*="type-filter-dropdown"]')) {
        typeDropdown.classList.add('hidden');
      }
      if (statusDropdown && !statusDropdown.contains(target) && !target.closest('button[onclick*="status-filter-dropdown"]')) {
        statusDropdown.classList.add('hidden');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resetWizard = () => {
    setWizardStep("company");
    setError("");
    setIsEditMode(false);
    setEditingIntegration(null);
    setSelectedType(null);
    setIntegrationName("");
    setIntegrationDescription("");
    setBaseUrl("");
    setAuthType("cookie");
    setTenantId("");
    setClientId("");
    setClientSecret("");
    setShowSecret(false);
    setSubscriptionId("");
    setResourceGroup("");
    setFactoryName("");
    setTokenValue("");
    setAuthProfileId(0);
  };

  const handleOpenWizard = () => {
    if (companies.length === 0) {
      setError(t("integrationNoCompanies"));
      return;
    }
    resetWizard();
    setWizardOpen(true);
  };

  const handleCloseWizard = () => {
    setWizardOpen(false);
    setError("");
  };

  const requireStep = (nextStep: WizardStep) => {
    if (wizardStep === "company") {
      if (!selectedCompanyId) {
        setError(t("integrationCompanyRequired"));
        return;
      }
    }
    if (wizardStep === "type") {
      if (!selectedType) {
        setError(t("integrationTypeRequired"));
        return;
      }
    }
    if (wizardStep === "config") {
      if (!integrationName.trim()) {
        setError(t("integrationNameRequired"));
        return;
      }
      if (selectedType !== "adf" && !baseUrl.trim()) {
        setError(t("integrationBaseUrlRequired"));
        return;
      }
      if (selectedType === "adf" && (!subscriptionId.trim() || !resourceGroup.trim() || !factoryName.trim())) {
        setError(t("integrationAdfRequired"));
        return;
      }
    }
    setError("");
    setWizardStep(nextStep);
  };

  const handleSave = () => {
    if (!integrationName.trim()) {
      setError(t("integrationNameRequired"));
      return;
    }

    if (!selectedType) {
      setError(t("integrationTypeRequired"));
      return;
    }

    // Build config based on type
    let configJson = "{}";
    if (selectedType === "api" || selectedType === "airflow") {
      const config: any = { baseUrl, authType, token: tokenValue };
      if (authType === "company-profile" && authProfileId) {
        config.authProfileId = authProfileId;
      }
      configJson = JSON.stringify(config);
    } else if (selectedType === "adf") {
      const adfAuth = authProfileId && authType === "company-profile"
        ? { authType: "spn_profile", authProfileId }
        : {
            authType: "spn",
            tenantId,
            clientId,
            clientSecret,
          };
      configJson = JSON.stringify({
        subscriptionId,
        resourceGroup,
        factoryName,
        ...adfAuth,
      });
    }

    const save = async () => {
      // Edit mode: update existing integration
      if (isEditMode && editingIntegration) {
        await updateIntegration(editingIntegration.id, {
          name: integrationName.trim(),
          description: integrationDescription.trim() || undefined,
          configJson,
        });

        const overview = await getIntegrationOverview(editingIntegration.companyId);
        setIntegrations(
          overview.integrations.map((item) => ({
            id: item.id,
            groupId: item.groupId,
            companyId: item.companyId,
            type: item.type as IntegrationType,
            name: item.name,
            description: item.description ?? undefined,
            status: item.status as "pending" | "ready" | "error",
            createdAt: item.createdAt,
            config: parseConfig(item.configJson),
            isInherited: item.isInherited,
          }))
        );
        showToast(t("integrationUpdated"), { title: t("integrations"), variant: "success" });
      }
      // Create mode: create new integration
      else {
        await createIntegration({
          companyId: selectedCompanyId,
          groupId: 0, // Ensure number
          type: selectedType,
          name: integrationName.trim(),
          description: integrationDescription.trim() || undefined,
          configJson,
        });

        const overview = await getIntegrationOverview(selectedCompanyId);
        setIntegrations(
          overview.integrations.map((item) => ({
            id: item.id,
            groupId: item.groupId,
            companyId: item.companyId,
            type: item.type as IntegrationType,
            name: item.name,
            description: item.description ?? undefined,
            status: item.status as "pending" | "ready" | "error",
            createdAt: item.createdAt,
            config: parseConfig(item.configJson),
            isInherited: item.isInherited,
          }))
        );
        showToast(t("integrationSaved"), { title: t("integrations"), variant: "success" });
      }

      setWizardOpen(false);
      resetWizard();
    };

    save().catch(() => {
      setError(t("integrationSaveError"));
    });
  };

  const handleEdit = (item: IntegrationItem) => {
    setEditingIntegration(item);
    setIsEditMode(true);
    setSelectedCompanyId(item.companyId);
    setSelectedType(item.type);

    // Pre-fill form with current values
    setIntegrationName(item.name);
    setIntegrationDescription(item.description || "");

    // item.config is already an object, no need to parse
    const config = (item.config || {}) as any;

    // Pre-fill based on type
    if (item.type === "api" || item.type === "airflow") {
      setBaseUrl(config.baseUrl || "");
      setAuthType(config.authType || "cookie");
      setTokenValue(config.token || "");
      setAuthProfileId(config.authProfileId || 0);
    } else if (item.type === "adf") {
      setSubscriptionId(config.subscriptionId || "");
      setResourceGroup(config.resourceGroup || "");
      setFactoryName(config.factoryName || "");
      setTenantId(config.tenantId || "");
      setClientId(config.clientId || "");
      setClientSecret(config.clientSecret || "");
      setAuthProfileId(config.authProfileId || 0);
    }

    setWizardStep("config");
    setWizardOpen(true);
  };

  const handleRemove = (item: IntegrationItem) => {
    deleteIntegration(item.id)
      .then(async () => {
        const overview = await getIntegrationOverview(selectedCompanyId);
        setIntegrations(
          overview.integrations.map((row) => ({
            id: row.id,
            groupId: row.groupId,
            companyId: row.companyId,
            type: row.type as IntegrationType,
            name: row.name,
            description: row.description ?? undefined,
            status: row.status as IntegrationItem["status"],
            createdAt: row.createdAt,
            config: parseConfig(row.configJson),
            isInherited: row.isInherited,
          }))
        );
        showToast(t("integrationRemoved"), { title: t("integrations"), variant: "info" });
      })
      .catch(() => {
        setError(t("integrationRemoveError"));
      });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("integrationsEyebrow")}
        title={t("integrationsTitle")}
        subtitle={t("integrationsSubtitle")}
      >
        <Button variant="secondary" className="gap-2" onClick={handleOpenWizard} size="sm">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {t("integrationAdd")}
        </Button>
      </PageHeader>

      {/* Search and Filters */}
      <Card className="bg-gradient-to-br from-slate-50/50 to-blue-50/30 dark:from-slate-900/50 dark:to-blue-950/20">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">{t("integrationSearch") || "Search"}</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder={t("integrationSearchPlaceholder") || "Search by name or description..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-md border border-border bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div className="space-y-2 relative">
              <label className="text-xs font-medium text-muted-foreground">{t("integrationFilterType") || "Type"}</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    const dropdown = document.getElementById('type-filter-dropdown');
                    if (dropdown) dropdown.classList.toggle('hidden');
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground text-left flex items-center justify-between dark:bg-slate-950/60"
                >
                  <span className={filterTypes.length === 0 ? "text-muted-foreground" : ""}>
                    {filterTypes.length === 0
                      ? t("integrationFilterAll") || "All Types"
                      : `${filterTypes.length} selected`
                    }
                  </span>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <div id="type-filter-dropdown" className="hidden absolute z-10 mt-1 w-full rounded-md border border-border bg-background shadow-lg dark:bg-slate-950">
                  <div className="p-2 space-y-1">
                    {(["api", "airflow", "adf"] as IntegrationType[]).map((type) => (
                      <label key={type} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterTypes.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilterTypes([...filterTypes, type]);
                            } else {
                              setFilterTypes(filterTypes.filter(t => t !== type));
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-sm text-foreground">
                          {t(`integrationType_${type}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2 relative">
              <label className="text-xs font-medium text-muted-foreground">{t("integrationFilterStatus") || "Status"}</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    const dropdown = document.getElementById('status-filter-dropdown');
                    if (dropdown) dropdown.classList.toggle('hidden');
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground text-left flex items-center justify-between dark:bg-slate-950/60"
                >
                  <span className={filterStatuses.length === 0 ? "text-muted-foreground" : ""}>
                    {filterStatuses.length === 0
                      ? t("integrationFilterAll") || "All Status"
                      : `${filterStatuses.length} selected`
                    }
                  </span>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <div id="status-filter-dropdown" className="hidden absolute z-10 mt-1 w-full rounded-md border border-border bg-background shadow-lg dark:bg-slate-950">
                  <div className="p-2 space-y-1">
                    {(["pending", "ready", "error"] as Array<"pending" | "ready" | "error">).map((status) => (
                      <label key={status} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterStatuses.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilterStatuses([...filterStatuses, status]);
                            } else {
                              setFilterStatuses(filterStatuses.filter(s => s !== status));
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-sm text-foreground">
                          {t(`integrationStatus_${status}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results count */}
          {(searchTerm || filterTypes.length > 0 || filterStatuses.length > 0) && (
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{filteredIntegrations.length} {t("integrationResults") || "results"}</span>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterTypes([]);
                  setFilterStatuses([]);
                }}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {t("integrationClearFilters") || "Clear filters"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && !wizardOpen ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">{t("loading")}</CardContent>
            </Card>
          ) : null}
          {!isLoading && companies.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                {t("integrationNoCompanies")}
              </CardContent>
            </Card>
          ) : null}
          {companies.map((company) => (
            <Card key={company.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                        <path d="M4 8h16M4 12h16M4 16h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </span>
                    {company.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {integrations.filter((item) => item.companyId === company.id).length} {t("integrationCount")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {filteredIntegrations.filter(int => int.companyId === company.id).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    {t("integrationEmptyCompany" as any)}
                  </div>
                ) : (
                  filteredIntegrations
                    .filter(int => int.companyId === company.id)
                    .map((integration) => (
                      <IntegrationCard
                        key={integration.id}
                        integration={integration}
                        onDelete={() => handleRemove(integration)}
                        onEdit={() => handleEdit(integration)}
                        onStatusChange={(newStatus) => {
                          setIntegrations(prev => prev.map(int =>
                            int.id === integration.id ? { ...int, status: newStatus as "pending" | "ready" | "error" } : int
                          ));
                        }}
                      />
                    ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                  <path d="M6 5h12M6 12h12M6 19h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              {t("integrationWizardTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!wizardOpen ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">{t("integrationWizardHintTitle")}</p>
                <p className="mt-1">{t("integrationWizardHintBody")}</p>
                <Button size="sm" className="mt-3" onClick={handleOpenWizard}>
                  {t("integrationAdd")}
                </Button>
              </div>
            ) : (
              <>
                {error ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                ) : null}

                {isEditMode ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-500/40 dark:bg-blue-500/10 px-3 py-2">
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{t("integrationEditMode") || "Edit Mode"}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{t("integrationEditingType") || "Editing"}: {selectedType && t(`integrationType_${selectedType}`)}</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {(["company", "type", "config"] as WizardStep[]).map((step) => (
                      <span
                        key={step}
                        className={`rounded-full border px-2 py-0.5 ${
                          step === wizardStep
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-200"
                            : "border-border/60 bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        {t(`integrationStep_${step}`)}
                      </span>
                    ))}
                  </div>
                )}

                {wizardStep === "company" ? (
                  <div className="space-y-3">
                    <label className="space-y-2 text-sm">
                      <span className="text-muted-foreground">{t("integrationCompany")}</span>
                      <select
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
                        value={selectedCompanyId}
                        onChange={(event) => setSelectedCompanyId(Number(event.target.value))}
                      >
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                {wizardStep === "type" ? (
                  <div className="grid gap-2">
                    {integrationTypes.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedType(item.id)}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm ${
                          selectedType === item.id
                            ? "border-emerald-400/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-200"
                            : "border-border/60 bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {item.icon}
                        </span>
                        <div>
                          <p className="font-semibold text-foreground">{t(`integrationType_${item.id}`)}</p>
                          <p className="text-xs text-muted-foreground">{t(`integrationTypeDesc_${item.id}`)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}

                {wizardStep === "config" && selectedType ? (
                  <div className="space-y-3">
                    <label className="space-y-2 text-sm">
                      <span className="text-muted-foreground">{t("integrationName")}</span>
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                        value={integrationName}
                        onChange={(event) => setIntegrationName(event.target.value)}
                        placeholder={t("integrationNamePlaceholder")}
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      <span className="text-muted-foreground">{t("integrationDescription" as any)}</span>
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                        value={integrationDescription}
                        onChange={(event) => setIntegrationDescription(event.target.value)}
                        placeholder={t("integrationDescriptionPlaceholder")}
                      />
                    </label>

                    {selectedType === "airflow" || selectedType === "api" ? (
                      <>
                        <label className="space-y-2 text-sm">
                          <span className="text-muted-foreground">{t("integrationBaseUrl")}</span>
                          <input
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                            value={baseUrl}
                            onChange={(event) => setBaseUrl(event.target.value)}
                            placeholder={t("integrationBaseUrlPlaceholder")}
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="text-muted-foreground">{t("integrationAuthType")}</span>
                          <select
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
                            value={authType}
                            onChange={(event) => setAuthType(event.target.value)}
                          >
                            <option value="cookie">{t("integrationAuthCookie")}</option>
                            <option value="basic">{t("integrationAuthBasic")}</option>
                            <option value="bearer">{t("integrationAuthBearer")}</option>
                            <option value="company-profile">{t("integrationAuthCompanyProfile") || "Company Auth Profile (Azure AD)"}</option>
                          </select>
                        </label>
                        {authType === "company-profile" ? (
                          <label className="space-y-2 text-sm">
                            <span className="text-muted-foreground">{t("integrationSelectProfile") || "Select Profile"}</span>
                            <select
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
                              value={authProfileId}
                              onChange={(event) => setAuthProfileId(Number(event.target.value))}
                            >
                              <option value={0}>{t("integrationSelectProfilePlaceholder") || "Select a profile..."}</option>
                              {authProfiles.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                            {authProfiles.length === 0 && (
                              <p className="text-xs text-amber-600">{t("integrationNoProfiles") || "No Azure AD profiles configured for this company."}</p>
                            )}
                          </label>
                        ) : selectedType === "api" && authType !== "company-profile" ? (
                          <label className="space-y-2 text-sm">
                            <span className="text-muted-foreground">{t("integrationToken")}</span>
                            <input
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                              type={showSecret ? "text" : "password"}
                              value={tokenValue}
                              onChange={(event) => setTokenValue(event.target.value)}
                            />
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={showSecret}
                                onChange={(event) => setShowSecret(event.target.checked)}
                              />
                              {t("showPassword")}
                            </label>
                          </label>
                        ) : null}
                      </>
                    ) : null}

                    {selectedType === "adf" ? (
                      <>
                        <label className="space-y-2 text-sm">
                          <span className="text-muted-foreground">{t("integrationSubscription")}</span>
                          <input
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                            value={subscriptionId}
                            onChange={(event) => setSubscriptionId(event.target.value)}
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="text-muted-foreground">{t("integrationResourceGroup")}</span>
                          <input
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                            value={resourceGroup}
                            onChange={(event) => setResourceGroup(event.target.value)}
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="text-muted-foreground">{t("integrationFactory")}</span>
                          <input
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                            value={factoryName}
                            onChange={(event) => setFactoryName(event.target.value)}
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="text-muted-foreground">{t("integrationAuthType")}</span>
                          <select
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
                            value={authType}
                            onChange={(event) => setAuthType(event.target.value)}
                          >
                            <option value="service-principal">{t("integrationAuthSpn")}</option>
                            <option value="managed-identity">{t("integrationAuthMsi")}</option>
                            <option value="company-profile">Use Company Auth Profile (Azure AD)</option>
                          </select>
                        </label>
                        {authType === "company-profile" ? (
                            <label className="space-y-2 text-sm">
                              <span className="text-muted-foreground">Select Profile</span>
                              <select
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
                                value={authProfileId}
                                onChange={(event) => setAuthProfileId(Number(event.target.value))}
                              >
                                <option value={0}>Select a profile...</option>
                                {authProfiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                              {authProfiles.length === 0 && (
                                  <p className="text-xs text-amber-600">No Azure AD profiles configured for this company.</p>
                              )}
                            </label>
                        ) : null}
                        {authType === "service-principal" ? (
                          <>
                            <label className="space-y-2 text-sm">
                              <span className="text-muted-foreground">{t("integrationTenantId")}</span>
                              <input
                                autoComplete="off"
                                name="adf-tenant-id"
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                                value={tenantId}
                                onChange={(event) => setTenantId(event.target.value)}
                              />
                            </label>
                            <label className="space-y-2 text-sm">
                              <span className="text-muted-foreground">{t("integrationClientId")}</span>
                              <input
                                autoComplete="off"
                                name="adf-client-id"
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                                value={clientId}
                                onChange={(event) => setClientId(event.target.value)}
                              />
                            </label>
                            <label className="space-y-2 text-sm">
                              <span className="text-muted-foreground">{t("integrationClientSecret")}</span>
                              <input
                                autoComplete="new-password"
                                name="adf-client-secret"
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                                type={showSecret ? "text" : "password"}
                                value={clientSecret}
                                onChange={(event) => setClientSecret(event.target.value)}
                              />
                              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={showSecret}
                                  onChange={(event) => setShowSecret(event.target.checked)}
                                />
                                {t("showPassword")}
                              </label>
                            </label>
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3 pt-2">
                  {isEditMode ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCloseWizard}
                      >
                        {t("integrationCancel")}
                      </Button>
                      <Button size="sm" onClick={handleSave}>
                        {t("integrationSave")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (wizardStep === "company") {
                            handleCloseWizard();
                            return;
                          }
                          const steps: WizardStep[] = ["company", "type", "config"];
                          const index = steps.indexOf(wizardStep);
                          setWizardStep(steps[Math.max(0, index - 1)]);
                        }}
                      >
                        {wizardStep === "company" ? t("integrationCancel") : t("back")}
                      </Button>
                      {wizardStep === "config" ? (
                        <Button size="sm" onClick={handleSave}>
                          {t("integrationSave")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            const steps: WizardStep[] = ["company", "type", "config"];
                            const index = steps.indexOf(wizardStep);
                            requireStep(steps[index + 1] ?? "config");
                          }}
                        >
                          {t("continue")}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
