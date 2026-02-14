import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/contexts/I18nContext";
import type { StudioShare } from "@/types/studio";
import type { ShareDraft } from "./dashboardTypes";

type DashboardShareSectionProps = {
  shares: StudioShare[];
  draft: ShareDraft;
  onDraftChange: (next: ShareDraft) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
  disableAdd: boolean;
};

export function DashboardShareSection({ shares, draft, onDraftChange, onAdd, onRemove, disableAdd }: DashboardShareSectionProps) {
  const { t } = useI18n();
  const subjectLabel = (value: StudioShare["subjectType"]) =>
    value === "User" ? t("studioShareUser") : value === "Group" ? t("studioShareGroup") : value;
  const accessLabel = (value: StudioShare["accessLevel"]) =>
    value === "View" ? t("studioShareView") : value === "Edit" ? t("studioShareEdit") : value;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{t("studioDashboardShares")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("studioDashboardSharesHint")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Select value={draft.subjectType} onValueChange={(value) => onDraftChange({ ...draft, subjectType: value as ShareDraft["subjectType"] })}>
            <SelectTrigger>
              <SelectValue placeholder={t("studioShareTargetType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="User">{t("studioShareUser")}</SelectItem>
              <SelectItem value="Group">{t("studioShareGroup")}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={draft.subjectId}
            onChange={(event) => onDraftChange({ ...draft, subjectId: event.target.value })}
            placeholder={t("studioShareSubjectPlaceholder")}
          />
          <Select value={draft.accessLevel} onValueChange={(value) => onDraftChange({ ...draft, accessLevel: value as ShareDraft["accessLevel"] })}>
            <SelectTrigger>
              <SelectValue placeholder={t("studioShareAccess")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="View">{t("studioShareView")}</SelectItem>
              <SelectItem value="Edit">{t("studioShareEdit")}</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" onClick={onAdd} disabled={disableAdd}>
            {t("studioShareAdd")}
          </Button>
        </div>

        <div className="space-y-2">
          {shares.map((share) => (
            <div key={share.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <div>
                <div className="font-medium">
                  {subjectLabel(share.subjectType)} #{share.subjectId}
                </div>
                <div className="text-xs text-muted-foreground">{accessLabel(share.accessLevel)}</div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(share.id)}>
                {t("remove")}
              </Button>
            </div>
          ))}
          {shares.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              {t("studioShareEmpty")}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
