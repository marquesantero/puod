import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";

export type CompanyOption = {
  id: number;
  name: string;
  slug: string;
};

interface CompanySelectorProps {
  companies: CompanyOption[];
  selectedCompanyIds: number[];
  onChange: (selectedIds: number[]) => void;
  disabled?: boolean;
}

export function CompanySelector({ companies, selectedCompanyIds, onChange, disabled = false }: CompanySelectorProps) {
  const { t } = useI18n();

  const toggleCompany = (companyId: number) => {
    if (disabled) return;

    if (selectedCompanyIds.includes(companyId)) {
      onChange(selectedCompanyIds.filter(id => id !== companyId));
    } else {
      onChange([...selectedCompanyIds, companyId]);
    }
  };

  const toggleAll = () => {
    if (disabled) return;

    if (selectedCompanyIds.length === companies.length) {
      onChange([]);
    } else {
      onChange(companies.map(c => c.id));
    }
  };

  const allSelected = companies.length > 0 && selectedCompanyIds.length === companies.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-foreground">
          {t("companiesAvailable") || "Available Companies"}
        </Label>
        <button
          type="button"
          onClick={toggleAll}
          disabled={disabled || companies.length === 0}
          className="text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {allSelected ? (t("deselectAll") || "Deselect All") : (t("selectAll") || "Select All")}
        </button>
      </div>

      {companies.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed rounded-2xl text-muted-foreground italic bg-accent/5">
          <p className="text-sm">{t("noCompaniesAvailable") || "No companies available"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 border rounded-2xl bg-accent/5">
          {companies.map((company) => {
            const isSelected = selectedCompanyIds.includes(company.id);
            return (
              <label
                key={company.id}
                className={`
                  flex items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent/50'}
                  ${isSelected
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-background border-border'
                  }
                `}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleCompany(company.id)}
                  disabled={disabled}
                  className="hidden"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {company.name}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{company.slug}</p>
                </div>
              </label>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {selectedCompanyIds.length} / {companies.length} {t("companiesSelected") || "companies selected"}
      </p>
    </div>
  );
}
