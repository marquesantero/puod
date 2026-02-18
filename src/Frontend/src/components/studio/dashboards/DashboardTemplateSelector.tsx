/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, Check } from "lucide-react";
import {
  dashboardTemplates,
  dashboardCategoryLabels,
  type DashboardTemplate,
} from "@/lib/dashboardTemplates";
import { useI18n } from "@/contexts/I18nContext";

interface DashboardTemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: DashboardTemplate) => void;
}

export function DashboardTemplateSelector({ open, onClose, onSelectTemplate }: DashboardTemplateSelectorProps) {
  const { t } = useI18n();
  const [selectedCategory, setSelectedCategory] = useState<DashboardTemplate["category"] | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const filteredTemplates = dashboardTemplates.filter((template) => {
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories: (DashboardTemplate["category"] | "all")[] = [
    "all",
    "executive",
    "sales",
    "operations",
    "analytics",
    "monitoring",
  ];

  const handleApply = () => {
    const template = dashboardTemplates.find((t) => t.id === selectedTemplate);
    if (template) {
      onSelectTemplate(template);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Dashboard Templates
          </DialogTitle>
          <DialogDescription>
            Browse and apply pre-built dashboard templates with multiple cards
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden space-y-4">
          {/* Search & Filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {category === "all" ? (
                    "All Templates"
                  ) : (
                    <span>
                      {dashboardCategoryLabels[category].icon} {dashboardCategoryLabels[category].label}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Templates Grid */}
          <div className="flex-1 overflow-y-auto">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">No templates found</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different category or search term</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`group p-4 rounded-lg border-2 transition-all text-left ${
                      selectedTemplate === template.id
                        ? "border-primary bg-primary/5 shadow-lg"
                        : "border-border hover:border-primary/50 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 ${
                          selectedTemplate === template.id
                            ? "bg-primary/20"
                            : "bg-muted group-hover:bg-primary/10"
                        }`}
                      >
                        {template.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-sm">{template.name}</h3>
                          {selectedTemplate === template.id && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <Check className="w-3 h-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{template.description}</p>

                        {/* Metadata */}
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>{template.cards.length} cards</span>
                          <span>•</span>
                          <span className="capitalize">{template.canvasMode}</span>
                          {template.canvasWidth && (
                            <>
                              <span>•</span>
                              <span>{template.canvasWidth}px</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Preview on hover */}
                    <div className="mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="grid grid-cols-4 gap-1 h-16">
                        {template.cards.slice(0, 8).map((card, i) => (
                          <div
                            key={i}
                            className="bg-primary/10 rounded border border-primary/20"
                            style={{
                              gridColumn: card.width > 600 ? "span 2" : "span 1",
                              gridRow: card.height > 300 ? "span 2" : "span 1",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          {selectedTemplate && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                💡 This will replace your current dashboard. Make sure to save any changes first!
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!selectedTemplate}>
            Use This Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
