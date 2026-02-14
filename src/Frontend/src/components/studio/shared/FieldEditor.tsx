import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";

export type StudioField = {
  key: string;
  label: string;
  format?: string;
};

type FieldEditorProps = {
  fields: StudioField[];
  onChange: (next: StudioField[]) => void;
};

export function FieldEditor({ fields, onChange }: FieldEditorProps) {
  const { t } = useI18n();

  const updateField = (index: number, patch: Partial<StudioField>) => {
    const next = fields.map((field, idx) => (idx === index ? { ...field, ...patch } : field));
    onChange(next);
  };

  const removeField = (index: number) => {
    const next = fields.filter((_, idx) => idx !== index);
    onChange(next);
  };

  const addField = () => {
    onChange([...fields, { key: "", label: "", format: "" }]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold">{t("studioFieldsTitle")}</Label>
          <p className="text-xs text-muted-foreground">{t("studioFieldsHint")}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={addField}>
          {t("studioAddField")}
        </Button>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={`${field.key}-${index}`} className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[1.2fr_1.2fr_1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("studioFieldKey")}</Label>
              <Input
                value={field.key}
                onChange={(event) => updateField(index, { key: event.target.value })}
                placeholder={t("studioFieldKeyPlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("studioFieldLabel")}</Label>
              <Input
                value={field.label}
                onChange={(event) => updateField(index, { label: event.target.value })}
                placeholder={t("studioFieldLabelPlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("studioFieldFormat")}</Label>
              <Input
                value={field.format ?? ""}
                onChange={(event) => updateField(index, { format: event.target.value })}
                placeholder={t("studioFieldFormatPlaceholder")}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => removeField(index)}>
                {t("remove")}
              </Button>
            </div>
          </div>
        ))}

        {fields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            {t("studioFieldsEmpty")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
