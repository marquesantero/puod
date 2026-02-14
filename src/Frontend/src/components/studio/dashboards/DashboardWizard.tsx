import { useState, useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { getClients, type ClientListResponse } from "@/lib/clientApi";
import { getCompanies, type CompanyListResponse } from "@/lib/companyApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft } from "lucide-react";

interface DashboardWizardProps {
  onComplete: (data: DashboardConfig) => void;
  onCancel: () => void;
  initialConfig?: DashboardConfig;
  disableScope?: boolean;
  mode?: "create" | "edit";
}

export interface DashboardConfig {
  name: string;
  description: string;
  scope: "Client" | "Company";
  clientId?: number;
  profileId?: number;
  canvasMode: "responsive" | "fixed";
  canvasWidth: string;
  canvasHeight: string;
}

export function DashboardWizard({ onComplete, onCancel, initialConfig, disableScope, mode = "create" }: DashboardWizardProps) {
  const { t } = useI18n();
  const [config, setConfig] = useState<DashboardConfig>({
    name: "",
    description: "",
    scope: "Company",
    canvasMode: "responsive",
    canvasWidth: "1920",
    canvasHeight: "1080",
  });

  const [clients, setClients] = useState<ClientListResponse[]>([]);
  const [companies, setCompanies] = useState<CompanyListResponse[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof DashboardConfig, string>>>({});
  const isScopeDisabled = disableScope ?? false;

  useEffect(() => {
    if (!initialConfig) return;
    setConfig({
      ...initialConfig,
      description: initialConfig.description ?? "",
      canvasWidth: initialConfig.canvasWidth || "1920",
      canvasHeight: initialConfig.canvasHeight || "1080",
    });
    setErrors({});
  }, [initialConfig]);

  const screenSizePresets = [
    { label: "1920x1080 (FHD)", width: "1920", height: "1080" },
    { label: "2560x1440 (QHD)", width: "2560", height: "1440" },
    { label: "3840x2160 (4K)", width: "3840", height: "2160" },
    { label: "1680x1050", width: "1680", height: "1050" },
    { label: "1440x900", width: "1440", height: "900" },
    { label: "1366x768", width: "1366", height: "768" },
    { label: "1280x720 (HD)", width: "1280", height: "720" },
    { label: "1024x768", width: "1024", height: "768" },
    { label: "1080x1920 (Portrait)", width: "1080", height: "1920" },
    { label: "1440x2560 (Portrait)", width: "1440", height: "2560" },
    { label: "768x1024 (Portrait)", width: "768", height: "1024" },
    { label: "800x1280 (Portrait)", width: "800", height: "1280" },
  ];

  const selectedPreset = screenSizePresets.find(
    (preset) => preset.width === config.canvasWidth && preset.height === config.canvasHeight
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const [clientsData, companiesData] = await Promise.all([
          getClients(),
          getCompanies(),
        ]);
        setClients(clientsData);
        setCompanies(companiesData);
      } catch (error) {
        console.error("Failed to load wizard data", error);
      }
    };
    loadData();
  }, []);

  const validateForm = () => {
    const newErrors: Partial<Record<keyof DashboardConfig, string>> = {};

    if (!config.name.trim()) {
      newErrors.name = "Dashboard name is required";
    }

    if (config.scope === "Client" && !config.clientId) {
      newErrors.clientId = "Please select a client";
    }

    if (config.scope === "Company" && !config.profileId) {
      newErrors.profileId = "Please select a company";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onComplete(config);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">
          {mode === "edit" ? t("studioWizardEditTitle") : t("studioWizardTitle")}
        </h2>
        <p className="text-muted-foreground">
          {mode === "edit" ? t("studioWizardEditSubtitle") : t("studioWizardSubtitle")}
        </p>
      </div>

      {/* Main Form Card */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              1
            </span>
            {t("studioWizardStepInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t("studioWizardNameLabel")}</Label>
            <Input
              id="name"
              placeholder={t("studioWizardNamePlaceholder")}
              value={config.name}
              onChange={(e) => {
                setConfig({ ...config, name: e.target.value });
                setErrors({ ...errors, name: undefined });
              }}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{t("studioWizardNameRequired")}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              placeholder={t("studioCardDescPlaceholder")}
              value={config.description}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <Label>{t("studioWizardScopeLabel")}</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                disabled={isScopeDisabled}
                onClick={() => {
                  if (isScopeDisabled) return;
                  setConfig({ ...config, scope: "Company" });
                }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  config.scope === "Company"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                } ${isScopeDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="text-sm font-bold">{t("studioWizardScopeCompany")}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("studioWizardScopeCompanyDesc")}
                </div>
              </button>
              <button
                type="button"
                disabled={isScopeDisabled}
                onClick={() => {
                  if (isScopeDisabled) return;
                  setConfig({ ...config, scope: "Client" });
                }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  config.scope === "Client"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                } ${isScopeDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="text-sm font-bold">{t("studioWizardScopeClient")}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("studioWizardScopeClientDesc")}
                </div>
              </button>
            </div>
          </div>

          {/* Company/Client Selection */}
          {config.scope === "Company" && (
            <div className="space-y-2">
              <Label htmlFor="company">{t("studioWizardSelectCompany")}</Label>
              <select
                id="company"
                disabled={isScopeDisabled}
                className={`w-full h-10 px-3 rounded-md border border-border bg-background ${
                  isScopeDisabled ? "opacity-60 cursor-not-allowed" : ""
                }`}
                value={config.profileId || ""}
                onChange={(e) => {
                  setConfig({ ...config, profileId: Number(e.target.value) });
                  setErrors({ ...errors, profileId: undefined });
                }}
              >
                <option value="">{t("studioWizardSelectCompanyPlaceholder")}</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              {errors.profileId && (
                <p className="text-xs text-destructive">{t("companiesClientRequired")}</p>
              )}
            </div>
          )}

          {config.scope === "Client" && (
            <div className="space-y-2">
              <Label htmlFor="client">{t("studioWizardSelectClient")}</Label>
              <select
                id="client"
                disabled={isScopeDisabled}
                className={`w-full h-10 px-3 rounded-md border border-border bg-background ${
                  isScopeDisabled ? "opacity-60 cursor-not-allowed" : ""
                }`}
                value={config.clientId || ""}
                onChange={(e) => {
                  setConfig({ ...config, clientId: Number(e.target.value) });
                  setErrors({ ...errors, clientId: undefined });
                }}
              >
                <option value="">{t("studioWizardSelectClientPlaceholder")}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              {errors.clientId && (
                <p className="text-xs text-destructive">{t("companiesClientRequired")}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Canvas Settings Card */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              2
            </div>
            {t("studioWizardCanvasSettings")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Canvas Mode */}
          <div className="space-y-2">
            <Label>{t("studioWizardCanvasMode")}</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setConfig({ ...config, canvasMode: "responsive" })}
                className={`p-4 rounded-xl border-2 transition-all ${
                  config.canvasMode === "responsive"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="text-sm font-bold">{t("studioWizardCanvasResponsive")}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("studioWizardCanvasResponsiveDesc")}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setConfig({ ...config, canvasMode: "fixed" })}
                className={`p-4 rounded-xl border-2 transition-all ${
                  config.canvasMode === "fixed"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="text-sm font-bold">{t("studioWizardCanvasFixed")}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("studioWizardCanvasFixedDesc")}
                </div>
              </button>
            </div>
          </div>

          {/* Canvas Width (if fixed) */}
          {config.canvasMode === "fixed" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="canvasPreset">{t("studioWizardCanvasPreset")}</Label>
                <div className="flex flex-wrap gap-2">
                  <select
                    id="canvasPreset"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    value={selectedPreset ? `${selectedPreset.width}x${selectedPreset.height}` : "custom"}
                    onChange={(e) => {
                      const value = e.target.value;
                      const preset = screenSizePresets.find(
                        (item) => `${item.width}x${item.height}` === value
                      );
                      if (preset) {
                        setConfig({
                          ...config,
                          canvasWidth: preset.width,
                          canvasHeight: preset.height,
                        });
                      }
                    }}
                  >
                    <option value="custom">{t("studioWizardCanvasPresetCustom")}</option>
                    {screenSizePresets.map((preset) => (
                      <option key={preset.label} value={`${preset.width}x${preset.height}`}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const width = Math.max(320, Math.round(window.innerWidth));
                      const height = Math.max(320, Math.round(window.innerHeight));
                      setConfig({
                        ...config,
                        canvasWidth: String(width),
                        canvasHeight: String(height),
                      });
                    }}
                  >
                    {t("studioWizardCanvasUseCurrent")}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="width">{t("studioWizardCanvasWidth")}</Label>
                  <Input
                    id="width"
                    type="number"
                    value={config.canvasWidth}
                    onChange={(e) => setConfig({ ...config, canvasWidth: e.target.value })}
                    min="320"
                    max="7680"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">{t("studioWizardCanvasHeight")}</Label>
                  <Input
                    id="height"
                    type="number"
                    value={config.canvasHeight}
                    onChange={(e) => setConfig({ ...config, canvasHeight: e.target.value })}
                    min="320"
                    max="7680"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{t("studioWizardCanvasWidthHint")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={onCancel}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          className="gap-2 shadow-lg"
        >
          {mode === "edit" ? t("studioWizardSaveChanges") : t("studioWizardContinueToCanvas")}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
