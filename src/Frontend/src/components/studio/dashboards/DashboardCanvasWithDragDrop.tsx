import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Plus, Layers, Grid3x3, Loader2, BarChart3, Table2, Activity, Clock, Eye } from "lucide-react";
import { TemplateGallery } from "../TemplateGallery";
import { QueryEditor } from "../cards/QueryEditor";
import { CardAdvancedSettings } from "../cards/CardAdvancedSettings";
import { QuickCardCreator } from "../cards/QuickCardCreator";
import { CanvasToolbar } from "./CanvasToolbar";
import { LayoutSelector } from "./LayoutSelector";
import { DashboardTemplateSelector } from "./DashboardTemplateSelector";
import { SnapGuides } from "./SnapGuides";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/contexts/I18nContext";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useCanvasShortcuts } from "@/hooks/useCanvasShortcuts";
import { findSnapPosition } from "@/lib/canvasLayouts";
import {
  exportDashboard,
  downloadDashboardJSON,
  importDashboardJSON,
  validateDashboard,
  type ExportedDashboard,
} from "@/lib/dashboardExport";
import { getTemplateById, type CardTemplate } from "@/lib/cardTemplates";
import { type DashboardTemplate } from "@/lib/dashboardTemplates";
import {
  getIntegrations,
  getClientIntegrations,
  getCompanyAvailableIntegrations,
  getIntegration,
  type IntegrationListResponse,
  type IntegrationDetailResponse
} from "@/lib/biIntegrationApi";
import { getClients, type ClientListResponse } from "@/lib/clientApi";
import { getCompanies, type CompanyListResponse } from "@/lib/companyApi";
import type { DashboardConfig } from "./DashboardWizard";
import {
  getStudioDashboard as getDashboard,
  createStudioDashboard as createDashboard,
  updateStudioDashboard as updateDashboard,
  getStudioCard as getCard,
  updateStudioCard as updateCard,
  createStudioCard as createCard,
  type StudioDashboardDetail as StudioDashboardDetailDto,
  type UpsertStudioDashboardCardRequest,
} from "@/lib/studioApi";

interface DashboardCanvasProps {
  config: DashboardConfig;
  dashboardId?: number;
  onSave: (dashboardId: number) => void;
  onBack: () => void;
}

interface CanvasCard {
  id: number; // DashboardCard ID (0 for new)
  cardId: number; // StudioCard ID
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  description?: string;
  showTitle?: boolean;
  showDescription?: boolean;
  orderIndex: number;
  cardType?: string;
  layoutType?: string;
  integrationId?: number;
  integrationName?: string;
  query?: string;
  fieldsJson?: string | null;
  styleJson?: string | null;
  layoutJson?: string | null;
  refreshPolicyJson?: string | null;
  dataSourceJson?: string | null;
}

const GRID_SIZE = 40;
const MIN_CARD_WIDTH = 200;
const MIN_CARD_HEIGHT = 160;

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function DashboardCanvas({ config, dashboardId, onSave, onBack }: DashboardCanvasProps) {
  const { showToast } = useToast();
  const { t } = useI18n();

  // Undo/Redo state management
  const {
    state: cards,
    setState: setCards,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo<CanvasCard[]>([]);

  const [showTemplates, setShowTemplates] = useState(true);
  const [templateWidth, setTemplateWidth] = useState(320);
  const [resizingTemplates, setResizingTemplates] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasViewportHeight, setCanvasViewportHeight] = useState(0);
  const [layoutViewportHeight, setLayoutViewportHeight] = useState(0);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [dragging, setDragging] = useState<{ cardId: number; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{ cardId: number; handle: string; startX: number; startY: number; startWidth: number; startHeight: number; startPosX: number; startPosY: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cardId: number } | null>(null);
  const [configuringCard, setConfiguringCard] = useState<number | null>(null);
  const [basicConfiguringCard, setBasicConfiguringCard] = useState<number | null>(null);
  const [originalCardData, setOriginalCardData] = useState<string | null>(null); // Track original card data for change detection
  const [integrations, setIntegrations] = useState<IntegrationListResponse[]>([]);
  const [currentCardIntegration, setCurrentCardIntegration] = useState<IntegrationDetailResponse | null>(null);
  const [editingIntegration, setEditingIntegration] = useState(false);
  const [clients, setClients] = useState<ClientListResponse[]>([]);
  const [companies, setCompanies] = useState<CompanyListResponse[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [cardTestResults, setCardTestResults] = useState<Record<number, { signature: string; testedAt: Date }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasShellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.toggle("dashboard-fullscreen", isFullscreen);
    return () => {
      document.body.classList.remove("dashboard-fullscreen");
    };
  }, [isFullscreen]);

  useEffect(() => {
    const updateHeight = () => {
      const layoutRect = layoutRef.current?.getBoundingClientRect();
      if (layoutRect) {
        const nextLayoutHeight = Math.max(600, Math.floor(window.innerHeight - layoutRect.top - 24));
        setLayoutViewportHeight(nextLayoutHeight);
      }
      const target = canvasShellRef.current ?? canvasRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const nextHeight = Math.max(600, Math.floor(window.innerHeight - rect.top - 24));
      setCanvasViewportHeight(nextHeight);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [showTemplates, templateWidth, isFullscreen]);
  const layoutRef = useRef<HTMLDivElement>(null);
  const nextTempIdRef = useRef(-1); // Temporary IDs for new cards (negative to avoid conflicts with real IDs)

  // New modals state
  const [showQuickCardCreator, setShowQuickCardCreator] = useState(false);
  const [showLayoutSelector, setShowLayoutSelector] = useState(false);
  const [showDashboardTemplateSelector, setShowDashboardTemplateSelector] = useState(false);

  // Smart snapping state
  const [snapLines, setSnapLines] = useState<{ type: "vertical" | "horizontal"; position: number }[]>([]);

  // Load clients and companies for configuration
  useEffect(() => {
    const loadData = async () => {
      try {
        const [clientsData, companiesData] = await Promise.all([
          getClients(),
          getCompanies(),
        ]);
        setClients(clientsData);
        setCompanies(companiesData);
      } catch (error) {
        console.error("Failed to load clients/companies:", error);
      }
    };
    loadData();
  }, []);

  // Load integrations based on client/company selection
  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        let data: IntegrationListResponse[];

        if (selectedCompanyId) {
          // Company selected - get integrations available for this company
          data = await getCompanyAvailableIntegrations(selectedCompanyId);
        } else if (selectedClientId) {
          // Client selected - get integrations for this client
          data = await getClientIntegrations(selectedClientId);
        } else {
          // No selection - platform admin view, show all integrations
          data = await getIntegrations();
        }

        setIntegrations(data);
      } catch (error) {
        console.error("Failed to load integrations:", error);
        setIntegrations([]);
      }
    };

    loadIntegrations();
  }, [selectedClientId, selectedCompanyId]);

  useEffect(() => {
    if (!resizingTemplates) return;

    const handleMouseMove = (event: MouseEvent) => {
      const layout = layoutRef.current?.getBoundingClientRect();
      if (!layout) return;
      const nextWidth = Math.round(event.clientX - layout.left);
      const clamped = Math.max(240, Math.min(480, nextWidth));
      setTemplateWidth(clamped);
    };

    const handleMouseUp = () => {
      setResizingTemplates(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingTemplates]);

  // Update integration names in cards when integrations list changes
  useEffect(() => {
    if (integrations.length === 0) return;

    setCards(prevCards =>
      prevCards.map(card => {
        // If card has integrationId but no integrationName, try to find it
        if (card.integrationId && !card.integrationName) {
          const integration = integrations.find(i => i.id === card.integrationId);
          if (integration) {
            return { ...card, integrationName: integration.name };
          }
        }
        return card;
      })
    );
  }, [integrations]);

  // Load current card integration when dialog opens
  useEffect(() => {
    const loadCurrentIntegration = async () => {
      console.log('[Integration Config] useEffect triggered, configuringCard:', configuringCard);

      if (configuringCard === null) {
        console.log('[Integration Config] No card being configured');
        setCurrentCardIntegration(null);
        setEditingIntegration(false);
        return;
      }

      const card = cards.find(c => c.id === configuringCard);
      console.log('[Integration Config] Found card:', card);
      console.log('[Integration Config] Card integrationId:', card?.integrationId);
      console.log('[Integration Config] Card integrationName:', card?.integrationName);

      if (!card?.integrationId) {
        console.log('[Integration Config] No integration ID, showing edit mode');
        setCurrentCardIntegration(null);
        setEditingIntegration(true); // No integration, show selection
        return;
      }

      try {
        console.log('[Integration Config] Loading integration:', card.integrationId);
        const integration = await getIntegration(card.integrationId);
        console.log('[Integration Config] Loaded integration:', integration);
        setCurrentCardIntegration(integration);
        setEditingIntegration(false); // Has integration, show view mode

        // Update card name if missing
        if (!card.integrationName) {
          console.log('[Integration Config] Updating card with integration name:', integration.name);
          setCards(cards.map(c =>
            c.id === configuringCard
              ? { ...c, integrationName: integration.name }
              : c
          ));
        }
      } catch (error) {
        console.error('[Integration Config] Failed to load integration:', error);
        // If can't load integration details, use what we have
        setCurrentCardIntegration(null);
        setEditingIntegration(false); // Show view mode with ID only
      }
    };

    loadCurrentIntegration();
  }, [configuringCard]);

  // Load existing dashboard
  useEffect(() => {
    if (dashboardId) {
      loadDashboard(dashboardId);
    }
  }, [dashboardId]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const loadDashboard = async (id: number) => {
    try {
      setLoading(true);
      const dashboard = await getDashboard(id);

      // Load card details and convert to canvas cards
      const canvasCards = await Promise.all(
        dashboard.cards.map(async (dashCard) => {
          try {
            const cardDetail = await getCard(dashCard.cardId);

            // Load integration name if dashboard card has an integration
            let integrationName: string | undefined;
            if (dashCard.integrationId) {
              try {
                const integration = await getIntegration(dashCard.integrationId);
                integrationName = integration.name;
                console.log(`[Load Dashboard] Card ${dashCard.cardId} has integration ${dashCard.integrationId}: ${integrationName}`);
              } catch (error) {
                console.error(`[Load Dashboard] Failed to load integration ${dashCard.integrationId}:`, error);
              }
            }

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
              orderIndex: dashCard.orderIndex,
              cardType: cardDetail.cardType,
              layoutType: cardDetail.layoutType,
              integrationId: dashCard.integrationId ?? undefined,
              integrationName: integrationName,
              query: cardDetail.query,
              fieldsJson: cardDetail.fieldsJson,
              styleJson: cardDetail.styleJson,
              layoutJson: cardDetail.layoutJson,
              refreshPolicyJson: cardDetail.refreshPolicyJson,
              dataSourceJson: dashCard.dataSourceJson ?? null,
            };
          } catch (error) {
            console.error(`Failed to load card ${dashCard.cardId}:`, error);
            return null;
          }
        })
      );

      setCards(canvasCards.filter((c): c is CanvasCard => c !== null));
    } catch (error) {
      console.error("Failed to load dashboard:", error);
      showToast("Failed to load dashboard", { variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async (templateCardId: number) => {
    try {
      // Get card details
      const cardDetail = await getCard(templateCardId);

      // Find next available position (simple stacking)
      const maxY = cards.length > 0 ? Math.max(...cards.map(c => c.y + c.height)) : 0;

      // Generate unique temporary ID for new card
      const tempId = nextTempIdRef.current;
      nextTempIdRef.current -= 1; // Decrement for next card

      const templateIntegrationId = cardDetail.integrationId ?? undefined;
      const templateIntegration = templateIntegrationId
        ? integrations.find(i => i.id === templateIntegrationId)
        : undefined;

      const newCard: CanvasCard = {
        id: tempId, // Temporary negative ID, will be replaced with real ID when saved
        cardId: templateCardId,
        x: snapToGrid(20),
        y: snapToGrid(maxY + 20),
        width: snapToGrid(400),
        height: snapToGrid(200),
        title: cardDetail.title,
        description: cardDetail.description ?? "",
        showTitle: true,
        showDescription: true,
        orderIndex: cards.length,
        cardType: cardDetail.cardType,
        layoutType: cardDetail.layoutType,
        integrationId: templateIntegrationId,
        integrationName: templateIntegration?.name,
        query: cardDetail.query,
        fieldsJson: cardDetail.fieldsJson,
        styleJson: cardDetail.styleJson,
        layoutJson: cardDetail.layoutJson,
        refreshPolicyJson: cardDetail.refreshPolicyJson,
        dataSourceJson: cardDetail.dataSourceJson ?? null,
      };

      setCards([...cards, newCard]);
      showToast("Card added to canvas", { variant: "success" });
    } catch (error) {
      console.error("Failed to add card:", error);
      showToast("Failed to add card", { variant: "destructive" });
    }
  };

  const handleRemoveCard = (cardId: number) => {
    setCards(cards.filter(c => c.id !== cardId));
  };

  const updateCardById = (cardId: number, patch: Partial<CanvasCard>) => {
    setCards(cards.map((card) => (card.id === cardId ? { ...card, ...patch } : card)));
  };

  const handleMouseDown = (e: React.MouseEvent, cardId: number) => {
    e.preventDefault();
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragging({
      cardId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    });
    setSelectedCard(cardId);
  };

  const handleResizeStart = (e: React.MouseEvent, cardId: number, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    setResizing({
      cardId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: card.width,
      startHeight: card.height,
      startPosX: card.x,
      startPosY: card.y,
    });
    setSelectedCard(cardId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      let newX = snapToGrid(e.clientX - canvasRect.left - dragging.offsetX);
      let newY = snapToGrid(e.clientY - canvasRect.top - dragging.offsetY);

      // Get current card being dragged
      const draggedCard = cards.find(c => c.id === dragging.cardId);
      if (draggedCard) {
        // Get other cards for snapping
        const otherCards = cards.filter(c => c.id !== dragging.cardId);

        // Find snap position with smart snapping
        const snapResult = findSnapPosition(
          { ...draggedCard, x: newX, y: newY },
          otherCards,
          20 // 20px threshold for snapping
        );

        // Update position with snap
        newX = snapResult.x;
        newY = snapResult.y;

        // Update snap lines for visual feedback
        setSnapLines(snapResult.snapLines);
      }

      setCards(cards.map(card =>
        card.id === dragging.cardId
          ? { ...card, x: Math.max(0, newX), y: Math.max(0, newY) }
          : card
      ));
    }

    if (resizing && canvasRef.current) {
      const deltaX = e.clientX - resizing.startX;
      const deltaY = e.clientY - resizing.startY;

      setCards(cards.map(card => {
        if (card.id !== resizing.cardId) return card;

        let newWidth = resizing.startWidth;
        let newHeight = resizing.startHeight;
        let newX = resizing.startPosX;
        let newY = resizing.startPosY;

        // Handle different resize directions
        if (resizing.handle.includes('e')) {
          newWidth = Math.max(MIN_CARD_WIDTH, snapToGrid(resizing.startWidth + deltaX));
        }
        if (resizing.handle.includes('w')) {
          const newW = Math.max(MIN_CARD_WIDTH, snapToGrid(resizing.startWidth - deltaX));
          newX = snapToGrid(resizing.startPosX + (resizing.startWidth - newW));
          newWidth = newW;
        }
        if (resizing.handle.includes('s')) {
          newHeight = Math.max(MIN_CARD_HEIGHT, snapToGrid(resizing.startHeight + deltaY));
        }
        if (resizing.handle.includes('n')) {
          const newH = Math.max(MIN_CARD_HEIGHT, snapToGrid(resizing.startHeight - deltaY));
          newY = snapToGrid(resizing.startPosY + (resizing.startHeight - newH));
          newHeight = newH;
        }

        return { ...card, x: newX, y: newY, width: newWidth, height: newHeight };
      }));
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setResizing(null);
    setSnapLines([]); // Clear snap lines when dragging ends
  };

  const handleContextMenu = (e: React.MouseEvent, cardId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, cardId });
    setSelectedCard(cardId);
  };

  const handleDuplicateCard = (cardId: number) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    // Generate unique temporary ID for duplicated card
    const tempId = nextTempIdRef.current;
    nextTempIdRef.current -= 1;

    const newCard: CanvasCard = {
      ...card,
      id: tempId, // Temporary negative ID, will be replaced with real ID when saved
      x: snapToGrid(card.x + 20),
      y: snapToGrid(card.y + 20),
      orderIndex: cards.length,
    };
    setCards([...cards, newCard]);
    setContextMenu(null);
    showToast("Card duplicated", { variant: "success" });
  };

  const handleBringToFront = (cardId: number) => {
    const cardIndex = cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const newCards = [...cards];
    const [card] = newCards.splice(cardIndex, 1);
    newCards.push(card);
    setCards(newCards.map((c, i) => ({ ...c, orderIndex: i })));
    setContextMenu(null);
  };

  const handleSendToBack = (cardId: number) => {
    const cardIndex = cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const newCards = [...cards];
    const [card] = newCards.splice(cardIndex, 1);
    newCards.unshift(card);
    setCards(newCards.map((c, i) => ({ ...c, orderIndex: i })));
    setContextMenu(null);
  };

  const getCardTypeIcon = (cardType?: string) => {
    switch (cardType?.toLowerCase()) {
      case "kpi":
        return <BarChart3 className="w-8 h-8 text-blue-500" />;
      case "grid":
      case "table":
        return <Table2 className="w-8 h-8 text-emerald-500" />;
      case "chart":
        return <Activity className="w-8 h-8 text-amber-500" />;
      case "timeline":
        return <Clock className="w-8 h-8 text-purple-500" />;
      default:
        return <BarChart3 className="w-8 h-8 text-slate-500" />;
    }
  };

  const getCardTypeColor = (cardType?: string) => {
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
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const dashboardCards: UpsertStudioDashboardCardRequest[] = cards.map((card, index) => ({
        id: card.id > 0 ? card.id : undefined,
        cardId: card.cardId,
        title: card.title,
        description: card.description ?? null,
        showTitle: card.showTitle ?? true,
        showDescription: card.showDescription ?? true,
        integrationId: card.integrationId,
        orderIndex: index,
        positionX: card.x,
        positionY: card.y,
        width: card.width,
        height: card.height,
        dataSourceJson: card.dataSourceJson ?? null,
      }));

      let savedDashboard: StudioDashboardDetailDto;

      if (dashboardId) {
        // Update existing dashboard
        savedDashboard = await updateDashboard(dashboardId, {
          cards: dashboardCards,
        });
      } else {
        // Create new dashboard
        savedDashboard = await createDashboard({
          name: config.name,
          description: config.description,
          scope: config.scope,
          clientId: config.clientId,
          profileId: config.profileId,
          layoutType: "grid",
          layoutJson: JSON.stringify({
            canvasMode: config.canvasMode,
            canvasWidth: config.canvasWidth,
            canvasHeight: config.canvasHeight,
          }),
        });

        // Update with cards
        savedDashboard = await updateDashboard(savedDashboard.id, {
          cards: dashboardCards,
        });
      }

      showToast("Dashboard saved successfully", { variant: "success" });
      onSave(savedDashboard.id);
    } catch (error) {
      console.error("Failed to save dashboard:", error);
      showToast("Failed to save dashboard", { variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Keyboard shortcuts ──
  const handleDeleteSelected = useCallback(() => {
    if (selectedCard !== null) {
      handleRemoveCard(selectedCard);
      setSelectedCard(null);
    }
  }, [selectedCard, cards]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedCard === null) return;
    const source = cards.find((c) => c.id === selectedCard);
    if (!source) return;
    const tempId = nextTempIdRef.current;
    nextTempIdRef.current -= 1;
    const clone: CanvasCard = {
      ...source,
      id: tempId,
      x: source.x + GRID_SIZE,
      y: source.y + GRID_SIZE,
      orderIndex: cards.length,
    };
    setCards([...cards, clone]);
    setSelectedCard(tempId);
  }, [selectedCard, cards, setCards]);

  const handleEscapeKey = useCallback(() => {
    if (contextMenu) {
      setContextMenu(null);
    } else if (configuringCard !== null) {
      setConfiguringCard(null);
    } else if (basicConfiguringCard !== null) {
      setBasicConfiguringCard(null);
    } else if (showQuickCardCreator) {
      setShowQuickCardCreator(false);
    } else {
      setSelectedCard(null);
    }
  }, [contextMenu, configuringCard, basicConfiguringCard, showQuickCardCreator]);

  useCanvasShortcuts({
    onUndo: undo,
    onRedo: redo,
    onSave: handleSave,
    onDeleteSelected: handleDeleteSelected,
    onDuplicateSelected: handleDuplicateSelected,
    onEscape: handleEscapeKey,
    onToggleFullscreen: () => setIsFullscreen((prev) => !prev),
  });

  // Quick Card Creator handler
  const handleQuickCardCreated = async (cardData: {
    title: string;
    cardType: string;
    layoutType: string;
    integrationId?: number;
    query?: string;
  }) => {
    try {
      // Create the card in the backend
      const newCard = await createCard({
        title: cardData.title,
        cardType: cardData.cardType,
        layoutType: cardData.layoutType,
        profileId: config.profileId,
        integrationId: cardData.integrationId,
        query: cardData.query,
      });

      // Add to canvas
      const maxY = cards.length > 0 ? Math.max(...cards.map(c => c.y + c.height)) : 0;
      const tempId = nextTempIdRef.current;
      nextTempIdRef.current -= 1;

      const canvasCard: CanvasCard = {
        id: tempId,
        cardId: newCard.id,
        x: snapToGrid(20),
        y: snapToGrid(maxY + 20),
        width: snapToGrid(400),
        height: snapToGrid(200),
        title: newCard.title,
        description: newCard.description ?? "",
        showTitle: true,
        showDescription: true,
        orderIndex: cards.length,
        cardType: newCard.cardType,
        layoutType: newCard.layoutType,
        integrationId: cardData.integrationId,
        query: newCard.query,
        dataSourceJson: null,
      };

      setCards([...cards, canvasCard]);
      setShowQuickCardCreator(false);
      showToast("Card created and added to canvas", { variant: "success" });
    } catch (error) {
      console.error("Failed to create card:", error);
      showToast("Failed to create card", { variant: "destructive" });
    }
  };

  // Dashboard template handler
  const handleApplyDashboardTemplate = async (template: DashboardTemplate) => {
    try {
      // Get first available integration if any
      const availableIntegrations = await getIntegrations();

      if (availableIntegrations.length === 0) {
        showToast("No integrations available. Please create a BI integration first.", {
          variant: "destructive"
        });
        return;
      }

      const firstIntegration = availableIntegrations[0];

      // Create cards from template card IDs
      const newCanvasCards: CanvasCard[] = [];

      for (const templateCard of template.cards) {
        const cardTemplate = getTemplateById(templateCard.templateCardId);
        if (!cardTemplate) continue;

        // Fill template placeholders with default values
        const placeholders: Record<string, string> = {};
        cardTemplate.placeholders?.forEach((p) => {
          placeholders[p.key] = p.default;
        });

        // Generate query from template
        const { fillTemplate } = await import("@/lib/cardTemplates");
        const filledQuery = fillTemplate(cardTemplate, placeholders);

        // Create the card in backend with query
        const newCard = await createCard({
          title: cardTemplate.name,
          cardType: cardTemplate.cardType,
          layoutType: "single",
          profileId: config.profileId,
          query: filledQuery, // Include the filled query template
        });

        const tempId = nextTempIdRef.current;
        nextTempIdRef.current -= 1;

        newCanvasCards.push({
          id: tempId,
          cardId: newCard.id,
          x: templateCard.x,
          y: templateCard.y,
          width: templateCard.width,
          height: templateCard.height,
          title: newCard.title,
          description: cardTemplate.description,
          showTitle: true,
          showDescription: true,
          orderIndex: newCanvasCards.length,
          cardType: newCard.cardType,
          layoutType: newCard.layoutType,
          integrationId: firstIntegration.id,
          query: newCard.query,
          dataSourceJson: null,
        });
      }

      setCards(newCanvasCards);
      setShowDashboardTemplateSelector(false);
      showToast(`Dashboard template "${template.name}" applied`, { variant: "success" });
    } catch (error) {
      console.error("Failed to apply dashboard template:", error);
      showToast("Failed to apply dashboard template", { variant: "destructive" });
    }
  };

  // Export dashboard handler
  const handleExportDashboard = () => {
    const exportData = exportDashboard(
      {
        name: config.name,
        description: config.description,
        layoutType: "grid",
        layoutJson: JSON.stringify({
          canvasMode: config.canvasMode,
          canvasWidth: config.canvasWidth,
        }),
        scope: config.scope,
        clientId: config.clientId,
        profileId: config.profileId,
      },
      cards
    );

    downloadDashboardJSON(exportData);
    showToast("Dashboard exported successfully", { variant: "success" });
  };

  // Import dashboard handler
  const handleImportDashboard = async () => {
    try {
      const importedData = await importDashboardJSON();
      if (!importedData) return;

      // Validate imported data
      const validation = validateDashboard(importedData);
      if (!validation.valid) {
        showToast(`Invalid dashboard file: ${validation.errors.join(", ")}`, {
          variant: "destructive",
        });
        return;
      }

      // Create cards from imported data
      const newCanvasCards: CanvasCard[] = [];

      for (const importedCard of importedData.cards) {
        // Create card in backend
        const newCard = await createCard({
          title: importedCard.title,
          cardType: importedCard.cardType,
          layoutType: importedCard.layoutType,
          profileId: config.profileId,
          query: importedCard.query,
        });

        const tempId = nextTempIdRef.current;
        nextTempIdRef.current -= 1;

        newCanvasCards.push({
          id: tempId,
          cardId: newCard.id,
          x: importedCard.position.x,
          y: importedCard.position.y,
          width: importedCard.position.width,
          height: importedCard.position.height,
          title: newCard.title,
          description: importedCard.description ?? "",
          showTitle: importedCard.showTitle ?? true,
          showDescription: importedCard.showDescription ?? true,
          orderIndex: importedCard.position.orderIndex,
          cardType: newCard.cardType,
          layoutType: newCard.layoutType,
          integrationId: importedCard.integrationId,
          query: newCard.query,
          dataSourceJson: importedCard.dataSourceJson ?? null,
        });
      }

      setCards(newCanvasCards);
      showToast("Dashboard imported successfully", { variant: "success" });
    } catch (error) {
      console.error("Failed to import dashboard:", error);
      showToast("Failed to import dashboard", { variant: "destructive" });
    }
  };

  const canvasWidth = config.canvasMode === "fixed" ? `${config.canvasWidth}px` : "100%";
  const canvasHeight = canvasViewportHeight > 0 ? canvasViewportHeight : 600;
  const layoutHeight = layoutViewportHeight > 0 ? layoutViewportHeight : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      ref={layoutRef}
      className="flex gap-4"
      style={layoutHeight ? { height: layoutHeight } : undefined}
    >
      {/* Sidebar com Templates */}
      <div
        className="transition-all duration-200 overflow-hidden relative"
        style={{ width: showTemplates ? templateWidth : 52 }}
      >
        <Card className="h-full flex flex-col border-2 relative">
          {showTemplates ? (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Templates & Cards
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTemplates(false)}
                    className="h-8 w-8 p-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4">
                <TemplateGallery
                  profileId={config.profileId}
                  onTemplateSelected={handleAddCard}
                />
              </CardContent>
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-gradient-to-l from-border/60 to-transparent"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setResizingTemplates(true);
                }}
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplates(true)}
                className="h-10 w-10 p-0"
                aria-label="Show templates"
              >
                <Layers className="w-5 h-5" />
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* New Unified Toolbar */}
        <Card className="border-2">
          <CardContent className="p-4">
            <CanvasToolbar
              dashboardName={config.name}
              dashboardId={dashboardId}
              cardsCount={cards.length}
              canvasMode={config.canvasMode}
              gridSize={GRID_SIZE}
              showTemplates={showTemplates}
              saving={saving}
              canUndo={canUndo}
              canRedo={canRedo}
              onBack={onBack}
              onSave={handleSave}
              onPreview={() => {
                if (dashboardId) {
                  window.open(`/studio/dashboards/preview/${dashboardId}`, '_blank');
                } else {
                  showToast("Please save the dashboard first to preview", { variant: "destructive" });
                }
              }}
              onToggleTemplates={() => setShowTemplates(!showTemplates)}
              onQuickAdd={() => setShowQuickCardCreator(true)}
              onAutoArrange={() => setShowLayoutSelector(true)}
              onUndo={undo}
              onRedo={redo}
              onExport={handleExportDashboard}
              onImport={handleImportDashboard}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
            />
          </CardContent>
        </Card>

        {/* Canvas */}
        <Card className="flex-1 border-2 border-dashed overflow-auto">
          <CardContent ref={canvasShellRef} className="h-full p-6">
            <div
              ref={canvasRef}
              className="relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 rounded-xl border-2 border-border/50 h-full min-h-[600px]"
              style={{
                width: canvasWidth,
                height: canvasHeight,
                minHeight: canvasHeight,
                margin: config.canvasMode === "fixed" ? "0 auto" : "0",
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Grid Pattern */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                    linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                  `,
                  backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                }}
              />

              {/* Snap Guides - Visual feedback during drag */}
              {snapLines.length > 0 && (
                <SnapGuides
                  snapLines={snapLines}
                  canvasWidth={config.canvasWidth || 1920}
                  canvasHeight={canvasHeight}
                />
              )}

              {/* Drop Zone Hint */}
              {cards.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                      <Grid3x3 className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Your canvas is empty</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {showTemplates
                          ? "Select a template from the sidebar to get started"
                          : "Click 'Show Templates' to add cards to your dashboard"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cards on Canvas */}
              {cards.map((card) => {
                const showTitle = card.showTitle !== false;
                const showDescription = card.showDescription !== false && Boolean(card.description);
                const showHeader = showTitle || showDescription;

                return (
                  <div
                    key={`${card.id}-${card.cardId}`}
                    className={`absolute bg-white dark:bg-slate-800 rounded-xl border-2 shadow-lg transition-all cursor-move overflow-hidden ${
                      selectedCard === card.id ? "border-primary ring-4 ring-primary/20 shadow-2xl scale-[1.02]" : "border-border hover:border-primary/50 hover:shadow-xl"
                    }`}
                    style={{
                      left: `${card.x}px`,
                      top: `${card.y}px`,
                      width: `${card.width}px`,
                      height: `${card.height}px`,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, card.id)}
                    onClick={() => setSelectedCard(card.id)}
                    onContextMenu={(e) => handleContextMenu(e, card.id)}
                  >
                    {/* Colored Header Bar */}
                    <div className={`h-3 w-full bg-gradient-to-r ${getCardTypeColor(card.cardType)}`} />

                    <div className="p-4 h-[calc(100%-12px)] flex flex-col">
                      {/* Header with Title and Close Button */}
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <div className="flex-1 min-w-0">
                          {showHeader && (
                            <>
                              {showTitle && (
                                <h4 className="font-bold text-base leading-tight truncate">{card.title}</h4>
                              )}
                              {showDescription && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.description}</p>
                              )}
                              <div className="flex gap-2 mt-1.5 flex-wrap">
                                {card.cardType && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase font-bold border border-primary/20">
                                    {card.cardType}
                                  </span>
                                )}
                                {card.layoutType && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent border uppercase font-bold">
                                    {card.layoutType}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCard(card.id);
                          }}
                          className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive rounded-lg flex-shrink-0"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>

                      {/* Content Preview Area - Realistic Card with Mock Data */}
                      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-lg overflow-hidden relative">
                        {(() => {
                          const cardType = card.cardType?.toLowerCase();

                        // KPI Card Preview - Production-ready structure with mock data
                        if (cardType === "kpi") {
                          return (
                            <div className="w-full h-full flex flex-col p-4">
                              {/* KPI Header - Uses real card title */}
                              {showHeader && (
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    {showTitle && <h4 className="text-sm font-bold text-foreground">{card.title}</h4>}
                                    {showDescription && card.description ? (
                                      <p className="text-xs text-muted-foreground">{card.description}</p>
                                    ) : showTitle ? (
                                      <p className="text-xs text-muted-foreground">Last updated: 2 min ago</p>
                                    ) : null}
                                  </div>
                                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                  </div>
                                </div>
                              )}

                              {/* Main KPI Value - Mock data */}
                              <div className="flex-1 flex flex-col justify-center">
                                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                                  94.2%
                                </div>

                                {/* Comparison & Trend */}
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-600 dark:text-emerald-400">
                                      <polyline points="18 15 12 9 6 15" />
                                    </svg>
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+5.8%</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">vs previous period</span>
                                </div>
                              </div>

                              {/* Footer Metrics */}
                              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                <div>
                                  <p className="text-xs text-muted-foreground">Current</p>
                                  <p className="text-sm font-semibold text-foreground">1,247</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Total</p>
                                  <p className="text-sm font-semibold text-foreground">1,324</p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Table/Grid Card Preview - Production-ready structure with mock data
                        if (cardType === "grid" || cardType === "table") {
                          const visibleRows = Math.floor((card.height - 120) / 32);

                          // Generic mock data for pipeline/DAG runs - adaptable to any data table
                          const mockData = [
                            { col1: "data_pipeline_v2", col2: "success", col3: "2024-01-15 14:30", col4: "5m 23s" },
                            { col1: "etl_transform_prod", col2: "running", col3: "2024-01-15 14:25", col4: "2m 10s" },
                            { col1: "ml_training_job", col2: "success", col3: "2024-01-15 14:20", col4: "12m 45s" },
                            { col1: "sync_databricks", col2: "failed", col3: "2024-01-15 14:15", col4: "1m 05s" },
                            { col1: "daily_report_gen", col2: "success", col3: "2024-01-15 14:10", col4: "3m 18s" },
                            { col1: "cleanup_staging", col2: "success", col3: "2024-01-15 14:05", col4: "45s" },
                            { col1: "backup_warehouse", col2: "running", col3: "2024-01-15 14:00", col4: "8m 32s" },
                            { col1: "validate_schema", col2: "success", col3: "2024-01-15 13:55", col4: "1m 22s" },
                          ];

                          const displayRows = mockData.slice(0, Math.max(3, visibleRows));

                          return (
                            <div className="w-full h-full flex flex-col text-xs">
                              {/* Table Header - Uses real card title */}
                              {showHeader && (
                                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                  <div className="min-w-0">
                                    {showTitle && (
                                      <span className="text-xs font-semibold text-foreground block truncate">{card.title}</span>
                                    )}
                                    {showDescription && card.description ? (
                                      <span className="text-[10px] text-muted-foreground block truncate">{card.description}</span>
                                    ) : null}
                                  </div>
                                  <div className="flex gap-1">
                                    <button className="w-5 h-5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                      </svg>
                                    </button>
                                    <button className="w-5 h-5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="m21 21-4.35-4.35" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Column Headers - Generic */}
                              <div className="grid grid-cols-4 gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border-b-2 border-emerald-500 dark:border-emerald-600">
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Name</span>
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Status</span>
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Timestamp</span>
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Duration</span>
                              </div>

                              {/* Table Rows */}
                              <div className="flex-1 overflow-hidden">
                                {displayRows.map((row, i) => (
                                  <div
                                    key={i}
                                    className={`grid grid-cols-4 gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 ${
                                      i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'
                                    }`}
                                  >
                                    <span className="text-xs text-foreground font-mono truncate">{row.col1}</span>
                                    <span className={`text-xs font-medium ${
                                      row.col2 === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                                      row.col2 === 'running' ? 'text-blue-600 dark:text-blue-400' :
                                      row.col2 === 'failed' ? 'text-red-600 dark:text-red-400' :
                                      'text-slate-600 dark:text-slate-400'
                                    }`}>
                                      {row.col2}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{row.col3}</span>
                                    <span className="text-xs text-foreground">{row.col4}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Pagination Footer */}
                              <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <span className="text-[10px] text-muted-foreground">Showing {displayRows.length} of 156 items</span>
                                <div className="flex gap-1">
                                  <button className="w-5 h-5 rounded text-xs bg-primary text-primary-foreground font-medium">1</button>
                                  <button className="w-5 h-5 rounded text-xs hover:bg-slate-200 dark:hover:bg-slate-700">2</button>
                                  <button className="w-5 h-5 rounded text-xs hover:bg-slate-200 dark:hover:bg-slate-700">3</button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Chart Card Preview - Production-ready structure with mock data
                        if (cardType === "chart") {
                          // Generic mock data - adaptable to any metric
                          const chartData = [
                            { label: 'W1', value: 65, display: '65' },
                            { label: 'W2', value: 45, display: '45' },
                            { label: 'W3', value: 85, display: '85' },
                            { label: 'W4', value: 55, display: '55' },
                            { label: 'W5', value: 75, display: '75' },
                            { label: 'W6', value: 50, display: '50' },
                            { label: 'W7', value: 80, display: '80' },
                            { label: 'W8', value: 60, display: '60' },
                          ];

                          return (
                            <div className="w-full h-full flex flex-col p-3">
                              {/* Chart Header - Uses real card title */}
                              {showHeader && (
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    {showTitle && <h4 className="text-xs font-bold text-foreground">{card.title}</h4>}
                                    {showDescription && card.description ? (
                                      <p className="text-[10px] text-muted-foreground">{card.description}</p>
                                    ) : showTitle ? (
                                      <p className="text-[10px] text-muted-foreground">Last 8 periods</p>
                                    ) : null}
                                  </div>
                                  <div className="flex gap-2 text-[10px]">
                                    <div className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                                      <span className="text-muted-foreground">Value</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Chart Area */}
                              <div className="flex-1 relative border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-900">
                                {/* Y-axis labels */}
                                <div className="absolute left-1 top-2 bottom-6 flex flex-col justify-between text-[9px] text-muted-foreground">
                                  <span>$100K</span>
                                  <span>$75K</span>
                                  <span>$50K</span>
                                  <span>$25K</span>
                                  <span>$0</span>
                                </div>

                                {/* Chart bars */}
                                <div className="h-full pl-10 pr-2 pb-5 flex items-end justify-around gap-0.5">
                                  {chartData.map((data, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center group relative">
                                      <div
                                        className="w-full bg-gradient-to-t from-amber-500 to-amber-400 dark:from-amber-600 dark:to-amber-500 rounded-t shadow transition-all hover:from-amber-600 hover:to-amber-500"
                                        style={{ height: `${data.value}%` }}
                                      />
                                      {/* Tooltip on hover */}
                                      <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
                                        {data.display}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* X-axis labels */}
                                <div className="absolute bottom-0 left-10 right-2 flex justify-around text-[9px] text-muted-foreground pb-0.5">
                                  {chartData.map((data, i) => (
                                    <span key={i} className="flex-1 text-center">{data.label}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Timeline Card Preview - Production-ready structure with mock data
                        if (cardType === "timeline") {
                          const visibleEvents = Math.floor((card.height - 70) / 55);

                          // Generic timeline events - adaptable to any workflow
                          const timelineEvents = [
                            { time: '2 hours ago', title: 'Task Completed', description: 'Process finished successfully with exit code 0', status: 'success' },
                            { time: '5 hours ago', title: 'Process Started', description: 'Execution initiated by scheduled trigger', status: 'progress' },
                            { time: '8 hours ago', title: 'Validation Passed', description: 'All checks completed without errors', status: 'success' },
                            { time: 'Yesterday', title: 'Configuration Updated', description: 'Applied new settings to production environment', status: 'success' },
                            { time: '2 days ago', title: 'Alert Triggered', description: 'Threshold exceeded - immediate attention required', status: 'warning' },
                            { time: '3 days ago', title: 'Backup Completed', description: 'Full snapshot created and verified', status: 'success' },
                          ];

                          const displayEvents = timelineEvents.slice(0, Math.max(3, visibleEvents));

                          return (
                            <div className="w-full h-full flex flex-col p-3">
                              {/* Timeline Header - Uses real card title */}
                              {showHeader && (
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    {showTitle && <h4 className="text-xs font-bold text-foreground">{card.title}</h4>}
                                    {showDescription && card.description ? (
                                      <p className="text-[10px] text-muted-foreground">{card.description}</p>
                                    ) : null}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">{displayEvents.length} recent</span>
                                </div>
                              )}

                              {/* Timeline Events */}
                              <div className="flex-1 relative overflow-hidden">
                                {/* Timeline Line */}
                                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-purple-200 dark:bg-purple-800" />

                                <div className="space-y-3">
                                  {displayEvents.map((event, i) => (
                                    <div key={i} className="flex gap-2 relative">
                                      {/* Timeline Dot */}
                                      <div className="relative z-10 flex-shrink-0">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 ${
                                          event.status === 'success' ? 'bg-emerald-500 dark:bg-emerald-600' :
                                          event.status === 'progress' ? 'bg-blue-500 dark:bg-blue-600' :
                                          event.status === 'warning' ? 'bg-amber-500 dark:bg-amber-600' :
                                          'bg-purple-500 dark:bg-purple-600'
                                        }`}>
                                          {event.status === 'success' && (
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                              <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                          )}
                                          {event.status === 'progress' && (
                                            <Clock className="w-3 h-3 text-white" />
                                          )}
                                          {event.status === 'warning' && (
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                              <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                                            </svg>
                                          )}
                                        </div>
                                      </div>

                                      {/* Event Content */}
                                      <div className="flex-1 pb-1">
                                        <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                                          <div className="flex items-start justify-between gap-2 mb-1">
                                            <h5 className="text-[11px] font-semibold text-foreground leading-tight">{event.title}</h5>
                                            <span className="text-[9px] text-muted-foreground whitespace-nowrap">{event.time}</span>
                                          </div>
                                          <p className="text-[10px] text-muted-foreground">{event.description}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Default Preview
                        return (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4">
                            {getCardTypeIcon(card.cardType)}
                            <p className="text-xs text-muted-foreground mt-2 font-medium">
                              {card.cardType || "Card"} Preview
                            </p>
                            <div className="mt-4 space-y-2 w-full max-w-[200px]">
                              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-3/4" />
                              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-1/2" />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Position Indicator */}
                      <div className="absolute bottom-1 right-1 text-[9px] font-mono text-muted-foreground/40 bg-background/90 px-1.5 py-0.5 rounded shadow-sm">
                        {card.width}x{card.height}
                      </div>
                    </div>
                  </div>

                  {/* Resize Handles - Show only when selected */}
                  {selectedCard === card.id && (
                    <>
                      {/* Corner Handles */}
                      <div
                        className="absolute -top-1 -left-1 w-3 h-3 bg-primary border-2 border-white rounded-full cursor-nw-resize"
                        onMouseDown={(e) => handleResizeStart(e, card.id, 'nw')}
                      />
                      <div
                        className="absolute -top-1 -right-1 w-3 h-3 bg-primary border-2 border-white rounded-full cursor-ne-resize"
                        onMouseDown={(e) => handleResizeStart(e, card.id, 'ne')}
                      />
                      <div
                        className="absolute -bottom-1 -left-1 w-3 h-3 bg-primary border-2 border-white rounded-full cursor-sw-resize"
                        onMouseDown={(e) => handleResizeStart(e, card.id, 'sw')}
                      />
                      <div
                        className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary border-2 border-white rounded-full cursor-se-resize"
                        onMouseDown={(e) => handleResizeStart(e, card.id, 'se')}
                      />
                      {/* Edge Handles */}
                      <div
                        className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-primary border border-white rounded-full cursor-n-resize"
                        onMouseDown={(e) => handleResizeStart(e, card.id, 'n')}
                      />
                      <div
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-primary border border-white rounded-full cursor-s-resize"
                        onMouseDown={(e) => handleResizeStart(e, card.id, 's')}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-8 bg-primary border border-white rounded-full cursor-w-resize"
                        onMouseDown={(e) => handleResizeStart(e, card.id, 'w')}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-8 bg-primary border border-white rounded-full cursor-e-resize"
                        onMouseDown={(e) => handleResizeStart(e, card.id, 'e')}
                      />
                    </>
                  )}
                </div>
                );
              })}

              {/* Context Menu */}
              {contextMenu && (
                <div
                  className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-2xl border-2 border-border py-2 z-50 min-w-[200px]"
                  style={{
                    left: `${contextMenu.x}px`,
                    top: `${contextMenu.y}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-3 text-sm"
                    onClick={() => {
                      setBasicConfiguringCard(contextMenu.cardId);
                      setContextMenu(null);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.82-.34 1.7 1.7 0 0 0-1 1.54V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.82.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.82 1.7 1.7 0 0 0-1.54-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.54-1 1.7 1.7 0 0 0-.34-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.82.34h.06A1.7 1.7 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09c0 .7.43 1.34 1.08 1.6.65.27 1.39.1 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.43.43-.6 1.17-.33 1.82.26.65.9 1.08 1.6 1.08H21a2 2 0 1 1 0 4h-.09c-.7 0-1.34.43-1.51 1z" />
                    </svg>
                    {t("studioDashboardCardEditBasic")}
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-3 text-sm"
                    onClick={() => {
                      console.log('[Configure Card] Looking for card with id:', contextMenu.cardId);
                      console.log('[Configure Card] Available cards:', cards.map(c => ({ id: c.id, cardId: c.cardId, dataSourceJson: c.dataSourceJson })));
                      // contextMenu.cardId is actually the card's internal ID (not the database cardId)
                      const card = cards.find(c => c.id === contextMenu.cardId);
                      console.log('[Configure Card] Found card:', card);
                      if (card) {
                        // Capture original state for change detection
                        setOriginalCardData(card.dataSourceJson || null);
                        console.log('[Configure Card] Captured originalCardData:', card.dataSourceJson || null);
                      } else {
                        console.warn('[Configure Card] Card not found with id:', contextMenu.cardId);
                      }
                      setConfiguringCard(contextMenu.cardId);
                      setContextMenu(null);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v6m0 6v6m8.66-13L17 9.5M7 14.5 3.34 18M23 12h-6M7 12H1m17.66 5L17 14.5M7 9.5 3.34 6" />
                    </svg>
                    {t("studioDashboardCardEditData")}
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-3 text-sm"
                    onClick={() => handleDuplicateCard(contextMenu.cardId)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    {t("studioDashboardCardActionDuplicate")}
                  </button>
                  <div className="h-px bg-border my-1" />
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-3 text-sm"
                    onClick={() => handleBringToFront(contextMenu.cardId)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="17 11 12 6 7 11" />
                      <polyline points="17 18 12 13 7 18" />
                    </svg>
                    {t("studioDashboardCardActionBringFront")}
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-3 text-sm"
                    onClick={() => handleSendToBack(contextMenu.cardId)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="7 13 12 18 17 13" />
                      <polyline points="7 6 12 11 17 6" />
                    </svg>
                    {t("studioDashboardCardActionSendBack")}
                  </button>
                  <div className="h-px bg-border my-1" />
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-destructive/10 hover:text-destructive flex items-center gap-3 text-sm"
                    onClick={() => {
                      handleRemoveCard(contextMenu.cardId);
                      setContextMenu(null);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    {t("studioDashboardCardActionDelete")}
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Basic Card Dialog */}
      <Dialog open={basicConfiguringCard !== null} onOpenChange={() => setBasicConfiguringCard(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{t("studioDashboardCardBasicTitle")}</DialogTitle>
          </DialogHeader>

          {basicConfiguringCard !== null && (() => {
            const card = cards.find(c => c.id === basicConfiguringCard);
            if (!card) return null;

            return (
              <div className="space-y-6 py-4">
                <div className="flex items-center gap-4 p-4 bg-accent/50 rounded-lg border-2">
                  {getCardTypeIcon(card.cardType)}
                  <div>
                    <h3 className="font-bold text-lg">{card.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {card.cardType} - {card.layoutType}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-border bg-background p-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("studioDashboardCardTitle")}</Label>
                    <Input
                      value={card.title}
                      onChange={(event) => updateCardById(card.id, { title: event.target.value })}
                      placeholder={t("studioDashboardCardTitlePlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("studioDashboardCardDescription")}</Label>
                    <Input
                      value={card.description ?? ""}
                      onChange={(event) => updateCardById(card.id, { description: event.target.value })}
                      placeholder={t("studioDashboardCardDescriptionPlaceholder")}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t("studioDashboardShowTitle")}</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
                        value={card.showTitle === false ? "no" : "yes"}
                        onChange={(event) => updateCardById(card.id, { showTitle: event.target.value === "yes" })}
                      >
                        <option value="yes">{t("yes")}</option>
                        <option value="no">{t("no")}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t("studioDashboardShowDescription")}</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
                        value={card.showDescription === false ? "no" : "yes"}
                        onChange={(event) => updateCardById(card.id, { showDescription: event.target.value === "yes" })}
                      >
                        <option value="yes">{t("yes")}</option>
                        <option value="no">{t("no")}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 rounded-lg border border-border bg-background p-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("studioPositionX")}</Label>
                    <Input
                      type="number"
                      value={card.x}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isNaN(next)) return;
                        updateCardById(card.id, { x: Math.max(0, snapToGrid(next)) });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("studioPositionY")}</Label>
                    <Input
                      type="number"
                      value={card.y}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isNaN(next)) return;
                        updateCardById(card.id, { y: Math.max(0, snapToGrid(next)) });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("studioDashboardCardWidth")}</Label>
                    <Input
                      type="number"
                      value={card.width}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isNaN(next)) return;
                        updateCardById(card.id, { width: Math.max(MIN_CARD_WIDTH, snapToGrid(next)) });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("studioDashboardCardHeight")}</Label>
                    <Input
                      type="number"
                      value={card.height}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isNaN(next)) return;
                        updateCardById(card.id, { height: Math.max(MIN_CARD_HEIGHT, snapToGrid(next)) });
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Configuration Dialog */}
      <Dialog open={configuringCard !== null} onOpenChange={() => {
        setConfiguringCard(null);
        setOriginalCardData(null);
        setCurrentCardIntegration(null);
        setSelectedClientId(null);
        setSelectedCompanyId(null);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{t("studioDashboardCardDataTitle")}</DialogTitle>
          </DialogHeader>

          {configuringCard !== null && (() => {
            const card = cards.find(c => c.id === configuringCard);
            if (!card) return null;

            // Filter companies based on selected client
            const filteredCompanies = selectedClientId
              ? companies.filter(c => c.clientId === selectedClientId)
              : companies;

            return (
              <div className="space-y-6 py-4">
                {/* Card Info */}
                <div className="flex items-center gap-4 p-4 bg-accent/50 rounded-lg border-2">
                  {getCardTypeIcon(card.cardType)}
                  <div>
                    <h3 className="font-bold text-lg">{card.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {card.cardType} - {card.layoutType}
                    </p>
                  </div>
                </div>

                {/* EDIT MODE - Show selection controls */}
                {(editingIntegration || !card.integrationId) && (
                  <>
                    {/* Cancel button if editing existing integration */}
                    {card.integrationId && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingIntegration(false)}
                        >
                          {t("cardConfigIntegrationCancelBtn")}
                        </Button>
                      </div>
                    )}

                    {/* Hierarchical Selection: Client -> Company -> Integration */}
                    <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">Access Scope</h4>
                          <p className="text-xs text-muted-foreground">Select client and company to filter integrations</p>
                        </div>
                      </div>

                  {/* Client Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="client" className="text-sm font-medium">
                      Client <span className="text-muted-foreground font-normal">(Optional - Platform Admin)</span>
                    </Label>
                    <select
                      id="client"
                      className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
                      value={selectedClientId || ""}
                      onChange={(e) => {
                        const clientId = e.target.value ? Number(e.target.value) : null;
                        setSelectedClientId(clientId);
                        setSelectedCompanyId(null); // Reset company when client changes
                      }}
                    >
                      <option value="">All Clients (Platform Admin View)</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.companyCount > 0 ? `(${client.companyCount} companies)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Company Selection - Only show if client is selected */}
                  {selectedClientId && (
                    <div className="space-y-2">
                      <Label htmlFor="company" className="text-sm font-medium">
                        Company <span className="text-muted-foreground font-normal">(Optional)</span>
                      </Label>
                      <select
                        id="company"
                        className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
                        value={selectedCompanyId || ""}
                        onChange={(e) => {
                          const companyId = e.target.value ? Number(e.target.value) : null;
                          setSelectedCompanyId(companyId);
                        }}
                      >
                        <option value="">All Companies (Client Level)</option>
                        {filteredCompanies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Current Scope Indicator */}
                  <div className="p-3 bg-background rounded border text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Current Scope:</span>
                      {!selectedClientId && !selectedCompanyId && (
                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded font-medium">
                          Platform Admin - All Integrations
                        </span>
                      )}
                      {selectedClientId && !selectedCompanyId && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium">
                          Client: {clients.find(c => c.id === selectedClientId)?.name}
                        </span>
                      )}
                      {selectedCompanyId && (
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded font-medium">
                          Company: {companies.find(c => c.id === selectedCompanyId)?.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                  </>
                )}

                {/* Integration Section */}
                {!editingIntegration && card.integrationId ? (
                  // VIEW MODE - Show current integration with change button
                  <div className="space-y-3">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-700 dark:text-emerald-300">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 1v6m0 6v6" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                            {t("cardConfigIntegrationCurrent")}
                          </p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t("cardConfigIntegrationName")}:</span>
                              <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                                {currentCardIntegration?.name || card.integrationName || `ID: ${card.integrationId}`}
                              </span>
                            </div>
                            {currentCardIntegration?.clientId && (() => {
                              const client = clients.find(c => c.id === currentCardIntegration.clientId);
                              return client && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t("cardConfigIntegrationClient")}:</span>
                                  <span className="text-xs text-emerald-800 dark:text-emerald-200">{client.name}</span>
                                </div>
                              );
                            })()}
                            {currentCardIntegration && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Tipo:</span>
                                <span className="text-xs text-emerald-800 dark:text-emerald-200">{currentCardIntegration.type}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                            {t("cardConfigIntegrationConnected")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditingIntegration(true)}
                        className="flex-1"
                      >
                        {t("cardConfigIntegrationChangeBtn")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setCards(cards.map(c =>
                            c.id === configuringCard
                              ? { ...c, integrationId: undefined, integrationName: undefined }
                              : c
                          ));
                          setEditingIntegration(true);
                        }}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        {t("cardConfigIntegrationRemoveBtn")}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {/* EDIT MODE - Integration Selection */}
                {(editingIntegration || !card.integrationId) && (
                  <>
                    {/* Show cancel button if there's already an integration configured */}
                    {card.integrationId && (
                      <div className="mb-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingIntegration(false)}
                        >
                          {t("cardConfigIntegrationCancelBtn")}
                        </Button>
                      </div>
                    )}

                    {/* Integration Selection */}
                    <div className="space-y-3">
                      <Label htmlFor="integration" className="text-base font-semibold">
                        {t("cardConfigIntegrationSelect")}
                      </Label>
                      <select
                        id="integration"
                        className="w-full h-11 px-3 rounded-md border border-border bg-background text-base"
                        value={card.integrationId || ""}
                        onChange={(e) => {
                          const integrationId = e.target.value ? Number(e.target.value) : undefined;
                          const integration = integrations.find(i => i.id === integrationId);
                          setCards(cards.map(c =>
                            c.id === configuringCard
                              ? { ...c, integrationId, integrationName: integration?.name }
                              : c
                          ));
                        }}
                      >
                        <option value="">Select an integration...</option>
                        {integrations.map((integration) => (
                          <option key={integration.id} value={integration.id}>
                            {integration.name} ({integration.type})
                            {integration.clientId && ` - Client ID: ${integration.clientId}`}
                          </option>
                        ))}
                      </select>
                      <p className="text-sm text-muted-foreground">
                        {integrations.length === 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            No integrations available for the selected scope
                          </span>
                        ) : (
                          `${integrations.length} integration${integrations.length !== 1 ? 's' : ''} available`
                        )}
                      </p>
                    </div>
                  </>
                )}

                {/* Query Configuration */}
                {card.integrationId && (
                  <>
                    <QueryEditor
                      query={card.query}
                      integrationId={card.integrationId}
                      cardType={card.cardType}
                      layoutType={card.layoutType}
                      fieldsJson={card.fieldsJson}
                      styleJson={card.styleJson}
                      layoutJson={card.layoutJson}
                      refreshPolicyJson={card.refreshPolicyJson}
                      dataSourceJson={card.dataSourceJson}
                      onChange={(query) => {
                        setCards(cards.map(c =>
                          c.id === configuringCard
                            ? { ...c, query }
                            : c
                        ));
                      }}
                      onTestSuccess={(signature, testedAt) => {
                        setCardTestResults(prev => ({
                          ...prev,
                          [card.cardId]: { signature, testedAt }
                        }));
                      }}
                    />

                    {/* Advanced Settings */}
                    {(() => {
                      // Use currentCardIntegration if available, otherwise search in integrations list
                      const integration = currentCardIntegration || integrations.find(i => i.id === card.integrationId);

                      if (!integration) {
                        console.log('[DashboardCanvas] No integration found for card', card.integrationId);
                        console.log('[DashboardCanvas] currentCardIntegration:', currentCardIntegration);
                        console.log('[DashboardCanvas] integrations list:', integrations);
                        return null;
                      }

                      console.log('[DashboardCanvas] Using integration:', {
                        id: integration.id,
                        type: integration.type,
                        name: integration.name,
                        source: currentCardIntegration ? 'currentCardIntegration' : 'integrations list'
                      });

                      return (
                        <CardAdvancedSettings
                          integrationType={integration.type}
                          integrationId={integration.id}
                          dataSourceJson={card.dataSourceJson}
                          onChange={(dataSourceJson) => {
                            setCards(cards.map(c =>
                              c.id === configuringCard
                                ? { ...c, dataSourceJson }
                                : c
                            ));
                          }}
                        />
                      );
                    })()}
                  </>
                )}
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setConfiguringCard(null);
              setOriginalCardData(null);
              setCurrentCardIntegration(null);
              setSelectedClientId(null);
              setSelectedCompanyId(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                console.log('[Save Configuration] Button clicked!');
                if (configuringCard !== null) {
                  const card = cards.find(c => c.id === configuringCard);
                  console.log('[Save Configuration] Found card:', card);
                  if (card) {
                    // Check if dataSourceJson changed
                    const currentData = card.dataSourceJson || null;
                    const hasDataSourceChanges = currentData !== originalCardData;

                    // Check if test is required
                    const requiresTest = card.integrationId && card.query && card.query.trim() !== "";
                    const testResult = cardTestResults[card.cardId];

                    console.log('[Save Configuration] hasDataSourceChanges:', hasDataSourceChanges, 'requiresTest:', requiresTest, 'testResult:', testResult);

                    // If only dataSourceJson changed, allow save without re-test
                    // Only block if: (requires test AND no test) AND (no dataSourceJson changes)
                    if (requiresTest && !testResult && !hasDataSourceChanges) {
                      console.log('[Save Configuration] Blocking save - needs test and no changes to dataSource');
                      showToast("Please test the query before saving", { variant: "destructive" });
                      return;
                    }

                    if (hasDataSourceChanges) {
                      console.log('[Save Configuration] Allowing save because dataSourceJson changed');
                    }

                    try {
                      console.log("Card from canvas:", card);
                      console.log("Captured test result:", testResult);

                      const updatePayload = {
                        query: card.query,
                        fieldsJson: card.fieldsJson,
                        styleJson: card.styleJson,
                        layoutJson: card.layoutJson,
                        refreshPolicyJson: card.refreshPolicyJson,
                        // Include test signature and timestamp from captured test result
                        testSignature: testResult?.signature,
                        testedAt: testResult?.testedAt?.toISOString(),
                      };

                      console.log("Update payload:", updatePayload);

                      // Update the card with integration and query configuration
                      await updateCard(card.cardId, updatePayload);

                      if (dashboardId) {
                        const dashboardCards: UpsertStudioDashboardCardRequest[] = cards.map((canvasCard, index) => ({
                          id: canvasCard.id > 0 ? canvasCard.id : undefined,
                          cardId: canvasCard.cardId,
                          integrationId: canvasCard.integrationId,
                          orderIndex: index,
                          positionX: canvasCard.x,
                          positionY: canvasCard.y,
                          width: canvasCard.width,
                          height: canvasCard.height,
                          dataSourceJson: canvasCard.dataSourceJson ?? null,
                        }));

                        await updateDashboard(dashboardId, { cards: dashboardCards });
                      }

                      // Reload the card from backend to get updated data
                      const updatedCardDetail = await getCard(card.cardId);

                      // Find integration name from current integrations list
                      const integration = integrations.find(i => i.id === updatedCardDetail.integrationId);

                      // Update the card in local state with fresh data from backend
                      setCards(cards.map(c =>
                        c.cardId === card.cardId
                          ? {
                              ...c,
                              integrationName: integration?.name,
                              query: updatedCardDetail.query,
                              fieldsJson: updatedCardDetail.fieldsJson,
                              styleJson: updatedCardDetail.styleJson,
                              layoutJson: updatedCardDetail.layoutJson,
                              refreshPolicyJson: updatedCardDetail.refreshPolicyJson,
                            }
                          : c
                      ));

                      showToast("Card configuration saved", { variant: "success" });

                      setConfiguringCard(null);
                      setOriginalCardData(null);
                      setCurrentCardIntegration(null);
                      setSelectedClientId(null);
                      setSelectedCompanyId(null);
                    } catch (error: any) {
                      console.error("Failed to save card configuration:", error);

                      // Extract error message
                      let errorMessage = "Failed to save card configuration";
                      if (error.response?.data?.message) {
                        errorMessage = error.response.data.message;
                      } else if (error.message) {
                        errorMessage = error.message;
                      }

                      showToast(errorMessage, { variant: "destructive" });
                    }
                  }
                }
              }}
              disabled={(() => {
                const card = configuringCard !== null ? cards.find(c => c.id === configuringCard) : null;
                if (!card) return true; // Disable if no card

                // Check if dataSourceJson has changed
                const currentData = card.dataSourceJson || null;
                const hasDataSourceChanges = currentData !== originalCardData;

                // Check if test is required (only if query exists)
                const requiresTest = card.integrationId && card.query && card.query.trim() !== "";
                const hasTest = cardTestResults[card.cardId];

                // Allow save if only dataSourceJson changed (no test needed for that)
                // Only require test if query/integration changed
                const needsTest = requiresTest && !hasTest;

                console.log('[Save Button] hasDataSourceChanges:', hasDataSourceChanges, 'needsTest:', needsTest, 'requiresTest:', requiresTest, 'hasTest:', hasTest);
                console.log('[Save Button] currentData:', currentData);
                console.log('[Save Button] originalData:', originalCardData);

                // Enable button if: (has changes to dataSourceJson) OR (has test when needed)
                // Disable if: (requires test AND no test) AND (no dataSourceJson changes)
                if (hasDataSourceChanges) {
                  console.log('[Save Button] Returning FALSE (button ENABLED) because hasDataSourceChanges=true');
                  return false; // Always enable if dataSourceJson changed
                }

                const result = needsTest;
                console.log('[Save Button] Returning', result, '(button', result ? 'DISABLED' : 'ENABLED', ') because needsTest=', needsTest);
                return result; // Otherwise, disable only if test is needed but missing
              })()}
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Card Creator Modal */}
      <QuickCardCreator
        open={showQuickCardCreator}
        onClose={() => setShowQuickCardCreator(false)}
        onCardCreated={handleQuickCardCreated}
        profileId={config.profileId}
      />

      {/* Layout Selector Modal */}
      <LayoutSelector
        open={showLayoutSelector}
        onClose={() => setShowLayoutSelector(false)}
        onSelectLayout={(layoutType) => {
          // This will be called when user selects a layout type
          // We need to apply the layout algorithm to the cards
          const { arrangeGrid, arrangeMasonry, arrangeDashboard, arrangeFocus, arrangeSidebar } = require("@/lib/canvasLayouts");

          let newCards: CanvasCard[] = [];
          switch (layoutType) {
            case "grid":
              newCards = arrangeGrid(cards, config.canvasWidth || 1920);
              break;
            case "masonry":
              newCards = arrangeMasonry(cards, config.canvasWidth || 1920);
              break;
            case "dashboard":
              newCards = arrangeDashboard(cards, config.canvasWidth || 1920);
              break;
            case "focus":
              newCards = arrangeFocus(cards, config.canvasWidth || 1920);
              break;
            case "sidebar":
              newCards = arrangeSidebar(cards, config.canvasWidth || 1920);
              break;
            default:
              newCards = cards;
          }

          setCards(newCards);
          setShowLayoutSelector(false);
          showToast("Layout applied", { variant: "success" });
        }}
      />

      {/* Dashboard Template Selector Modal */}
      <DashboardTemplateSelector
        open={showDashboardTemplateSelector}
        onClose={() => setShowDashboardTemplateSelector(false)}
        onSelectTemplate={handleApplyDashboardTemplate}
      />
    </div>
  );
}
