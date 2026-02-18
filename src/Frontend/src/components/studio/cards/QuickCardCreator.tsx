// @ts-nocheck
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Code, Wand2, Loader2 } from "lucide-react";
import { CardTemplatesBrowser } from "./CardTemplatesBrowser";
import { VisualQueryBuilder } from "./VisualQueryBuilder";
import { CardDataRenderer } from "./CardDataRenderer";
import { createStudioCard as createCard } from "@/lib/studioApi";
import { getIntegrations, type IntegrationListResponse, executeQuery } from "@/lib/biIntegrationApi";
import { fillTemplate, type CardTemplate } from "@/lib/cardTemplates";
import { useToast } from "@/contexts/ToastContext";


interface QuickCardCreatorProps {
  open: boolean;
  onClose: () => void;
  onCardCreated: (cardId: number) => void;
  profileId?: number;
  clientId?: number;
}

type CreationMode = "template" | "scratch";
type CardType = "kpi" | "table" | "grid" | "chart" | "timeline";

export function QuickCardCreator({ open, onClose, onCardCreated, profileId, clientId }: QuickCardCreatorProps) {
  const { showToast } = useToast();

  // Mode & Steps
  const [mode, setMode] = useState<CreationMode>("template");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Card Configuration
  const [cardTitle, setCardTitle] = useState("");
  const [cardType, setCardType] = useState<CardType>("kpi");
  const [layoutType, setLayoutType] = useState("single");
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplate | null>(null);
  const [templatePlaceholders, setTemplatePlaceholders] = useState<Record<string, string>>({});

  // Data Source
  const [integrations, setIntegrations] = useState<IntegrationListResponse[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<number | undefined>();
  const [query, setQuery] = useState("");
  const [, setQueryMode] = useState<"visual" | "sql">("visual");

  // Preview
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [previewError, setPreviewError] = useState<string | undefined>();

  // Creation
  const [creating, setCreating] = useState(false);

  // Load integrations
  useEffect(() => {
    if (open) {
      loadIntegrations();
    }
  }, [open, profileId, clientId]);

  // Auto-preview when query changes
  useEffect(() => {
    if (selectedIntegration && query && step === 3) {
      const debounce = setTimeout(() => {
        loadPreview();
      }, 1000);
      return () => clearTimeout(debounce);
    }
  }, [query, selectedIntegration, step]);

  const loadIntegrations = async () => {
    try {
      const data = await getIntegrations(profileId);
      setIntegrations(data);
      if (data.length > 0) {
        setSelectedIntegration(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load integrations:", error);
    }
  };

  const loadPreview = async () => {
    if (!selectedIntegration || !query) return;

    setPreviewLoading(true);
    setPreviewError(undefined);

    try {
      const result = await executeQuery({
        integrationId: selectedIntegration,
        query,
      });
      setPreviewData(result);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Failed to load preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleTemplateSelect = (template: CardTemplate) => {
    setSelectedTemplate(template);
    setCardTitle(template.name);
    setCardType(template.cardType);
    setLayoutType(template.layoutType);

    // Initialize placeholders with defaults
    const placeholders: Record<string, string> = {};
    template.placeholders?.forEach((p) => {
      placeholders[p.key] = p.default;
    });
    setTemplatePlaceholders(placeholders);

    // Generate initial query
    const initialQuery = fillTemplate(template, placeholders);
    setQuery(initialQuery);
    setQueryMode("sql"); // Templates start in SQL mode

    setStep(2);
  };

  const handleCreateCard = async () => {
    if (!cardTitle) {
      showToast("Please enter a card title", { variant: "destructive" });
      return;
    }

    if (!query) {
      showToast("Please configure a query", { variant: "destructive" });
      return;
    }

    setCreating(true);

    try {
      const newCard = await createCard({
        title: cardTitle,
        cardType,
        layoutType,
        scope: clientId ? 1 : 2, // Client or Company
        clientId,
        profileId,
        integrationId: selectedIntegration,
        query,
        status: 2, // Published
      });

      showToast("Card created successfully!", { variant: "success" });
      onCardCreated(newCard.id);
      handleReset();
      onClose();
    } catch (error) {
      console.error("Failed to create card:", error);
      showToast("Failed to create card", { variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleReset = () => {
    setMode("template");
    setStep(1);
    setCardTitle("");
    setCardType("kpi");
    setLayoutType("single");
    setSelectedTemplate(null);
    setTemplatePlaceholders({});
    setQuery("");
    setQueryMode("visual");
    setPreviewData(null);
    setPreviewError(undefined);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            Quick Card Creator
          </DialogTitle>
          <DialogDescription>
            Create a new card in 3 easy steps: choose template, configure data, and preview
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 px-6 py-3 bg-muted/50 rounded-lg">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm ${
                  step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              <div className="flex-1 ml-2">
                <p className={`text-xs font-medium ${step >= s ? "text-foreground" : "text-muted-foreground"}`}>
                  {s === 1 && "Choose Template"}
                  {s === 2 && "Configure Data"}
                  {s === 3 && "Preview & Create"}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {step === 1 && (
            <Tabs value={mode} onValueChange={(v) => setMode(v as CreationMode)} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="template" className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  From Template
                </TabsTrigger>
                <TabsTrigger value="scratch" className="gap-2">
                  <Code className="w-4 h-4" />
                  From Scratch
                </TabsTrigger>
              </TabsList>

              <TabsContent value="template" className="flex-1 overflow-hidden mt-4">
                <CardTemplatesBrowser onSelectTemplate={handleTemplateSelect} />
              </TabsContent>

              <TabsContent value="scratch" className="flex-1 overflow-auto mt-4 p-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Card Title *</Label>
                    <Input
                      placeholder="e.g., Total Revenue"
                      value={cardTitle}
                      onChange={(e) => setCardTitle(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Card Type *</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-border bg-background"
                        value={cardType}
                        onChange={(e) => setCardType(e.target.value as CardType)}
                      >
                        <option value="kpi">KPI</option>
                        <option value="table">Table</option>
                        <option value="grid">Grid</option>
                        <option value="chart">Chart</option>
                        <option value="timeline">Timeline</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Layout Type</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-border bg-background"
                        value={layoutType}
                        onChange={(e) => setLayoutType(e.target.value)}
                      >
                        <option value="single">Single</option>
                        <option value="list">List</option>
                        <option value="grid">Grid</option>
                        <option value="vertical">Vertical</option>
                      </select>
                    </div>
                  </div>

                  <Button onClick={() => setStep(2)} className="w-full">
                    Continue to Data Configuration →
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {step === 2 && (
            <div className="h-full overflow-auto p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Card Title *</Label>
                  <Input value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Integration *</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-border bg-background"
                    value={selectedIntegration}
                    onChange={(e) => setSelectedIntegration(Number(e.target.value))}
                  >
                    <option value="">Select integration...</option>
                    {integrations.map((int) => (
                      <option key={int.id} value={int.id}>
                        {int.name} ({int.type})
                      </option>
                    ))}
                  </select>
                  {integrations.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ No integrations available. Please create a BI integration first to use data-driven cards.
                    </p>
                  )}
                </div>

                {/* Template Placeholders */}
                {selectedTemplate && selectedTemplate.placeholders && selectedTemplate.placeholders.length > 0 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Template Configuration</p>
                    {selectedTemplate.placeholders.map((placeholder) => (
                      <div key={placeholder.key} className="space-y-1">
                        <Label className="text-xs">{placeholder.label}</Label>
                        <Input
                          value={templatePlaceholders[placeholder.key] || ""}
                          onChange={(e) => {
                            const newPlaceholders = { ...templatePlaceholders, [placeholder.key]: e.target.value };
                            setTemplatePlaceholders(newPlaceholders);
                            const newQuery = fillTemplate(selectedTemplate, newPlaceholders);
                            setQuery(newQuery);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Query Builder */}
                <VisualQueryBuilder
                  integrationId={selectedIntegration}
                  initialQuery={query}
                  onQueryChange={setQuery}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  ← Back
                </Button>
                <Button onClick={() => setStep(3)} disabled={!query || !selectedIntegration} className="flex-1">
                  Preview & Create →
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex-1 grid grid-cols-2 gap-6 p-6 overflow-hidden">
                {/* Left: Query Editor */}
                <div className="space-y-4 overflow-auto">
                  <div>
                    <h3 className="font-semibold mb-2">Final Configuration</h3>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Title</Label>
                        <p className="font-medium">{cardTitle}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Type</Label>
                        <p className="font-medium capitalize">{cardType}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Integration</Label>
                        <p className="font-medium">{integrations.find((i) => i.id === selectedIntegration)?.name}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Query</Label>
                    <textarea
                      className="w-full h-64 px-3 py-2 rounded-md border border-border bg-background font-mono text-xs resize-none"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>

                  <Button onClick={loadPreview} variant="outline" className="w-full gap-2" disabled={previewLoading}>
                    {previewLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading Preview...
                      </>
                    ) : (
                      <>Refresh Preview</>
                    )}
                  </Button>
                </div>

                {/* Right: Live Preview */}
                <div className="border-2 border-dashed rounded-lg overflow-hidden flex flex-col">
                  <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-3 border-b">
                    <h3 className="font-semibold text-sm">Live Preview</h3>
                  </div>
                  <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 overflow-auto">
                    <div className="p-4" style={{ minHeight: "400px" }}>
                      <CardDataRenderer
                        cardType={cardType}
                        layoutType={layoutType}
                        title={cardTitle}
                        integrationId={selectedIntegration}
                        queryData={previewData}
                        loading={previewLoading}
                        error={previewError}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 p-6 border-t">
                <Button variant="outline" onClick={() => setStep(2)}>
                  ← Back
                </Button>
                <Button onClick={handleCreateCard} disabled={creating || !cardTitle || !query} className="flex-1">
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating Card...
                    </>
                  ) : (
                    "Create Card & Add to Canvas"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
