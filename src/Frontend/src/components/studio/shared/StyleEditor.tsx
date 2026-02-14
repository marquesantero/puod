import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import { useMemo } from "react";

export type StudioStyle = {
  background: string;
  text: string;
  accent: string;
  fontSize: string;
  radius: string;
  shadow: string;
};

type StyleEditorProps = {
  value: StudioStyle;
  onChange: (next: StudioStyle) => void;
};

const fontSizes = ["xs", "sm", "base", "lg", "xl"];

export function StyleEditor({ value, onChange }: StyleEditorProps) {
  const { t } = useI18n();
  const fontSizeLabels = useMemo(
    () => ({
      xs: t("studioFontSizeXs"),
      sm: t("studioFontSizeSm"),
      base: t("studioFontSizeBase"),
      lg: t("studioFontSizeLg"),
      xl: t("studioFontSizeXl"),
    }),
    [t]
  );

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold">{t("studioStyleTitle")}</Label>
        <p className="text-xs text-muted-foreground">{t("studioStyleHint")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("studioStyleBackground")}</Label>
          <Input
            type="color"
            value={value.background}
            onChange={(event) => onChange({ ...value, background: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("studioStyleText")}</Label>
          <Input
            type="color"
            value={value.text}
            onChange={(event) => onChange({ ...value, text: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("studioStyleAccent")}</Label>
          <Input
            type="color"
            value={value.accent}
            onChange={(event) => onChange({ ...value, accent: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("studioStyleFontSize")}</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={value.fontSize}
            onChange={(event) => onChange({ ...value, fontSize: event.target.value })}
          >
            {fontSizes.map((size) => (
              <option key={size} value={size}>
                {fontSizeLabels[size] ?? size}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("studioStyleRadius")}</Label>
          <Input
            value={value.radius}
            onChange={(event) => onChange({ ...value, radius: event.target.value })}
            placeholder="12px"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("studioStyleShadow")}</Label>
          <Input
            value={value.shadow}
            onChange={(event) => onChange({ ...value, shadow: event.target.value })}
            placeholder="0 18px 40px rgba(0,0,0,0.12)"
          />
        </div>
      </div>
    </div>
  );
}
