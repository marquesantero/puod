import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Plus, Layers, Grid3x3 } from "lucide-react";
import { TemplateGallery } from "../TemplateGallery";
import type { DashboardConfig } from "./DashboardWizard";

interface DashboardCanvasProps {
  config: DashboardConfig;
  dashboardId?: number; // Used to determine if editing existing dashboard
  onSave: (cards: any[]) => void;
  onBack: () => void;
}

interface CanvasCard {
  id: string;
  cardId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
}

export function DashboardCanvas({ config, dashboardId: _dashboardId, onSave, onBack }: DashboardCanvasProps) {
  const [cards, setCards] = useState<CanvasCard[]>([]);
  const [showTemplates, setShowTemplates] = useState(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const handleAddCard = (templateCardId: number) => {
    // Add card to canvas at next available position
    const newCard: CanvasCard = {
      id: `card-${Date.now()}`,
      cardId: templateCardId,
      x: 0,
      y: cards.length * 200, // Stack vertically for now
      width: 400,
      height: 200,
      title: `Card ${cards.length + 1}`,
    };
    setCards([...cards, newCard]);
  };

  const handleRemoveCard = (cardId: string) => {
    setCards(cards.filter(c => c.id !== cardId));
  };

  const handleSave = () => {
    onSave(cards);
  };

  const canvasWidth = config.canvasMode === "fixed" ? `${config.canvasWidth}px` : "100%";

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* Sidebar com Templates */}
      <div
        className={`transition-all duration-300 ${
          showTemplates ? "w-80" : "w-0"
        } overflow-hidden`}
      >
        <Card className="h-full flex flex-col border-2">
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
        </Card>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Toolbar */}
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {!showTemplates && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTemplates(true)}
                    className="gap-2"
                  >
                    <Layers className="w-4 h-4" />
                    Show Templates
                  </Button>
                )}
                <div className="border-l pl-4">
                  <h2 className="font-bold text-lg">{config.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {cards.length} card{cards.length !== 1 ? "s" : ""} • {config.canvasMode} mode
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onBack} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button onClick={handleSave} className="gap-2 shadow-lg">
                  <Save className="w-4 h-4" />
                  Save Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Canvas */}
        <Card className="flex-1 border-2 border-dashed overflow-auto">
          <CardContent className="h-full p-6">
            <div
              className="relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 rounded-xl border-2 border-border/50 h-full min-h-[600px]"
              style={{ width: canvasWidth, margin: config.canvasMode === "fixed" ? "0 auto" : "0" }}
            >
              {/* Grid Pattern */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                    linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                  `,
                  backgroundSize: "40px 40px",
                }}
              />

              {/* Drop Zone Hint */}
              {cards.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
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
                    {!showTemplates && (
                      <Button
                        onClick={() => setShowTemplates(true)}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Show Templates
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Cards on Canvas */}
              {cards.map((card) => (
                <div
                  key={card.id}
                  className={`absolute bg-white dark:bg-slate-800 rounded-xl border-2 shadow-lg transition-all cursor-move ${
                    selectedCard === card.id ? "border-primary ring-2 ring-primary/20" : "border-border"
                  }`}
                  style={{
                    left: `${card.x}px`,
                    top: `${card.y}px`,
                    width: `${card.width}px`,
                    height: `${card.height}px`,
                  }}
                  onClick={() => setSelectedCard(card.id)}
                >
                  <div className="p-4 h-full flex flex-col">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-sm">{card.title}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCard(card.id);
                        }}
                        className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </Button>
                    </div>
                    <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                      Card Preview
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
