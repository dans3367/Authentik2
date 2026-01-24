import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";

interface Tag {
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

export default function ManagementTags() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3B82F6");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#3B82F6");
  const [editDesc, setEditDesc] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/contact-tags"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/contact-tags");
      return res.json();
    },
  });

  const tags: Tag[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data?.tags)) return data.tags;
    if (Array.isArray(data)) return data as Tag[];
    return [];
  }, [data]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: newName.trim(), color: newColor, description: newDesc.trim() || undefined };
      const res = await apiRequest("POST", "/api/contact-tags", payload);
      return res.json();
    },
    onSuccess: async () => {
      setNewName("");
      setNewColor("#3B82F6");
      setNewDesc("");
      setCreating(false);
      await qc.invalidateQueries({ queryKey: ["/api/contact-tags"] });
      toast({ title: t('management.tags.toasts.created') });
    },
    onError: (e: any) => toast({ title: t('management.tags.toasts.error'), description: e?.message || t('management.tags.toasts.createError'), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const payload: any = { name: editName.trim(), color: editColor, description: editDesc.trim() || null };
      const res = await apiRequest("PUT", `/api/contact-tags/${editingId}`, payload);
      return res.json();
    },
    onSuccess: async () => {
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: ["/api/contact-tags"] });
      toast({ title: t('management.tags.toasts.updated') });
    },
    onError: (e: any) => toast({ title: t('management.tags.toasts.error'), description: e?.message || t('management.tags.toasts.updateError'), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contact-tags/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/contact-tags"] });
      toast({ title: t('management.tags.toasts.deleted') });
    },
    onError: (e: any) => toast({ title: t('management.tags.toasts.error'), description: e?.message || t('management.tags.toasts.deleteError'), variant: "destructive" }),
  });

  const startEdit = (t: Tag) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditColor(t.color);
    setEditDesc(t.description || "");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{t('management.tags.title')}</h2>
        {!creating ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> {t('management.tags.newTag')}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setCreating(false)}>{t('management.tags.cancel')}</Button>
        )}
      </div>

      {creating && (
        <div className="border rounded-md p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
            <div className="md:col-span-1">
              <label className="text-xs block mb-1">{t('management.tags.name')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('management.tags.namePlaceholder')} />
            </div>
            <div className="md:col-span-1">
              <label className="text-xs block mb-1">{t('management.tags.color')}</label>
              <div className="grid grid-cols-10 gap-2">
                {PRESET_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setNewColor(c)}
                    className={`h-6 w-6 rounded-full ${newColor === c ? "ring-2 ring-offset-1 ring-primary" : ""}`}
                    style={{ backgroundColor: c }} aria-label={`Choose color ${c}`} />
                ))}
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="text-xs block mb-1">{t('management.tags.preview')}</label>
              <Badge style={{ backgroundColor: newColor }} className="text-white">{newName || t('management.tags.example')}</Badge>
            </div>
            <div className="md:col-span-3">
              <label className="text-xs block mb-1">{t('management.tags.description')}</label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('management.tags.descriptionPlaceholder')} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreating(false)}>{t('management.tags.cancel')}</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending}>
              {createMutation.isPending ? t('management.tags.creating') : t('management.tags.create')}
            </Button>
          </div>
        </div>
      )}

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">{t('management.tags.color')}</TableHead>
              <TableHead>{t('management.tags.name')}</TableHead>
              <TableHead>{t('management.tags.description')}</TableHead>
              <TableHead className="w-24 text-right">{t('management.tags.contacts')}</TableHead>
              <TableHead className="w-32">{t('management.tags.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}>{t('management.tags.loading')}</TableCell></TableRow>
            ) : tags.length === 0 ? (
              <TableRow><TableCell colSpan={5}>{t('management.tags.noTags')}</TableCell></TableRow>
            ) : (
              tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <span className="inline-block w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                  </TableCell>
                  <TableCell>
                    {editingId === tag.id ? (
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge style={{ backgroundColor: tag.color }} className="text-white">{tag.name}</Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === tag.id ? (
                      <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
                    ) : (
                      <span className="text-sm text-muted-foreground">{tag.description || ""}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{tag.contactCount ?? "-"}</TableCell>
                  <TableCell>
                    {editingId === tag.id ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          {PRESET_COLORS.map((c) => (
                            <button key={c} type="button" onClick={() => setEditColor(c)}
                              className={`h-4 w-4 rounded-full ${editColor === c ? "ring-2 ring-offset-1 ring-primary" : ""}`}
                              style={{ backgroundColor: c }} aria-label={`Choose color ${c}`} />
                          ))}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>{t('management.tags.cancel')}</Button>
                        <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? t('management.tags.saving') : t('management.tags.save')}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" onClick={() => startEdit(tag)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="destructive" onClick={() => deleteMutation.mutate(tag.id)} aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}