import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Tag, X } from "lucide-react";

interface ContactTag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  contactId: string;
  currentTagIds: string[];
  contactName?: string;
  trigger: React.ReactNode;
  onUpdated?: () => void;
}

export default function ManageContactTagsModal({
  contactId,
  currentTagIds,
  contactName,
  trigger,
  onUpdated,
}: Props) {
  const [open, setOpen] = useState(false);
  const safeCurrentTagIds = useMemo(() => 
    Array.isArray(currentTagIds) ? currentTagIds : [], 
    [currentTagIds]
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (open) setSelected(safeCurrentTagIds);
  }, [open, safeCurrentTagIds]);

  const { data: tagsData, isLoading: tagsLoading } = useQuery({
    queryKey: ["/api/contact-tags"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/contact-tags");
      return res.json();
    },
    enabled: open,
  });

  const tags: ContactTag[] = useMemo(() => {
    const raw: any = tagsData;
    if (Array.isArray(raw?.tags)) return raw.tags;
    if (Array.isArray(raw)) return raw;
    return [];
  }, [tagsData]);

  const PRESET_COLORS = [
    "#EF4444", "#EC4899", "#A855F7", "#6366F1", "#3B82F6",
    "#0EA5E9", "#06B6D4", "#14B8A6", "#22C55E", "#84CC16",
    "#FACC15", "#F59E0B", "#F97316", "#EA580C", "#8B5E3C",
    "#64748B", "#111827", "#10B981", "#9333EA", "#2563EB",
  ];

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toAdd = useMemo(
    () => (selected || []).filter((id) => !safeCurrentTagIds.includes(id)),
    [selected, safeCurrentTagIds]
  );
  const toRemove = useMemo(
    () => safeCurrentTagIds.filter((id) => !(selected || []).includes(id)),
    [selected, safeCurrentTagIds]
  );

  const applyMutation = useMutation({
    mutationFn: async () => {
      const adds = toAdd.map((tagId) =>
        apiRequest("POST", `/api/email-contacts/${contactId}/tags/${tagId}`)
      );
      const removes = toRemove.map((tagId) =>
        apiRequest("DELETE", `/api/email-contacts/${contactId}/tags/${tagId}`)
      );
      const res = await Promise.allSettled([...adds, ...removes]);
      const rejected = res.filter((r) => r.status === "rejected");
      if (rejected.length > 0) {
        throw new Error("Failed to update some tags");
      }
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/email-contacts", contactId] }),
        qc.invalidateQueries({ queryKey: ["/api/email-contacts"] }),
      ]);
      if (onUpdated) onUpdated();
      toast({ title: "Success", description: "Tags updated" });
      setOpen(false);
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e?.message || "Failed to update tags",
        variant: "destructive",
      });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async (payload: { name: string; color: string }) => {
      const res = await apiRequest("POST", "/api/contact-tags", payload);
      return res.json();
    },
    onSuccess: async (tag: ContactTag) => {
      setNewTagName("");
      setNewTagColor("#3B82F6");
      setCreating(false);
      await qc.invalidateQueries({ queryKey: ["/api/contact-tags"] });
      setSelected((prev) => (prev.includes(tag.id) ? prev : [...prev, tag.id]));
      toast({ title: "Tag created", description: tag.name });
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e?.message || "Failed to create tag",
        variant: "destructive",
      });
    },
  });

  const hasChanges = toAdd.length > 0 || toRemove.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Manage Tags{contactName ? ` for ${contactName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Select tags</Label>
            {!creating ? (
              <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Tag
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            )}
          </div>

          {creating && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end border rounded-md p-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Name</Label>
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="VIP, Loyal, High LTV"
                />
              </div>
              <div className="sm:col-span-3">
                <Label className="text-xs">Color</Label>
                <div className="mt-2 grid grid-cols-10 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Choose color ${c}`}
                      onClick={() => setNewTagColor(c)}
                      className={`h-6 w-6 rounded-full transition-all hover:scale-110 ${
                        newTagColor === c 
                          ? "ring-2 ring-offset-1 ring-primary shadow-md" 
                          : "hover:shadow-sm"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="sm:col-span-3 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreating(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    createTagMutation.mutate({ name: newTagName.trim(), color: newTagColor })
                  }
                  disabled={!newTagName.trim() || createTagMutation.isPending}
                >
                  {createTagMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-auto border rounded-md">
            {tagsLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading tags...</div>
            ) : !tags || tags.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No tags available</div>
            ) : (
              <div className="divide-y">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={selected.includes(tag.id)}
                      onCheckedChange={() => toggle(tag.id)}
                    />
                    <span className="flex-1 flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm font-medium">{tag.name}</span>
                    </span>
                    {selected.includes(tag.id) ? (
                      <Badge
                        variant="outline"
                        style={{ borderColor: tag.color, color: tag.color }}
                        className="text-xs"
                      >
                        Selected
                      </Badge>
                    ) : null}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-muted-foreground">
              {hasChanges ? `${toAdd.length} to add, ${toRemove.length} to remove` : "No changes"}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={applyMutation.isPending}>
                Close
              </Button>
              <Button onClick={() => applyMutation.mutate()} disabled={!hasChanges || applyMutation.isPending}>
                {applyMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
