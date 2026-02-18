/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, X, AlertCircle, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getStudioDashboard as getDashboard,
  getStudioCard as getCard,
  type StudioDashboardDetail as StudioDashboardDetailDto,
  type StudioCardDetail as StudioCardDetailDto,
} from "@/lib/studioApi";
import { executeQuery, type QueryResultDto } from "@/lib/biIntegrationApi";
import { CardDataRenderer } from "@/components/studio/cards/CardDataRenderer";
import { useI18n } from "@/contexts/I18nContext";

interface CardWithData {
  id: number;
  cardId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  description?: string;
  showTitle?: boolean;
  showDescription?: boolean;
  cardType: string;
  layoutType: string;
  integrationId?: number;
  integrationName?: string;
  query?: string;
  dataSourceJson?: string | null;
  queryData?: QueryResultDto;
  loading: boolean;
  error?: string;
}

export default function DashboardPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [dashboard, setDashboard] = useState<StudioDashboardDetailDto | null>(null);
  const [cards, setCards] = useState<CardWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canvasViewportHeight, setCanvasViewportHeight] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      loadDashboard(parseInt(id));
    }
  }, [id]);

  const updateHeight = useCallback(() => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nextHeight = Math.max(600, Math.floor(window.innerHeight - rect.top - 24));
    setCanvasViewportHeight(nextHeight);
  }, []);

  useEffect(() => {
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [updateHeight]);

  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add("dashboard-fullscreen");
    } else {
      document.body.classList.remove("dashboard-fullscreen");
    }
    updateHeight();
    return () => {
      document.body.classList.remove("dashboard-fullscreen");
    };
  }, [isFullscreen, updateHeight]);

  useEffect(() => {
    if (!isFullscreen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  const loadDashboard = async (dashboardId: number) => {
    try {
      setLoading(true);
      const dashboardData = await getDashboard(dashboardId);
      setDashboard(dashboardData);

      // Load card details
      const cardsWithDetails = await Promise.all(
        dashboardData.cards.map(async (dashCard) => {
          try {
            const cardDetail = await getCard(dashCard.cardId);
            return {
              id: dashCard.id,
              cardId: dashCard.cardId,
              x: dashCard.positionX,
              y: dashCard.positionY,
              width: dashCard.width,
              height: dashCard.height,
              title: dashCard.title ?? cardDetail.title,
              description: dashCard.description ?? cardDetail.description ?? "",
              showTitle: dashCard.showTitle ?? true,
              showDescription: dashCard.showDescription ?? true,
              cardType: cardDetail.cardType,
              layoutType: cardDetail.layoutType,
              integrationId: dashCard.integrationId ?? undefined,
              query: cardDetail.query,
              dataSourceJson: dashCard.dataSourceJson ?? null,
              loading: !!dashCard.integrationId && !!cardDetail.query, // Will load data if has integration and query
            } as CardWithData;
          } catch (error) {
            console.error(`Failed to load card ${dashCard.cardId}:`, error);
            return null;
          }
        })
      );

      const validCards = cardsWithDetails.filter((c): c is CardWithData => c !== null);
      setCards(validCards);

      // Load data for cards with integrations
      validCards.forEach((card) => {
        if (card.integrationId) {
          loadCardData(card);
        }
      });
    } catch (error) {
      console.error("Failed to load dashboard:", error);
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadCardData = async (card: CardWithData) => {
    if (!card.integrationId || !card.query) return;

    try {
      const result = await executeQuery({
        integrationId: card.integrationId,
        query: card.query,
        dataSourceJson: card.dataSourceJson,
      });

      setCards((prevCards) =>
        prevCards.map((c) =>
          c.id === card.id
            ? { ...c, queryData: result, loading: false }
            : c
        )
      );
    } catch (error) {
      console.error(`Failed to load data for card ${card.id}:`, error);
      setCards((prevCards) =>
        prevCards.map((c) =>
          c.id === card.id
            ? { ...c, error: "Failed to load data", loading: false }
            : c
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Error Loading Dashboard</h1>
          <p className="text-muted-foreground mb-4">{error || "Dashboard not found"}</p>
          <Button onClick={() => navigate("/studio/dashboards")}>
            Back to Dashboards
          </Button>
        </div>
      </div>
    );
  }

  const layoutConfig = dashboard.layoutJson ? JSON.parse(dashboard.layoutJson) : {};
  const canvasWidth = layoutConfig.canvasMode === "fixed" ? `${layoutConfig.canvasWidth}px` : "100%";
  const canvasHeight = canvasViewportHeight > 0 ? canvasViewportHeight : 600;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-[1920px] mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{dashboard.name}</h1>
            {dashboard.description && (
              <p className="text-sm text-muted-foreground mt-1">{dashboard.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="gap-2"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {isFullscreen ? t("studioDashboardExitFullscreen") : t("studioDashboardEnterFullscreen")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.close()}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Close Preview
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Canvas */}
      <div className="p-6">
        <div
          ref={canvasRef}
          className="relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl mx-auto min-h-[600px] p-6"
          style={{ width: canvasWidth, height: canvasHeight, minHeight: canvasHeight }}
        >
          {/* Render Cards */}
          {cards.map((card) => {
            const showTitle = card.showTitle !== false;
            const showDescription = card.showDescription !== false && Boolean(card.description);
            const showHeader = showTitle || showDescription;

            return (
              <div
                key={card.id}
                className="absolute bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden"
                style={{
                  left: `${card.x}px`,
                  top: `${card.y}px`,
                  width: `${card.width}px`,
                  height: `${card.height}px`,
                }}
              >
                {/* Card Type Color Bar */}
                <div className={`h-3 w-full bg-gradient-to-r ${getCardTypeColor(card.cardType)}`} />

                <div className="p-4 h-[calc(100%-12px)] flex flex-col">
                  {/* Card Header */}
                  {showHeader && (
                    <div className="mb-3">
                      {showTitle && (
                        <h4 className="font-bold text-base leading-tight">{card.title}</h4>
                      )}
                      {showDescription ? (
                        <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                      ) : null}
                      <div className="flex gap-2 mt-1.5">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase font-bold border border-primary/20">
                          {card.cardType}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Card Content */}
                  <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 rounded-lg overflow-auto">
                    <CardDataRenderer
                      cardType={card.cardType}
                      layoutType={card.layoutType}
                      title={card.title}
                      integrationId={card.integrationId}
                      dataSourceJson={card.dataSourceJson}
                      queryData={card.queryData}
                      loading={card.loading}
                      error={card.error}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getCardTypeColor(cardType: string) {
  switch (cardType?.toLowerCase()) {
    case "kpi":
      return "from-blue-500 to-indigo-600";
    case "grid":
    case "table":
      return "from-emerald-500 to-teal-600";
    case "chart":
      return "from-amber-500 to-orange-600";
    case "timeline":
      return "from-purple-500 to-pink-600";
    default:
      return "from-slate-500 to-slate-600";
  }
}
