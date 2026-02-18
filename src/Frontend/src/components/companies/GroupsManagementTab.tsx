/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import { getAuthProfiles, type AuthProfileListResponse } from "@/lib/authProfileApi";
import {
  searchGroups,
  importGroup,
  getGroups,
  createGroup,
  deleteGroup,
  IdentitySource,
  type IdentityGroupResult,
  type GroupDto,
} from "@/lib/securityApi";
import { Can } from "@/components/auth/Can";
import { Trash2, Users } from "lucide-react";

interface GroupsManagementTabProps {
  companyId: number;
}

export function GroupsManagementTab({ companyId }: GroupsManagementTabProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Data
  const [authProfiles, setAuthProfiles] = useState<AuthProfileListResponse[]>([]);
  const [groups, setGroups] = useState<GroupDto[]>([]);

  // UI States
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<number | null>(null);

  // Search/Import State (Modal)
  const [importSource, setImportSource] = useState<"Local" | string>("Local");
  const [importSearchTerm, setImportSearchTerm] = useState("");
  const [importSearchResults, setImportSearchResults] = useState<IdentityGroupResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);

  // Create Group State
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // List Filter State
  const [listSearchTerm, setListSearchTerm] = useState("");
  const [sourceFilters, setSourceFilters] = useState<Set<string>>(
    new Set(["Local", "WindowsAd", "AzureAd"])
  );

  useEffect(() => {
    loadAuthProfiles();
    loadGroups();
  }, [companyId]);

  const loadAuthProfiles = async () => {
    try {
      const profiles = await getAuthProfiles(companyId);
      setAuthProfiles(profiles.filter((p) => p.isActive));
    } catch (e) {
      console.error(e);
    }
  };

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const data = await getGroups(companyId);
      setGroups(data as any);
    } catch (e) {
      console.error("Failed to load groups", e);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleImportSearch = async () => {
    if (!importSearchTerm) return;
    setSearching(true);
    setImportSearchResults([]);
    try {
      let sourceEnum = IdentitySource.Local;
      let profileId = undefined;

      if (importSource !== "Local") {
        const profile = authProfiles.find((p) => p.id.toString() === importSource);
        if (profile) {
          profileId = profile.id;
          sourceEnum = (profile.providerType === "WindowsAd"
            ? IdentitySource.WindowsAd
            : IdentitySource.AzureAd) as any;
        }
      }

      const results = await searchGroups(importSearchTerm, sourceEnum, profileId ? String(profileId) : undefined);

      const markedResults = results.map((r) => ({
        ...r,
        isImported: groups.some((g: any) => String(g.externalId) === String(r.id)),
      }));

      setImportSearchResults(markedResults);
    } catch (e) {
      showToast(t("testConnectionFailed"), { variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (group: IdentityGroupResult) => {
    setImporting(group.id);
    try {
      await importGroup({
        profileId: companyId,
        externalId: group.id,
        name: group.name,
        source: group.source,
      });
      showToast("Group imported successfully", { variant: "success" });
      setImportSearchResults((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, isImported: true } : g))
      );
      loadGroups();
    } catch (e) {
      showToast("Failed to import group", { variant: "destructive" });
    } finally {
      setImporting(null);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      await createGroup(companyId, {
        name: newGroupName,
        description: newGroupDescription,
      });
      showToast("Group created successfully", { variant: "success" });
      setIsCreateDialogOpen(false);
      setNewGroupName("");
      setNewGroupDescription("");
      loadGroups();
    } catch (e) {
      showToast("Failed to create group", { variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (groupId: number) => {
    try {
      await deleteGroup(groupId);
      showToast("Group deleted successfully", { variant: "success" });
      loadGroups();
    } catch (e) {
      showToast("Failed to delete group", { variant: "destructive" });
    }
  };

  const requestDelete = (e: React.MouseEvent, groupId: number) => {
    e.stopPropagation();
    setGroupToDelete(groupId);
  };

  const confirmDelete = () => {
    if (groupToDelete === null) return;
    handleDelete(groupToDelete);
    setGroupToDelete(null);
  };

  const toggleSourceFilter = (source: string) => {
    const next = new Set(sourceFilters);
    if (next.has(source)) {
      next.delete(source);
    } else {
      next.add(source);
    }
    setSourceFilters(next);
  };

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      const matchesSearch =
        group.name.toLowerCase().includes(listSearchTerm.toLowerCase()) ||
        (group.description?.toLowerCase() || "").includes(listSearchTerm.toLowerCase());
      const matchesSource = sourceFilters.has(group.type);
      return matchesSearch && matchesSource;
    });
  }, [groups, listSearchTerm, sourceFilters]);

  const getSourceBadgeColor = (type: string) => {
    switch (type) {
      case "WindowsAd":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "AzureAd":
        return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getSourceName = (type: string) => {
    switch (type) {
      case "WindowsAd":
        return t("windowsAd") || "Windows AD";
      case "AzureAd":
        return t("azureAd") || "Azure AD";
      default:
        return t("localAuth") || "Local";
    }
  };

  return (
    <div className="space-y-8 pt-6 animate-in fade-in duration-500">
      {/* Header and Filters */}
      <div className="flex flex-col gap-6 bg-accent/10 p-6 rounded-3xl border border-border/50 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1 max-w-md space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
              {t("groupsSearchLabel") || "Search Groups"}
            </Label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <Input
                placeholder={t("groupsFilterPlaceholder") || "Filter by name or description..."}
                value={listSearchTerm}
                onChange={(e) => setListSearchTerm(e.target.value)}
                className="bg-background pl-10 h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Can I="Security.Groups.Manage">
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                type="button"
                variant="outline"
                className="h-11 rounded-xl gap-2 font-bold"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t("groupsCreateLocal") || "Create Local Group"}
              </Button>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                type="button"
                className="h-11 rounded-xl shadow-lg gap-2 font-bold"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                {t("groupsImport") || "Import Group"}
              </Button>
            </Can>
          </div>
        </div>

        {/* Source Type Filters */}
        <div className="flex flex-wrap items-center gap-6 pt-2">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            {t("filterByType") || "Filter by type"}
          </span>

          <div className="flex flex-wrap gap-3">
            {["Local", "WindowsAd", "AzureAd"].map((source) => (
              <label
                key={source}
                className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer select-none
                ${
                  sourceFilters.has(source)
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary/30"
                }
              `}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={sourceFilters.has(source)}
                  onChange={() => toggleSourceFilter(source)}
                />
                <span className="text-xs font-bold uppercase tracking-wider">{getSourceName(source)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loadingGroups ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-3xl bg-accent/10 animate-pulse border border-dashed" />
          ))
        ) : filteredGroups.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl text-muted-foreground italic bg-accent/5">
            <p className="text-lg font-medium">{t("groupsListEmpty") || "No groups found"}</p>
            <p className="text-sm mt-2">{t("groupsListEmptyHint") || "Create or import groups to get started"}</p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <Card
              key={group.id}
              className="group relative overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-3xl"
              onClick={() => navigate(`/groups/${group.id}`)}
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-20" />
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary font-black text-sm shrink-0 shadow-sm">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
                      {group.name}
                    </h5>
                    <p className="text-xs text-muted-foreground truncate font-medium">
                      {group.userCount} {group.userCount === 1 ? "member" : "members"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-4 border-t border-border/50">
                  <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getSourceBadgeColor(group.type)}`}>
                    {getSourceName(group.type)}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => requestDelete(e, group.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ConfirmDialog
        open={groupToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setGroupToDelete(null);
        }}
        title={t("confirm")}
        description={t("groupsDeleteConfirm") || "Are you sure you want to delete this group?"}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={confirmDelete}
      />

      {/* Create Local Group Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("groupsCreateLocalTitle") || "Create Local Group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("groupsName") || "Group Name"}</Label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t("groupsNamePlaceholder") || "Enter group name"}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("groupsDescription") || "Description"} (Optional)</Label>
              <Input
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder={t("groupsDescriptionPlaceholder") || "Enter description"}
              />
            </div>
            <Button onClick={handleCreateGroup} disabled={creating || !newGroupName.trim()} className="w-full">
              {creating ? "Creating..." : t("create") || "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Group Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("groupsImportTitle") || "Import Group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end bg-muted/30 p-4 rounded-lg">
              <div className="w-full sm:w-1/3 space-y-2">
                <Label>{t("groupsSource") || "Source"}</Label>
                <Select value={importSource} onValueChange={setImportSource}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Local">{t("localAuth") || "Local"}</SelectItem>
                    {authProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name} ({p.providerType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 w-full space-y-2">
                <Label>{t("groupsSearch") || "Search"}</Label>
                <div className="flex gap-2">
                  <Input
                    className="bg-background"
                    value={importSearchTerm}
                    onChange={(e) => setImportSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleImportSearch()}
                    placeholder={t("groupsSearchPlaceholder") || "Search for groups..."}
                  />
                  <Button type="button" onClick={handleImportSearch} disabled={searching}>
                    {searching ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                        {t("usersSearching") || "Searching..."}
                      </span>
                    ) : (
                      t("search") || "Search"
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t("summary") || "Results"}
              </h4>
              {importSearchResults.length === 0 && !searching && (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                  <p>{t("groupsNoResults") || "No groups found"}</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {importSearchResults.map((group) => (
                  <Card key={group.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-sm truncate" title={group.name}>
                            {group.name}
                          </h5>
                          <p className="text-xs text-muted-foreground truncate">
                            {getSourceName(group.source === IdentitySource.WindowsAd ? "WindowsAd" : group.source === IdentitySource.AzureAd ? "AzureAd" : "Local")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button
                          type="button"
                          size="sm"
                          variant={group.isImported ? "secondary" : "default"}
                          className="w-full h-7 text-xs"
                          disabled={group.isImported || importing === group.id}
                          onClick={() => handleImport(group)}
                        >
                          {group.isImported
                            ? t("groupsAdded") || "Added"
                            : importing === group.id
                            ? t("groupsImporting") || "Importing..."
                            : t("groupsImport") || "Import"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
