/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import {
    getRoles,
    getRolesForClient,
    getUserRoles,
    getUserRolesForClient,
    assignUserRoles,
    deleteUser,
    getUserCompanyAvailability,
    type RoleDto,
} from "@/lib/securityApi";
import { getClients } from "@/lib/clientApi";
import { CompanySelector, type CompanyOption } from "@/components/common/CompanySelector";
import apiClient from "@/lib/api-client";

export default function UserProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const { showToast } = useToast();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState<RoleDto[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  // Company selection for client-level users
  const [isClientLevelUser, setIsClientLevelUser] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [roleCompanies, setRoleCompanies] = useState<Map<number, number[]>>(new Map());

  // Role Filter
  const [roleSearch, setRoleSearch] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [roleOptions, setRoleOptions] = useState<Array<{
      key: string;
      name: string;
      description?: string;
      scope: "client" | "company";
      clientRoleId?: number;
      companyRoleIds?: Map<number, number>;
      roleId?: number;
      permissionIds: string[];
  }>>([]);
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<Set<string>>(new Set());
  const [roleCompanySelections, setRoleCompanySelections] = useState<Map<string, number[]>>(new Map());

  const scopeParam = searchParams.get("scope");
  const scopeProfileId = searchParams.get("profileId");
  const scopeClientId = searchParams.get("clientId");
  const isCompanyScope = scopeParam === "company" && !!scopeProfileId;
  const isClientScope = scopeParam === "client" && !!scopeClientId;

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/security/users/${userId}`);
      const userData = response.data;
      setUser(userData);

      // Check if user is client-level (has clientId but no profileId)
      const isClientLevel = userData.clientId && !userData.profileId;
      setIsClientLevelUser(isClientLevel);

      let profileOrClientId = isClientLevel ? userData.clientId : userData.profileId;

      if (isCompanyScope) {
        const profileIdValue = Number(scopeProfileId);
        setIsClientLevelUser(false);
        profileOrClientId = profileIdValue;

        const [allRoles, currentRoles] = await Promise.all([
          getRoles(profileIdValue),
          getUserRoles(Number(userId!), profileIdValue)
        ]);

        setAvailableRoles(allRoles);
        setSelectedRoleIds(new Set(currentRoles));
        const nextRoleOptions = allRoles.map(role => ({
          key: `company:${role.id}`,
          name: role.name,
          description: role.description,
          scope: "company" as const,
          permissionIds: role.permissionIds,
          roleId: role.id
        }));
        setRoleOptions(nextRoleOptions);
        setSelectedRoleKeys(new Set(nextRoleOptions.filter(role => currentRoles.includes(role.roleId ?? -1)).map(role => role.key)));
        setRoleCompanySelections(new Map());
      } else if (isClientScope || isClientLevel) {
        if (isClientScope) {
          profileOrClientId = Number(scopeClientId);
          setIsClientLevelUser(true);
        }

        // Load companies and available companies for this user
        const clientsData = await getClients();
        const client = clientsData.find(c => c.id === profileOrClientId);
        if (client && client.companies) {
          setCompanies(client.companies.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug
          })));
        }

        // Load user's company availability to initialize roleCompanies
        const availability = await getUserCompanyAvailability(Number(userId!), profileOrClientId);
        const userCompanyIds = availability.filter(c => c.isAvailable).map(c => c.companyId);

        const clientRoles = await getRolesForClient(profileOrClientId);
        const companyRolesByCompany = await Promise.all(
          (client?.companies || []).map(async (company) => {
            const roles = await getRoles(company.id);
            return { companyId: company.id, roles };
          })
        );

        const roleOptionsList: typeof roleOptions = [];
        const clientRoleKeyMap = new Map<number, string>();
        clientRoles.forEach(role => {
          const key = `client:${role.id}`;
          clientRoleKeyMap.set(role.id, key);
          roleOptionsList.push({
            key,
            name: role.name,
            description: role.description,
            scope: "client",
            clientRoleId: role.id,
            roleId: role.id,
            permissionIds: role.permissionIds
          });
        });

        const companyRoleMapByName = new Map<string, {
          description?: string;
          permissionIds: string[];
          roleIdsByCompany: Map<number, number>;
        }>();

        companyRolesByCompany.forEach(({ companyId, roles }) => {
          roles.forEach(role => {
            const entry = companyRoleMapByName.get(role.name);
            if (!entry) {
              companyRoleMapByName.set(role.name, {
                description: role.description,
                permissionIds: role.permissionIds,
                roleIdsByCompany: new Map([[companyId, role.id]])
              });
            } else {
              entry.roleIdsByCompany.set(companyId, role.id);
            }
          });
        });

        companyRoleMapByName.forEach((entry, roleName) => {
          roleOptionsList.push({
            key: `company:${roleName}`,
            name: roleName,
            description: entry.description,
            scope: "company",
            companyRoleIds: entry.roleIdsByCompany,
            permissionIds: entry.permissionIds
          });
        });

        setRoleOptions(roleOptionsList);
        setAvailableRoles(clientRoles);

        const clientRoleAssignments = await getUserRolesForClient(Number(userId!), profileOrClientId);
        const companyRoleAssignments = await Promise.all(
          (client?.companies || []).map(async (company) => ({
            companyId: company.id,
            roleIds: await getUserRoles(Number(userId!), company.id)
          }))
        );

        const nextSelectedKeys = new Set<string>();
        const nextRoleCompanySelections = new Map<string, number[]>();

        clientRoleAssignments.forEach(roleId => {
          const key = clientRoleKeyMap.get(roleId);
          if (key) {
            nextSelectedKeys.add(key);
          }
        });

        companyRoleAssignments.forEach(({ companyId, roleIds }) => {
          roleIds.forEach(roleId => {
            roleOptionsList.forEach(option => {
              if (option.scope !== "company" || !option.companyRoleIds) return;
              const mappedRoleId = option.companyRoleIds.get(companyId);
              if (mappedRoleId === roleId) {
                nextSelectedKeys.add(option.key);
                const existing = nextRoleCompanySelections.get(option.key) || [];
                if (!existing.includes(companyId)) {
                  nextRoleCompanySelections.set(option.key, [...existing, companyId]);
                }
              }
            });
          });
        });

        setSelectedRoleKeys(nextSelectedKeys);
        setRoleCompanySelections(nextRoleCompanySelections);
        setSelectedRoleIds(new Set(clientRoleAssignments));

        // Initialize roleCompanies with user's available companies for legacy client role assignment
        const initialRoleCompanies = new Map<number, number[]>();
        clientRoleAssignments.forEach(roleId => {
          initialRoleCompanies.set(roleId, userCompanyIds);
        });
        setRoleCompanies(initialRoleCompanies);
      } else {
        // Company-level user: standard role loading
        const [allRoles, currentRoles] = await Promise.all([
          getRoles(profileOrClientId),
          getUserRoles(Number(userId!), profileOrClientId)
        ]);

        setAvailableRoles(allRoles);
        setSelectedRoleIds(new Set(currentRoles));
        const nextRoleOptions = allRoles.map(role => ({
          key: `company:${role.id}`,
          name: role.name,
          description: role.description,
          scope: "company" as const,
          permissionIds: role.permissionIds,
          roleId: role.id
        }));
        setRoleOptions(nextRoleOptions);
        setSelectedRoleKeys(new Set(nextRoleOptions.filter(role => currentRoles.includes(role.roleId ?? -1)).map(role => role.key)));
      }
    } catch (e) {
      console.error(e);
      showToast(t("userProfileNotFound"), { variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
      try {
          const nextStatus = !user.isActive;
          await apiClient.put(`/security/users/${userId}/status`, { isActive: nextStatus });
          setUser({ ...user, isActive: nextStatus });
          showToast(t("usersStatusUpdated"), { variant: "success" });
      } catch (e) {
          showToast(t("usersStatusError"), { variant: "destructive" });
      }
  };

  const handleSaveRoles = async () => {
      setSaving(true);
      try {
          let profileOrClientId = isClientLevelUser ? user.clientId : user.profileId;
          if (isCompanyScope) {
            profileOrClientId = Number(scopeProfileId);
          } else if (isClientScope) {
            profileOrClientId = Number(scopeClientId);
          }

          if (isClientLevelUser) {
              const roleIdsToAssign: number[] = [];
              const roleCompaniesObj: Record<number, number[]> = {};

              roleOptions.forEach(option => {
                if (!selectedRoleKeys.has(option.key)) {
                  return;
                }

                if (option.scope === "client" && option.clientRoleId) {
                  roleIdsToAssign.push(option.clientRoleId);
                  if (roleCompanies.has(option.clientRoleId)) {
                    roleCompaniesObj[option.clientRoleId] = roleCompanies.get(option.clientRoleId) || [];
                  }
                  return;
                }

                if (option.scope === "company" && option.companyRoleIds) {
                  const selectedCompanies = roleCompanySelections.get(option.key) || [];
                  selectedCompanies.forEach(companyId => {
                    const roleId = option.companyRoleIds?.get(companyId);
                    if (roleId) {
                      roleIdsToAssign.push(roleId);
                      roleCompaniesObj[roleId] = [companyId];
                    }
                  });
                }
              });

              await assignUserRoles(Number(userId!), profileOrClientId, roleIdsToAssign, roleCompaniesObj);
          } else {
              await assignUserRoles(Number(userId!), profileOrClientId, Array.from(selectedRoleIds));
          }

          showToast(t("usersRolesUpdated"), { variant: "success" });
      } catch (e) {
          showToast(t("stepSaveFailed"), { variant: "destructive" });
      } finally {
          setSaving(false);
      }
  };

  const handleDeleteUser = async () => {
      try {
          await deleteUser(Number(userId!));
          showToast(t("usersDeleteSuccess"), { variant: "success" });
          navigate(-1);
      } catch (e) {
          showToast(t("usersDeleteError"), { variant: "destructive" });
      }
  };

  const requestDeleteUser = () => {
      setIsDeleteDialogOpen(true);
  };

  const toggleRole = (roleKey: string) => {
      const option = roleOptions.find(role => role.key === roleKey);
      const nextKeys = new Set(selectedRoleKeys);
      if (nextKeys.has(roleKey)) {
          nextKeys.delete(roleKey);
          if (isClientLevelUser) {
              const newRoleCompanies = new Map(roleCompanySelections);
              newRoleCompanies.delete(roleKey);
              setRoleCompanySelections(newRoleCompanies);
          }
          if (option?.roleId) {
              const nextIds = new Set(selectedRoleIds);
              nextIds.delete(option.roleId);
              setSelectedRoleIds(nextIds);
          }
      } else {
          nextKeys.add(roleKey);
          if (option?.roleId) {
              const nextIds = new Set(selectedRoleIds);
              nextIds.add(option.roleId);
              setSelectedRoleIds(nextIds);
          }
      }
      setSelectedRoleKeys(nextKeys);
  };

  const updateRoleCompanies = (roleKey: string, companyIds: number[]) => {
      const newRoleCompanies = new Map(roleCompanySelections);
      newRoleCompanies.set(roleKey, companyIds);
      setRoleCompanySelections(newRoleCompanies);
  };

  const filteredRoles = roleOptions.filter(r => 
      r.name.toLowerCase().includes(roleSearch.toLowerCase()) || 
      (r.description && r.description.toLowerCase().includes(roleSearch.toLowerCase()))
  );

  if (loading) return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
          <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"/>
              {t("loading")}
          </span>
      </div>
  );
  
  if (!user) return <div className="p-8 text-center text-destructive">{t("userProfileNotFound")}</div>;

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4 space-y-8 animate-in fade-in duration-500">
      {/* Top Nav */}
      <div className="flex items-center text-sm text-muted-foreground">
        <button onClick={() => navigate(-1)} className="hover:text-foreground transition-colors flex items-center gap-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            {t("back")}
        </button>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">{t("userProfileTitle")}</span>
      </div>

      {/* Hero Banner */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center text-3xl font-bold shadow-inner shrink-0">
                {user.displayName.substring(0, 2).toUpperCase()}
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{user.displayName}</h1>
                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    <span>{user.username}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400`}>
                        {user.source}
                    </span>
                    {user.isImported && <span className="text-xs text-muted-foreground">• {t("imported")}</span>}
                </div>
            </div>
        </div>

        <div className="flex flex-col items-end gap-4 min-w-[200px]">
            <div 
                className={`flex items-center gap-3 px-4 py-2 rounded-lg border transition-colors cursor-pointer select-none ${user.isActive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 border-transparent'}`}
                onClick={handleToggleActive}
            >
                <div className="text-right">
                        <p className={`text-sm font-bold ${user.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                            {user.isActive ? t("userProfileStatusActiveTitle") : t("userProfileStatusInactiveTitle")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                            {user.isActive ? t("userProfileStatusActiveDesc") : t("userProfileStatusInactiveDesc")}
                        </p>
                </div>
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${user.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${user.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Role Management */}
        <div className="lg:col-span-2 space-y-6">
            <Card className="h-full border-border shadow-sm">
                <CardHeader className="border-b pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle>{t("userProfileRoles")}</CardTitle>
                            <CardDescription>{t("usersEditRolesSubtitle")} {user.displayName}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Input 
                                placeholder={t("userProfileSearchRolesPlaceholder")}
                                className="h-9 w-[200px]"
                                value={roleSearch}
                                onChange={e => setRoleSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredRoles.map(role => (
                            <div key={role.key} className="space-y-3">
                                <div
                                    onClick={() => toggleRole(role.key)}
                                    className={`
                                        relative p-4 rounded-xl border transition-all duration-200 cursor-pointer group
                                        ${selectedRoleKeys.has(role.key)
                                            ? 'bg-primary/5 border-primary ring-1 ring-primary/20 shadow-sm'
                                            : 'bg-card border-border hover:border-primary/50 hover:bg-muted/30'}
                                    `}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`
                                            flex h-5 w-5 items-center justify-center rounded border transition-colors mt-0.5
                                            ${selectedRoleKeys.has(role.key) ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 bg-transparent'}
                                        `}>
                                            {selectedRoleKeys.has(role.key) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5"/></svg>}
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-sm font-semibold transition-colors ${selectedRoleKeys.has(role.key) ? 'text-primary' : 'text-foreground'}`}>
                                                {role.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                {role.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {isClientLevelUser && selectedRoleKeys.has(role.key) && role.scope === "company" && companies.length > 0 && (
                                    <div className="pl-2 pr-2 pb-2">
                                        <CompanySelector
                                            companies={companies}
                                            selectedCompanyIds={roleCompanySelections.get(role.key) || []}
                                            onChange={(companyIds) => updateRoleCompanies(role.key, companyIds)}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {filteredRoles.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            {t("userProfileNoRolesMatch")}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Right: Actions & Meta */}
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t("actions")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button 
                        className="w-full h-11" 
                        onClick={handleSaveRoles} 
                        disabled={saving}
                    >
                        {saving ? (
                            <span className="flex items-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"/>
                                {t("saving")}
                            </span>
                        ) : t("userProfileSave")}
                    </Button>
                    
                    <Button 
                        variant="destructive" 
                        className="w-full h-11" 
                        onClick={requestDeleteUser}
                    >
                        {t("usersDeleteAction")}
                    </Button>

                    <div className="pt-4 border-t">
                        <Label className="text-xs uppercase text-muted-foreground tracking-wider mb-2 block">{t("systemMetadata")}</Label>
                        <dl className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <dt className="text-muted-foreground">{t("userId")}</dt>
                                <dd className="font-mono text-xs truncate max-w-[150px]" title={user.id}>{user.id}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-muted-foreground">{t("createdAt")}</dt>
                                <dd>--</dd>
                            </div>
                        </dl>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={t("confirm")}
        description={t("userProfileDeleteConfirm")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={handleDeleteUser}
      />
    </div>
  );
}
