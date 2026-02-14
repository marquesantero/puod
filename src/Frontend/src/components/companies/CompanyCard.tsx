import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Pencil, Trash2 } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { type CompanyListResponse } from "@/lib/companyApi";

interface CompanyCardProps {
  company: CompanyListResponse;
  onView: (company: CompanyListResponse) => void;
  onEdit: (company: CompanyListResponse) => void;
  onDelete: (id: number) => void;
}

export function CompanyCard({ company, onView, onEdit, onDelete }: CompanyCardProps) {
  const { t } = useI18n();

  return (
    <Card
      className="group relative overflow-hidden cursor-pointer bg-card border border-border/50 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 rounded-3xl"
      onClick={() => onView(company)}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full transition-all group-hover:scale-150 group-hover:bg-primary/10" />
      
      <CardHeader className="pb-4 relative pt-8 px-8">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-3 flex-1 min-w-0">
            <CardTitle className="text-2xl font-extrabold tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
              {company.name}
            </CardTitle>
            {company.companyName && (
              <p className="text-sm text-muted-foreground font-medium truncate">{company.companyName}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {company.clientName && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] bg-primary/10 text-primary border border-primary/20 shadow-sm">
                  {company.clientName}
                </span>
              )}
              {company.inheritFromClient && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600 border border-purple-500/20">
                  {t("inherited") || "Inherited"}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => onEdit(company)} className="p-2.5 rounded-xl bg-background border shadow-sm text-muted-foreground hover:text-primary hover:border-primary transition-all" title={t("edit")}>
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(company.id)} className="p-2.5 rounded-xl bg-background border shadow-sm text-muted-foreground hover:text-destructive hover:border-destructive transition-all" title={t("delete")}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-8 pb-8 space-y-6 relative">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-accent/30 p-4 rounded-2xl border border-border/50 group-hover:bg-accent/50 transition-colors text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t("companiesUsers") || "Users"}</p>
            <p className="text-2xl font-black text-foreground">{company.userCount}</p>
          </div>
          <div className="bg-accent/30 p-4 rounded-2xl border border-border/50 group-hover:bg-accent/50 transition-colors text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t("status") || "Status"}</p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${company.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'}`} />
              <span className={`text-sm font-bold uppercase tracking-wider ${company.isActive ? 'text-emerald-600' : 'text-destructive'}`}>
                {company.isActive ? t("active") : t("inactive")}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
