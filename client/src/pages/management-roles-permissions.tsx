import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useToast } from "@/hooks/use-toast";
import { useTenantPlan } from "@/hooks/useTenantPlan";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Users,
  UserCog,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Info,
  Search,
  ChevronsUpDown,
  Pencil,
  Save,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

interface RolePermissions {
  [key: string]: boolean;
}

interface PermissionDetail {
  key: string;
  label: string;
  description: string;
}

interface Role {
  name: string;
  level: number;
  description: string;
  userCount: number;
  permissions: RolePermissions;
  isSystem: boolean;
  isCustomized?: boolean;
}

interface PermissionCategory {
  key: string;
  label: string;
  description: string;
  icon: string;
  permissions: PermissionDetail[];
}

interface RoleUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

function getRoleIcon(role: string, size: "sm" | "md" = "md") {
  const cls = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  switch (role) {
    case "Owner":
      return <Crown className={`${cls} text-purple-600`} />;
    case "Administrator":
      return <ShieldAlert className={`${cls} text-red-600`} />;
    case "Manager":
      return <ShieldCheck className={`${cls} text-blue-600`} />;
    case "Employee":
      return <Shield className={`${cls} text-gray-600`} />;
    default:
      return <Shield className={`${cls} text-gray-400`} />;
  }
}

function getRoleColor(role: string) {
  switch (role) {
    case "Owner":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
    case "Administrator":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    case "Manager":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "Employee":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getRoleBorderColor(role: string) {
  switch (role) {
    case "Owner":
      return "border-purple-200 dark:border-purple-800/50";
    case "Administrator":
      return "border-red-200 dark:border-red-800/50";
    case "Manager":
      return "border-blue-200 dark:border-blue-800/50";
    case "Employee":
      return "border-gray-200 dark:border-gray-700/50";
    default:
      return "border-gray-200";
  }
}

function getUserInitials(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
}

export default function ManagementRolesPermissions() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useReduxAuth();
  const queryClient = useQueryClient();
  const { canManageRoles, planName, isLoading: planLoading } = useTenantPlan();
  const [, setLocation] = useLocation();

  // UI state - must be declared before any conditional returns
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [changeRoleDialog, setChangeRoleDialog] = useState<{
    open: boolean;
    user: RoleUser | null;
    newRole: string;
  }>({ open: false, user: null, newRole: "" });
  const [resetDialog, setResetDialog] = useState<{
    open: boolean;
    role: string | null;
    resetAll: boolean;
  }>({ open: false, role: null, resetAll: false });

  const currentUser = user as { id: string; role?: string } | null;
  const isOwner = currentUser?.role === "Owner";
  const isAdmin = currentUser?.role === "Owner" || currentUser?.role === "Administrator";

  // Fetch roles with permissions
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["/api/roles"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/roles");
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    },
    enabled: isAdmin,
  });

  // Fetch users by role
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/roles/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/roles/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: isAdmin,
  });

  // Save permissions mutation
  const savePermissionsMutation = useMutation({
    mutationFn: async ({ role, permissions }: { role: string; permissions: Record<string, boolean> }) => {
      const res = await apiRequest("PUT", "/api/roles/permissions", { role, permissions });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to save permissions");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setIsEditing(false);
      setEditingRole(null);
      setPendingChanges({});
      toast({
        title: t("management.rolesPermissions.toasts.permissionsSaved", "Permissions Saved"),
        description: t("management.rolesPermissions.toasts.permissionsSavedDesc", "Role permissions have been updated successfully."),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("management.rolesPermissions.toasts.error", "Error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reset permissions mutation
  const resetPermissionsMutation = useMutation({
    mutationFn: async ({ role, resetAll }: { role?: string; resetAll?: boolean }) => {
      const url = resetAll ? "/api/roles/permissions/reset-all" : "/api/roles/permissions/reset";
      const body = resetAll ? {} : { role };
      const res = await apiRequest("POST", url, body);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to reset permissions");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setResetDialog({ open: false, role: null, resetAll: false });
      setIsEditing(false);
      setEditingRole(null);
      setPendingChanges({});
      toast({
        title: t("management.rolesPermissions.toasts.permissionsReset", "Permissions Reset"),
        description: t("management.rolesPermissions.toasts.permissionsResetDesc", "Role permissions have been reset to defaults."),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("management.rolesPermissions.toasts.error", "Error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/roles/users/${userId}/role`, { role });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roles/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/stats"] });
      setChangeRoleDialog({ open: false, user: null, newRole: "" });
      toast({
        title: t("management.rolesPermissions.toasts.roleUpdated", "Role Updated"),
        description: t("management.rolesPermissions.toasts.roleUpdatedDesc", "User role has been updated successfully."),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("management.rolesPermissions.toasts.error", "Error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const roles: Role[] = rolesData?.roles || [];
  const permissionCategories: PermissionCategory[] = rolesData?.permissionCategories || [];
  const usersByRole: Record<string, RoleUser[]> = usersData?.usersByRole || {};
  const totalPermissions: number = rolesData?.totalPermissions || 0;
  const totalCategories: number = rolesData?.totalCategories || 0;
  const hasCustomPermissions: boolean = rolesData?.hasCustomPermissions || false;

  // Check if plan data is loading
  if (planLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">
            {t("management.rolesPermissions.title", "Roles & Permissions")}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Check if plan allows roles management - after all hooks
  if (!canManageRoles) {
    return (
      <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
            <CardContent className="p-8">
              <div className="text-center">
                <Shield className="mx-auto h-12 w-12 text-amber-500 dark:text-amber-400 mb-4" />
                <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('management.rolesPermissions.upgradeRequired', 'Upgrade Required')}
                </h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  {t('management.rolesPermissions.upgradeDescription', { 
                    planName, 
                    defaultValue: 'Your current plan ({{planName}}) does not include roles & permissions management. Upgrade to Plus or Pro to customize role permissions.' 
                  })}
                </p>
                <Button
                  onClick={() => setLocation('/profile?tab=subscription')}
                  className="mt-6 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white"
                >
                  {t('management.rolesPermissions.upgradePlan', 'Upgrade Plan')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Filter categories by search term
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return permissionCategories;
    const lower = searchTerm.toLowerCase();
    return permissionCategories
      .map((cat) => ({
        ...cat,
        permissions: cat.permissions.filter(
          (p) =>
            p.label.toLowerCase().includes(lower) ||
            p.description.toLowerCase().includes(lower) ||
            p.key.toLowerCase().includes(lower) ||
            cat.label.toLowerCase().includes(lower)
        ),
      }))
      .filter((cat) => cat.permissions.length > 0);
  }, [permissionCategories, searchTerm]);

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    permissionCategories.forEach((c) => (all[c.key] = true));
    setExpandedCategories(all);
  };

  const collapseAll = () => {
    const all: Record<string, boolean> = {};
    permissionCategories.forEach((c) => (all[c.key] = false));
    setExpandedCategories(all);
  };

  const startEditing = (roleName: string) => {
    const role = roles.find((r) => r.name === roleName);
    if (!role) return;
    setIsEditing(true);
    setEditingRole(roleName);
    setPendingChanges({ ...role.permissions });
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingRole(null);
    setPendingChanges({});
  };

  const togglePermission = (permKey: string) => {
    setPendingChanges((prev) => ({ ...prev, [permKey]: !prev[permKey] }));
  };

  const savePermissions = () => {
    if (!editingRole) return;
    savePermissionsMutation.mutate({
      role: editingRole,
      permissions: pendingChanges,
    });
  };

  const handleRoleChange = (targetUser: RoleUser, newRole: string) => {
    if (newRole === targetUser.role) return;
    setChangeRoleDialog({ open: true, user: targetUser, newRole });
  };

  const confirmRoleChange = () => {
    if (changeRoleDialog.user && changeRoleDialog.newRole) {
      changeRoleMutation.mutate({
        userId: changeRoleDialog.user.id,
        role: changeRoleDialog.newRole,
      });
    }
  };

  // Count pending changes
  const pendingChangeCount = useMemo(() => {
    if (!editingRole) return 0;
    const role = roles.find((r) => r.name === editingRole);
    if (!role) return 0;
    return Object.keys(pendingChanges).filter(
      (k) => pendingChanges[k] !== role.permissions[k]
    ).length;
  }, [pendingChanges, editingRole, roles]);

  // Determine which roles the current user can assign
  const assignableRoles = useMemo(() => {
    if (isOwner) return ["Owner", "Administrator", "Manager", "Employee"];
    if (isAdmin) return ["Administrator", "Manager", "Employee"];
    return [];
  }, [isOwner, isAdmin]);

  // Permission count per role
  const getPermissionCount = useCallback(
    (role: Role) => {
      return Object.values(role.permissions).filter(Boolean).length;
    },
    []
  );

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Shield className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-lg font-semibold">
              {t("management.rolesPermissions.accessDenied", "Access Denied")}
            </h2>
            <p className="text-muted-foreground mt-2">
              {t(
                "management.rolesPermissions.accessDeniedDesc",
                "You need Owner or Administrator access to manage roles and permissions."
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (rolesLoading || usersLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">
            {t("management.rolesPermissions.title", "Roles & Permissions")}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-6 bg-muted rounded w-1/4 mb-4" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">
            {t("management.rolesPermissions.title", "Roles & Permissions")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "management.rolesPermissions.subtitle",
              "View role hierarchy, permissions, and manage user role assignments"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {totalCategories} {t("management.rolesPermissions.categoriesLabel", "categories")}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {totalPermissions} {t("management.rolesPermissions.permissionsLabel", "permissions")}
          </Badge>
          {hasCustomPermissions && (
            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {t("management.rolesPermissions.customized", "Customized")}
            </Badge>
          )}
        </div>
      </div>

      {/* Role Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((role) => (
          <Card
            key={role.name}
            className={`border-2 ${getRoleBorderColor(role.name)} bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-300`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getRoleIcon(role.name)}
                  <CardTitle className="text-base">{role.name}</CardTitle>
                </div>
                <Badge variant="secondary" className={getRoleColor(role.name)}>
                  {t("management.rolesPermissions.level", "Level")} {role.level}
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                {role.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {role.userCount}{" "}
                    {role.userCount === 1
                      ? t("management.rolesPermissions.user", "user")
                      : t("management.rolesPermissions.users", "users")}
                  </span>
                </div>
                {role.isCustomized && (
                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
                    {t("management.rolesPermissions.customized", "Customized")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all"
                    style={{
                      width: `${totalPermissions > 0 ? (getPermissionCount(role) / totalPermissions) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {getPermissionCount(role)}/{totalPermissions}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs for Permissions Matrix and User Assignments */}
      <Tabs defaultValue="permissions" className="w-full">
        <TabsList>
          <TabsTrigger value="permissions">
            <Shield className="h-4 w-4 mr-2" />
            {t("management.rolesPermissions.permissionsMatrix", "Permissions Matrix")}
          </TabsTrigger>
          <TabsTrigger value="users">
            <UserCog className="h-4 w-4 mr-2" />
            {t("management.rolesPermissions.userAssignments", "User Assignments")}
          </TabsTrigger>
        </TabsList>

        {/* Permissions Matrix Tab */}
        <TabsContent value="permissions" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {t("management.rolesPermissions.permissionsOverview", "Permissions Overview")}
                  </CardTitle>
                  <CardDescription>
                    {isEditing
                      ? t(
                          "management.rolesPermissions.editingDesc",
                          "Toggle permissions on/off for {{role}}. Click Save when done.",
                          { role: editingRole }
                        )
                      : t(
                          "management.rolesPermissions.permissionsOverviewDesc",
                          "View what each role can access across the system. Permissions are inherited from higher roles."
                        )}
                  </CardDescription>
                </div>
                {isOwner && !isEditing && (
                  <div className="flex items-center gap-2">
                    {hasCustomPermissions && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetDialog({ open: true, role: null, resetAll: true })}
                        className="text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        {t("management.rolesPermissions.resetAll", "Reset All")}
                      </Button>
                    )}
                  </div>
                )}
                {isEditing && (
                  <div className="flex items-center gap-2">
                    {pendingChangeCount > 0 && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {pendingChangeCount} {t("management.rolesPermissions.changes", "changes")}
                      </Badge>
                    )}
                    <Button variant="outline" size="sm" onClick={cancelEditing}>
                      {t("management.rolesPermissions.cancel", "Cancel")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={savePermissions}
                      disabled={pendingChangeCount === 0 || savePermissionsMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Save className="h-3.5 w-3.5 mr-1" />
                      {savePermissionsMutation.isPending
                        ? t("management.rolesPermissions.saving", "Saving...")
                        : t("management.rolesPermissions.saveChanges", "Save Changes")}
                    </Button>
                  </div>
                )}
              </div>
              {/* Search and controls */}
              <div className="flex items-center gap-3 mt-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("management.rolesPermissions.searchPermissions", "Search permissions...")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={expandAll} className="text-xs">
                  <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />
                  {t("management.rolesPermissions.expandAll", "Expand All")}
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll} className="text-xs">
                  {t("management.rolesPermissions.collapseAll", "Collapse All")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[300px] font-semibold sticky left-0 bg-muted/50 z-10">
                          {t("management.rolesPermissions.permission", "Permission")}
                        </TableHead>
                        {roles.map((role) => (
                          <TableHead key={role.name} className="text-center font-semibold min-w-[120px]">
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1.5">
                                {getRoleIcon(role.name, "sm")}
                                <span className="text-xs">{role.name}</span>
                              </div>
                              {isOwner && !isEditing && role.name !== "Owner" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                                  onClick={() => startEditing(role.name)}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  {t("management.rolesPermissions.edit", "Edit")}
                                </Button>
                              )}
                              {isEditing && editingRole === role.name && (
                                <Badge className="bg-blue-600 text-white text-[10px]">
                                  {t("management.rolesPermissions.editing", "Editing")}
                                </Badge>
                              )}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCategories.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={roles.length + 1} className="text-center py-8 text-muted-foreground">
                            {t("management.rolesPermissions.noResults", "No permissions match your search.")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCategories.map((category) => {
                          const isExpanded = expandedCategories[category.key] === true;
                          return (
                            <React.Fragment key={category.key}>
                              {/* Category Header Row */}
                              <TableRow
                                className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => toggleCategory(category.key)}
                              >
                                <TableCell className="font-semibold text-sm sticky left-0 bg-muted/30 z-10">
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    )}
                                    <div>
                                      <div>{category.label}</div>
                                      <div className="text-[10px] font-normal text-muted-foreground">
                                        {category.description}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                {roles.map((role) => {
                                  const permKeys = category.permissions.map((p) => p.key);
                                  const currentPerms = isEditing && editingRole === role.name ? pendingChanges : role.permissions;
                                  const allGranted = permKeys.every((p) => currentPerms[p]);
                                  const someGranted = permKeys.some((p) => currentPerms[p]);
                                  const grantedCount = permKeys.filter((p) => currentPerms[p]).length;
                                  return (
                                    <TableCell key={role.name} className="text-center">
                                      <div className="flex flex-col items-center gap-0.5">
                                        {allGranted ? (
                                          <Badge
                                            variant="secondary"
                                            className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[10px]"
                                          >
                                            {t("management.rolesPermissions.full", "Full")}
                                          </Badge>
                                        ) : someGranted ? (
                                          <Badge
                                            variant="secondary"
                                            className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-[10px]"
                                          >
                                            {t("management.rolesPermissions.partial", "Partial")}
                                          </Badge>
                                        ) : (
                                          <Badge
                                            variant="secondary"
                                            className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500 text-[10px]"
                                          >
                                            {t("management.rolesPermissions.none", "None")}
                                          </Badge>
                                        )}
                                        <span className="text-[9px] text-muted-foreground">
                                          {grantedCount}/{permKeys.length}
                                        </span>
                                      </div>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                              {/* Individual Permission Rows */}
                              {isExpanded &&
                                category.permissions.map((perm) => (
                                  <TableRow key={perm.key} className="hover:bg-muted/20">
                                    <TableCell className="pl-10 sticky left-0 bg-background z-10">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="text-sm text-muted-foreground cursor-help">
                                              {perm.label}
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent side="right">
                                            <p className="text-xs max-w-[200px]">{perm.description}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </TableCell>
                                    {roles.map((role) => {
                                      const isEditingThis = isEditing && editingRole === role.name;
                                      const currentValue = isEditingThis
                                        ? pendingChanges[perm.key]
                                        : role.permissions[perm.key];
                                      const hasChanged = isEditingThis && pendingChanges[perm.key] !== role.permissions[perm.key];

                                      return (
                                        <TableCell
                                          key={role.name}
                                          className={`text-center ${hasChanged ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                                        >
                                          {isEditingThis ? (
                                            <div className="flex justify-center">
                                              <Switch
                                                checked={currentValue}
                                                onCheckedChange={() => togglePermission(perm.key)}
                                                className="data-[state=checked]:bg-green-600"
                                              />
                                            </div>
                                          ) : currentValue ? (
                                            <Check className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
                                          ) : (
                                            <X className="h-4 w-4 text-gray-300 dark:text-gray-600 mx-auto" />
                                          )}
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                ))}
                            </React.Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Assignments Tab */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("management.rolesPermissions.userRoleAssignments", "User Role Assignments")}
              </CardTitle>
              <CardDescription>
                {t(
                  "management.rolesPermissions.userRoleAssignmentsDesc",
                  "View and change user roles. Users inherit all permissions from their assigned role."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {["Owner", "Administrator", "Manager", "Employee"].map((roleName) => {
                  const roleUsers = usersByRole[roleName] || [];
                  return (
                    <div key={roleName}>
                      <div className="flex items-center gap-2 mb-3">
                        {getRoleIcon(roleName)}
                        <h3 className="font-semibold text-sm">{roleName}</h3>
                        <Badge variant="outline" className="text-xs">
                          {roleUsers.length}
                        </Badge>
                      </div>
                      {roleUsers.length === 0 ? (
                        <p className="text-sm text-muted-foreground pl-7 pb-2">
                          {t("management.rolesPermissions.noUsersInRole", "No users with this role")}
                        </p>
                      ) : (
                        <div className="border rounded-lg overflow-hidden ml-7">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead>
                                  {t("management.rolesPermissions.userName", "User")}
                                </TableHead>
                                <TableHead>
                                  {t("management.rolesPermissions.email", "Email")}
                                </TableHead>
                                <TableHead>
                                  {t("management.rolesPermissions.status", "Status")}
                                </TableHead>
                                <TableHead className="w-[180px]">
                                  {t("management.rolesPermissions.changeRole", "Change Role")}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {roleUsers.map((roleUser) => {
                                const isSelf = roleUser.id === currentUser?.id;
                                const isOwnerUser = roleUser.role === "Owner";
                                const canChangeRole =
                                  !isSelf &&
                                  (isOwner || (!isOwnerUser && isAdmin));

                                return (
                                  <TableRow key={roleUser.id}>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8">
                                          <AvatarFallback className="text-xs bg-gray-100 dark:bg-gray-800">
                                            {getUserInitials(
                                              roleUser.firstName,
                                              roleUser.lastName
                                            )}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <span className="font-medium text-sm">
                                            {roleUser.firstName || ""}{" "}
                                            {roleUser.lastName || ""}
                                          </span>
                                          {isSelf && (
                                            <Badge
                                              variant="outline"
                                              className="ml-2 text-xs"
                                            >
                                              {t("management.rolesPermissions.you", "You")}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {roleUser.email}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="secondary"
                                        className={
                                          roleUser.isActive
                                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                        }
                                      >
                                        {roleUser.isActive
                                          ? t("management.rolesPermissions.active", "Active")
                                          : t("management.rolesPermissions.inactive", "Inactive")}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {canChangeRole ? (
                                        <Select
                                          value={roleUser.role}
                                          onValueChange={(newRole) =>
                                            handleRoleChange(roleUser, newRole)
                                          }
                                        >
                                          <SelectTrigger className="h-8 text-xs w-[150px]">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {assignableRoles.map((r) => (
                                              <SelectItem key={r} value={r}>
                                                <div className="flex items-center gap-2">
                                                  {getRoleIcon(r, "sm")}
                                                  <span>{r}</span>
                                                </div>
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Info className="h-3.5 w-3.5" />
                                                {isSelf
                                                  ? t(
                                                      "management.rolesPermissions.cannotChangeSelf",
                                                      "Cannot change own role"
                                                    )
                                                  : t(
                                                      "management.rolesPermissions.insufficientPermission",
                                                      "Insufficient permission"
                                                    )}
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>
                                                {isSelf
                                                  ? t(
                                                      "management.rolesPermissions.cannotChangeSelfTooltip",
                                                      "You cannot change your own role for security reasons."
                                                    )
                                                  : t(
                                                      "management.rolesPermissions.insufficientPermissionTooltip",
                                                      "Only Owners can modify Owner accounts."
                                                    )}
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Role Hierarchy Info Card */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600" />
            {t("management.rolesPermissions.hierarchyInfo", "Role Hierarchy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t(
              "management.rolesPermissions.hierarchyDesc",
              "Roles follow a hierarchical structure: Owner > Administrator > Manager > Employee. Higher roles automatically inherit access to features available to lower roles. The Owner role has full system access including billing and subscription management. Administrators have full operational access but cannot manage billing. Managers can handle team and content operations. Employees have basic access for day-to-day tasks."
            )}
          </p>
        </CardContent>
      </Card>

      {/* Confirm Role Change Dialog */}
      <Dialog
        open={changeRoleDialog.open}
        onOpenChange={(open) => {
          if (!open) setChangeRoleDialog({ open: false, user: null, newRole: "" });
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {t("management.rolesPermissions.confirmRoleChange", "Confirm Role Change")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "management.rolesPermissions.confirmRoleChangeDesc",
                "Are you sure you want to change this user's role? This will immediately affect their permissions."
              )}
            </DialogDescription>
          </DialogHeader>
          {changeRoleDialog.user && (
            <div className="py-4 space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {getUserInitials(
                      changeRoleDialog.user.firstName,
                      changeRoleDialog.user.lastName
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">
                    {changeRoleDialog.user.firstName}{" "}
                    {changeRoleDialog.user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {changeRoleDialog.user.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 py-2">
                <Badge className={getRoleColor(changeRoleDialog.user.role)}>
                  {changeRoleDialog.user.role}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <Badge className={getRoleColor(changeRoleDialog.newRole)}>
                  {changeRoleDialog.newRole}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setChangeRoleDialog({ open: false, user: null, newRole: "" })
              }
            >
              {t("management.rolesPermissions.cancel", "Cancel")}
            </Button>
            <Button
              onClick={confirmRoleChange}
              disabled={changeRoleMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {changeRoleMutation.isPending
                ? t("management.rolesPermissions.updating", "Updating...")
                : t("management.rolesPermissions.confirmChange", "Confirm Change")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Permissions Dialog */}
      <Dialog
        open={resetDialog.open}
        onOpenChange={(open) => {
          if (!open) setResetDialog({ open: false, role: null, resetAll: false });
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t("management.rolesPermissions.resetPermissions", "Reset Permissions")}
            </DialogTitle>
            <DialogDescription>
              {resetDialog.resetAll
                ? t(
                    "management.rolesPermissions.resetAllDesc",
                    "This will reset ALL role permissions back to their default values. Any customizations will be lost."
                  )
                : t(
                    "management.rolesPermissions.resetRoleDesc",
                    "This will reset permissions for {{role}} back to default values.",
                    { role: resetDialog.role }
                  )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialog({ open: false, role: null, resetAll: false })}
            >
              {t("management.rolesPermissions.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                resetPermissionsMutation.mutate({
                  role: resetDialog.role || undefined,
                  resetAll: resetDialog.resetAll,
                })
              }
              disabled={resetPermissionsMutation.isPending}
            >
              {resetPermissionsMutation.isPending
                ? t("management.rolesPermissions.resetting", "Resetting...")
                : t("management.rolesPermissions.confirmReset", "Reset to Defaults")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
