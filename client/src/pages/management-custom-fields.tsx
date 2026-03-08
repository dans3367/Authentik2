import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil,
  Trash2,
  Plus,
  Search,
  GripVertical,
  Type,
  Hash,
  Calendar,
  List,
  Link,
  ToggleLeft,
  AlertTriangle,
  Settings2,
  X,
} from "lucide-react";

interface CustomField {
  id: string;
  name: string;
  label: string;
  fieldType: string;
  options: string[];
  placeholder: string | null;
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Text", icon: Type, description: "Free-form text input" },
  { value: "number", label: "Number", icon: Hash, description: "Numeric values" },
  { value: "date", label: "Date", icon: Calendar, description: "Date picker" },
  { value: "select", label: "Dropdown", icon: List, description: "Choose from predefined options" },
  { value: "url", label: "URL", icon: Link, description: "Web links" },
  { value: "boolean", label: "Yes/No", icon: ToggleLeft, description: "Toggle on or off" },
];

function getFieldTypeIcon(fieldType: string) {
  const match = FIELD_TYPE_OPTIONS.find(f => f.value === fieldType);
  return match?.icon || Type;
}

function getFieldTypeLabel(fieldType: string) {
  const match = FIELD_TYPE_OPTIONS.find(f => f.value === fieldType);
  return match?.label || fieldType;
}

export default function ManagementCustomFields() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<CustomField | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formType, setFormType] = useState("text");
  const [formPlaceholder, setFormPlaceholder] = useState("");
  const [formRequired, setFormRequired] = useState(false);
  const [formOptions, setFormOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");

  // Fetch custom fields
  const { data, isLoading } = useQuery({
    queryKey: ["/api/contact-custom-fields"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/contact-custom-fields");
      return res.json();
    },
  });

  const fields: CustomField[] = data?.fields || [];

  const filteredFields = fields.filter(f =>
    f.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/contact-custom-fields", payload);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create field");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Custom field created", description: "The field is now available for all contacts." });
      qc.invalidateQueries({ queryKey: ["/api/contact-custom-fields"] });
      resetForm();
      setCreateOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create field", variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await apiRequest("PUT", `/api/contact-custom-fields/${id}`, payload);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to update field");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Custom field updated" });
      qc.invalidateQueries({ queryKey: ["/api/contact-custom-fields"] });
      resetForm();
      setEditOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update field", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/contact-custom-fields/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete field");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Custom field deleted", description: "The field and all its values have been removed." });
      qc.invalidateQueries({ queryKey: ["/api/contact-custom-fields"] });
      setDeleteOpen(false);
      setSelectedField(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete field", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormLabel("");
    setFormType("text");
    setFormPlaceholder("");
    setFormRequired(false);
    setFormOptions([]);
    setNewOption("");
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (field: CustomField) => {
    setSelectedField(field);
    setFormName(field.name);
    setFormLabel(field.label);
    setFormType(field.fieldType);
    setFormPlaceholder(field.placeholder || "");
    setFormRequired(field.isRequired);
    setFormOptions(field.options || []);
    setNewOption("");
    setEditOpen(true);
  };

  const openDelete = (field: CustomField) => {
    setSelectedField(field);
    setDeleteOpen(true);
  };

  const handleCreate = () => {
    if (!formName.trim() || !formLabel.trim()) return;
    createMutation.mutate({
      name: formName.trim(),
      label: formLabel.trim(),
      fieldType: formType,
      options: formType === "select" ? formOptions : undefined,
      placeholder: formPlaceholder.trim() || undefined,
      isRequired: formRequired,
      sortOrder: fields.length,
    });
  };

  const handleUpdate = () => {
    if (!selectedField || !formName.trim() || !formLabel.trim()) return;
    updateMutation.mutate({
      id: selectedField.id,
      payload: {
        name: formName.trim(),
        label: formLabel.trim(),
        fieldType: formType,
        options: formType === "select" ? formOptions : undefined,
        placeholder: formPlaceholder.trim() || undefined,
        isRequired: formRequired,
      },
    });
  };

  const addOption = () => {
    const val = newOption.trim();
    if (val && !formOptions.includes(val)) {
      setFormOptions([...formOptions, val]);
      setNewOption("");
    }
  };

  const removeOption = (opt: string) => {
    setFormOptions(formOptions.filter(o => o !== opt));
  };

  // Auto-generate name from label
  const handleLabelChange = (value: string, isCreate: boolean) => {
    setFormLabel(value);
    if (isCreate) {
      setFormName(value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
    }
  };

  const fieldForm = (isCreate: boolean) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Display Label *</Label>
        <Input
          placeholder="e.g. Annual Income, YouTube Channel"
          value={formLabel}
          onChange={(e) => handleLabelChange(e.target.value, isCreate)}
        />
      </div>

      <div className="space-y-2">
        <Label>Field Name (internal) *</Label>
        <Input
          placeholder="e.g. annual_income"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">Used internally. Lowercase, underscores only.</p>
      </div>

      <div className="space-y-2">
        <Label>Field Type</Label>
        <Select value={formType} onValueChange={setFormType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{opt.label}</span>
                    <span className="text-xs text-muted-foreground">— {opt.description}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {formType === "select" && (
        <div className="space-y-2">
          <Label>Dropdown Options</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add option..."
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addOption}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {formOptions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {formOptions.map((opt) => (
                <Badge key={opt} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                  {opt}
                  <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => removeOption(opt)} />
                </Badge>
              ))}
            </div>
          )}
          {formOptions.length === 0 && (
            <p className="text-xs text-muted-foreground">Add at least one option for the dropdown.</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>Placeholder Text</Label>
        <Input
          placeholder="e.g. Enter their income..."
          value={formPlaceholder}
          onChange={(e) => setFormPlaceholder(e.target.value)}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="field-required"
          checked={formRequired}
          onCheckedChange={(checked) => setFormRequired(checked === true)}
        />
        <Label htmlFor="field-required" className="text-sm cursor-pointer">
          Required field
        </Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Custom Contact Fields
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Define custom fields that appear on every contact's profile. Examples: age, employment, income, social media channels.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search fields..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Fields List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredFields.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <Settings2 className="h-12 w-12 text-gray-300 dark:text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {searchTerm ? "No fields match your search" : "No custom fields yet"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm max-w-md">
                {searchTerm
                  ? "Try a different search term."
                  : "Custom fields let you track additional information about your contacts like age, employment, income, social media channels, and more."}
              </p>
              {!searchTerm && (
                <Button onClick={openCreate} variant="outline" className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Field
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredFields.map((field) => {
            const Icon = getFieldTypeIcon(field.fieldType);
            return (
              <Card key={field.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex-shrink-0">
                        <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                            {field.label}
                          </h4>
                          <Badge variant="outline" className="text-xs font-mono">
                            {field.name}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {getFieldTypeLabel(field.fieldType)}
                          </Badge>
                          {field.isRequired && (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {field.placeholder && (
                            <span className="text-xs text-muted-foreground">
                              Placeholder: "{field.placeholder}"
                            </span>
                          )}
                          {field.fieldType === "select" && field.options.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {field.options.length} option{field.options.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(field)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDelete(field)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {fields.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {fields.length} custom field{fields.length !== 1 ? "s" : ""} defined. These fields will appear on all contact profiles.
        </p>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Custom Field</DialogTitle>
            <DialogDescription>
              Define a new custom field that will be available on all contact profiles.
            </DialogDescription>
          </DialogHeader>
          {fieldForm(true)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!formName.trim() || !formLabel.trim() || createMutation.isPending || (formType === "select" && formOptions.length === 0)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {createMutation.isPending ? "Creating..." : "Create Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Custom Field</DialogTitle>
            <DialogDescription>
              Update the field definition. Changes apply to all contacts.
            </DialogDescription>
          </DialogHeader>
          {fieldForm(false)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={handleUpdate}
              disabled={!formName.trim() || !formLabel.trim() || updateMutation.isPending || (formType === "select" && formOptions.length === 0)}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Custom Field
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the field <strong>"{selectedField?.label}"</strong>? This will permanently remove all values stored for this field across all contacts. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => selectedField && deleteMutation.mutate(selectedField.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
