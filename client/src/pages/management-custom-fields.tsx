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
  mask: string | null;
  options: string[];
  placeholder: string | null;
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const FIELD_TYPE_KEYS = [
  { value: "text", key: "text", icon: Type },
  { value: "number", key: "number", icon: Hash },
  { value: "date", key: "date", icon: Calendar },
  { value: "select", key: "select", icon: List },
  { value: "url", key: "url", icon: Link },
  { value: "boolean", key: "boolean", icon: ToggleLeft },
];

// Mask (format) option keys per field type
const MASK_KEYS: Record<string, string[]> = {
  text: ["single_line", "multi_line"],
  number: ["plain", "phone_with_area", "phone_no_area", "currency", "percentage"],
  date: ["date_only", "date_time", "time_only"],
};

function getDefaultMask(fieldType: string): string | null {
  const masks = MASK_KEYS[fieldType];
  return masks ? masks[0] : null;
}

function getFieldTypeIcon(fieldType: string) {
  const match = FIELD_TYPE_KEYS.find(f => f.value === fieldType);
  return match?.icon || Type;
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
  const [formMask, setFormMask] = useState<string | null>(null);
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
      toast({ title: t('management.customFields.toasts.created'), description: t('management.customFields.toasts.createdDesc') });
      qc.invalidateQueries({ queryKey: ["/api/contact-custom-fields"] });
      resetForm();
      setCreateOpen(false);
    },
    onError: (err: any) => {
      toast({ title: t('management.customFields.toasts.error'), description: err.message, variant: "destructive" });
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
      toast({ title: t('management.customFields.toasts.updated') });
      qc.invalidateQueries({ queryKey: ["/api/contact-custom-fields"] });
      resetForm();
      setEditOpen(false);
    },
    onError: (err: any) => {
      toast({ title: t('management.customFields.toasts.error'), description: err.message, variant: "destructive" });
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
      toast({ title: t('management.customFields.toasts.deleted'), description: t('management.customFields.toasts.deletedDesc') });
      qc.invalidateQueries({ queryKey: ["/api/contact-custom-fields"] });
      setDeleteOpen(false);
      setSelectedField(null);
    },
    onError: (err: any) => {
      toast({ title: t('management.customFields.toasts.error'), description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormLabel("");
    setFormType("text");
    setFormMask(null);
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
    setFormMask(field.mask || getDefaultMask(field.fieldType));
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
      mask: MASK_KEYS[formType] ? (formMask || getDefaultMask(formType)) : null,
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
        mask: MASK_KEYS[formType] ? (formMask || getDefaultMask(formType)) : null,
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
        <Label>{t('management.customFields.form.displayLabel')} *</Label>
        <Input
          placeholder={t('management.customFields.form.displayLabelPlaceholder')}
          value={formLabel}
          onChange={(e) => handleLabelChange(e.target.value, isCreate)}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('management.customFields.form.fieldName')} *</Label>
        <Input
          placeholder={t('management.customFields.form.fieldNamePlaceholder')}
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">{t('management.customFields.form.fieldNameHint')}</p>
      </div>

      <div className="space-y-2">
        <Label>{t('management.customFields.form.fieldType')}</Label>
        <Select value={formType} onValueChange={(val) => { setFormType(val); setFormMask(getDefaultMask(val)); }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPE_KEYS.map(opt => {
              const Icon = opt.icon;
              return (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{t(`management.customFields.fieldTypes.${opt.key}`)}</span>
                    <span className="text-xs text-muted-foreground">— {t(`management.customFields.fieldTypes.${opt.key}Desc`)}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {MASK_KEYS[formType] && (
        <div className="space-y-2">
          <Label>{t('management.customFields.form.format')}</Label>
          <Select value={formMask || getDefaultMask(formType) || ''} onValueChange={setFormMask}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MASK_KEYS[formType].map(maskKey => (
                <SelectItem key={maskKey} value={maskKey}>
                  <div className="flex items-center gap-2">
                    <span>{t(`management.customFields.masks.${maskKey}`)}</span>
                    <span className="text-xs text-muted-foreground">— {t(`management.customFields.masks.${maskKey}Desc`)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {formType === "select" && (
        <div className="space-y-2">
          <Label>{t('management.customFields.form.dropdownOptions')}</Label>
          <div className="flex gap-2">
            <Input
              placeholder={t('management.customFields.form.addOptionPlaceholder')}
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
            <p className="text-xs text-muted-foreground">{t('management.customFields.form.addOptionHint')}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>{t('management.customFields.form.placeholderText')}</Label>
        <Input
          placeholder={t('management.customFields.form.placeholderTextPlaceholder')}
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
          {t('management.customFields.form.requiredField')}
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
            {t('management.customFields.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('management.customFields.subtitle')}
          </p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          {t('management.customFields.addField')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('management.customFields.searchPlaceholder')}
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
                {searchTerm ? t('management.customFields.noSearchResults') : t('management.customFields.noFieldsTitle')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm max-w-md">
                {searchTerm
                  ? t('management.customFields.noSearchResultsHint')
                  : t('management.customFields.noFieldsDescription')}
              </p>
              {!searchTerm && (
                <Button onClick={openCreate} variant="outline" className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('management.customFields.createFirstField')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredFields.map((field) => {
            const Icon = getFieldTypeIcon(field.fieldType);
            const maskLabel = field.mask ? t(`management.customFields.masks.${field.mask}`, { defaultValue: '' }) : null;
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
                            {t(`management.customFields.fieldTypes.${field.fieldType}`, { defaultValue: field.fieldType })}
                          </Badge>
                          {field.isRequired && (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
                              {t('management.customFields.required')}
                            </Badge>
                          )}
                          {maskLabel && (
                            <Badge variant="outline" className="text-xs">
                              {maskLabel}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {field.placeholder && (
                            <span className="text-xs text-muted-foreground">
                              {t('management.customFields.placeholder')}: "{field.placeholder}"
                            </span>
                          )}
                          {field.fieldType === "select" && field.options.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {field.options.length} {field.options.length !== 1 ? t('management.customFields.options') : t('management.customFields.option')}
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
          {t('management.customFields.summary', { count: fields.length })}
        </p>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('management.customFields.createDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('management.customFields.createDialog.description')}
            </DialogDescription>
          </DialogHeader>
          {fieldForm(true)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('management.customFields.cancel')}</Button>
            <Button
              onClick={handleCreate}
              disabled={!formName.trim() || !formLabel.trim() || createMutation.isPending || (formType === "select" && formOptions.length === 0)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {createMutation.isPending ? t('management.customFields.createDialog.creating') : t('management.customFields.createDialog.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('management.customFields.editDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('management.customFields.editDialog.description')}
            </DialogDescription>
          </DialogHeader>
          {fieldForm(false)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t('management.customFields.cancel')}</Button>
            <Button
              onClick={handleUpdate}
              disabled={!formName.trim() || !formLabel.trim() || updateMutation.isPending || (formType === "select" && formOptions.length === 0)}
            >
              {updateMutation.isPending ? t('management.customFields.editDialog.saving') : t('management.customFields.editDialog.save')}
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
              {t('management.customFields.deleteDialog.title')}
            </DialogTitle>
            <DialogDescription>
              <span dangerouslySetInnerHTML={{ __html: t('management.customFields.deleteDialog.description', { fieldLabel: selectedField?.label || '' }) }} />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t('management.customFields.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => selectedField && deleteMutation.mutate(selectedField.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t('management.customFields.deleteDialog.deleting') : t('management.customFields.deleteDialog.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
