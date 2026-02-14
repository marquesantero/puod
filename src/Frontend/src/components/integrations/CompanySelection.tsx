import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import type { CompanyListResponse } from "@/lib/companyApi";

type CompanySelectionProps = {
  companies: CompanyListResponse[];
  selectedCompanies: Set<number>;
  onToggleCompany: (companyId: number) => void;
  onToggleAll: () => void;
};

export const CompanySelection = ({
  companies,
  selectedCompanies,
  onToggleCompany,
  onToggleAll,
}: CompanySelectionProps) => {
  const { t } = useI18n();

  return (
    <div className="bg-accent/30 rounded-2xl p-6 border border-border/50 space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold uppercase tracking-widest text-foreground">
          {t("selectCompanies")} ({selectedCompanies.size}/{companies.length})
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleAll}
        >
          {selectedCompanies.size === companies.length ? t("deselectAll") : t("selectAll")}
        </Button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {companies.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("noCompanies")}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {companies.map((company) => (
              <label
                key={company.id}
                className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  selectedCompanies.has(company.id)
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-background hover:bg-accent/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCompanies.has(company.id)}
                  onChange={() => onToggleCompany(company.id)}
                  className="hidden"
                />
                <span className="text-xs font-bold truncate">{company.name}</span>
                {!company.isActive && (
                  <span className="text-[10px] text-muted-foreground">({t("inactive")})</span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
