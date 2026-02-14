import { useState } from "react";
import { ClientUserManagementTab } from "./ClientUserManagementTab";
import { ClientRoleManagementTab } from "./ClientRoleManagementTab";
import { ClientGroupsManagementTab } from "./ClientGroupsManagementTab";
import { useI18n, type MessageKey } from "@/contexts/I18nContext";

interface ClientSecurityManagerProps {
  clientId: number;
  clientName: string;
}

type SecurityTab = "users" | "roles" | "groups";

export function ClientSecurityManager({ clientId, clientName }: ClientSecurityManagerProps) {
  const { t } = useI18n();
  const isPlatformClient = clientName === "Platform";
  const [activeTab, setActiveTab] = useState<SecurityTab>("users");

  // Platform client only shows users tab (no roles/groups management)
  const availableTabs = isPlatformClient ? (["users"] as SecurityTab[]) : (["users", "groups", "roles"] as SecurityTab[]);

  return (
    <div className="space-y-6 pt-4 animate-in fade-in duration-500">
      {availableTabs.length > 1 && (
        <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto no-scrollbar scroll-smooth">
          {availableTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-semibold transition-all relative whitespace-nowrap ${
                activeTab === tab
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-t-xl"
              }`}
            >
              {t(`secTab${tab.charAt(0).toUpperCase() + tab.slice(1)}` as MessageKey)}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-[500px] animate-in fade-in duration-300">
        {activeTab === "users" && <ClientUserManagementTab clientId={clientId} isPlatformClient={isPlatformClient} />}
        {activeTab === "groups" && !isPlatformClient && <ClientGroupsManagementTab clientId={clientId} />}
        {activeTab === "roles" && !isPlatformClient && <ClientRoleManagementTab clientId={clientId} />}
      </div>
    </div>
  );
}
