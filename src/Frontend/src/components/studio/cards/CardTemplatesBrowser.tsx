import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cardTemplates, categoryLabels, type CardTemplate } from "@/lib/cardTemplates";

interface CardTemplatesBrowserProps {
  onSelectTemplate: (template: CardTemplate) => void;
}

export function CardTemplatesBrowser({ onSelectTemplate }: CardTemplatesBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState<CardTemplate["category"] | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = cardTemplates.filter((template) => {
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories: (CardTemplate["category"] | "all")[] = ["all", "sales", "operations", "analytics", "monitoring", "general"];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Card Templates</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Filter */}
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
                  {categoryLabels[category].icon} {categoryLabels[category].label}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No templates found</p>
            <p className="text-xs text-muted-foreground mt-1">Try a different category or search term</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="group p-4 rounded-lg border-2 border-border hover:border-primary transition-all cursor-pointer bg-card hover:shadow-lg"
                onClick={() => onSelectTemplate(template)}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                    {template.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {template.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 ${getCardTypeBadge(
                          template.cardType
                        )}`}
                      >
                        {template.cardType}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{template.description}</p>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      {template.requiredTables && template.requiredTables.length > 0 && (
                        <span>
                          Tables: <span className="font-mono">{template.requiredTables.join(", ")}</span>
                        </span>
                      )}
                      <span className="ml-auto text-primary font-medium group-hover:underline">Use Template →</span>
                    </div>
                  </div>
                </div>

                {/* Query Preview (on hover) */}
                <div className="mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-muted-foreground mb-1">Query Preview:</p>
                  <pre className="text-[10px] font-mono bg-muted p-2 rounded overflow-x-auto max-h-20 line-clamp-3">
                    {template.queryTemplate}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t bg-muted/50">
        <p className="text-xs text-muted-foreground text-center">
          Showing {filteredTemplates.length} of {cardTemplates.length} templates
        </p>
      </div>
    </div>
  );
}

function getCardTypeBadge(cardType: string): string {
  switch (cardType) {
    case "kpi":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
    case "table":
    case "grid":
      return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
    case "chart":
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
    case "timeline":
      return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800";
    default:
      return "bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800";
  }
}
