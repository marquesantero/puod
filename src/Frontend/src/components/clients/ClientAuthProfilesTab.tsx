import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import {
  getAuthProfile,
  getClientAuthProfiles,
  createAuthProfile,
  updateAuthProfile,
  deleteAuthProfile,
  type AuthProfileListResponse,
  type AuthProviderType,
  type WindowsAdConfig,
  type AzureAdConfig,
} from "@/lib/authProfileApi";
import { getCompanies, type CompanyListResponse } from "@/lib/companyApi";
import { Pencil, Trash2, Globe, Building2, X, FlaskConical } from "lucide-react";

interface ClientAuthProfilesTabProps {
  clientId: number;
}

export function ClientAuthProfilesTab({ clientId }: ClientAuthProfilesTabProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<AuthProfileListResponse[]>([]);
  const [companies, setCompanies] = useState<CompanyListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AuthProfileListResponse | null>(null);

  // Delete Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<number | null>(null);
  const [profileToEdit, setProfileToEdit] = useState<AuthProfileListResponse | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState<AuthProviderType>("Local");
  const [domains, setDomains] = useState<string>("");
  const [selectedCompanies, setSelectedCompanies] = useState<Set<number>>(new Set());
  const [isActive, setIsActive] = useState(true);

  // Windows AD Config State
  const [winDomain, setWinDomain] = useState("");
  const [winLdapUrl, setWinLdapUrl] = useState("");
  const [winBaseDn, setWinBaseDn] = useState("");
  const [winBindDn, setWinBindDn] = useState("");
  const [winBindPassword, setWinBindPassword] = useState("");
  const [winUserFilter, setWinUserFilter] = useState("");
  const [winGroupFilter, setWinGroupFilter] = useState("");
  const [winUseSsl, setWinUseSsl] = useState(true);
  const [winStartTls, setWinStartTls] = useState(false);
  const [winTimeout, setWinTimeout] = useState(15);

  // Azure AD Config State
  const [azureTenantId, setAzureTenantId] = useState("");
  const [azureClientId, setAzureClientId] = useState("");
  const [azureClientSecret, setAzureClientSecret] = useState("");
  const [azureAuthUrl, setAzureAuthUrl] = useState("");
  const [azureTokenUrl, setAzureTokenUrl] = useState("");
  const [azureAuthority, setAzureAuthority] = useState("");
  const [azureRedirectUri, setAzureRedirectUri] = useState("");
  const [azureScopes, setAzureScopes] = useState("openid profile email");
  const [azureIssuer, setAzureIssuer] = useState("");
  const [azureUsePkce, setAzureUsePkce] = useState(true);
  const [formErrors, setFormErrors] = useState({
    azureAuthUrl: "",
    azureTokenUrl: "",
  });

  // Test Connection State
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profilesData, companiesData] = await Promise.all([
        getClientAuthProfiles(clientId),
        getCompanies()
      ]);
      setProfiles(profilesData);
      const clientCompanies = companiesData.filter(c => c.clientId === clientId);
      setCompanies(clientCompanies);
    } catch (error) {
      console.error("Failed to load data", error);
      showToast("Failed to load data", { variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingProfile(null);
    setName("");
    setDomains("");
    setProviderType("Local");
    setSelectedCompanies(new Set());
    setIsActive(true);
    setWinDomain("");
    setWinLdapUrl("");
    setWinBaseDn("");
    setWinBindDn("");
    setWinBindPassword("");
    setWinUserFilter("");
    setWinGroupFilter("");
    setWinUseSsl(true);
    setWinStartTls(false);
    setWinTimeout(15);
    setAzureTenantId("");
    setAzureClientId("");
    setAzureClientSecret("");
    setAzureAuthUrl("");
    setAzureTokenUrl("");
    setAzureAuthority("");
    setAzureRedirectUri("");
    setAzureScopes("openid profile email");
    setAzureIssuer("");
    setAzureUsePkce(true);
    setFormErrors({ azureAuthUrl: "", azureTokenUrl: "" });
  };

  const isValidUrl = (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const handleEdit = (profile: AuthProfileListResponse) => {
    setEditingProfile(profile);
    getAuthProfile(profile.id).then(detail => {
        setName(detail.name);
        setDomains(detail.domains ? detail.domains.join(", ") : "");
        setProviderType(detail.providerType);
        setIsActive(detail.isActive);
        setSelectedCompanies(new Set(detail.companyIds || []));

        if (detail.providerType === "WindowsAd") {
            const c = detail.config as WindowsAdConfig;
            setWinDomain(c.domain || "");
            setWinLdapUrl(c.ldapUrl || "");
            setWinBaseDn(c.baseDn || "");
            setWinBindDn(c.bindDn || "");
            setWinBindPassword(c.bindPassword || "");
            setWinUserFilter(c.userFilter || "");
            setWinGroupFilter(c.groupFilter || "");
            setWinUseSsl(c.useSsl ?? true);
            setWinStartTls(c.startTls ?? false);
            setWinTimeout(c.timeoutSeconds || 15);
        } else if (detail.providerType === "AzureAd") {
            const c = detail.config as AzureAdConfig;
            setAzureTenantId(c.tenantId || "");
            setAzureClientId(c.clientId || "");
            setAzureClientSecret(c.clientSecret || "");
            setAzureAuthUrl(c.authUrl || "");
            setAzureTokenUrl(c.tokenUrl || "");
            setAzureAuthority(c.authority || "");
            setAzureRedirectUri(c.redirectUri || "");
            setAzureScopes(c.scopes || "openid profile email");
            setAzureIssuer(c.issuer || "");
            setAzureUsePkce(c.usePkce ?? true);
        }
        setIsDialogOpen(true);
    });
  };

  const requestEdit = (profile: AuthProfileListResponse) => {
    setProfileToEdit(profile);
  };

  const confirmEdit = () => {
    if (!profileToEdit) return;
    handleEdit(profileToEdit);
    setProfileToEdit(null);
  };

  const confirmDelete = (id: number) => {
      setProfileToDelete(id);
      setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!profileToDelete) return;
    try {
      await deleteAuthProfile(profileToDelete);
      showToast(t("authProfilesDeleteSuccess"), { variant: "success" });
      loadData();
    } catch (error) {
      showToast("Failed to delete", { variant: "destructive" });
    } finally {
        setIsDeleteDialogOpen(false);
        setProfileToDelete(null);
    }
  };

  const toggleCompany = (companyId: number) => {
    const newSelected = new Set(selectedCompanies);
    if (newSelected.has(companyId)) newSelected.delete(companyId);
    else newSelected.add(companyId);
    setSelectedCompanies(newSelected);
  };

  const handleSave = async () => {
    if (selectedCompanies.size === 0) {
      showToast("Please select at least one company", { variant: "destructive" });
      return;
    }

    if (providerType === "AzureAd") {
      const requiredMessage = t("fieldRequired") || "This field is required";
      const invalidMessage = t("invalidUrl") || "Invalid URL";
      const authUrlValue = azureAuthUrl.trim();
      const tokenUrlValue = azureTokenUrl.trim();
      const errors = {
        azureAuthUrl: authUrlValue
          ? (isValidUrl(authUrlValue) ? "" : invalidMessage)
          : requiredMessage,
        azureTokenUrl: tokenUrlValue
          ? (isValidUrl(tokenUrlValue) ? "" : invalidMessage)
          : requiredMessage,
      };
      setFormErrors(errors);
      if (errors.azureAuthUrl || errors.azureTokenUrl) {
        return;
      }
    }

    let config: any = {};
    if (providerType === "WindowsAd") {
      config = { domain: winDomain, ldapUrl: winLdapUrl, baseDn: winBaseDn, bindDn: winBindDn || undefined, bindPassword: winBindPassword || undefined, userFilter: winUserFilter || undefined, groupFilter: winGroupFilter || undefined, useSsl: winUseSsl, startTls: winStartTls, timeoutSeconds: winTimeout };
    } else if (providerType === "AzureAd") {
      config = { tenantId: azureTenantId, clientId: azureClientId, clientSecret: azureClientSecret || undefined, authUrl: azureAuthUrl, tokenUrl: azureTokenUrl, authority: azureAuthority, redirectUri: azureRedirectUri, scopes: azureScopes, issuer: azureIssuer, usePkce: azureUsePkce };
    }

    const domainList = domains.split(',').map(d => d.trim()).filter(d => d.length > 0);

    try {
      if (editingProfile) {
        await updateAuthProfile(editingProfile.id, { name, domains: domainList, config, companyIds: Array.from(selectedCompanies), isActive });
      } else {
        await createAuthProfile({ clientId, name, providerType, domains: domainList, config, companyIds: Array.from(selectedCompanies) });
      }
      showToast(t("authProfilesSaveSuccess"), { variant: "success" });
      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      showToast("Failed to save", { variant: "destructive" });
    }
  };

  const handleTestAzureConnection = async () => {
    if (!azureTenantId || !azureClientId || !azureClientSecret) {
      showToast(t("authProfilesTestMissingFields"), { variant: "destructive" });
      return;
    }
    setTestingConnection(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/auth-profiles/test-azure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
        body: JSON.stringify({ tenantId: azureTenantId, clientId: azureClientId, clientSecret: azureClientSecret })
      });
      if (!response.ok) throw new Error('Test failed');
      const result = await response.json();
      if (result.domain) setDomains(result.domain);
      showToast(result.message || t("authProfilesTestSuccess"), { variant: "success" });
    } catch (error) {
      showToast(t("authProfilesTestFailed"), { variant: "destructive" });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="space-y-6 pt-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-accent/10 p-6 rounded-3xl border border-border/50 shadow-sm">
        <div>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">{t("authProfilesTitle")}</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("authProfilesClientSubtitle") || "Configure identity providers and domain mapping for this client."}
            </p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="rounded-xl shadow-lg gap-2">
            <Globe className="w-4 h-4" />
            {t("authProfilesNew")}
        </Button>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-card rounded-3xl border shadow-2xl p-8 space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black tracking-tight text-foreground">
                {editingProfile ? t("authProfilesUpdate") : t("authProfilesCreate")}
              </h2>
              <button onClick={() => setIsDialogOpen(false)} className="p-2 hover:bg-accent rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("authProfilesName")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("authProfilesProvider")}</Label>
                  <select
                    disabled={!!editingProfile}
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:ring-2 focus:ring-primary"
                    value={providerType}
                    onChange={(e) => setProviderType(e.target.value as AuthProviderType)}
                  >
                    <option value="Local">{t("authProfilesTypeLocal")}</option>
                    <option value="WindowsAd">{t("authProfilesTypeWindowsAd")}</option>
                    <option value="AzureAd">{t("authProfilesTypeAzureAd")}</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <Label className="text-sm font-bold cursor-pointer">{t("authProfilesActive")}</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Domains</Label>
                <textarea
                  value={domains}
                  onChange={(e) => setDomains(e.target.value)}
                  className="w-full h-32 rounded-xl border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                  placeholder="example.com, company.net"
                />
                <p className="text-[10px] text-muted-foreground uppercase font-medium leading-relaxed">
                  Discovery routing: Users with these domains will be sent to this provider.
                </p>
              </div>
            </div>

            {/* Company Selection */}
            <div className="bg-accent/30 rounded-2xl p-6 border border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-widest text-foreground">{t("selectCompanies")}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCompanies(selectedCompanies.size === companies.length ? new Set() : new Set(companies.map(c => c.id)))}>
                  {selectedCompanies.size === companies.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {companies.map((c) => (
                  <label key={c.id} className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${selectedCompanies.has(c.id) ? 'bg-primary/10 border-primary text-primary' : 'bg-background hover:bg-accent/50'}`}>
                    <input type="checkbox" checked={selectedCompanies.has(c.id)} onChange={() => toggleCompany(c.id)} className="hidden" />
                    <span className="text-xs font-bold truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {providerType === "WindowsAd" && (
              <div className="grid grid-cols-2 gap-6 p-6 bg-accent/20 rounded-2xl border border-border/50">
                <DetailInput label={t("windowsAdDomain")} value={winDomain} onChange={setWinDomain} />
                <DetailInput label={t("windowsAdLdapUrl")} value={winLdapUrl} onChange={setWinLdapUrl} />
                <DetailInput label={t("windowsAdBaseDn")} value={winBaseDn} onChange={setWinBaseDn} />
                <DetailInput label={t("windowsAdBindDn")} value={winBindDn} onChange={setWinBindDn} />
                <DetailInput label={t("windowsAdBindPassword")} value={winBindPassword} onChange={setWinBindPassword} type="password" />
                <DetailInput label={t("windowsAdTimeout")} value={winTimeout.toString()} onChange={(v: string) => setWinTimeout(Number(v))} type="number" />
              </div>
            )}

            {providerType === "AzureAd" && (
              <div className="space-y-6 p-6 bg-accent/20 rounded-2xl border border-border/50">
                <div className="grid grid-cols-2 gap-6">
                  <DetailInput label={t("azureTenantId")} value={azureTenantId} onChange={setAzureTenantId} />
                  <DetailInput label={t("azureClientId")} value={azureClientId} onChange={setAzureClientId} />
                  <DetailInput label={t("azureClientSecret")} value={azureClientSecret} onChange={setAzureClientSecret} type="password" />
                  <DetailInput label={t("azureAuthority")} value={azureAuthority} onChange={setAzureAuthority} placeholder="https://login.microsoftonline.com/{id}" />
                  <div className="space-y-1.5">
                    <DetailInput
                      label={t("azureAuthUrl")}
                      value={azureAuthUrl}
                      onChange={(value: string) => {
                        setAzureAuthUrl(value);
                        if (formErrors.azureAuthUrl) {
                          setFormErrors(prev => ({ ...prev, azureAuthUrl: "" }));
                        }
                      }}
                      placeholder="https://login.microsoftonline.com/{id}/oauth2/v2.0/authorize"
                      inputClassName={formErrors.azureAuthUrl ? "border-destructive" : ""}
                    />
                    {formErrors.azureAuthUrl && (
                      <p className="text-xs text-destructive font-medium">{formErrors.azureAuthUrl}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <DetailInput
                      label={t("azureTokenUrl")}
                      value={azureTokenUrl}
                      onChange={(value: string) => {
                        setAzureTokenUrl(value);
                        if (formErrors.azureTokenUrl) {
                          setFormErrors(prev => ({ ...prev, azureTokenUrl: "" }));
                        }
                      }}
                      placeholder="https://login.microsoftonline.com/{id}/oauth2/v2.0/token"
                      inputClassName={formErrors.azureTokenUrl ? "border-destructive" : ""}
                    />
                    {formErrors.azureTokenUrl && (
                      <p className="text-xs text-destructive font-medium">{formErrors.azureTokenUrl}</p>
                    )}
                  </div>
                  <DetailInput label={t("azureRedirectUri")} value={azureRedirectUri} onChange={setAzureRedirectUri} />
                </div>
                <div className="flex justify-end pt-4 border-t border-border/50">
                  <Button type="button" variant="outline" onClick={handleTestAzureConnection} disabled={testingConnection || !azureTenantId || !azureClientId} className="rounded-xl gap-2 h-11 px-6">
                    {testingConnection ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" /> : <FlaskConical className="w-4 h-4" />}
                    {t("authProfilesTestConnection")}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-4 pt-6 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl h-11 px-8">{t("cancel")}</Button>
              <Button type="button" onClick={handleSave} className="rounded-xl h-11 px-10 shadow-lg font-bold">{t("save")}</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={t("confirm")}
        description={t("authProfilesDeleteConfirm")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={!!profileToEdit}
        onOpenChange={(open) => {
          if (!open) setProfileToEdit(null);
        }}
        title={t("confirm")}
        description={t("editConfirm")}
        confirmLabel={t("edit")}
        cancelLabel={t("cancel")}
        onConfirm={confirmEdit}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-48 rounded-3xl bg-accent/10 animate-pulse border border-dashed" />)
        ) : profiles.length === 0 ? (
          <div className="col-span-full py-16 text-center border-2 border-dashed rounded-3xl text-muted-foreground italic">
            {t("authProfilesNoProfiles")}
          </div>
        ) : (
          profiles.map((p) => (
            <Card key={p.id} className="group relative overflow-hidden bg-card border-border/50 hover:border-primary/50 transition-all duration-300 rounded-3xl shadow-sm hover:shadow-xl">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-20" />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-bold">{p.name}</CardTitle>
                    <div className="flex gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-accent text-accent-foreground border">{p.providerType}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border ${p.isActive ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>{p.isActive ? t("active") : t("inactive")}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => requestEdit(p)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-primary transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => confirmDelete(p.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-accent/30 p-3 rounded-2xl border border-border/50">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mb-1 block">{t("companies")}</Label>
                  <p className="text-xs font-bold text-foreground truncate flex items-center gap-2">
                    <Building2 className="w-3 h-3 text-primary" />
                    {p.companyIds?.length || 0} {t("companies")} linked
                  </p>
                </div>
                {p.domains && p.domains.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.domains.slice(0, 3).map(d => <span key={d} className="px-2 py-0.5 rounded-md bg-background border text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Globe className="w-2 h-2" />{d}</span>)}
                    {p.domains.length > 3 && <span className="text-[10px] text-muted-foreground font-bold pl-1">+{p.domains.length - 3} more</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function DetailInput({ label, value, onChange, type = "text", placeholder, inputClassName = "" }: any) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-10 rounded-xl text-foreground placeholder:text-muted-foreground ${inputClassName}`}
      />
    </div>
  );
}
