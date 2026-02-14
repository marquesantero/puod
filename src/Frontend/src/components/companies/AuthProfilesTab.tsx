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
  getCompanyAvailableAuthProfiles,
  createAuthProfile,
  updateAuthProfile,
  deleteAuthProfile,
  type AuthProfileListResponse,
  type AuthProviderType,
  type WindowsAdConfig,
  type AzureAdConfig,
} from "@/lib/authProfileApi";
import { Pencil, Trash2, Globe, ShieldCheck, X, ArrowUpRight, FlaskConical } from "lucide-react";

interface AuthProfilesTabProps {
  companyId: number;
}

export function AuthProfilesTab({ companyId }: AuthProfilesTabProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [ownedProfiles, setOwnedProfiles] = useState<AuthProfileListResponse[]>([]);
  const [inheritedProfiles, setInheritedProfiles] = useState<AuthProfileListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AuthProfileListResponse | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<number | null>(null);
  const [profileToEdit, setProfileToEdit] = useState<AuthProfileListResponse | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState<AuthProviderType>("Local");
  const [domains, setDomains] = useState<string>("");
  const [isActive, setIsActive] = useState(true);

  // Config States (Windows/Azure)
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
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => { loadProfiles(); }, [companyId]);

  const isValidUrl = (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const normalizeOwnerType = (value: AuthProfileListResponse["ownerType"] | number) => {
    if (typeof value === "number") {
      if (value === 2) return "Client";
      if (value === 0) return "Company";
      return "Group";
    }
    return value;
  };

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await getCompanyAvailableAuthProfiles(companyId);
      setOwnedProfiles(data.filter(p => normalizeOwnerType(p.ownerType) === "Company"));
      setInheritedProfiles(data.filter(p => normalizeOwnerType(p.ownerType) === "Client"));
    } catch (error) {
      console.error(error);
    } finally { setLoading(false); }
  };

  const resetForm = () => {
    setEditingProfile(null); setName(""); setDomains(""); setProviderType("Local"); setIsActive(true);
    setWinDomain(""); setWinLdapUrl(""); setWinBaseDn(""); setWinBindDn(""); setWinBindPassword(""); setWinUserFilter(""); setWinGroupFilter(""); setWinUseSsl(true); setWinStartTls(false); setWinTimeout(15);
    setAzureTenantId(""); setAzureClientId(""); setAzureClientSecret(""); setAzureAuthUrl(""); setAzureTokenUrl(""); setAzureAuthority(""); setAzureRedirectUri(""); setAzureScopes("openid profile email"); setAzureIssuer(""); setAzureUsePkce(true);
    setFormErrors({ azureAuthUrl: "", azureTokenUrl: "" });
  };

  const handleEdit = (profile: AuthProfileListResponse) => {
    setEditingProfile(profile);
    getAuthProfile(profile.id).then(detail => {
        setName(detail.name);
        setDomains(detail.domains ? detail.domains.join(", ") : "");
        setProviderType(detail.providerType);
        setIsActive(detail.isActive);
        if (detail.providerType === "WindowsAd") {
            const c = detail.config as WindowsAdConfig;
            setWinDomain(c.domain || ""); setWinLdapUrl(c.ldapUrl || ""); setWinBaseDn(c.baseDn || "");
            setWinBindDn(c.bindDn || ""); setWinBindPassword(c.bindPassword || ""); setWinUserFilter(c.userFilter || ""); setWinGroupFilter(c.groupFilter || ""); setWinUseSsl(c.useSsl ?? true); setWinStartTls(c.startTls ?? false); setWinTimeout(c.timeoutSeconds || 15);
        } else if (detail.providerType === "AzureAd") {
            const c = detail.config as AzureAdConfig;
            setAzureTenantId(c.tenantId || ""); setAzureClientId(c.clientId || ""); setAzureClientSecret(c.clientSecret || "");
            setAzureAuthUrl(c.authUrl || ""); setAzureTokenUrl(c.tokenUrl || ""); setAzureAuthority(c.authority || ""); setAzureRedirectUri(c.redirectUri || ""); setAzureScopes(c.scopes || "openid profile email"); setAzureIssuer(c.issuer || ""); setAzureUsePkce(c.usePkce ?? true);
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

  const handleSave = async () => {
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
    if (providerType === "WindowsAd") config = { domain: winDomain, ldapUrl: winLdapUrl, baseDn: winBaseDn, bindDn: winBindDn || undefined, bindPassword: winBindPassword || undefined, userFilter: winUserFilter || undefined, groupFilter: winGroupFilter || undefined, useSsl: winUseSsl, startTls: winStartTls, timeoutSeconds: winTimeout };
    else if (providerType === "AzureAd") config = { tenantId: azureTenantId, clientId: azureClientId, clientSecret: azureClientSecret || undefined, authUrl: azureAuthUrl, tokenUrl: azureTokenUrl, authority: azureAuthority, redirectUri: azureRedirectUri, scopes: azureScopes, issuer: azureIssuer, usePkce: azureUsePkce };

    const domainList = domains.split(',').map(d => d.trim()).filter(d => d.length > 0);
    try {
      if (editingProfile) await updateAuthProfile(editingProfile.id, { name, domains: domainList, config, isActive });
      else await createAuthProfile({ profileId: companyId, name, providerType, domains: domainList, config });
      showToast(t("authProfilesSaveSuccess"), { variant: "success" });
      setIsDialogOpen(false); loadProfiles();
    } catch (error: any) {
      const message = error?.response?.data?.message || "Failed to save";
      showToast(message, { variant: "destructive" });
    }
  };

  const handleTestAzureConnection = async () => {
    if (!azureTenantId || !azureClientId || !azureClientSecret) {
      showToast(t("authProfilesTestMissingFields"), { variant: "destructive" });
      return;
    }
    setTestingConnection(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth-profiles/test-azure`, {
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

  const handleDelete = async () => {
    if (!profileToDelete) return;
    try {
      await deleteAuthProfile(profileToDelete);
      showToast(t("authProfilesDeleteSuccess"), { variant: "success" }); loadProfiles();
    } finally { setIsDeleteDialogOpen(false); setProfileToDelete(null); }
  };

  return (
    <div className="space-y-8 pt-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-accent/10 p-6 rounded-3xl border border-border/50">
        <div>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">{t("authProfilesTitle")}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{t("authProfilesCompanySubtitle")}</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="rounded-xl shadow-lg gap-2">
            <Globe className="w-4 h-4" />
            {t("authProfilesNew")}
        </Button>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card rounded-3xl border shadow-2xl p-8 space-y-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black tracking-tight text-foreground">{editingProfile ? t("authProfilesUpdate") : t("authProfilesCreate")}</h2>
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
                  <select disabled={!!editingProfile} className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:ring-2 focus:ring-primary" value={providerType} onChange={(e) => setProviderType(e.target.value as AuthProviderType)}>
                    <option value="Local">{t("authProfilesTypeLocal")}</option>
                    <option value="WindowsAd">{t("authProfilesTypeWindowsAd")}</option>
                    <option value="AzureAd">{t("authProfilesTypeAzureAd")}</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setIsActive(!isActive)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-primary' : 'bg-muted'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <Label className="text-sm font-bold cursor-pointer">{t("authProfilesActive")}</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Domains</Label>
                <textarea value={domains} onChange={(e) => setDomains(e.target.value)} className="w-full h-32 rounded-xl border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary" placeholder="company.com" />
              </div>
            </div>

            {providerType === "WindowsAd" && (
              <div className="grid grid-cols-2 gap-6 p-6 bg-accent/20 rounded-2xl border border-border/50">
                <DetailInput label={t("windowsAdDomain")} value={winDomain} onChange={setWinDomain} />
                <DetailInput label={t("windowsAdLdapUrl")} value={winLdapUrl} onChange={setWinLdapUrl} />
                <DetailInput label={t("windowsAdBaseDn")} value={winBaseDn} onChange={setWinBaseDn} />
                <DetailInput label={t("windowsAdBindDn")} value={winBindDn} onChange={setWinBindDn} />
                <DetailInput label={t("windowsAdBindPassword")} value={winBindPassword} onChange={setWinBindPassword} type="password" />
              </div>
            )}

            {providerType === "AzureAd" && (
              <div className="space-y-6 p-6 bg-accent/20 rounded-2xl border border-border/50">
                <div className="grid grid-cols-2 gap-6">
                  <DetailInput label={t("azureTenantId")} value={azureTenantId} onChange={setAzureTenantId} />
                  <DetailInput label={t("azureClientId")} value={azureClientId} onChange={setAzureClientId} />
                  <DetailInput label={t("azureClientSecret")} value={azureClientSecret} onChange={setAzureClientSecret} type="password" />
                  <DetailInput label={t("azureAuthority")} value={azureAuthority} onChange={setAzureAuthority} />
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

      <div className="space-y-8">
        {inheritedProfiles.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-2 text-muted-foreground">
              <ArrowUpRight className="w-4 h-4" />
              <h4 className="text-sm font-black uppercase tracking-widest">{t("inheritedAuthProfiles")}</h4>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {inheritedProfiles.map(p => <ProfileCard key={p.id} profile={p} isInherited t={t} />)}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2 text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            <h4 className="text-sm font-black uppercase tracking-widest">{t("ownedAuthProfiles")}</h4>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {loading ? <div className="col-span-full h-32 rounded-3xl bg-accent/10 animate-pulse border border-dashed" /> : 
             ownedProfiles.length === 0 ? <div className="col-span-full py-12 text-center border-2 border-dashed rounded-3xl text-muted-foreground italic">{t("authProfilesNoOwnedProfiles")}</div> :
             ownedProfiles.map(p => <ProfileCard key={p.id} profile={p} onEdit={requestEdit} onDelete={() => { setProfileToDelete(p.id); setIsDeleteDialogOpen(true); }} t={t} />)}
          </div>
        </section>
      </div>
    </div>
  );
}

function ProfileCard({ profile, isInherited, onEdit, onDelete, t }: any) {
  return (
    <Card className={`group relative overflow-hidden bg-card border-border/50 transition-all duration-300 rounded-3xl shadow-sm ${isInherited ? 'bg-accent/5 opacity-80 hover:opacity-100' : 'hover:border-primary/50 hover:shadow-xl'}`}>
      <div className={`absolute top-0 left-0 w-1 h-full ${isInherited ? 'bg-muted' : 'bg-primary'}`} />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold">{profile.name}</CardTitle>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-accent border">{profile.providerType}</span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border ${profile.isActive ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>{profile.isActive ? t("active") : t("inactive")}</span>
            </div>
          </div>
          {!isInherited && (onEdit || onDelete) && (
            <div className="flex gap-1">
              {onEdit && <button onClick={() => onEdit(profile)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-primary transition-colors"><Pencil className="w-4 h-4" /></button>}
              {onDelete && <button onClick={() => onDelete(profile.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {profile.domains?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {profile.domains.slice(0, 3).map((d: any) => <span key={d} className="px-2 py-0.5 rounded-md bg-background border text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Globe className="w-2 h-2" />{d}</span>)}
          </div>
        )}
      </CardContent>
    </Card>
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
