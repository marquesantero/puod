import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import PageHeader from "@/components/layout/PageHeader";
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  type ClientListResponse,
  type ClientDetailResponse,
  type ClientCreateRequest,
  type ClientUpdateRequest,
  SubscriptionTier,
} from "@/lib/clientApi";
import { ClientCard } from "@/components/clients/ClientCard";
import { ClientDetails } from "@/components/clients/ClientDetails";
import { ClientForm } from "@/components/clients/ClientForm";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ClientFormData = {
  id?: number;
  name: string;
  tier: SubscriptionTier;
  isAlterable: boolean;
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

type Tab = "basic" | "contact" | "address" | "details" | "authentication" | "integrations" | "companies";

export default function ClientsPage() {
  const { t } = useI18n();
  const [clients, setClients] = useState<ClientListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientDetailResponse | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("basic");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingEditClient, setPendingEditClient] = useState<ClientListResponse | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ClientFormData>({
    name: "",
    tier: SubscriptionTier.Free,
    isAlterable: true,
    isActive: true,
    logoUrl: "",
    taxId: "",
    website: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    description: "",
    industry: "",
    employeeCount: "",
    foundedDate: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getClients();
      setClients(data || []);
    } catch (err: any) {
      console.error("Error loading clients:", err);
      setError(err.response?.data?.message || t("clientsLoadError"));
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError(t("clientsLogoInvalidType") || "Invalid file type.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t("clientsLogoTooLarge") || "File too large.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, logoUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) {
        const updateData: ClientUpdateRequest = {
          name: formData.name,
          tier: formData.tier,
          isActive: formData.isActive,
          logoUrl: formData.logoUrl || undefined,
          taxId: formData.taxId || undefined,
          website: formData.website || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
          country: formData.country || undefined,
          postalCode: formData.postalCode || undefined,
          description: formData.description || undefined,
          industry: formData.industry || undefined,
          employeeCount: formData.employeeCount ? parseInt(formData.employeeCount) : undefined,
          foundedDate: formData.foundedDate || undefined,
        };
        await updateClient(editingId, updateData);
      } else {
        const createData: ClientCreateRequest = {
          name: formData.name,
          tier: formData.tier,
          isAlterable: formData.isAlterable,
          logoUrl: formData.logoUrl || undefined,
          taxId: formData.taxId || undefined,
          website: formData.website || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
          country: formData.country || undefined,
          postalCode: formData.postalCode || undefined,
          description: formData.description || undefined,
          industry: formData.industry || undefined,
          employeeCount: formData.employeeCount ? parseInt(formData.employeeCount) : undefined,
          foundedDate: formData.foundedDate || undefined,
        };
        await createClient(createData);
      }
      await loadClients();
      handleCancel();
    } catch (err: any) {
      setError(err.response?.data?.message || t("clientsSaveError"));
    }
  };

  const handleView = async (client: ClientListResponse) => {
    try {
      const detail = await getClientById(client.id);
      setSelectedClient(detail);
      setShowDetail(true);
      setActiveTab("basic");
    } catch (err: any) {
      setError(err.response?.data?.message || t("clientsErrorDetails"));
    }
  };

  const handleEdit = async (client: any) => {
    try {
      const detail = await getClientById(client.id);
      setFormData({
        id: detail.id,
        name: detail.name,
        tier: detail.tier,
        isAlterable: detail.isAlterable,
        isActive: detail.isActive,
        logoUrl: detail.logoUrl || "",
        taxId: detail.taxId || "",
        website: detail.website || "",
        email: detail.email || "",
        phone: detail.phone || "",
        address: detail.address || "",
        city: detail.city || "",
        state: detail.state || "",
        country: detail.country || "",
        postalCode: detail.postalCode || "",
        description: detail.description || "",
        industry: detail.industry || "",
        employeeCount: detail.employeeCount ? detail.employeeCount.toString() : "",
        foundedDate: detail.foundedDate ? new Date(detail.foundedDate).toISOString().split('T')[0] : "",
      });
      setEditingId(client.id);
      setShowForm(true);
      setShowDetail(false);
      setSelectedClient(null);
      setActiveTab("basic");
    } catch (err: any) {
      setError(err.response?.data?.message || t("clientsErrorDetails"));
    }
  };

  const requestEdit = (client: ClientListResponse) => {
    setPendingEditClient(client);
    setIsEditDialogOpen(true);
  };

  const confirmEdit = async () => {
    if (!pendingEditClient) return;
    setIsEditDialogOpen(false);
    await handleEdit(pendingEditClient);
    setPendingEditClient(null);
  };

  const requestDelete = (id: number) => {
    const clientToDelete = clients.find(c => c.id === id);
    if (clientToDelete?.name === "Platform") {
      setError(t("clientsSystemClient") || "System client cannot be deleted");
      return;
    }
    setPendingDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteClient(pendingDeleteId);
      await loadClients();
      if (selectedClient?.id === pendingDeleteId) handleCloseDetail();
    } catch (err: any) {
      setError(err.response?.data?.message || t("clientsDeleteError"));
    } finally {
      setIsDeleteDialogOpen(false);
      setPendingDeleteId(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      name: "", tier: SubscriptionTier.Free, isAlterable: true, isActive: true, logoUrl: "",
      taxId: "", website: "", email: "", phone: "", address: "", city: "", state: "",
      country: "", postalCode: "", description: "", industry: "", employeeCount: "", foundedDate: "",
    });
    setError(null);
    setActiveTab("basic");
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    setSelectedClient(null);
    setActiveTab("basic");
  };

  if (loading) {
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
        title={t("clientsTitle")}
        subtitle={t("clientsSubtitle")}
      >
        {showDetail && (
          <Button variant="secondary" onClick={handleCloseDetail} className="gap-2" size="sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            {t("back") || "Back"}
          </Button>
        )}
        {!showForm && !showDetail && (
          <Button onClick={() => setShowForm(true)} variant="secondary" className="gap-2" size="sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            {t("clientsCreateNew")}
          </Button>
        )}
      </PageHeader>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in slide-in-from-top-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}

      {showDetail && selectedClient ? (
        <ClientDetails 
          client={selectedClient} 
          activeTab={activeTab} 
          onTabChange={(tab) => setActiveTab(tab)}
          onEdit={requestEdit}
          onDelete={requestDelete}
          onClose={handleCloseDetail}
        />
      ) : showForm ? (
        <ClientForm
          editingId={editingId !== null ? String(editingId) : null}
          formData={formData}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          setFormData={setFormData}
          onLogoUpload={handleLogoUpload}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      ) : (
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <ClientCard 
              key={client.id} 
              client={client} 
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
        description={t("clientsDeleteConfirm")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}
