// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import PageHeader from "@/components/layout/PageHeader";
import {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  type CompanyListResponse,
  type CompanyDetailResponse,
} from "@/lib/companyApi";
import { getClients, getClientInfoPreview, type ClientListResponse, type ClientInfoPreview } from "@/lib/clientApi";
import { CompanyCard } from "@/components/companies/CompanyCard";
import { CompanyDetails } from "@/components/companies/CompanyDetails";
import { CompanyForm } from "@/components/companies/CompanyForm";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type CompanyFormData = {
  id?: number;
  name: string;
  companyName: string;
  clientId: number;
  inheritFromClient: boolean;
  inheritBasicInfo: boolean;
  inheritLogo: boolean;
  inheritContact: boolean;
  inheritAddress: boolean;
  inheritDetails: boolean;
  inheritAuthentication: boolean;
  inheritIntegrations: boolean;
  isActive: boolean;
  logoUrl: string;
  taxId: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  description: string;
  industry: string;
  employeeCount: string;
  foundedDate: string;
};

type Tab = "basic" | "info" | "contact" | "address" | "details" | "auth" | "integrations" | "security";

export default function CompaniesPage() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState<CompanyListResponse[]>([]);
  const [clients, setClients] = useState<ClientListResponse[]>([]);
  const [clientPreview, setClientPreview] = useState<ClientInfoPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientIdError, setClientIdError] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyDetailResponse | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingEditCompany, setPendingEditCompany] = useState<CompanyListResponse | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CompanyFormData>({
    name: "", companyName: "", clientId: 0, inheritFromClient: true,
    inheritBasicInfo: false, inheritLogo: false, inheritContact: false, inheritAddress: false,
    inheritDetails: false, inheritAuthentication: false, inheritIntegrations: false,
    isActive: true, logoUrl: "", taxId: "", website: "", email: "", phone: "",
    address: "", city: "", state: "", country: "", postalCode: "", description: "",
    industry: "", employeeCount: "", foundedDate: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const hasAnyInheritance = formData.inheritBasicInfo || formData.inheritLogo ||
                              formData.inheritContact || formData.inheritAddress || formData.inheritDetails;
    if (formData.clientId && hasAnyInheritance) {
      loadClientPreview(formData.clientId);
    } else {
      setClientPreview(null);
    }
  }, [formData.clientId, formData.inheritBasicInfo, formData.inheritLogo, formData.inheritContact, formData.inheritAddress, formData.inheritDetails]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [companiesData, clientsData] = await Promise.all([getCompanies(), getClients()]);
      setCompanies(companiesData || []);
      setClients(clientsData || []);
    } catch (err: any) {
      setError(err.response?.data?.message || t("companiesLoadError"));
    } finally {
      setLoading(false);
    }
  };

  const loadClientPreview = async (clientId: number) => {
    try {
      const preview = await getClientInfoPreview(clientId);
      setClientPreview(preview);
    } catch {
      setClientPreview(null);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFormData({ ...formData, logoUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate clientId is selected
    if (!editingId && !formData.clientId) {
      setClientIdError(t("companiesClientRequired") || "Please select a client");
      return;
    }

    setClientIdError("");

    try {
      // When inheriting info, use values from clientPreview if fields are empty
      const effectiveName = (formData.inheritBasicInfo && clientPreview) ? (formData.name || clientPreview.name) : formData.name;
      const effectiveCompanyName = (formData.inheritBasicInfo && clientPreview) ? (formData.companyName || clientPreview.name) : formData.companyName;
      const effectiveLogoUrl = (formData.inheritLogo && clientPreview) ? (formData.logoUrl || clientPreview.logoUrl) : formData.logoUrl;
      const effectiveTaxId = (formData.inheritBasicInfo && clientPreview) ? (formData.taxId || clientPreview.taxId) : formData.taxId;
      const effectiveWebsite = (formData.inheritContact && clientPreview) ? (formData.website || clientPreview.website) : formData.website;
      const effectiveEmail = (formData.inheritContact && clientPreview) ? (formData.email || clientPreview.email) : formData.email;
      const effectivePhone = (formData.inheritContact && clientPreview) ? (formData.phone || clientPreview.phone) : formData.phone;
      const effectiveAddress = (formData.inheritAddress && clientPreview) ? (formData.address || clientPreview.address) : formData.address;
      const effectiveCity = (formData.inheritAddress && clientPreview) ? (formData.city || clientPreview.city) : formData.city;
      const effectiveState = (formData.inheritAddress && clientPreview) ? (formData.state || clientPreview.state) : formData.state;
      const effectiveCountry = (formData.inheritAddress && clientPreview) ? (formData.country || clientPreview.country) : formData.country;
      const effectivePostalCode = (formData.inheritAddress && clientPreview) ? (formData.postalCode || clientPreview.postalCode) : formData.postalCode;
      const effectiveDescription = (formData.inheritDetails && clientPreview) ? (formData.description || clientPreview.description) : formData.description;
      const effectiveIndustry = (formData.inheritDetails && clientPreview) ? (formData.industry || clientPreview.industry) : formData.industry;
      const effectiveEmployeeCount = (formData.inheritDetails && clientPreview) ? (formData.employeeCount || clientPreview.employeeCount?.toString()) : formData.employeeCount;
      const effectiveFoundedDate = (formData.inheritDetails && clientPreview) ? (formData.foundedDate || clientPreview.foundedDate) : formData.foundedDate;

      const payload: any = {
        ...formData,
        name: effectiveName,
        companyName: effectiveCompanyName || undefined,
        clientId: formData.clientId || undefined,
        employeeCount: effectiveEmployeeCount ? parseInt(effectiveEmployeeCount) : undefined,
        // Clean up empty string values
        logoUrl: effectiveLogoUrl || undefined,
        taxId: effectiveTaxId || undefined,
        website: effectiveWebsite || undefined,
        email: effectiveEmail || undefined,
        phone: effectivePhone || undefined,
        address: effectiveAddress || undefined,
        city: effectiveCity || undefined,
        state: effectiveState || undefined,
        country: effectiveCountry || undefined,
        postalCode: effectivePostalCode || undefined,
        description: effectiveDescription || undefined,
        industry: effectiveIndustry || undefined,
        foundedDate: effectiveFoundedDate || undefined,
      };
      if (editingId) {
        await updateCompany(editingId, payload);
      } else {
        await createCompany(payload);
      }
      await loadData();
      handleCancel();
    } catch (err: any) {
      setError(err.response?.data?.message || t("companiesSaveError"));
    }
  };

  const handleView = async (company: CompanyListResponse) => {
    try {
      const detail = await getCompanyById(company.id);
      setSelectedCompany(detail);
      setShowDetail(true);
      setActiveTab("info");
    } catch (err: any) {
      setError(err.response?.data?.message || t("companiesErrorDetails"));
    }
  };

  const handleEdit = async (company: any) => {
    try {
      const details = await getCompanyById(company.id);
      setFormData({
        id: details.id,
        name: details.name,
        companyName: details.companyName || "",
        clientId: details.clientId || 0,
        inheritFromClient: details.inheritFromClient,
        inheritBasicInfo: details.inheritBasicInfo,
        inheritLogo: details.inheritLogo,
        inheritContact: details.inheritContact,
        inheritAddress: details.inheritAddress,
        inheritDetails: details.inheritDetails,
        inheritAuthentication: details.inheritAuthentication,
        inheritIntegrations: details.inheritIntegrations,
        isActive: details.isActive,
        logoUrl: details.logoUrl || "",
        taxId: details.taxId || "",
        website: details.website || "",
        email: details.email || "",
        phone: details.phone || "",
        address: details.address || "",
        city: details.city || "",
        state: details.state || "",
        country: details.country || "",
        postalCode: details.postalCode || "",
        description: details.description || "",
        industry: details.industry || "",
        employeeCount: details.employeeCount?.toString() || "",
        foundedDate: details.foundedDate || "",
      });
      setEditingId(details.id);
      setShowForm(true);
      setShowDetail(false);
      setActiveTab("basic");
    } catch (err: any) {
      setError(err.response?.data?.message || t("companiesErrorDetails"));
    }
  };

  const requestEdit = (company: CompanyListResponse) => {
    setPendingEditCompany(company);
    setIsEditDialogOpen(true);
  };

  const confirmEdit = async () => {
    if (!pendingEditCompany) return;
    setIsEditDialogOpen(false);
    await handleEdit(pendingEditCompany);
    setPendingEditCompany(null);
  };

  const requestDelete = (id: number) => {
    setPendingDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteCompany(pendingDeleteId);
      await loadData();
      if (selectedCompany?.id === pendingDeleteId) handleCloseDetail();
    } catch (err: any) {
      setError(err.response?.data?.message || t("companiesDeleteError"));
    } finally {
      setIsDeleteDialogOpen(false);
      setPendingDeleteId(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setClientPreview(null);
    setClientIdError("");
    setFormData({
      name: "", companyName: "", clientId: 0, inheritFromClient: true,
      inheritBasicInfo: false, inheritLogo: false, inheritContact: false, inheritAddress: false,
      inheritDetails: false, inheritAuthentication: false, inheritIntegrations: false,
      isActive: true, logoUrl: "", taxId: "", website: "", email: "", phone: "",
      address: "", city: "", state: "", country: "", postalCode: "", description: "",
      industry: "", employeeCount: "", foundedDate: "",
    });
    setActiveTab("basic");
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    setSelectedCompany(null);
    setActiveTab("info");
  };

  if (loading && !showForm) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("organization")}
        title={t("companiesTitle")}
        subtitle={t("companiesSubtitle")}
      >
        {showDetail && (
          <Button variant="secondary" onClick={handleCloseDetail} className="gap-2" size="sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            {t("back") || "Back"}
          </Button>
        )}
        {!showForm && !showDetail && (
          <Button onClick={() => { setShowForm(true); setActiveTab("basic"); }} variant="secondary" className="gap-2" size="sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            {t("companiesCreateNew")}
          </Button>
        )}
      </PageHeader>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in slide-in-from-top-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}

      {showDetail && selectedCompany ? (
        <CompanyDetails
          company={selectedCompany}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          onEdit={requestEdit}
          onDelete={requestDelete}
          onClose={handleCloseDetail}
        />
      ) : showForm ? (
        <CompanyForm
          editingId={editingId}
          formData={formData}
          activeTab={activeTab}
          clients={clients}
          clientPreview={clientPreview}
          clientIdError={clientIdError}
          setClientIdError={setClientIdError}
          onTabChange={(tab) => setActiveTab(tab)}
          setFormData={setFormData}
          onLogoUpload={handleLogoUpload}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      ) : (
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onView={handleView}
              onEdit={requestEdit}
              onDelete={requestDelete}
            />
          ))}
        </div>
      )}
      <ConfirmDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        title={t("confirm")}
        description={t("editConfirm")}
        confirmLabel={t("edit")}
        cancelLabel={t("cancel")}
        onConfirm={confirmEdit}
      />
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={t("confirm")}
        description={t("companiesDeleteConfirm")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}
