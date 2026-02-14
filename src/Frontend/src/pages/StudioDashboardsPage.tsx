import { DashboardStudioPanel } from "@/components/studio/dashboards/DashboardStudioPanel";
import { useI18n } from "@/contexts/I18nContext";

export default function StudioDashboardsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-12 top-6 h-40 w-40 rounded-full bg-emerald-300/40 blur-3xl" />
          <div className="absolute right-8 top-6 h-32 w-32 rounded-full bg-teal-300/40 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-2 px-6 py-6">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-300">
            {t("puodStudioEyebrow")}
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{t("puodStudioDashboardsTitle")}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t("puodStudioDashboardsSubtitle")}</p>
        </div>
      </div>

      <DashboardStudioPanel />
    </div>
  );
}
