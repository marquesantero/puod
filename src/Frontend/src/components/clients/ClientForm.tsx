import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import { SubscriptionTier } from "@/lib/clientApi";

interface ClientFormProps {
  editingId: string | null;
  formData: any;
  activeTab: string;
  onTabChange: (tab: any) => void;
  setFormData: (data: any) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function ClientForm({ editingId, formData, activeTab, onTabChange, setFormData, onLogoUpload, onSubmit, onCancel }: ClientFormProps) {
  const { t } = useI18n();

  const tabs = [
    { id: "basic", label: t("clientsTabBasic") },
    { id: "contact", label: t("clientsTabContact") },
    { id: "address", label: t("clientsTabAddress") },
    { id: "details", label: t("clientsTabDetails") },
  ];

  return (
    <Card className="border-none shadow-2xl bg-card overflow-hidden max-w-7xl mx-auto animate-in slide-in-from-bottom-4 duration-500 rounded-3xl">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8">
        <CardTitle className="text-3xl font-bold tracking-tight">
          {editingId ? formData.name : t("clientsCreateTitle")}
        </CardTitle>
        <CardDescription className="text-blue-100 mt-2 text-base">
          {editingId ? (
            <div className="flex gap-3 items-center flex-wrap">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm border border-white/30 uppercase tracking-wider">
                {formData.tier === SubscriptionTier.Free ? t("clientsTierFree") :
                 formData.tier === SubscriptionTier.Pro ? t("clientsTierPro") : t("clientsTierEnterprise")}
              </span>
              {formData.slug && (
                <span className="font-mono text-sm opacity-90">{formData.slug}</span>
              )}
            </div>
          ) : t("clientsCreateDescription")}
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
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t("clientsLogo")}</Label>
                    <div className="relative group">
                      {formData.logoUrl ? (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, logoUrl: "" })}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center z-10 shadow-lg hover:scale-110 transition-transform"
                          >
                            ×
                          </button>
                          <div className="w-40 h-40 p-4 border border-border rounded-2xl bg-accent/30 flex items-center justify-center overflow-hidden shadow-inner group-hover:border-primary/50 transition-colors">
                            <img src={formData.logoUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
                          </div>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <div className="w-40 h-40 border-2 border-dashed border-muted-foreground/25 rounded-2xl flex flex-col items-center justify-center bg-accent/30 hover:bg-accent/50 hover:border-primary transition-all group shadow-inner">
                            <svg className="h-10 w-10 text-muted-foreground mb-3 group-hover:text-primary transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 0 0-4 4v20m32-12v8m0 0v8a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4v-4m32-4l-3.172-3.172a4 4 0 0 0-5.656 0L28 28M8 32l9.172-9.172a4 4 0 0 1 5.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest group-hover:text-primary">{t("clientsUploadLogo")}</span>
                          </div>
                          <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 grid gap-6 w-full">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest">{t("clientsName")} *</Label>
                        <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="h-11 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tier" className="text-xs font-bold uppercase tracking-widest">{t("clientsTier")}</Label>
                        <select
                          id="tier"
                          value={formData.tier}
                          onChange={(e) => setFormData({ ...formData, tier: parseInt(e.target.value) as SubscriptionTier })}
                          className="w-full h-11 border border-input bg-background rounded-xl px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        >
                          <option value={SubscriptionTier.Free}>{t("clientsTierFree")}</option>
                          <option value={SubscriptionTier.Pro}>{t("clientsTierPro")}</option>
                          <option value={SubscriptionTier.Enterprise}>{t("clientsTierEnterprise")}</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-8 items-center pt-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.isActive ? 'bg-primary' : 'bg-muted'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <Label className="text-sm font-medium cursor-pointer" onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}>{t("clientsActive")}</Label>
                      </div>
                      {!editingId && (
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="isAlterable"
                            checked={formData.isAlterable}
                            onChange={(e) => setFormData({ ...formData, isAlterable: e.target.checked })}
                            className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                          />
                          <Label htmlFor="isAlterable" className="text-sm font-medium cursor-pointer">{t("clientsAlterable")}</Label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "contact" && (
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest">{t("clientsEmail")}</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest">{t("clientsPhone")}</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="website" className="text-xs font-bold uppercase tracking-widest">{t("clientsWebsite")}</Label>
                  <Input id="website" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className="h-11 rounded-xl" placeholder="https://example.com" />
                </div>
              </div>
            )}

            {activeTab === "address" && (
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address" className="text-xs font-bold uppercase tracking-widest">{t("clientsAddress")}</Label>
                  <Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-xs font-bold uppercase tracking-widest">{t("clientsCity")}</Label>
                  <Input id="city" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="text-xs font-bold uppercase tracking-widest">{t("clientsState")}</Label>
                  <Input id="state" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country" className="text-xs font-bold uppercase tracking-widest">{t("clientsCountry")}</Label>
                  <Input id="country" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode" className="text-xs font-bold uppercase tracking-widest">{t("clientsPostalCode")}</Label>
                  <Input id="postalCode" value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} className="h-11 rounded-xl" />
                </div>
              </div>
            )}

            {activeTab === "details" && (
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description" className="text-xs font-bold uppercase tracking-widest">{t("clientsDescription")}</Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-input bg-background rounded-xl px-3 py-3 text-sm min-h-[120px] focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry" className="text-xs font-bold uppercase tracking-widest">{t("clientsIndustry")}</Label>
                  <Input id="industry" value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId" className="text-xs font-bold uppercase tracking-widest">{t("clientsTaxId")}</Label>
                  <Input id="taxId" value={formData.taxId} onChange={(e) => setFormData({ ...formData, taxId: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeCount" className="text-xs font-bold uppercase tracking-widest">{t("clientsEmployeeCount")}</Label>
                  <Input id="employeeCount" type="number" value={formData.employeeCount} onChange={(e) => setFormData({ ...formData, employeeCount: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="foundedDate" className="text-xs font-bold uppercase tracking-widest">{t("clientsFoundedDate")}</Label>
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
              {editingId ? t("update") : t("create")} {t("client")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
