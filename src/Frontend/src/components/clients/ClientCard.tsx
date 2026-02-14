import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Pencil, Trash2 } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { type ClientListResponse, SubscriptionTier } from "@/lib/clientApi";

interface ClientCardProps {
  client: ClientListResponse;
  onView: (client: ClientListResponse) => void;
  onEdit: (client: ClientListResponse) => void;
  onDelete: (id: number) => void;
}

export function ClientCard({ client, onView, onEdit, onDelete }: ClientCardProps) {
  const { t } = useI18n();

  return (
    <Card
      className="group relative overflow-hidden cursor-pointer bg-card border-border/50 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 rounded-3xl"
      onClick={() => onView(client)}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full transition-all group-hover:scale-150 group-hover:bg-primary/10" />
      
      <CardHeader className="pb-4 relative pt-8 px-8">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-3 flex-1 min-w-0">
            <CardTitle className="text-2xl font-extrabold tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
              {client.name}
            </CardTitle>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.1em] bg-primary/10 text-primary border border-primary/20 shadow-sm">
              {client.tier === SubscriptionTier.Free ? t("clientsTierFree") :
               client.tier === SubscriptionTier.Pro ? t("clientsTierPro") : t("clientsTierEnterprise")}
            </span>
          </div>
          <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0" onClick={(e) => e.stopPropagation()}>
            {client.isAlterable && (
              <>
                <button onClick={() => onEdit(client)} className="p-2.5 rounded-xl bg-background border shadow-sm text-muted-foreground hover:text-primary hover:border-primary transition-all" title={t("edit")}>
                  <Pencil className="w-4 h-4" />
                </button>
                {client.name !== "Platform" && (
                  <button onClick={() => onDelete(client.id)} className="p-2.5 rounded-xl bg-background border shadow-sm text-muted-foreground hover:text-destructive hover:border-destructive transition-all" title={t("delete")}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-8 pb-8 space-y-6 relative">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-accent/30 p-4 rounded-2xl border border-border/50 group-hover:bg-accent/50 transition-colors text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t("clientsCompanies")}</p>
            <p className="text-2xl font-black text-foreground">{client.companyCount}</p>
          </div>
          <div className="bg-accent/30 p-4 rounded-2xl border border-border/50 group-hover:bg-accent/50 transition-colors text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t("status") || "Status"}</p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${client.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'}`} />
              <span className={`text-sm font-bold uppercase tracking-wider ${client.isActive ? 'text-emerald-600' : 'text-destructive'}`}>
                {client.isActive ? t("active") : t("inactive")}
              </span>
            </div>
          </div>
        </div>

        {!client.isAlterable && (
          <div className="pt-2 flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-muted text-muted-foreground border border-border/50">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              {t("clientsSystemClient")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
