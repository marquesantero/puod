import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import {
  createIntegration,
  deleteIntegration,
  getCompanyAvailableIntegrations,
  getIntegration,
  updateIntegration,
  type IntegrationDetailResponse,
  type IntegrationListResponse,
} from "@/lib/biIntegrationApi";
import { getCompanyAvailableAuthProfiles, type AuthProfileListResponse } from "@/lib/authProfileApi";
import { IntegrationDialog } from "@/components/integrations/IntegrationDialog";

interface IntegrationsTabProps {
  companyId: number;
}

export function IntegrationsTab({ companyId }: IntegrationsTabProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [ownedIntegrations, setOwnedIntegrations] = useState<IntegrationListResponse[]>([]);
  const [inheritedIntegrations, setInheritedIntegrations] = useState<IntegrationListResponse[]>([]);
  const [authProfiles, setAuthProfiles] = useState<AuthProfileListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<IntegrationListResponse | null>(null);
  const [editingDetail, setEditingDetail] = useState<IntegrationDetailResponse | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<number | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [integrationToEdit, setIntegrationToEdit] = useState<IntegrationListResponse | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, [companyId]);

  const normalizeOwnerType = (value: IntegrationListResponse["ownerType"] | number) => {
    if (typeof value === "number") {
      if (value === 2) return "Client";
      if (value === 0) return "Company";
      return "Group";
    }
    return value;
  };

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const data = await getCompanyAvailableIntegrations(companyId);
      const owned = data.filter((item: any) => normalizeOwnerType(item.ownerType) === "Company" && item.profileId === companyId);
      const inherited = data.filter((item: any) => normalizeOwnerType(item.ownerType) === "Client");

      setOwnedIntegrations(owned);
      setInheritedIntegrations(inherited);
    } catch (error) {
      console.error("Failed to load integrations", error);
    } finally {
      setLoading(false);
    }
  };

  const ensureAuthProfiles = async () => {
    if (profilesLoading || authProfiles.length > 0) return;
    setProfilesLoading(true);
    try {
      const data = await getCompanyAvailableAuthProfiles(companyId);
      setAuthProfiles(data.filter((profile) => profile.isActive && profile.providerType === "AzureAd"));
    } catch (error) {
      console.error("Failed to load auth profiles", error);
      setAuthProfiles([]);
    } finally {
      setProfilesLoading(false);
    }
  };

  const getTypeLabel = (type: IntegrationListResponse["type"]) => {
    switch (type) {
      case "Databricks":
        return t("integrationConnectorDatabricks");
      case "Synapse":
        return t("integrationConnectorSynapse");
      case "Airflow":
        return t("integrationConnectorAirflow");
      case "AzureDataFactory":
        return t("integrationConnectorAdf");
      default:
        return type;
    }
  };

  const openCreateDialog = () => {
    setEditingIntegration(null);
    setEditingDetail(null);
    setIsDialogOpen(true);
    void ensureAuthProfiles();
  };

  const openEditDialog = async (integration: IntegrationListResponse) => {
    try {
      void ensureAuthProfiles();
      const detail = await getIntegration(integration.id);
      setEditingIntegration(integration);
      setEditingDetail(detail);
      setIsDialogOpen(true);
    } catch (error) {
      console.error(error);
      showToast(t("integrationOverviewError"), { variant: "destructive" });
    }
  };

  const requestEditDialog = (integration: IntegrationListResponse) => {
    setIntegrationToEdit(integration);
    setIsEditDialogOpen(true);
  };

  const confirmEditDialog = async () => {
    if (!integrationToEdit) return;
    setIsEditDialogOpen(false);
    await openEditDialog(integrationToEdit);
    setIntegrationToEdit(null);
  };

  const confirmDelete = (id: number) => {
    setIntegrationToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!integrationToDelete) return;
    try {
      await deleteIntegration(integrationToDelete);
      showToast(t("integrationsDeleteSuccess"), { variant: "success" });
      loadIntegrations();
    } catch (error) {
      console.error(error);
      showToast(t("integrationRemoveError"), { variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setIntegrationToDelete(null);
    }
  };

  const handleSave = async (payload: {
    name: string;
    type: IntegrationDetailResponse["type"];
    isActive: boolean;
    configuration: Record<string, string>;
  }) => {
    try {
      if (editingIntegration) {
        await updateIntegration(editingIntegration.id, {
          name: payload.name,
          configuration: payload.configuration,
          isActive: payload.isActive,
        });
      } else {
        await createIntegration({
          profileId: companyId,
          name: payload.name,
          type: payload.type,
          configuration: payload.configuration,
        });
      }
      showToast(t("integrationsSaveSuccess"), { variant: "success" });
      setIsDialogOpen(false);
      setEditingIntegration(null);
      setEditingDetail(null);
      loadIntegrations();
    } catch (error) {
      console.error(error);
      const errorMessage = (error as any)?.response?.data?.message || t("integrationSaveError");
      showToast(errorMessage, { variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">{t("integrationsTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("integrationsCompanySubtitle")}</p>
        </div>
        <Button type="button" onClick={openCreateDialog}>
          {t("integrationsNew")}
        </Button>
      </div>

      <IntegrationDialog
        open={isDialogOpen}
        authProfiles={authProfiles}
        initialDetail={editingDetail}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        title={t("confirm")}
        description={t("editConfirm")}
        confirmLabel={t("edit")}
        cancelLabel={t("cancel")}
        onConfirm={confirmEditDialog}
      />
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={t("confirm")}
        description={t("integrationsDeleteConfirm")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={handleDelete}
      />

      <div className="space-y-6">
        {inheritedIntegrations.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t("inheritedIntegrations")}
            </h4>
            <div className="border rounded-md overflow-hidden bg-background/50">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">{t("integrationsName")}</th>
                    <th className="px-4 py-3 text-left font-medium">{t("integrationsType")}</th>
                    <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("source")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inheritedIntegrations.map((integration) => (
                    <tr key={integration.id} className="hover:bg-muted/20 transition-colors opacity-75">
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        {integration.name}
                      </td>
                      <td className="px-4 py-3">{getTypeLabel(integration.type)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          integration.status === "Active"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : integration.status === "Error"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        }`}>
                          {integration.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-muted-foreground italic">{t("client")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          {inheritedIntegrations.length > 0 && (
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
              {t("ownedIntegrations")}
            </h4>
          )}
          <div className="border rounded-md overflow-hidden bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("integrationsName")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("integrationsType")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8">{t("loading")}</td>
                  </tr>
                ) : ownedIntegrations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      {inheritedIntegrations.length > 0
                        ? t("integrationsNoOwnedIntegrations")
                        : t("integrationsNoIntegrations")}
                    </td>
                  </tr>
                ) : (
                  ownedIntegrations.map((integration) => (
                    <tr key={integration.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{integration.name}</td>
                      <td className="px-4 py-3">{getTypeLabel(integration.type)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          integration.status === "Active"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : integration.status === "Error"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        }`}>
                          {integration.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => requestEditDialog(integration)}>
                          {t("edit")}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => confirmDelete(integration.id)}>
                          {t("delete")}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
