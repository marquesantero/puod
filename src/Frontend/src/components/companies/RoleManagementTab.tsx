import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import {
  getPermissions,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  type PermissionDto,
  type RoleDto,
} from "@/lib/securityApi";

import { ShieldCheck, Trash2, FlaskConical } from "lucide-react";

interface RoleManagementTabProps {
  companyId: number;
}

export function RoleManagementTab({ companyId }: RoleManagementTabProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [permissions, setPermissions] = useState<PermissionDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | "new" | null>(null);

  // Form State
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  // UI State
  const [saving, setSaving] = useState(false);
  const [roleNameError, setRoleNameError] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<number | null>(null);

  // Track original state for change detection
  const [originalState, setOriginalState] = useState<{
    name: string;
    description: string;
    perms: Set<string>;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [companyId]);

  // Detect changes
  useEffect(() => {
    if (!originalState) {
      setHasChanges(false);
      return;
    }

    const nameChanged = roleName !== originalState.name;
    const descChanged = roleDescription !== originalState.description;
    const permsChanged = selectedPerms.size !== originalState.perms.size ||
      Array.from(selectedPerms).some(p => !originalState.perms.has(p));

    setHasChanges(nameChanged || descChanged || permsChanged);
  }, [roleName, roleDescription, selectedPerms, originalState]);

  const loadData = async () => {
    try {
      const [permsData, rolesData] = await Promise.all([
        getPermissions(),
        getRoles(companyId, true) // isCompanyLevel = true to filter out Client Admin
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
      setOriginalState({
        name: "",
        description: "",
        perms: new Set()
      });
      return;
    }

    const role = roles.find(r => r.id === roleId);
    if (role) {
      const perms = new Set(role.permissionIds);
      setRoleName(role.name);
      setRoleDescription(role.description || "");
      setSelectedPerms(perms);
      setOriginalState({
        name: role.name,
        description: role.description || "",
        perms: perms
      });
    }
  };

  const togglePermission = (permId: string) => {
    const next = new Set(selectedPerms);
    if (next.has(permId)) {
      next.delete(permId);
    } else {
      next.add(permId);
    }
    setSelectedPerms(next);
  };

  const toggleCategory = (_category: string, perms: PermissionDto[]) => {
    const next = new Set(selectedPerms);
    const allIds = perms.map(p => p.id);
    const allSelected = allIds.every(id => next.has(id));

    if (allSelected) {
      // Unselect all in category
      allIds.forEach(id => next.delete(id));
    } else {
      // Select all in category
      allIds.forEach(id => next.add(id));
    }
    setSelectedPerms(next);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
        setRoleNameError(t("fieldRequired") || "This field is required");
        return;
    }

    setSaving(true);
    try {
      let savedRoleId = selectedRoleId;

      if (selectedRoleId === "new") {
        const newRole = await createRole(companyId, {
          name: roleName,
          description: roleDescription,
          permissionIds: Array.from(selectedPerms)
        });
        savedRoleId = newRole.id;
        showToast(t("rolesCreatedSuccess"), { variant: "success" });
      } else if (selectedRoleId) {
        await updateRole(selectedRoleId, {
          description: roleDescription,
          permissionIds: Array.from(selectedPerms)
        });
        showToast(t("rolesUpdatedSuccess"), { variant: "success" });
      }

      await loadData();

      // Maintain selection and update original state
      if (savedRoleId && savedRoleId !== "new") {
        setSelectedRoleId(savedRoleId);
        const updatedRole = roles.find(r => r.id === savedRoleId);
        if (updatedRole) {
          setOriginalState({
            name: roleName,
            description: roleDescription,
            perms: new Set(selectedPerms)
          });
        }
      }
    } catch (e) {
      console.error(e);
      showToast(t("rolesSaveFailed"), { variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
        await deleteRole(id);
        showToast(t("rolesDeleteSuccess"), { variant: "success" });
        if (selectedRoleId === id) setSelectedRoleId(null);
        loadData();
    } catch (e) {
        showToast(t("rolesDeleteFailed"), { variant: "destructive" });
    }
  };

  const requestDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
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
        {/* Sidebar List */}
        <div className="w-full md:w-[320px] shrink-0 space-y-4">
            <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/70">{t("rolesTitle")}</h3>
                <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); handleSelectRole("new"); }} className="h-8 text-primary font-bold hover:bg-primary/10">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="mr-1"><path d="M12 5v14M5 12h14"/></svg>
                  {t("rolesNew")}
                </Button>
            </div>
            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-2 no-scrollbar">
                {roles.map(role => (
                    <div 
                        key={role.id}
                        className={`group relative p-4 rounded-2xl cursor-pointer border transition-all duration-200 shadow-sm ${selectedRoleId === role.id ? "bg-primary border-primary text-primary-foreground shadow-md" : "bg-card border-border/50 hover:border-primary/30"}`}
                        onClick={() => handleSelectRole(role.id)}
                    >
                        <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                                <p className={`font-bold text-sm truncate ${selectedRoleId === role.id ? "text-white" : "text-foreground"}`}>{role.name}</p>
                                <p className={`text-[10px] uppercase font-bold tracking-wider mt-1 truncate ${selectedRoleId === role.id ? "text-white/70" : "text-muted-foreground"}`}>{role.description || t("rolesNoDescription")}</p>
                            </div>
                            {selectedRoleId === role.id && (
                                <button type="button" className="opacity-0 group-hover:opacity-100 p-1 bg-white/20 hover:bg-white/30 rounded-lg transition-all" onClick={(e) => requestDelete(e, role.id)}>
                                    <Trash2 className="w-3.5 h-3.5 text-white" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {roles.length === 0 && (
                  <div className="py-12 text-center border-2 border-dashed rounded-2xl text-muted-foreground text-xs italic">
                    {t("rolesEmpty")}
                  </div>
                )}
            </div>
        </div>

        <ConfirmDialog
          open={roleToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setRoleToDelete(null);
          }}
          title={t("confirm")}
          description={t("rolesDeleteConfirm")}
          confirmLabel={t("delete")}
          cancelLabel={t("cancel")}
          destructive
          onConfirm={confirmDelete}
        />

        {/* Edit Area */}
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
                                    placeholder={t("rolesRoleNamePlaceholder")}
                                    className={`h-11 rounded-xl bg-background font-bold ${roleNameError ? 'border-destructive' : ''}`}
                                />
                                {roleNameError && (
                                    <p className="text-xs text-destructive font-medium">{roleNameError}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{t("rolesDescription")}</Label>
                                <Input
                                    value={roleDescription}
                                    onChange={e => setRoleDescription(e.target.value)}
                                    placeholder={t("rolesDescriptionPlaceholder")}
                                    className="h-11 rounded-xl bg-background"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 space-y-6 overflow-y-auto pr-2 no-scrollbar">
                        <div className="flex items-center gap-2 px-2">
                          <ShieldCheck className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-black uppercase tracking-widest text-foreground">{t("rolesPermissionsMatrix")}</h4>
                        </div>
                        
                        <div className="grid gap-6">
                            {Object.entries(permissionsByCategory).map(([category, perms]) => {
                                const allSelected = perms.every(p => selectedPerms.has(p.id));
                                return (
                                    <div key={category} className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="px-4 py-3 bg-accent/30 border-b border-border/50 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              <input 
                                                  type="checkbox" 
                                                  className="rounded-md border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                                  checked={allSelected}
                                                  onChange={() => toggleCategory(category, perms)}
                                              />
                                              <h5 className="font-bold text-xs uppercase tracking-widest text-foreground">{t(category as any) || category}</h5>
                                            </div>
                                            <span className="text-[10px] font-bold text-muted-foreground bg-background px-2 py-0.5 rounded-full border">
                                              {perms.filter(p => selectedPerms.has(p.id)).length} / {perms.length}
                                            </span>
                                        </div>
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {perms.map(perm => (
                                                <label key={perm.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${selectedPerms.has(perm.id) ? 'bg-primary/5 border-primary/30' : 'bg-background border-transparent hover:border-border'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                                                        checked={selectedPerms.has(perm.id)}
                                                        onChange={() => togglePermission(perm.id)}
                                                    />
                                                    <div className="space-y-0.5 min-w-0">
                                                        <span className="font-bold text-xs block text-foreground truncate">{t(perm.id as any) || perm.id}</span>
                                                        <span className="text-[10px] text-muted-foreground leading-tight block">{perm.description}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-between items-center gap-4 pt-6 border-t border-border mt-auto">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                            {hasChanges && !saving && (
                                <span className="flex items-center gap-2 text-amber-600 animate-in pulse duration-1000">
                                    <FlaskConical className="w-4 h-4" />
                                    {t("rolesUnsavedChanges")}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <Button type="button" variant="ghost" onClick={(e) => { e.preventDefault(); setSelectedRoleId(null); }} disabled={saving} className="rounded-xl h-11 px-6">
                                {t("rolesCancel")}
                            </Button>
                            <Button type="button" onClick={handleSave} disabled={!hasChanges || saving} className="rounded-xl h-11 px-10 shadow-lg font-black uppercase tracking-widest">
                                {saving ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"/>
                                        {t("saving")}
                                    </span>
                                ) : t("rolesSave")}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-accent/5 rounded-3xl border-2 border-dashed border-border/50 p-12">
                    <ShieldCheck className="w-16 h-16 opacity-10 mb-4" />
                    <p className="text-sm font-medium italic">{t("rolesSelectPlaceholder")}</p>
                    <Button variant="outline" onClick={() => handleSelectRole("new")} className="mt-6 rounded-xl gap-2 h-10">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                      {t("rolesNew")}
                    </Button>
                </div>
            )}
        </div>
    </div>
  );
}
