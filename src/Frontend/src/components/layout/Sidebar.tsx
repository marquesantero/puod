import { useI18n, type MessageKey } from "@/contexts/I18nContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type MenuItem = {
  href: string;
  icon: string;
  key: MessageKey;
  indent?: number; // 0 = no indent, 1 = first level, 2 = second level
};

type MenuSection = {
  title?: "organization";
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
  {
    items: [
      { href: "/dashboard", icon: "chart", key: "dashboard" as MessageKey, indent: 0 },
      { href: "/studio", icon: "layers", key: "puodStudio" as MessageKey, indent: 0 },
      { href: "/studio/cards", icon: "grid", key: "puodStudioCards" as MessageKey, indent: 1 },
      { href: "/studio/dashboards", icon: "chart", key: "puodStudioDashboards" as MessageKey, indent: 1 },
    ],
  },
  {
    title: "organization",
    items: [
      { href: "/clients", icon: "briefcase", key: "clients" as MessageKey, indent: 0 },
      { href: "/companies", icon: "building", key: "companies" as MessageKey, indent: 1 },
    ],
  },
  {
    items: [
      { href: "/monitoring", icon: "pulse", key: "monitoring" as MessageKey, indent: 0 },
      { href: "/reports", icon: "report", key: "reports" as MessageKey, indent: 0 },
    ],
  },
];

const icons: Record<string, ReactNode> = {
  chart: (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path d="M4 19h16M7 16V9m5 7V5m5 11v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  grid: (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="currentColor" />
    </svg>
  ),
  pulse: (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path d="M3 12h4l2-4 4 8 2-4h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  report: (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path d="M6 4h9l3 3v13H6z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9 13h6M9 17h6M9 9h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  building: (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path d="M3 21h18M5 21V7l8-4v18M19 21V10l-6-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  briefcase: (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  layers: (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const getIndentClass = (indent: number = 0): string => {
  switch (indent) {
    case 1:
      return "pl-6";
    case 2:
      return "pl-10";
    default:
      return "pl-3";
  }
};

const getConnectorElement = (indent: number = 0): ReactNode => {
  if (indent === 0) return null;

  return (
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600">
      {indent === 1 ? (
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M0 6 L6 6 L6 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ) : (
        <svg width="16" height="12" viewBox="0 0 16 12">
          <path d="M0 6 L10 6 L10 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
    </span>
  );
};

export default function Sidebar({ disabled = false }: { disabled?: boolean }) {
  const { t } = useI18n();
  const { isCollapsed, toggleSidebar } = useSidebar();

  return (
    <aside className={`app-sidebar relative border-r border-blue-100 bg-gradient-to-b from-blue-50 to-white py-6 dark:border-blue-900/60 dark:from-slate-900 dark:to-slate-950 transition-all duration-300 ${isCollapsed ? "w-16" : "w-64 px-4"}`}>
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-white shadow-md hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        )}
      </button>

      <div className={`flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100 ${isCollapsed ? "justify-center px-2" : ""}`}>
        <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
            <path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        {!isCollapsed && t("appTitle")}
      </div>
      <nav className="mt-8">
        <div className={`space-y-4 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
          {menuSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {section.title && !isCollapsed && (
                <div className="px-3 mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t(section.title) || section.title}
                  </h3>
                </div>
              )}
              <ul className="space-y-1">
                {section.items.map((link) => (
                  <li key={link.href} className="relative group">
                    {!isCollapsed && getConnectorElement(link.indent)}
                    <a
                      href={link.href}
                      className={`flex items-center gap-3 rounded-lg pr-3 py-2 text-sm text-slate-700 transition hover:bg-blue-100/70 hover:text-blue-800 dark:text-slate-200 dark:hover:bg-blue-950/60 ${
                        isCollapsed
                          ? "justify-center px-2"
                          : getIndentClass(link.indent)
                      }`}
                      title={isCollapsed ? t(link.key) : undefined}
                    >
                      <span className={`text-blue-500 dark:text-blue-300 ${link.indent && !isCollapsed ? 'text-opacity-70' : ''}`}>
                        {icons[link.icon]}
                      </span>
                      {!isCollapsed && (
                        <span className={link.indent ? 'text-sm' : ''}>{t(link.key)}</span>
                      )}
                    </a>
                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block z-50 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
                        {t(link.key)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {disabled && !isCollapsed ? (
          <div className="mt-6 rounded-lg border border-dashed border-border/70 bg-white/70 px-3 py-2 text-xs text-muted-foreground dark:bg-slate-900/60">
            <p className="font-semibold text-foreground">{t("sidebarLockedTitle")}</p>
            <p className="mt-1">{t("sidebarLockedBody")}</p>
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
