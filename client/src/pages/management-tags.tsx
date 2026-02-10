import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Pencil,
  Trash2,
  Plus,
  ShieldAlert,
  Tag,
  Tags,
  Users,
  Search,
  Palette,
  AlertTriangle,
} from "lucide-react";

interface TagItem {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  contactCount?: number;
}

const PRESET_COLORS = [
  "#EF4444", "#EC4899", "#A855F7", "#6366F1", "#3B82F6",
  "#0EA5E9", "#06B6D4", "#14B8A6", "#22C55E", "#84CC16",
  "#FACC15", "#F59E0B", "#F97316", "#EA580C", "#8B5E3C",
  "#64748B", "#111827", "#10B981", "#9333EA", "#2563EB",
];

/** Reusable color picker grid */
function ColorPickerGrid({
  selected,
  onSelect,
  size = "md",
}: {
  selected: string;
  onSelect: (color: string) => void;
  size?: "sm" | "md";
}) {
  const dotSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(c)}
          className={`${dotSize} rounded-full border border-transparent hover:scale-110 transition-transform ${selected.toLowerCase() === c.toLowerCase()
            ? "ring-2 ring-primary ring-offset-2"
            : ""
            }`}
          style={{ backgroundColor: c }}
          aria-label={`Choose color ${c}`}
        />
      ))}
    </div>
  );
}

export default function ManagementTags() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3B82F6");
  const [newDesc, setNewDesc] = useState("");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#3B82F6");
  const [editDesc, setEditDesc] = useState("");

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<TagItem | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/contact-tags"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/contact-tags");
      return res.json();
    },
  });

  const tags: TagItem[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data?.tags)) return data.tags;
    if (Array.isArray(data)) return data as TagItem[];
    return [];
  }, [data]);

  // Filtered tags
  const filteredTags = useMemo(() => {
    if (!searchTerm.trim()) return tags;
    const lower = searchTerm.toLowerCase();
    return tags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(lower) ||
        (tag.description && tag.description.toLowerCase().includes(lower))
    );
  }, [tags, searchTerm]);

  // Stats
  const totalContacts = useMemo(
    () => tags.reduce((sum, tag) => sum + (tag.contactCount ?? 0), 0),
    [tags]
  );

  // — Mutations —

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: newName.trim(),
        color: newColor,
        description: newDesc.trim() || undefined,
      };
      const res = await apiRequest("POST", "/api/contact-tags", payload);
      return res.json();
    },
    onSuccess: async () => {
      setNewName("");
      setNewColor("#3B82F6");
      setNewDesc("");
      setCreateOpen(false);
      await qc.invalidateQueries({ queryKey: ["/api/contact-tags"] });
      toast({ title: t("management.tags.toasts.created") });
    },
    onError: (e: any) =>
      toast({
        title: t("management.tags.toasts.error"),
        description: e?.message || t("management.tags.toasts.createError"),
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingTag) return;
      const payload: any = {
        name: editName.trim(),
        color: editColor,
        description: editDesc.trim() || null,
      };
      const res = await apiRequest("PUT", `/api/contact-tags/${editingTag.id}`, payload);
      return res.json();
    },
    onSuccess: async () => {
      setEditOpen(false);
      setEditingTag(null);
      await qc.invalidateQueries({ queryKey: ["/api/contact-tags"] });
      toast({ title: t("management.tags.toasts.updated") });
    },
    onError: (e: any) =>
      toast({
        title: t("management.tags.toasts.error"),
        description: e?.message || t("management.tags.toasts.updateError"),
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contact-tags/${id}`);
    },
    onSuccess: async () => {
      setDeleteOpen(false);
      setDeletingTag(null);
      await qc.invalidateQueries({ queryKey: ["/api/contact-tags"] });
      toast({ title: t("management.tags.toasts.deleted") });
    },
    onError: (e: any) =>
      toast({
        title: t("management.tags.toasts.error"),
        description: e?.message || t("management.tags.toasts.deleteError"),
        variant: "destructive",
      }),
  });

  // Helpers
  const openEdit = (tag: TagItem) => {
    setEditingTag(tag);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditDesc(tag.description || "");
    setEditOpen(true);
  };

  const openDelete = (tag: TagItem) => {
    setDeletingTag(tag);
    setDeleteOpen(true);
  };

  const resetCreate = () => {
    setNewName("");
    setNewColor("#3B82F6");
    setNewDesc("");
    setCreateOpen(false);
  };

  // — Permission denied —
  const is403 = error instanceof Error && error.message?.startsWith("403:");

  if (is403) {
    return (
      <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
        <CardContent className="p-8">
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-full">
              <ShieldAlert className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="font-semibold text-base">
              {t("common.permissionDenied", "Permission Denied")}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t(
                "common.permissionDeniedDescription",
                "You do not have permission to view this section. Contact your administrator to request access."
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // — Loading skeleton —
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between bg-card p-6 rounded-xl border shadow-sm animate-pulse">
          <div>
            <div className="h-6 w-40 bg-muted rounded mb-2" />
            <div className="h-4 w-64 bg-muted rounded" />
          </div>
          <div className="h-9 w-28 bg-muted rounded" />
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5">
                <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                <div className="h-7 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table skeleton */}
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-9 bg-muted rounded w-full max-w-sm mb-5" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
            <Tags className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {t("management.tags.title")}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t(
                "management.tags.subtitle",
                "Create, organize, and manage tags for your contacts"
              )}
            </p>
          </div>
        </div>

        <Button onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          {t("management.tags.newTag")}
        </Button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("management.tags.stats.totalTags", "Total Tags")}
                </p>
                <p className="text-2xl font-bold mt-1 text-foreground">{tags.length}</p>
              </div>
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Tag className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("management.tags.stats.totalContacts", "Tagged Contacts")}
                </p>
                <p className="text-2xl font-bold mt-1 text-foreground">{totalContacts}</p>
              </div>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("management.tags.stats.colors", "Colors Used")}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  {Array.from(new Set(tags.map((t) => t.color)))
                    .slice(0, 8)
                    .map((c, i) => (
                      <span
                        key={i}
                        className="h-5 w-5 rounded-full border border-white dark:border-gray-700 shadow-sm"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  {Array.from(new Set(tags.map((t) => t.color))).length > 8 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      +{Array.from(new Set(tags.map((t) => t.color))).length - 8}
                    </span>
                  )}
                  {tags.length === 0 && (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <Palette className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tag List ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {t("management.tags.listTitle", "Your Tags")}
              </CardTitle>
              <CardDescription className="mt-0.5">
                {t(
                  "management.tags.listDescription",
                  "Assign tags to contacts for better organization and segmentation"
                )}
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("management.tags.searchPlaceholder", "Search tags...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {tags.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full mb-4">
                <Tags className="h-10 w-10 text-blue-500 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {t("management.tags.empty.title", "No tags yet")}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                {t(
                  "management.tags.empty.description",
                  "Tags help you organize contacts into groups for better management and targeted campaigns."
                )}
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                {t("management.tags.empty.createFirst", "Create Your First Tag")}
              </Button>
            </div>
          ) : filteredTags.length === 0 ? (
            /* No search results */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {t("management.tags.noResults", 'No tags found matching "{{query}}"', {
                  query: searchTerm,
                })}
              </p>
            </div>
          ) : (
            /* Tag grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTags.map((tag) => (
                <div
                  key={tag.id}
                  className="group relative flex items-start gap-3 p-4 rounded-lg border border-gray-200/80 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/30 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
                >
                  {/* Color dot */}
                  <span
                    className="mt-0.5 h-5 w-5 rounded-full shrink-0 shadow-sm ring-2 ring-white dark:ring-gray-800"
                    style={{ backgroundColor: tag.color }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        style={{ backgroundColor: tag.color }}
                        className="text-white text-xs font-medium shadow-sm"
                      >
                        {tag.name}
                      </Badge>
                    </div>

                    {tag.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                        {tag.description}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 mt-2">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {tag.contactCount ?? 0}{" "}
                        {(tag.contactCount ?? 0) === 1
                          ? t("management.tags.contact", "contact")
                          : t("management.tags.contacts", "contacts")}
                      </span>
                    </div>
                  </div>

                  {/* Actions — visible on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(tag)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      aria-label={t("management.tags.editTag", "Edit tag")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openDelete(tag)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label={t("management.tags.deleteTag", "Delete tag")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ──────── CREATE DIALOG ──────── */}
      <Dialog open={createOpen} onOpenChange={(open) => !open && resetCreate()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              {t("management.tags.createDialog.title", "Create New Tag")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "management.tags.createDialog.description",
                "Add a new tag to organize and segment your contacts."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="new-tag-name">{t("management.tags.name")}</Label>
              <Input
                id="new-tag-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("management.tags.namePlaceholder")}
                autoFocus
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>{t("management.tags.color")}</Label>
              <ColorPickerGrid selected={newColor} onSelect={setNewColor} />
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>{t("management.tags.preview")}</Label>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <span
                  className="h-5 w-5 rounded-full shadow-sm"
                  style={{ backgroundColor: newColor }}
                />
                <Badge style={{ backgroundColor: newColor }} className="text-white">
                  {newName || t("management.tags.example")}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="new-tag-desc">{t("management.tags.description")}</Label>
              <Textarea
                id="new-tag-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={t("management.tags.descriptionPlaceholder")}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetCreate}>
              {t("management.tags.cancel")}
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending
                ? t("management.tags.creating")
                : t("management.tags.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────── EDIT DIALOG ──────── */}
      <Dialog open={editOpen} onOpenChange={(open) => !open && setEditOpen(false)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                <Pencil className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              {t("management.tags.editDialog.title", "Edit Tag")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "management.tags.editDialog.description",
                "Update this tag's name, color, or description."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-tag-name">{t("management.tags.name")}</Label>
              <Input
                id="edit-tag-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("management.tags.namePlaceholder")}
                autoFocus
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>{t("management.tags.color")}</Label>
              <ColorPickerGrid selected={editColor} onSelect={setEditColor} />
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>{t("management.tags.preview")}</Label>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <span
                  className="h-5 w-5 rounded-full shadow-sm"
                  style={{ backgroundColor: editColor }}
                />
                <Badge style={{ backgroundColor: editColor }} className="text-white">
                  {editName || t("management.tags.example")}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-tag-desc">{t("management.tags.description")}</Label>
              <Textarea
                id="edit-tag-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder={t("management.tags.descriptionPlaceholder")}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t("management.tags.cancel")}
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!editName.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending
                ? t("management.tags.saving")
                : t("management.tags.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────── DELETE CONFIRMATION DIALOG ──────── */}
      <Dialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              {t("management.tags.deleteDialog.title", "Delete Tag")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "management.tags.deleteDialog.description",
                'Are you sure you want to delete "{{name}}"? This will remove the tag from all contacts. This action cannot be undone.',
                { name: deletingTag?.name }
              )}
            </DialogDescription>
          </DialogHeader>

          {deletingTag && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border my-2">
              <span
                className="h-5 w-5 rounded-full shadow-sm"
                style={{ backgroundColor: deletingTag.color }}
              />
              <Badge style={{ backgroundColor: deletingTag.color }} className="text-white">
                {deletingTag.name}
              </Badge>
              {(deletingTag.contactCount ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {deletingTag.contactCount}{" "}
                  {(deletingTag.contactCount ?? 0) === 1
                    ? t("management.tags.contact", "contact")
                    : t("management.tags.contacts", "contacts")}
                </span>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("management.tags.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingTag && deleteMutation.mutate(deletingTag.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? t("management.tags.deleteDialog.deleting", "Deleting...")
                : t("management.tags.deleteDialog.delete", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}