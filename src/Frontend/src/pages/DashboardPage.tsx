import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLibraryPanel } from "@/components/dashboards/DashboardLibraryPanel";
import { DashboardViewer } from "@/components/dashboards/DashboardViewer";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/contexts/I18nContext";
import { getClients } from "@/lib/clientApi";
import { getCompanies } from "@/lib/companyApi";
import {
  getStudioCard,
  getStudioDashboard,
  listStudioDashboards,
} from "@/lib/studioApi";
import type { ClientListResponse } from "@/lib/clientApi";
import type { CompanyListResponse } from "@/lib/companyApi";
import type { StudioCard, StudioDashboard, StudioDashboardDetail, StudioScope } from "@/types/studio";

export default function DashboardPage() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [scope, setScope] = useState<StudioScope>("Client");
  const [clientId, setClientId] = useState<number | undefined>();
  const [profileId, setProfileId] = useState<number | undefined>();
  const [clients, setClients] = useState<ClientListResponse[]>([]);
  const [companies, setCompanies] = useState<CompanyListResponse[]>([]);
  const [dashboards, setDashboards] = useState<StudioDashboard[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeDashboard, setActiveDashboard] = useState<StudioDashboardDetail | null>(null);
  const [cardsById, setCardsById] = useState<Record<number, StudioCard | undefined>>({});
  const [loading, setLoading] = useState(false);
  const scopeId = scope === "Client" ? clientId : profileId;

  useEffect(() => {
    let active = true;
    getClients()
      .then((data) => {
        if (!active) return;
        setClients(data);
      })
      .catch(() => {
        if (!active) return;
        setClients([]);
      });
    getCompanies()
      .then((data) => {
        if (!active) return;
        setCompanies(data);
      })
      .catch(() => {
        if (!active) return;
        setCompanies([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (scope === "Client" && !clientId && clients.length) {
      setClientId(clients[0].id);
    }
    if (scope === "Company" && !profileId && companies.length) {
      setProfileId(companies[0].id);
    }
  }, [scope, clientId, profileId, clients, companies]);

  useEffect(() => {
    if (!scopeId) {
      setDashboards([]);
      setActiveId(null);
      setActiveDashboard(null);
      setCardsById({});
      return;
    }
    let active = true;
    setLoading(true);
    listStudioDashboards(scope, clientId, profileId)
      .then((list) => {
        if (!active) return;
        const published = list.filter((dashboard) => dashboard.status === "Published");
        setDashboards(published);
        if (!published.length) {
          setActiveId(null);
          setActiveDashboard(null);
          setCardsById({});
          return;
        }
        if (!activeId || !published.some((dashboard) => dashboard.id === activeId)) {
          setActiveId(published[0].id);
        }
      })
      .catch(() => {
        if (!active) return;
        setDashboards([]);
        showToast(t("dashboardsHubLoadFailed"), { variant: "error" });
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [scope, clientId, profileId, scopeId, activeId, showToast, t]);

  useEffect(() => {
    if (!activeId) {
      setActiveDashboard(null);
      return;
    }
    let active = true;
    getStudioDashboard(activeId)
      .then((dashboard) => {
        if (!active) return;
        setActiveDashboard(dashboard);
      })
      .catch(() => {
        if (!active) return;
        setActiveDashboard(null);
        showToast(t("dashboardsHubLoadFailed"), { variant: "error" });
      });
    return () => {
      active = false;
    };
  }, [activeId, showToast, t]);

  useEffect(() => {
    if (!activeDashboard) {
      setCardsById({});
      return;
    }
    let active = true;
    const cardIds = Array.from(new Set(activeDashboard.cards.map((card) => card.cardId)));
    Promise.all(cardIds.map((id) => getStudioCard(id).catch(() => null)))
      .then((results) => {
        if (!active) return;
        const map: Record<number, StudioCard | undefined> = {};
        results.forEach((card) => {
          if (card) {
            map[card.id] = card;
          }
        });
        setCardsById(map);
      })
      .catch(() => {
        if (!active) return;
        setCardsById({});
      });
    return () => {
      active = false;
    };
  }, [activeDashboard]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-20 -top-16 h-56 w-56 rounded-full bg-emerald-400/30 blur-3xl" />
          <div className="absolute right-8 top-10 h-40 w-40 rounded-full bg-amber-400/40 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-300">{t("dashboardHeroEyebrow")}</p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{t("dashboardsHubTitle")}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t("dashboardsHubSubtitle")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <DashboardLibraryPanel
          scope={scope}
          clientId={clientId}
          profileId={profileId}
          clients={clients}
          companies={companies}
          dashboards={dashboards}
          activeId={activeId}
          loading={loading}
          onScopeChange={setScope}
          onClientChange={setClientId}
          onCompanyChange={setProfileId}
          onSelect={setActiveId}
        />
        <DashboardViewer
          dashboard={activeDashboard}
          cardsById={cardsById}
          onEdit={activeId ? () => navigate(`/studio/dashboards?dashboardId=${activeId}`) : undefined}
          onShare={activeId ? () => navigate(`/studio/dashboards?dashboardId=${activeId}`) : undefined}
        />
      </div>
    </div>
  );
}
