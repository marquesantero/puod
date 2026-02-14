import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/contexts/ToastContext";
import { getTemplates, cloneCard, type StudioCardDto } from "@/lib/studioCardsApi";
import { getIntegrations, type IntegrationListResponse } from "@/lib/biIntegrationApi";
import { Database, BarChart3, Workflow, Factory, Loader2, Server } from "lucide-react";

interface TemplateGalleryProps {
  profileId?: number;
  onTemplateSelected?: (cardId: number) => void;
}

export function TemplateGallery({ profileId, onTemplateSelected }: TemplateGalleryProps) {
  const { showToast } = useToast();

  const [templates, setTemplates] = useState<StudioCardDto[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState<number | null>(null);
  const [selectedIntegrationType, setSelectedIntegrationType] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [profileId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesData, integrationsData] = await Promise.all([
        getTemplates(),
        profileId ? getIntegrations(profileId) : Promise.resolve([]),
      ]);
      setTemplates(templatesData);
      setIntegrations(integrationsData);
    } catch (error) {
      console.error("Failed to load templates:", error);
      showToast("Failed to load templates", { variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCloneTemplate = async (templateId: number) => {
    try {
      setCloning(templateId);
      const clonedCard = await cloneCard(templateId);
      showToast("Template cloned successfully", { variant: "success" });
      if (onTemplateSelected) {
        onTemplateSelected(clonedCard.id);
      }
    } catch (error) {
      console.error("Failed to clone template:", error);
      showToast("Failed to clone template", { variant: "destructive" });
    } finally {
      setCloning(null);
    }
  };

  // Group templates by integration
  const templatesByIntegration = useMemo(() => {
    const groups: Record<string, { integration?: IntegrationListResponse; templates: StudioCardDto[] }> = {};

    templates.forEach((template) => {
      if (!template.integrationId) {
        // Generic templates without integration
        if (!groups["generic"]) {
          groups["generic"] = { templates: [] };
        }
        groups["generic"].templates.push(template);
        return;
      }

      const integration = integrations.find((i) => i.id === template.integrationId);
      const key = integration ? `${integration.type}-${integration.id}` : `unknown-${template.integrationId}`;

      if (!groups[key]) {
        groups[key] = { integration, templates: [] };
      }
      groups[key].templates.push(template);
    });

    return groups;
  }, [templates, integrations]);

  // Get unique integration types
  const integrationTypes = useMemo(() => {
    const types = new Set<string>();
    integrations.forEach((i) => types.add(i.type));
    templates.forEach((t) => {
      const integration = integrations.find((i) => i.id === t.integrationId);
      if (integration) types.add(integration.type);
    });
    return Array.from(types);
  }, [integrations, templates]);

  // Filter templates by selected integration type
  const filteredGroups = useMemo(() => {
    if (!selectedIntegrationType) return templatesByIntegration;

    return Object.fromEntries(
      Object.entries(templatesByIntegration).filter(([_, group]) => {
        if (!group.integration) return selectedIntegrationType === "generic";
        return group.integration.type === selectedIntegrationType;
      })
    );
  }, [templatesByIntegration, selectedIntegrationType]);

  const getIntegrationIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case "databricks":
        return <Database className="w-5 h-5" />;
      case "airflow":
        return <Workflow className="w-5 h-5" />;
      case "azuredatafactory":
        return <Factory className="w-5 h-5" />;
      case "synapse":
        return <Server className="w-5 h-5" />;
      default:
        return <BarChart3 className="w-5 h-5" />;
    }
  };

  const getCardTypeColor = (cardType: string) => {
    switch (cardType.toLowerCase()) {
      case "kpi":
        return "from-blue-500 to-indigo-600";
      case "grid":
        return "from-emerald-500 to-teal-600";
      case "chart":
        return "from-amber-500 to-orange-600";
      case "timeline":
        return "from-purple-500 to-pink-600";
      default:
        return "from-slate-500 to-slate-600";
    }
  };

  const renderTemplatePreview = (template: StudioCardDto, integrationType?: string) => {
    const cardType = template.cardType.toLowerCase();
    if (cardType === "kpi") {
      return (
        <div className="h-24 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 flex flex-col justify-between">
          <div className="text-xs text-muted-foreground">{template.title}</div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold text-blue-600">94.2%</div>
            <div className="text-xs text-emerald-600 font-semibold">+5.8%</div>
          </div>
          <div className="text-[10px] text-muted-foreground">Last run: 2 min ago</div>
        </div>
      );
    }

    if (cardType === "grid" || cardType === "table") {
      return (
        <div className="h-24 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden text-[10px]">
          <div className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-semibold">
            {template.title}
          </div>
          <div className="px-2 py-1 border-b border-slate-100 dark:border-slate-800 flex justify-between">
            <span className="font-medium">dag_a</span>
            <span className="text-emerald-600">success</span>
          </div>
          <div className="px-2 py-1 border-b border-slate-100 dark:border-slate-800 flex justify-between">
            <span className="font-medium">dag_b</span>
            <span className="text-blue-600">running</span>
          </div>
          <div className="px-2 py-1 flex justify-between">
            <span className="font-medium">dag_c</span>
            <span className="text-red-600">failed</span>
          </div>
        </div>
      );
    }

    if (cardType === "chart") {
      return (
        <div className="h-24 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 flex flex-col gap-2">
          <div className="text-[10px] text-muted-foreground">{template.title}</div>
          <div className="flex items-end gap-1 h-full">
            {[40, 70, 55, 85, 60, 45].map((value, index) => (
              <div
                key={index}
                className="flex-1 rounded-sm bg-amber-500/70"
                style={{ height: `${value}%` }}
              />
            ))}
          </div>
        </div>
      );
    }

    if (cardType === "timeline") {
      return (
        <div className="h-24 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-[10px] space-y-2">
          <div className="text-[10px] text-muted-foreground">{template.title}</div>
          {["Run started", "Task completed", "Run finished"].map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${index === 2 ? "bg-emerald-500" : "bg-slate-400"}`} />
              <span className="text-foreground truncate">{label}</span>
            </div>
          ))}
        </div>
      );
    }

    if (cardType === "status") {
      return (
        <div className="h-24 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-[10px] space-y-1">
          <div className="text-[10px] text-muted-foreground">{template.title}</div>
          <div className="flex justify-between">
            <span>Pipeline A</span>
            <span className="text-emerald-600 font-semibold">ok</span>
          </div>
          <div className="flex justify-between">
            <span>Pipeline B</span>
            <span className="text-amber-600 font-semibold">warn</span>
          </div>
          <div className="flex justify-between">
            <span>Pipeline C</span>
            <span className="text-red-600 font-semibold">fail</span>
          </div>
        </div>
      );
    }

    return (
      <div className="h-24 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
        {getIntegrationIcon(integrationType)}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter by Integration Type */}
      {integrationTypes.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedIntegrationType === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedIntegrationType(null)}
            className="rounded-xl"
          >
            All
          </Button>
          {integrationTypes.map((type) => (
            <Button
              key={type}
              variant={selectedIntegrationType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedIntegrationType(type)}
              className="rounded-xl gap-2"
            >
              {getIntegrationIcon(type)}
              {type}
            </Button>
          ))}
        </div>
      )}

      {/* Template Groups */}
      {Object.entries(filteredGroups).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground italic">
              No templates available
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(filteredGroups).map(([key, group]) => (
            <div key={key} className="space-y-4">
              {/* Group Header */}
              <div className="flex items-center gap-3">
                {group.integration && (
                  <div className="flex items-center gap-2">
                    {getIntegrationIcon(group.integration.type)}
                    <h3 className="text-lg font-bold">{group.integration.name}</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-accent border uppercase font-bold">
                      {group.integration.type}
                    </span>
                  </div>
                )}
                {!group.integration && (
                  <h3 className="text-lg font-bold">Generic Templates</h3>
                )}
                <span className="text-xs text-muted-foreground">
                  {group.templates.length} templates
                </span>
              </div>

              {/* Template Cards - Single Column for Sidebar */}
              <div className="space-y-3">
                {group.templates.map((template) => (
                  <Card
                    key={template.id}
                    className="group overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-primary/50"
                    onClick={() => handleCloneTemplate(template.id)}
                  >
                    {/* Card Type Header - Larger colored bar */}
                    <div className={`h-3 w-full bg-gradient-to-r ${getCardTypeColor(template.cardType)}`} />

                    <div className="p-4 space-y-3">
                      {/* Title and Type Badges */}
                      <div>
                        <CardTitle className="text-base font-bold leading-tight mb-2">{template.title}</CardTitle>
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary uppercase font-bold border border-primary/20">
                            {template.cardType}
                          </span>
                          <span className="text-xs px-2.5 py-1 rounded-full bg-accent border uppercase font-bold">
                            {template.layoutType}
                          </span>
                        </div>
                      </div>

                      {/* Visual Preview */}
                      {renderTemplatePreview(template, group.integration?.type)}

                      {/* Action Button */}
                      <Button
                        size="sm"
                        disabled={cloning === template.id}
                        className="w-full gap-2 rounded-lg shadow-md group-hover:shadow-lg transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloneTemplate(template.id);
                        }}
                      >
                        {cloning === template.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add to Canvas
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
