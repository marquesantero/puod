import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, X } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { type ClientDetailResponse, SubscriptionTier } from "@/lib/clientApi";
import { ClientAuthProfilesTab } from "./ClientAuthProfilesTab";
import { ClientIntegrationsTab } from "./ClientIntegrationsTab";
import { ClientSecurityManager } from "./ClientSecurityManager";

interface ClientDetailsProps {
  client: ClientDetailResponse;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onEdit: (client: ClientDetailResponse) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export function ClientDetails({ client, activeTab, onTabChange, onEdit, onDelete, onClose }: ClientDetailsProps) {
  const { t } = useI18n();
  const isPlatformClient = client.name === "Platform";

  // Platform client only shows basic and security tabs
  const allTabs = [
    { id: "basic", label: t("clientsTabBasic") },
    { id: "contact", label: t("clientsTabContact") },
    { id: "address", label: t("clientsTabAddress") },
    { id: "details", label: t("clientsTabDetails") },
    { id: "authentication", label: t("authentication") },
    { id: "integrations", label: t("integrations") },
    { id: "security", label: t("companiesTabSecurity") || "Security" },
    { id: "companies", label: t("companies") },
  ];

  const tabs = isPlatformClient
    ? allTabs.filter(tab => tab.id === "basic" || tab.id === "security")
    : allTabs;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in zoom-in-95 duration-300">
      <Card className="border-none shadow-xl bg-card overflow-hidden rounded-3xl">
        <div className="h-2 w-full bg-gradient-to-r from-blue-600 to-indigo-600" />
        <CardHeader className="p-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex items-center gap-6 flex-1">
              {client.logoUrl ? (
                <div className="w-24 h-24 rounded-2xl border bg-white p-3 shadow-inner flex items-center justify-center overflow-hidden shrink-0">
                  <img src={client.logoUrl} alt={client.name} className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shrink-0">
                  {client.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="space-y-2">
                <CardTitle className="text-4xl font-bold tracking-tight text-foreground">
                  {client.name}
                </CardTitle>
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary uppercase tracking-wider border border-primary/20">
                    {client.tier === SubscriptionTier.Free ? t("clientsTierFree") :
                     client.tier === SubscriptionTier.Pro ? t("clientsTierPro") : t("clientsTierEnterprise")}
                  </span>
                  <span className={`
                    inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border
                    ${client.isActive
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                    }
                  `}>
                    {client.isActive ? t("active") : t("inactive")}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-auto">
              {client.isAlterable && (
                <Button variant="outline" onClick={() => onEdit(client)} className="gap-2 h-10 hover:bg-accent rounded-xl">
                  <Pencil className="w-4 h-4" />
                  {t("edit")}
                </Button>
              )}
              {client.isAlterable && client.name !== "Platform" && (
                <Button variant="outline" onClick={() => onDelete(client.id)} className="gap-2 h-10 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive rounded-xl">
                  <Trash2 className="w-4 h-4" />
                  {t("delete")}
                </Button>
              )}
              <Button variant="ghost" onClick={onClose} className="h-10 w-10 p-0 rounded-full">
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 pt-0">
          <div className="flex gap-1 border-b border-border mb-8 overflow-x-auto no-scrollbar scroll-smooth">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`px-6 py-3 text-sm font-semibold transition-all relative whitespace-nowrap ${
                  activeTab === tab.id
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-t-xl"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6 animate-in fade-in duration-500 min-h-[500px]">
            {activeTab === "basic" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <DetailItem label={t("clientsName")} value={client.name} />
                <DetailItem label={t("slug")} value={client.slug} />
                <DetailItem label={t("createdAt")} value={new Date(client.createdAt).toLocaleString()} />
              </div>
            )}

            {activeTab === "contact" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <DetailItem label={t("clientsEmail")} value={client.email} placeholder={t("notDefined")} />
                <DetailItem label={t("clientsPhone")} value={client.phone} placeholder={t("notDefined")} />
                <DetailItem label={t("clientsWebsite")} value={client.website} isLink placeholder={t("notDefined")} />
              </div>
            )}

            {activeTab === "address" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <DetailItem label={t("clientsAddress")} value={client.address} placeholder={t("notDefined")} className="col-span-1 md:col-span-2" />
                <DetailItem label={t("clientsCity")} value={client.city} placeholder={t("notDefined")} />
                <DetailItem label={t("clientsState")} value={client.state} placeholder={t("notDefined")} />
                <DetailItem label={t("clientsCountry")} value={client.country} placeholder={t("notDefined")} />
                <DetailItem label={t("clientsPostalCode")} value={client.postalCode} placeholder={t("notDefined")} />
              </div>
            )}

            {activeTab === "details" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <DetailItem label={t("clientsDescription")} value={client.description} placeholder={t("notDefined")} className="col-span-1 md:col-span-3 text-justify" />
                <DetailItem label={t("clientsIndustry")} value={client.industry} placeholder={t("notDefined")} />
                <DetailItem label={t("clientsTaxId")} value={client.taxId} placeholder={t("notDefined")} />
                <DetailItem label={t("clientsEmployeeCount")} value={client.employeeCount?.toString()} placeholder={t("notDefined")} />
                <DetailItem label={t("clientsFoundedDate")} value={client.foundedDate ? new Date(client.foundedDate).toLocaleDateString() : undefined} placeholder={t("notDefined")} />
              </div>
            )}

            {activeTab === "authentication" && <ClientAuthProfilesTab clientId={client.id} />}
            {activeTab === "integrations" && <ClientIntegrationsTab clientId={client.id} />}
            {activeTab === "security" && <ClientSecurityManager clientId={client.id} clientName={client.name} />}
            
            {activeTab === "companies" && (
              <div className="grid gap-6 md:grid-cols-2">
                {client.companies.length === 0 ? (
                  <div className="col-span-full py-12 text-center border-2 border-dashed rounded-3xl text-muted-foreground italic">
                    {t("clientsNoCompanies") || "No companies yet"}
                  </div>
                ) : (
                  client.companies.map((company) => (
                    <div key={company.id} className="p-6 rounded-2xl border bg-accent/20 hover:border-primary/50 transition-all space-y-4 group">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{company.name}</h4>
                          <p className="text-sm text-muted-foreground font-mono mt-1">{company.slug}</p>
                        </div>
                        <span className={`
                          inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                          ${company.isActive
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border border-destructive/20"
                          }
                        `}>
                          {company.isActive ? t("active") : t("inactive")}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailItem({ label, value, placeholder, isLink, className = "" }: { label: string, value?: string, placeholder?: string, isLink?: boolean, className?: string }) {
  const displayValue = value || placeholder;
  const isPlaceholder = !value;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{label}</Label>
      <div className={`text-base font-semibold ${isPlaceholder ? 'text-muted-foreground/50 italic font-medium' : 'text-foreground'}`}>
        {isLink && value ? (
          <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1.5 w-fit">
            {value}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        ) : (
          displayValue
        )}
      </div>
    </div>
  );
}
