import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserManagementTab } from "./UserManagementTab";
import { RoleManagementTab } from "./RoleManagementTab";
import { GroupsManagementTab } from "./GroupsManagementTab";
import { useI18n } from "@/contexts/I18nContext";

interface SecurityManagerProps {
  companyId: number;
}

type SecurityTab = "users" | "roles" | "groups";

export function SecurityManager({ companyId }: SecurityManagerProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SecurityTab>("users");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b pb-2">
        <Button
          type="button"
          variant={activeTab === "users" ? "secondary" : "ghost"}
          size="sm"
          onClick={(e) => { e.preventDefault(); setActiveTab("users"); }}
        >
          {t("secTabUsers")}
        </Button>
        <Button
          type="button"
          variant={activeTab === "groups" ? "secondary" : "ghost"}
          size="sm"
          onClick={(e) => { e.preventDefault(); setActiveTab("groups"); }}
        >
          {t("secTabGroups") || "Groups"}
        </Button>
        <Button
          type="button"
          variant={activeTab === "roles" ? "secondary" : "ghost"}
          size="sm"
          onClick={(e) => { e.preventDefault(); setActiveTab("roles"); }}
        >
          {t("secTabRoles")}
        </Button>
      </div>

      <div className="min-h-[500px] animate-in fade-in duration-300">
        {activeTab === "users" && <UserManagementTab companyId={companyId} />}
        {activeTab === "groups" && <GroupsManagementTab companyId={companyId} />}
        {activeTab === "roles" && <RoleManagementTab companyId={companyId} />}
      </div>
    </div>
  );
}
