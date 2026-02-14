import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";

interface CompanyFormProps {
  editingId: number | null;
  formData: any;
  activeTab: string;
  clients: any[];
  clientPreview: any;
  clientIdError?: string;
  setClientIdError?: (error: string) => void;
  onTabChange: (tab: any) => void;
  setFormData: (data: any) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function CompanyForm({
  editingId, formData, activeTab, clients, clientPreview, clientIdError, setClientIdError,
  onTabChange, setFormData, onLogoUpload, onSubmit, onCancel
}: CompanyFormProps) {
  const { t } = useI18n();

  const tabs = [
    { id: "basic", label: t("companiesTabBasic") },
    { id: "contact", label: t("companiesTabContact"), hidden: formData.inheritContact },
    { id: "address", label: t("companiesTabAddress"), hidden: formData.inheritAddress },
    { id: "details", label: t("companiesTabDetails"), hidden: formData.inheritDetails },
  ].filter(tab => !tab.hidden);

  return (
    <Card className="border-none shadow-2xl bg-card overflow-hidden max-w-7xl mx-auto animate-in slide-in-from-bottom-4 duration-500 rounded-3xl">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8">
        <CardTitle className="text-3xl font-bold tracking-tight">
          {editingId ? formData.name : t("companiesCreateTitle")}
        </CardTitle>
        <CardDescription className="text-blue-100 mt-2 text-base">
          {editingId ? (
            <span className="inline-flex gap-3 items-center flex-wrap">
              {clientPreview && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm border border-white/30 uppercase tracking-wider">
                  {clientPreview.name}
                </span>
              )}
              {formData.slug && (
                <span className="font-mono text-sm opacity-90">{formData.slug}</span>
              )}
            </span>
          ) : t("companiesCreateDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 pt-0">
        <form onSubmit={onSubmit} className="space-y-10">
          <div className="flex gap-1 border-b border-border overflow-x-auto no-scrollbar scroll-smooth">
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

          <div className="animate-in fade-in duration-300 min-h-[500px]">
                {activeTab === "basic" && (
              <div className="space-y-8">
                <div className="grid md:grid-cols-2 gap-6 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="clientId" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesClient")} *</Label>
                    {editingId ? (
                      <div className="h-11 flex items-center px-4 rounded-xl border bg-muted/30 font-bold text-foreground text-sm">
                        {clients.find(c => c.id === formData.clientId)?.name || formData.clientId}
                      </div>
                    ) : (
                      <select
                        id="clientId"
                        value={formData.clientId}
                        onChange={(e) => {
                            setFormData({ ...formData, clientId: Number(e.target.value) });
                            if (clientIdError && setClientIdError) setClientIdError("");
                        }}
                        className={`w-full h-11 border border-input bg-background rounded-xl px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all ${clientIdError ? 'border-destructive' : ''}`}
                      >
                        <option value={0}>{t("companiesSelectClient")}</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {clientIdError && (
                        <p className="text-xs text-destructive font-medium">{clientIdError}</p>
                    )}
                  </div>
                  {formData.clientId && (
                    <div className="flex items-center gap-3 bg-primary/5 p-3 rounded-xl border border-primary/10">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      <p className="text-xs font-semibold text-primary">{t("companiesInheritOptionHint") || "Configure data inheritance below"}</p>
                    </div>
                  )}
                </div>

                {formData.clientId && (
                  <div className="bg-accent/30 rounded-2xl p-6 border border-border/50 space-y-4 shadow-inner">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-primary rounded-full" />
                      <h4 className="text-sm font-bold uppercase tracking-widest text-foreground">{t("companiesInheritFromClient")}</h4>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { key: 'inheritBasicInfo', label: t("companiesTabBasic") },
                        { key: 'inheritLogo', label: t("companiesLogo") },
                        { key: 'inheritContact', label: t("companiesTabContact") },
                        { key: 'inheritAddress', label: t("companiesTabAddress") },
                        { key: 'inheritDetails', label: t("companiesTabDetails") },
                      ].map((opt) => (
                        <label key={opt.key} className={`
                          flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all cursor-pointer select-none
                          ${(formData as any)[opt.key] 
                            ? 'bg-primary border-primary text-primary-foreground shadow-md scale-105' 
                            : 'bg-background border-border text-muted-foreground hover:border-primary/30'}
                        `}>
                          <input
                            type="checkbox"
                            checked={(formData as any)[opt.key]}
                            onChange={(e) => setFormData({ ...formData, [opt.key]: e.target.checked })}
                            className="hidden"
                          />
                          <span className="text-[10px] font-black uppercase tracking-wider">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t("companiesLogo")}</Label>
                    <div className="relative group">
                      {formData.inheritLogo && clientPreview?.logoUrl ? (
                        <div className="space-y-2">
                          <div className="w-40 h-40 p-4 border border-primary/30 rounded-2xl bg-primary/5 flex items-center justify-center overflow-hidden shadow-inner">
                            <img src={clientPreview.logoUrl} alt="Inherited" className="max-w-full max-h-full object-contain rounded-lg opacity-80" />
                          </div>
                          <p className="text-center text-[10px] font-bold text-primary uppercase tracking-widest">{t("companiesInheritedInfo")}</p>
                        </div>
                      ) : formData.logoUrl ? (
                        <div className="relative">
                          <button type="button" onClick={() => setFormData({ ...formData, logoUrl: "" })} className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center z-10 shadow-lg hover:scale-110 transition-transform">×</button>
                          <div className="w-40 h-40 p-4 border border-border rounded-2xl bg-accent/30 flex items-center justify-center overflow-hidden shadow-inner">
                            <img src={formData.logoUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
                          </div>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <div className="w-40 h-40 border-2 border-dashed border-muted-foreground/25 rounded-2xl flex flex-col items-center justify-center bg-accent/30 hover:bg-accent/50 hover:border-primary transition-all group shadow-inner">
                            <svg className="h-10 w-10 text-muted-foreground mb-3 group-hover:text-primary transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 0 0-4 4v20m32-12v8m0 0v8a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4v-4m32-4l-3.172-3.172a4 4 0 0 0-5.656 0L28 28M8 32l9.172-9.172a4 4 0 0 1 5.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest group-hover:text-primary">{t("companiesUploadLogo")}</span>
                          </div>
                          <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 grid gap-6 w-full">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesName")} *</Label>
                        <Input id="name" value={formData.inheritBasicInfo && clientPreview ? clientPreview.name : formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={formData.inheritBasicInfo} required className="h-11 rounded-xl font-bold" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companyName" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesDisplayName")}</Label>
                        <Input id="companyName" value={formData.inheritBasicInfo && clientPreview ? clientPreview.name : formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} disabled={formData.inheritBasicInfo} className="h-11 rounded-xl" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.isActive ? 'bg-primary' : 'bg-muted'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <Label className="text-sm font-medium cursor-pointer" onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}>{t("companiesActive")}</Label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "contact" && (
              <div className="grid md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesEmail")}</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesPhone")}</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="website" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesWebsite")}</Label>
                  <Input id="website" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className="h-11 rounded-xl" placeholder="https://example.com" />
                </div>
              </div>
            )}

            {activeTab === "address" && (
              <div className="grid md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesAddress")}</Label>
                  <Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesCity")}</Label>
                  <Input id="city" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesState")}</Label>
                  <Input id="state" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesCountry")}</Label>
                  <Input id="country" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesPostalCode")}</Label>
                  <Input id="postalCode" value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} className="h-11 rounded-xl" />
                </div>
              </div>
            )}

            {activeTab === "details" && (
              <div className="grid md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesDescription")}</Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-input bg-background rounded-xl px-3 py-3 text-sm min-h-[120px] focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesIndustry")}</Label>
                  <Input id="industry" value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesTaxId")}</Label>
                  <Input id="taxId" value={formData.taxId} onChange={(e) => setFormData({ ...formData, taxId: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeCount" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesEmployeeCount")}</Label>
                  <Input id="employeeCount" type="number" value={formData.employeeCount} onChange={(e) => setFormData({ ...formData, employeeCount: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="foundedDate" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("companiesFoundedDate")}</Label>
                  <Input id="foundedDate" type="date" value={formData.foundedDate} onChange={(e) => setFormData({ ...formData, foundedDate: e.target.value })} className="h-11 rounded-xl" />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-4 pt-8 border-t border-border">
            <Button type="button" variant="ghost" onClick={onCancel} className="px-8 h-11 rounded-xl">
              {t("cancel")}
            </Button>
                            <Button type="submit" className="px-8 h-11 bg-primary text-primary-foreground font-bold shadow-lg hover:shadow-primary/20 rounded-xl">
                              {editingId ? t("update") : t("create")} {t("company" as any)}
                            </Button>          </div>
        </form>
      </CardContent>
    </Card>
  );
}
