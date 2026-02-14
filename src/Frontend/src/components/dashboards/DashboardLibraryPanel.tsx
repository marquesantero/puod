import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/contexts/I18nContext";
import type { ClientListResponse } from "@/lib/clientApi";
import type { CompanyListResponse } from "@/lib/companyApi";
import type { StudioDashboard, StudioScope } from "@/types/studio";

type DashboardLibraryPanelProps = {
  scope: StudioScope;
  clientId?: number;
  profileId?: number;
  clients: ClientListResponse[];
  companies: CompanyListResponse[];
  dashboards: StudioDashboard[];
  activeId: number | null;
  loading: boolean;
  onScopeChange: (value: StudioScope) => void;
  onClientChange: (value: number) => void;
  onCompanyChange: (value: number) => void;
  onSelect: (id: number) => void;
};

export function DashboardLibraryPanel({
  scope,
  clientId,
  profileId,
  clients,
  companies,
  dashboards,
  activeId,
  loading,
  onScopeChange,
  onClientChange,
  onCompanyChange,
  onSelect,
}: DashboardLibraryPanelProps) {
  const { t } = useI18n();

  const scopeOptions = [
    { value: "Client" as StudioScope, label: t("studioScopeClient") },
    { value: "Company" as StudioScope, label: t("studioScopeCompany") },
  ];

  const statusLabels: Record<string, string> = {
    Draft: t("studioStatusDraft"),
    Published: t("studioStatusPublished"),
    Archived: t("studioStatusArchived"),
  };

  return (
    <Card className="h-fit">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{t("dashboardsHubTitle")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("dashboardsHubSubtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("dashboardsHubSelectScope")}</Label>
            <Select value={scope} onValueChange={(value) => onScopeChange(value as StudioScope)}>
              <SelectTrigger>
                <SelectValue placeholder={t("dashboardsHubSelectScope")} />
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

          {scope === "Client" ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("client")}</Label>
              <Select value={clientId ? String(clientId) : ""} onValueChange={(value) => onClientChange(Number(value))}>
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
              <Select value={profileId ? String(profileId) : ""} onValueChange={(value) => onCompanyChange(Number(value))}>
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
          {loading ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              {t("loading")}
            </div>
          ) : null}
          {!loading && dashboards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{t("dashboardsHubEmptyTitle")}</div>
              <div>{t("dashboardsHubEmptyBody")}</div>
            </div>
          ) : null}
          {dashboards.map((dashboard) => (
            <button
              key={dashboard.id}
              onClick={() => onSelect(dashboard.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                dashboard.id === activeId ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{dashboard.name}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {statusLabels[dashboard.status] ?? dashboard.status}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{dashboard.layoutType}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
