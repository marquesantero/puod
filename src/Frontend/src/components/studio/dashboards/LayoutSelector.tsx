import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Grid3x3, LayoutGrid, LayoutDashboard, Focus, SidebarIcon, AlignHorizontalJustifyStart, AlignHorizontalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalJustifyEnd, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import type { LayoutType } from "@/lib/canvasLayouts";

interface LayoutSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectLayout: (layout: LayoutType) => void;
  onAlign?: (alignment: "left" | "right" | "top" | "bottom" | "center-h" | "center-v") => void;
}

interface LayoutOption {
  type: LayoutType;
  name: string;
  nameKey: string;
  description: string;
  descriptionKey: string;
  icon: React.ReactNode;
  preview: string;
}

const layoutOptions: LayoutOption[] = [
  {
    type: "grid",
    name: "Grid Layout",
    nameKey: "layoutGrid",
    description: "Uniform grid with equal-sized cards",
    descriptionKey: "layoutGridDesc",
    icon: <Grid3x3 className="w-6 h-6" />,
    preview: "┌─┬─┬─┐\n├─┼─┼─┤\n└─┴─┴─┘",
  },
  {
    type: "masonry",
    name: "Masonry Layout",
    nameKey: "layoutMasonry",
    description: "Pinterest-style with variable heights",
    descriptionKey: "layoutMasonryDesc",
    icon: <LayoutGrid className="w-6 h-6" />,
    preview: "┌─┬───┐\n├─┤   │\n│ ├───┤\n└─┴───┘",
  },
  {
    type: "dashboard",
    name: "Dashboard Layout",
    nameKey: "layoutDashboard",
    description: "KPIs at top, charts below",
    descriptionKey: "layoutDashboardDesc",
    icon: <LayoutDashboard className="w-6 h-6" />,
    preview: "┌─┬─┬─┐\n├───┬─┤\n└───┴─┘",
  },
  {
    type: "focus",
    name: "Focus Layout",
    nameKey: "layoutFocus",
    description: "One large card with smaller sidebar",
    descriptionKey: "layoutFocusDesc",
    icon: <Focus className="w-6 h-6" />,
    preview: "┌───┬─┐\n│   ├─┤\n│   ├─┤\n└───┴─┘",
  },
  {
    type: "sidebar",
    name: "Sidebar Layout",
    nameKey: "layoutSidebar",
    description: "Sidebar navigation with main content",
    descriptionKey: "layoutSidebarDesc",
    icon: <SidebarIcon className="w-6 h-6" />,
    preview: "┌─┬───┐\n├─┼─┬─┤\n├─┼─┴─┤\n└─┴───┘",
  },
];

const alignmentOptions = [
  { type: "left" as const, name: "Align Left", icon: <AlignHorizontalJustifyStart className="w-4 h-4" /> },
  { type: "right" as const, name: "Align Right", icon: <AlignHorizontalJustifyEnd className="w-4 h-4" /> },
  { type: "top" as const, name: "Align Top", icon: <AlignVerticalJustifyStart className="w-4 h-4" /> },
  { type: "bottom" as const, name: "Align Bottom", icon: <AlignVerticalJustifyEnd className="w-4 h-4" /> },
  { type: "center-h" as const, name: "Center Horizontally", icon: <AlignHorizontalJustifyCenter className="w-4 h-4" /> },
  { type: "center-v" as const, name: "Center Vertically", icon: <AlignVerticalJustifyCenter className="w-4 h-4" /> },
];

export function LayoutSelector({ open, onClose, onSelectLayout, onAlign }: LayoutSelectorProps) {
  const { t } = useI18n();
  const [selectedLayout, setSelectedLayout] = useState<LayoutType | null>(null);

  const handleSelectLayout = (layout: LayoutType) => {
    setSelectedLayout(layout);
  };

  const handleApply = () => {
    if (selectedLayout) {
      onSelectLayout(selectedLayout);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5" />
            Auto-Arrange Cards
          </DialogTitle>
          <DialogDescription>
            Choose a layout style to automatically arrange your cards on the canvas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Layout Options */}
          <div>
            <h3 className="font-semibold mb-3">Choose Layout Style</h3>
            <div className="grid grid-cols-2 gap-4">
              {layoutOptions.map((option) => (
                <button
                  key={option.type}
                  onClick={() => handleSelectLayout(option.type)}
                  className={`group p-4 rounded-lg border-2 transition-all text-left ${
                    selectedLayout === option.type
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={`p-3 rounded-lg ${
                        selectedLayout === option.type
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                      }`}
                    >
                      {option.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{option.name}</h4>
                      <p className="text-xs text-muted-foreground mb-2">{option.description}</p>

                      {/* ASCII Preview */}
                      <pre className="text-[10px] font-mono text-muted-foreground leading-tight">
                        {option.preview}
                      </pre>
                    </div>

                    {/* Selected Indicator */}
                    {selectedLayout === option.type && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Alignment Tools */}
          {onAlign && (
            <div>
              <h3 className="font-semibold mb-3">Quick Alignment</h3>
              <div className="flex flex-wrap gap-2">
                {alignmentOptions.map((option) => (
                  <Button
                    key={option.type}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onAlign(option.type);
                      onClose();
                    }}
                    className="gap-2"
                  >
                    {option.icon}
                    {option.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Preview Info */}
          {selectedLayout && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                ℹ️ This will rearrange all cards on the canvas. You can undo this action with Ctrl+Z.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!selectedLayout}>
            Apply Layout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
