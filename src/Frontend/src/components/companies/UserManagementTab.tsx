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
import { Can } from "@/components/auth/Can";
import { Trash2 } from "lucide-react";
import {
  getUsers,
  searchUsers,
  importUser,
  createLocalUser,
  deleteUser,
  IdentitySource,
  type IdentityUserResult,
} from "@/lib/securityApi";

interface UserManagementTabProps {
  companyId: number;
}

export function UserManagementTab({ companyId }: UserManagementTabProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  // Data
  const [authProfiles, setAuthProfiles] = useState<AuthProfileListResponse[]>([]);
  const [users, setUsers] = useState<IdentityUserResult[]>([]);
  
  // UI States
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // Search/Import State (Modal)
  const [importSource, setImportSource] = useState<"Local" | string>("Local");
  const [importSearchTerm, setImportSearchTerm] = useState("");
  const [importSearchResults, setImportSearchResults] = useState<IdentityUserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);
  const [userToDelete, setUserToDelete] = useState<IdentityUserResult | null>(null);

  // Local User Creation State
  const [localUserForm, setLocalUserForm] = useState({
    username: "",
    displayName: "",
    password: "",
    confirmPassword: "",
    photoUrl: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [photoInputType, setPhotoInputType] = useState<"url" | "upload">("url");
  const [formErrors, setFormErrors] = useState({
    username: "",
    displayName: "",
    password: "",
    confirmPassword: ""
  });

  // List Filter State
  const [listSearchTerm, setListSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [sourceFilters, setSourceFilters] = useState<Set<IdentitySource>>(new Set([IdentitySource.Local, IdentitySource.WindowsAd, IdentitySource.AzureAd]));

  useEffect(() => {
    loadAuthProfiles();
    loadUsers();
  }, [companyId]);

  const loadAuthProfiles = async () => {
    try {
      const profiles = await getAuthProfiles(companyId);
      setAuthProfiles(profiles.filter(p => p.isActive));
    } catch (e) {
      console.error(e);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await getUsers(companyId);
      setUsers(data);
    } catch (e) {
      console.error("Failed to load users", e);
    } finally {
      setLoadingUsers(false);
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
        const profile = authProfiles.find(p => p.id.toString() === importSource);
        if (profile) {
            profileId = profile.id;
            sourceEnum = (profile.providerType === "WindowsAd" ? IdentitySource.WindowsAd : IdentitySource.AzureAd) as any;
        }
      }

      const results = await searchUsers(importSearchTerm, sourceEnum, profileId !== undefined ? String(profileId) : undefined);
      
      const markedResults = results.map(r => ({
          ...r,
          isImported: users.some(u => u.username.toLowerCase() === r.username.toLowerCase())
      }));

      setImportSearchResults(markedResults);
    } catch (e) {
      showToast(t("testConnectionFailed"), { variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (user: IdentityUserResult) => {
    setImporting(user.id);
    try {
        await importUser({
            profileId: companyId,
            externalId: user.id,
            username: user.username,
            displayName: user.displayName,
            source: user.source
        });
        showToast(t("usersImportSuccess"), { variant: "success" });
        setImportSearchResults(prev => prev.map(u => u.id === user.id ? { ...u, isImported: true } : u));
        loadUsers();
    } catch (e) {
        showToast(t("integrationSaveError"), { variant: "destructive" });
    } finally {
        setImporting(null);
    }
  };

  const validateForm = () => {
    const errors = {
      username: "",
      displayName: "",
      password: "",
      confirmPassword: ""
    };

    if (localUserForm.username.length < 3) {
      errors.username = t("usersUsernameTooShort") || "Username must be at least 3 characters";
    }

    if (!localUserForm.displayName.trim()) {
      errors.displayName = t("fieldRequired") || "This field is required";
    }

    if (localUserForm.password.length < 8) {
      errors.password = t("usersPasswordTooShort") || "Password must be at least 8 characters";
    }

    if (localUserForm.password !== localUserForm.confirmPassword) {
      errors.confirmPassword = t("usersPasswordMismatch") || "Passwords do not match";
    }

    setFormErrors(errors);
    return !errors.username && !errors.displayName && !errors.password && !errors.confirmPassword;
  };

  const handleCreateLocalUser = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleCreateLocalUser called", localUserForm);

    if (!validateForm()) {
      return;
    }

    setCreating(true);
    try {
      await createLocalUser({
        profileId: companyId,
        username: localUserForm.username,
        displayName: localUserForm.displayName,
        password: localUserForm.password,
        photoUrl: localUserForm.photoUrl || undefined
      });
      showToast(t("usersCreateSuccess") || "User created successfully", { variant: "success" });
      setIsAddDialogOpen(false);
      resetLocalUserForm();
      loadUsers();
    } catch (e: any) {
      const errorMsg = e.response?.data?.message || t("integrationSaveError");
      showToast(errorMsg, { variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const resetLocalUserForm = () => {
    setLocalUserForm({
      username: "",
      displayName: "",
      password: "",
      confirmPassword: "",
      photoUrl: ""
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPhotoInputType("url");
    setFormErrors({
      username: "",
      displayName: "",
      password: "",
      confirmPassword: ""
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast(t("clientsLogoInvalidType") || "Invalid file type", { variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast(t("clientsLogoTooLarge") || "File too large (max 2MB)", { variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLocalUserForm({ ...localUserForm, photoUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleDialogClose = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      setImportSearchTerm("");
      setImportSearchResults([]);
      resetLocalUserForm();
    } else {
      // Reset form when opening dialog
      resetLocalUserForm();
    }
  };

  const handleDelete = async (userId: number) => {
      try {
          await deleteUser(userId);
          showToast(t("usersDeleteSuccess"), { variant: "success" });
          loadUsers();
      } catch (e) {
          showToast(t("usersDeleteError"), { variant: "destructive" });
      }
  };

  const requestDelete = (e: React.MouseEvent, user: IdentityUserResult) => {
      e.stopPropagation();
      setUserToDelete(user);
  };

  const confirmDelete = () => {
      if (!userToDelete) return;
      handleDelete(userToDelete.id);
      setUserToDelete(null);
  };

  const toggleSourceFilter = (source: IdentitySource) => {
    const next = new Set(sourceFilters);
    if (next.has(source)) {
      next.delete(source);
    } else {
      next.add(source);
    }
    setSourceFilters(next);
  };

  const filteredUsers = useMemo(() => {
      return users.filter(user => {
          const matchesSearch = user.displayName.toLowerCase().includes(listSearchTerm.toLowerCase()) ||
                                user.username.toLowerCase().includes(listSearchTerm.toLowerCase());
          const matchesStatus = showInactive ? true : user.isActive;
          const matchesSource = sourceFilters.has(user.source);
          return matchesSearch && matchesStatus && matchesSource;
      });
  }, [users, listSearchTerm, showInactive, sourceFilters]);

  const getSourceBadgeColor = (source: IdentitySource) => {
    switch(source) {
        case IdentitySource.WindowsAd: return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
        case IdentitySource.AzureAd: return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
        default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getSourceName = (source: IdentitySource) => {
    switch(source) {
        case IdentitySource.WindowsAd: return t("windowsAd");
        case IdentitySource.AzureAd: return t("azureAd");
        default: return t("localAuth");
    }
  };

  return (
    <div className="space-y-8 pt-6 animate-in fade-in duration-500">
      {/* Header and Filters */}
      <div className="flex flex-col gap-6 bg-accent/10 p-6 rounded-3xl border border-border/50 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1 max-w-md space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{t("usersSearchLabel")}</Label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <Input
                    placeholder={t("usersFilterPlaceholder")}
                    value={listSearchTerm}
                    onChange={(e) => setListSearchTerm(e.target.value)}
                    className="bg-background pl-10 h-11 rounded-xl"
                />
              </div>
          </div>

          <Can I="Security.Users.Manage">
              <Button onClick={() => setIsAddDialogOpen(true)} type="button" className="h-11 rounded-xl shadow-lg gap-2 font-bold">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                {t("usersAdd")}
              </Button>
          </Can>
        </div>

        {/* Source Type Filters */}
        <div className="flex flex-wrap items-center gap-6 pt-2">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("filterByType")}</span>

          <div className="flex flex-wrap gap-3">
            {[IdentitySource.Local, IdentitySource.WindowsAd, IdentitySource.AzureAd].map(source => (
              <label key={source} className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer select-none
                ${sourceFilters.has(source) 
                  ? 'bg-primary/10 border-primary text-primary' 
                  : 'bg-background border-border text-muted-foreground hover:border-primary/30'}
              `}>
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

          <div className="h-6 w-px bg-border hidden md:block"></div>

          <label className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer select-none
            ${showInactive 
              ? 'bg-destructive/10 border-destructive text-destructive' 
              : 'bg-background border-border text-muted-foreground hover:border-destructive/30'}
          `}>
              <input
                  type="checkbox"
                  className="hidden"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
              />
              <span className="text-xs font-bold uppercase tracking-wider">{t("usersShowInactive")}</span>
          </label>
        </div>
      </div>

      {/* Main List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loadingUsers ? (
            Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 rounded-3xl bg-accent/10 animate-pulse border border-dashed" />
            ))
        ) : filteredUsers.length === 0 ? (
            <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl text-muted-foreground italic bg-accent/5">
                <p className="text-lg font-medium">{t("usersListEmpty")}</p>
                <p className="text-sm mt-2">{t("usersListEmptyHint")}</p>
            </div>
        ) : (
            filteredUsers.map(user => {
                return (
                <Card
                    key={user.id}
                    className={`group relative overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-3xl ${!user.isActive ? 'opacity-60 bg-muted/10 grayscale' : ''}`}
                    onClick={() => navigate(`/users/${user.id}?scope=company&profileId=${companyId}`)}
                >
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-20" />
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`flex items-center justify-center h-12 w-12 rounded-2xl font-black text-sm shrink-0 shadow-sm ${user.isActive ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500'}`}>
                                {user.displayName.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h5 className="font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">{user.displayName}</h5>
                                <p className="text-xs text-muted-foreground truncate font-medium">{user.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-4 border-t border-border/50">
                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getSourceBadgeColor(user.source)}`}>
                                {getSourceName(user.source)}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => requestDelete(e, user)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )})
        )}
      </div>

      <ConfirmDialog
        open={!!userToDelete}
        onOpenChange={(open) => {
          if (!open) setUserToDelete(null);
        }}
        title={t("confirm")}
        description={t("usersDeleteConfirm")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={confirmDelete}
      />

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" aria-describedby="dialog-description">
            <DialogHeader>
              <DialogTitle>{importSource === "Local" ? t("usersCreateLocalTitle") || "Create Local User" : t("usersAddTitle")}</DialogTitle>
              <p id="dialog-description" className="text-sm text-muted-foreground sr-only">
                {importSource === "Local" ? "Create a new local user account" : "Import or add a new user"}
              </p>
            </DialogHeader>
            <div className="space-y-6 py-4">
                <div className="bg-muted/30 p-4 rounded-lg space-y-4">
                    <div className="w-full space-y-2">
                        <Label>{t("usersSource")}</Label>
                        <Select value={importSource} onValueChange={setImportSource}>
                            <SelectTrigger className="bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Local">{t("localAuth")}</SelectItem>
                                {authProfiles.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.providerType})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {importSource === "Local" ? (
                        <form onSubmit={handleCreateLocalUser} className="space-y-4 pt-4" autoComplete="off">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="username" className="text-xs font-bold uppercase tracking-wider">{t("username")} *</Label>
                                    <Input
                                        id="username"
                                        type="text"
                                        value={localUserForm.username}
                                        onChange={(e) => {
                                            setLocalUserForm({ ...localUserForm, username: e.target.value });
                                            if (formErrors.username) setFormErrors({ ...formErrors, username: "" });
                                        }}
                                        placeholder={t("username")}
                                        autoComplete="off"
                                        className={`bg-background ${formErrors.username ? 'border-destructive' : ''}`}
                                    />
                                    {formErrors.username && (
                                        <p className="text-xs text-destructive font-medium">{formErrors.username}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="displayName" className="text-xs font-bold uppercase tracking-wider">{t("name")} *</Label>
                                    <Input
                                        id="displayName"
                                        value={localUserForm.displayName}
                                        onChange={(e) => {
                                            setLocalUserForm({ ...localUserForm, displayName: e.target.value });
                                            if (formErrors.displayName) setFormErrors({ ...formErrors, displayName: "" });
                                        }}
                                        placeholder={t("name")}
                                        autoComplete="off"
                                        className={`bg-background ${formErrors.displayName ? 'border-destructive' : ''}`}
                                    />
                                    {formErrors.displayName && (
                                        <p className="text-xs text-destructive font-medium">{formErrors.displayName}</p>
                                    )}
                                </div>

                                <div className="space-y-3 md:col-span-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">{t("photoUrl")}</Label>

                                    <div className="flex gap-2 p-1 bg-muted/30 rounded-lg w-fit">
                                        <button
                                            type="button"
                                            onClick={() => setPhotoInputType("url")}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                                photoInputType === "url"
                                                    ? "bg-background shadow-sm text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            URL
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPhotoInputType("upload")}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                                photoInputType === "upload"
                                                    ? "bg-background shadow-sm text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {t("upload") || "Upload"}
                                        </button>
                                    </div>

                                    {photoInputType === "url" ? (
                                        <Input
                                            id="photoUrl"
                                            type="url"
                                            value={localUserForm.photoUrl}
                                            onChange={(e) => setLocalUserForm({ ...localUserForm, photoUrl: e.target.value })}
                                            placeholder="https://example.com/photo.jpg"
                                            autoComplete="off"
                                            className="bg-background"
                                        />
                                    ) : (
                                        <div className="flex gap-4 items-start">
                                            <label className="cursor-pointer block">
                                                <div className="w-32 h-32 border-2 border-dashed border-muted-foreground/25 rounded-xl flex flex-col items-center justify-center bg-accent/30 hover:bg-accent/50 hover:border-primary transition-all group">
                                                    {localUserForm.photoUrl ? (
                                                        <img src={localUserForm.photoUrl} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                                                    ) : (
                                                        <>
                                                            <svg className="h-8 w-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                                                <path d="M28 8H12a4 4 0 0 0-4 4v20m32-12v8m0 0v8a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4v-4m32-4l-3.172-3.172a4 4 0 0 0-5.656 0L28 28M8 32l9.172-9.172a4 4 0 0 1 5.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-primary">{t("upload") || "Upload"}</span>
                                                        </>
                                                    )}
                                                </div>
                                                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                                            </label>
                                            {localUserForm.photoUrl && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setLocalUserForm({ ...localUserForm, photoUrl: "" })}
                                                    className="h-8"
                                                >
                                                    {t("remove") || "Remove"}
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider">{t("password")} *</Label>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            value={localUserForm.password}
                                            onChange={(e) => {
                                                setLocalUserForm({ ...localUserForm, password: e.target.value });
                                                if (formErrors.password) setFormErrors({ ...formErrors, password: "" });
                                            }}
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                            className={`bg-background pr-10 ${formErrors.password ? 'border-destructive' : ''}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPassword ? (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                                    <line x1="1" y1="1" x2="23" y2="23"/>
                                                </svg>
                                            ) : (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                    <circle cx="12" cy="12" r="3"/>
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                    {formErrors.password && (
                                        <p className="text-xs text-destructive font-medium">{formErrors.password}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider">{t("usersConfirmPassword") || "Confirm Password"} *</Label>
                                    <div className="relative">
                                        <Input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={localUserForm.confirmPassword}
                                            onChange={(e) => {
                                                setLocalUserForm({ ...localUserForm, confirmPassword: e.target.value });
                                                if (formErrors.confirmPassword) setFormErrors({ ...formErrors, confirmPassword: "" });
                                            }}
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                            className={`bg-background pr-10 ${formErrors.confirmPassword ? 'border-destructive' : ''}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showConfirmPassword ? (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                                    <line x1="1" y1="1" x2="23" y2="23"/>
                                                </svg>
                                            ) : (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                    <circle cx="12" cy="12" r="3"/>
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                    {formErrors.confirmPassword && (
                                        <p className="text-xs text-destructive font-medium">{formErrors.confirmPassword}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                                    {t("cancel")}
                                </Button>
                                <Button type="submit" disabled={creating}>
                                    {creating ? (
                                        <span className="flex items-center gap-2">
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"/>
                                            {"Creating..."}
                                        </span>
                                    ) : t("create")}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <>
                            <div className="flex gap-2">
                                <Input
                                    className="bg-background"
                                    value={importSearchTerm}
                                    onChange={e => setImportSearchTerm(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleImportSearch()}
                                    placeholder={t("usersSearchPlaceholder")}
                                />
                                <Button type="button" onClick={handleImportSearch} disabled={searching}>
                                    {searching ? (
                                        <span className="flex items-center gap-2">
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"/>
                                            {t("usersSearching")}
                                        </span>
                                    ) : t("search")}
                                </Button>
                            </div>
                        </>
                    )}
                </div>

                {importSource !== "Local" && (
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("summary")}</h4>
                        {importSearchResults.length === 0 && !searching && (
                            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                                <p>{t("usersNoResults")}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {importSearchResults.map(user => (
                            <Card key={user.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                                            {user.displayName.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h5 className="font-medium text-sm truncate" title={user.displayName}>{user.displayName}</h5>
                                            <p className="text-xs text-muted-foreground truncate" title={user.username}>{user.username}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${getSourceBadgeColor(user.source)}`}>{getSourceName(user.source)}</span>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={user.isImported ? "secondary" : "default"}
                                            className="h-7 text-xs"
                                            disabled={user.isImported || importing === user.id}
                                            onClick={() => handleImport(user)}
                                        >
                                            {user.isImported ? t("usersAdded") : importing === user.id ? t("usersImporting") : t("usersImport")}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        </div>
                    </div>
                )}
            </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
