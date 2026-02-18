/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import {
  createIntegration,
  deleteIntegration,
  getClientIntegrations,
  getIntegration,
  updateIntegration,
  type IntegrationDetailResponse,
  type IntegrationListResponse,
} from "@/lib/biIntegrationApi";
import { getCompanies, type CompanyListResponse } from "@/lib/companyApi";
import { getClientAuthProfiles, type AuthProfileListResponse } from "@/lib/authProfileApi";
import { IntegrationDialog } from "@/components/integrations/IntegrationDialog";
import { CompanySelection } from "@/components/integrations/CompanySelection";

interface ClientIntegrationsTabProps {
  clientId: number;
}

export function ClientIntegrationsTab({ clientId }: ClientIntegrationsTabProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [integrations, setIntegrations] = useState<IntegrationListResponse[]>([]);
  const [companies, setCompanies] = useState<CompanyListResponse[]>([]);
  const [authProfiles, setAuthProfiles] = useState<AuthProfileListResponse[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<IntegrationListResponse | null>(null);
  const [editingDetail, setEditingDetail] = useState<IntegrationDetailResponse | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<number | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [integrationToEdit, setIntegrationToEdit] = useState<IntegrationListResponse | null>(null);

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const integrationsData = await getClientIntegrations(clientId);
      setIntegrations(integrationsData);
    } catch (error) {
      console.error("Failed to load data", error);
      showToast(t("integrationOverviewError"), { variant: "destructive" });
    } finally {
      setLoading(false);
    }

    void ensureCompanies();
    void ensureAuthProfiles();
  };

  const ensureCompanies = async () => {
    if (companiesLoading || companies.length > 0) return;
    setCompaniesLoading(true);
    try {
      const companiesData = await getCompanies();
      const clientCompanies = companiesData.filter((company) => company.clientId === clientId);
      setCompanies(clientCompanies);
    } catch (error) {
      console.error("Failed to load companies", error);
    } finally {
      setCompaniesLoading(false);
    }
  };

  const ensureAuthProfiles = async () => {
    if (profilesLoading || authProfiles.length > 0) return;
    setProfilesLoading(true);
    try {
      const profilesData = await getClientAuthProfiles(clientId);
      setAuthProfiles(profilesData.filter((profile) => profile.isActive && profile.providerType === "AzureAd"));
    } catch (error) {
      console.error("Failed to load auth profiles", error);
    } finally {
      setProfilesLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingIntegration(null);
    setEditingDetail(null);
    setSelectedCompanies(new Set());
    setIsDialogOpen(true);
    void ensureCompanies();
    void ensureAuthProfiles();
  };

  const openEditDialog = async (integration: IntegrationListResponse) => {
    try {
      void ensureCompanies();
      void ensureAuthProfiles();
      const detail = await getIntegration(integration.id, clientId);
      setEditingIntegration(integration);
      setEditingDetail(detail);
      setSelectedCompanies(new Set(detail.companyIds || []));
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
      await deleteIntegration(integrationToDelete, clientId);
      showToast(t("integrationsDeleteSuccess"), { variant: "success" });
      loadData();
    } catch (error) {
      console.error(error);
      showToast(t("integrationRemoveError"), { variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setIntegrationToDelete(null);
    }
  };

  const toggleCompany = (companyId: number) => {
    setSelectedCompanies((current) => {
      const next = new Set(current);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const toggleAllCompanies = () => {
    setSelectedCompanies((current) => {
      if (current.size === companies.length) {
        return new Set();
      }
      return new Set(companies.map((company) => company.id));
    });
  };

  const handleSave = async (payload: {
    name: string;
    type: IntegrationDetailResponse["type"];
    isActive: boolean;
    configuration: Record<string, string>;
  }) => {
    try {
      const companyIds = selectedCompanies.size > 0 ? Array.from(selectedCompanies) : undefined;
      if (editingIntegration) {
        await updateIntegration(
          editingIntegration.id,
          {
            name: payload.name,
            configuration: payload.configuration,
            ...(companyIds ? { companyIds } : {}),
            isActive: payload.isActive,
          },
          clientId
        );
      } else {
        await createIntegration({
          clientId,
          name: payload.name,
          type: payload.type,
          configuration: payload.configuration,
          ...(companyIds ? { companyIds } : {}),
        });
      }
      showToast(t("integrationsSaveSuccess"), { variant: "success" });
      setIsDialogOpen(false);
      setEditingIntegration(null);
      setEditingDetail(null);
      setSelectedCompanies(new Set());
      loadData();
    } catch (error) {
      console.error(error);
      const errorMessage = (error as any)?.response?.data?.message || t("integrationSaveError");
      showToast(errorMessage, { variant: "destructive" });
    }
  };

  const getCompanyNamesForIntegration = (integration: IntegrationListResponse): string => {
    if (companiesLoading && companies.length === 0) {
      return t("loading");
    }
    if (!integration.companyIds || integration.companyIds.length === 0) {
      return t("noCompanies");
    }

    const companyNames = integration.companyIds
      .map((id) => companies.find((company) => company.id === id)?.name)
      .filter((name): name is string => Boolean(name));

    if (companyNames.length === 0) return t("noCompanies");
    if (companyNames.length <= 2) return companyNames.join(", ");
    return `${companyNames[0]}, ${companyNames[1]} +${companyNames.length - 2}`;
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

  return (
    <div className="space-y-4 pt-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">{t("integrationsTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("integrationsClientSubtitle")}</p>
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
        extraFields={(
          <CompanySelection
            companies={companies}
            selectedCompanies={selectedCompanies}
            onToggleCompany={toggleCompany}
            onToggleAll={toggleAllCompanies}
          />
        )}
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

      <div className="border rounded-md overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium">{t("integrationsName")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("integrationsType")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("companies")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8">{t("loading")}</td>
              </tr>
            ) : integrations.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  {t("integrationsNoIntegrations")}
                </td>
              </tr>
            ) : (
              integrations.map((integration) => (
                <tr key={integration.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{integration.name}</td>
                  <td className="px-4 py-3">{getTypeLabel(integration.type)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {getCompanyNamesForIntegration(integration)}
                  </td>
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
  );
}
