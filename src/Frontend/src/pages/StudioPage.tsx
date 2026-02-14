import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/contexts/I18nContext";

export default function StudioPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-12 top-6 h-40 w-40 rounded-full bg-amber-300/40 blur-3xl" />
          <div className="absolute right-8 top-6 h-32 w-32 rounded-full bg-rose-300/40 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-300">
              {t("puodStudioEyebrow")}
            </p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{t("puodStudioTitle")}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t("puodStudioSubtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => navigate("/studio/cards")}>
              {t("puodStudioCardsTab")}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => navigate("/studio/dashboards")}>
              {t("puodStudioDashboardsTab")}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border border-border bg-card">
          <CardContent className="space-y-3 p-6">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{t("puodStudioCardsTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("puodStudioCardsSubtitle")}</p>
            </div>
            <Button type="button" onClick={() => navigate("/studio/cards")}>
              {t("puodStudioOpenCards")}
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="space-y-3 p-6">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{t("puodStudioDashboardsTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("puodStudioDashboardsSubtitle")}</p>
            </div>
            <Button type="button" onClick={() => navigate("/studio/dashboards")}>
              {t("puodStudioOpenDashboards")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
