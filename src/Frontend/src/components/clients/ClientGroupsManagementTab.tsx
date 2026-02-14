// Placeholder - Groups tab for client level
// This will be implemented similar to ClientUserManagementTab
// Groups at client level can be used across all companies under that client

import { GroupsManagementTab } from "../companies/GroupsManagementTab";

interface ClientGroupsManagementTabProps {
  clientId: number;
}

export function ClientGroupsManagementTab({ clientId }: ClientGroupsManagementTabProps) {
  // For now, reuse the company-level component with clientId
  // TODO: Implement client-specific group management with company inheritance
  return <GroupsManagementTab companyId={clientId} />;
}
