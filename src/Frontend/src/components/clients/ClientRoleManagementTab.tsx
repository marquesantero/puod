import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n, type MessageKey } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import { 
  getPermissions, 
  getRolesForClient, 
  createRoleForClient, 
  updateRoleForClient, 
  deleteRoleForClient, 
  type PermissionDto, 
  type RoleDto 
} from "@/lib/securityApi";
import { ShieldCheck, Trash2 } from "lucide-react";

interface ClientRoleManagementTabProps {
  clientId: number;
}

export function ClientRoleManagementTab({ clientId }: ClientRoleManagementTabProps) {
  const { t } = useI18n();
  const { showToast } = useToast();

  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [permissions, setPermissions] = useState<PermissionDto[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | "new" | null>(null);

  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [roleNameError, setRoleNameError] = useState("");
  const [roleToDelete, setRoleToDelete] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    try {
      const [permsData, rolesData] = await Promise.all([
        getPermissions(),
        getRolesForClient(clientId)
      ]);
      setPermissions(permsData);
      setRoles(rolesData);
    } catch (e) {
      console.error(e);
      showToast(t("rolesLoadFailed"), { variant: "destructive" });
    }
  };

  const handleSelectRole = (roleId: number | "new") => {
    setSelectedRoleId(roleId);
    setRoleNameError("");
    if (roleId === "new") {
      setRoleName("");
      setRoleDescription("");
      setSelectedPerms(new Set());
      return;
    }
    const role = roles.find(r => r.id === roleId);
    if (role) {
      setRoleName(role.name);
      setRoleDescription(role.description || "");
      setSelectedPerms(new Set(role.permissionIds));
    }
  };

  const handleSave = async () => {
    if (!roleName.trim()) {
        setRoleNameError(t("fieldRequired") || "This field is required");
        return;
    }
    setSaving(true);
    try {
      const data = { name: roleName, description: roleDescription, permissionIds: Array.from(selectedPerms) };
      if (selectedRoleId === "new") {
        await createRoleForClient(clientId, data);
        showToast(t("rolesCreatedSuccess"), { variant: "success" });
      } else if (selectedRoleId) {
        await updateRoleForClient(clientId, selectedRoleId, data);
        showToast(t("rolesUpdatedSuccess"), { variant: "success" });
      }
      setSelectedRoleId(null);
      await loadData();
    } catch (e) {
      showToast(t("rolesSaveFailed"), { variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
        await deleteRoleForClient(clientId, id);
        showToast(t("rolesDeleteSuccess" as MessageKey), { variant: "success" });
        if (selectedRoleId === id) setSelectedRoleId(null);
        loadData();
    } catch (e) {
        showToast(t("rolesDeleteFailed"), { variant: "destructive" });
    }
  };

  const requestDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setRoleToDelete(id);
  };

  const confirmDelete = () => {
    if (roleToDelete === null) return;
    handleDelete(roleToDelete);
    setRoleToDelete(null);
  };

  const permissionsByCategory = useMemo(() => {
    const groups: Record<string, PermissionDto[]> = {};
    permissions.forEach(p => {
        if (!groups[p.category]) groups[p.category] = [];
        groups[p.category].push(p);
    });
    return groups;
  }, [permissions]);

  return (
    <div className="flex flex-col md:flex-row gap-8 min-h-[600px] pt-6 animate-in fade-in duration-500">
        {/* Sidebar */}
        <div className="w-full md:w-[320px] shrink-0 space-y-4">
            <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/70">{t("rolesTitle")}</h3>
                <Button variant="ghost" size="sm" onClick={() => handleSelectRole("new")} className="h-8 text-primary font-bold">
                  {t("rolesNew")}
                </Button>
            </div>
            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-2 no-scrollbar">
                {roles.map(role => (
                    <div 
                        key={role.id}
                        className={`group relative p-4 rounded-2xl cursor-pointer border transition-all ${selectedRoleId === role.id ? "bg-primary border-primary text-primary-foreground shadow-md" : "bg-card border-border/50 hover:border-primary/30"}`}
                        onClick={() => handleSelectRole(role.id)}
                    >
                        <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                                <p className="font-bold text-sm truncate">{role.name}</p>
                                <p className="text-[10px] uppercase font-bold tracking-wider mt-1 truncate opacity-70">{role.description || t("rolesNoDescription")}</p>
                            </div>
                            <button type="button" className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded-lg" onClick={(e) => requestDelete(e, role.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <ConfirmDialog
          open={roleToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setRoleToDelete(null);
          }}
          title={t("confirm")}
          description={t("rolesDeleteConfirm" as MessageKey)}
          confirmLabel={t("delete")}
          cancelLabel={t("cancel")}
          destructive
          onConfirm={confirmDelete}
        />

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
            {selectedRoleId ? (
                <div className="flex flex-col h-full space-y-6">
                    <div className="bg-accent/10 p-6 rounded-3xl border border-border/50 space-y-6 shadow-sm">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{t("rolesRoleName")}</Label>
                                <Input
                                    value={roleName}
                                    onChange={e => {
                                        setRoleName(e.target.value);
                                        if (roleNameError) setRoleNameError("");
                                    }}
                                    disabled={selectedRoleId !== "new"}
                                    className={`h-11 rounded-xl bg-background font-bold ${roleNameError ? 'border-destructive' : ''}`}
                                />
                                {roleNameError && (
                                    <p className="text-xs text-destructive font-medium">{roleNameError}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{t("rolesDescription")}</Label>
                                <Input value={roleDescription} onChange={e => setRoleDescription(e.target.value)} className="h-11 rounded-xl bg-background" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 space-y-6 overflow-y-auto pr-2 no-scrollbar">
                        <div className="flex items-center gap-2 px-2">
                          <ShieldCheck className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-black uppercase tracking-widest text-foreground">{t("rolesPermissionsMatrix")}</h4>
                        </div>
                        <div className="grid gap-6">
                            {Object.entries(permissionsByCategory).map(([category, perms]) => (
                                <div key={category} className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="px-4 py-3 bg-accent/30 border-b border-border/50 flex items-center justify-between">
                                        <h5 className="font-bold text-xs uppercase tracking-widest text-foreground">{t(category as MessageKey) || category}</h5>
                                        <span className="text-[10px] font-bold text-muted-foreground bg-background px-2 py-0.5 rounded-full border">{perms.filter(p => selectedPerms.has(p.id)).length} / {perms.length}</span>
                                    </div>
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {perms.map(perm => (
                                            <label key={perm.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${selectedPerms.has(perm.id) ? 'bg-primary/5 border-primary/30' : 'border-transparent hover:border-border'}`}>
                                                <input 
                                                    type="checkbox" 
                                                    className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                                                    checked={selectedPerms.has(perm.id)}
                                                    onChange={() => {
                                                        const next = new Set(selectedPerms);
                                                        if (next.has(perm.id)) next.delete(perm.id);
                                                        else next.add(perm.id);
                                                        setSelectedPerms(next);
                                                    }}
                                                />
                                                <div className="space-y-0.5 min-w-0">
                                                    <span className="font-bold text-xs block text-foreground truncate">{t(perm.id as MessageKey) || perm.id}</span>
                                                    <span className="text-[10px] text-muted-foreground leading-tight block">{perm.description}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-border mt-auto">
                        <Button variant="ghost" onClick={() => setSelectedRoleId(null)} className="rounded-xl h-11 px-6">{t("cancel")}</Button>
                        <Button onClick={handleSave} disabled={saving} className="rounded-xl h-11 px-10 shadow-lg font-bold">
                            {saving ? t("saving") : t("save")}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-accent/5 rounded-3xl border-2 border-dashed border-border/50 p-12">
                    <ShieldCheck className="w-16 h-16 opacity-10 mb-4" />
                    <p className="text-sm font-medium italic">{t("rolesSelectPlaceholder")}</p>
                </div>
            )}
        </div>
    </div>
  );
}
