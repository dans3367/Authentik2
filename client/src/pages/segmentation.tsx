import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Tag,
  Mail,
  List,
  UserCheck,
  Target,
  Copy,
  Eye,
  LayoutDashboard,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CustomerSegmentationModal } from "@/components/CustomerSegmentationModal";

interface SegmentList {
  id: string;
  name: string;
  description: string | null;
  type: "all" | "selected" | "tags";
  contactCount: number;
  selectedContactIds: string[];
  selectedTagIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface SegmentStats {
  totalLists: number;
  totalContacts: number;
  averageListSize: number;
}

export default function SegmentationPage() {
  const { t } = useTranslation();

  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: t('navigation.dashboard'), href: "/", icon: LayoutDashboard },
    { label: t('segmentation.title'), icon: Target }
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSegmentationModalOpen, setIsSegmentationModalOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<SegmentList | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "all" as "all" | "selected" | "tags",
    selectedContactIds: [] as string[],
    selectedTagIds: [] as string[],
  });

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch segment lists
  const { data: listsData, isLoading: listsLoading } = useQuery({
    queryKey: ["/api/segment-lists"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/segment-lists");
      return response.json();
    },
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ["/api/segment-lists-stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/segment-lists/stats");
      return response.json();
    },
  });

  const lists: SegmentList[] = listsData?.lists || [];
  const stats: SegmentStats = statsData?.stats || {
    totalLists: 0,
    totalContacts: 0,
    averageListSize: 0,
  };

  // Filter lists
  const filteredLists = lists.filter((list) => {
    const matchesSearch =
      list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (list.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesType = typeFilter === "all" || list.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/segment-lists", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists-stats"] });
      toast({
        title: t('segmentation.toasts.success'),
        description: t('segmentation.toasts.createSuccess'),
      });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: t('segmentation.toasts.error'),
        description: error.message || t('segmentation.toasts.createError'),
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof formData) => {
      const response = await apiRequest("PATCH", `/api/segment-lists/${data.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists-stats"] });
      toast({
        title: t('segmentation.toasts.success'),
        description: t('segmentation.toasts.updateSuccess'),
      });
      setIsEditModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: t('segmentation.toasts.error'),
        description: error.message || t('segmentation.toasts.updateError'),
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/segment-lists/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists-stats"] });
      toast({
        title: t('segmentation.toasts.success'),
        description: t('segmentation.toasts.deleteSuccess'),
      });
      setIsDeleteModalOpen(false);
      setSelectedList(null);
    },
    onError: (error: any) => {
      toast({
        title: t('segmentation.toasts.error'),
        description: error.message || t('segmentation.toasts.deleteError'),
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "all",
      selectedContactIds: [],
      selectedTagIds: [],
    });
    setSelectedList(null);
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleEdit = (list: SegmentList) => {
    setSelectedList(list);
    setFormData({
      name: list.name,
      description: list.description || "",
      type: list.type,
      selectedContactIds: list.selectedContactIds,
      selectedTagIds: list.selectedTagIds,
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (list: SegmentList) => {
    setSelectedList(list);
    setIsDeleteModalOpen(true);
  };

  const handleDuplicate = async (list: SegmentList) => {
    const duplicateData = {
      name: `${list.name} (Copy)`,
      description: list.description || "",
      type: list.type,
      selectedContactIds: list.selectedContactIds,
      selectedTagIds: list.selectedTagIds,
    };
    createMutation.mutate(duplicateData);
  };

  const handleSubmitCreate = () => {
    if (!formData.name.trim()) {
      toast({
        title: t('segmentation.toasts.error'),
        description: t('segmentation.toasts.nameRequired'),
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleSubmitEdit = () => {
    if (!formData.name.trim()) {
      toast({
        title: t('segmentation.toasts.error'),
        description: t('segmentation.toasts.nameRequired'),
        variant: "destructive",
      });
      return;
    }
    if (selectedList) {
      updateMutation.mutate({ id: selectedList.id, ...formData });
    }
  };

  const handleSegmentationSave = (data: {
    recipientType: "all" | "selected" | "tags";
    selectedContactIds: string[];
    selectedTagIds: string[];
  }) => {
    setFormData({
      ...formData,
      type: data.recipientType,
      selectedContactIds: data.selectedContactIds,
      selectedTagIds: data.selectedTagIds,
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "all":
        return <Users className="h-4 w-4" />;
      case "selected":
        return <UserCheck className="h-4 w-4" />;
      case "tags":
        return <Tag className="h-4 w-4" />;
      default:
        return <List className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "all":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "selected":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "tags":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="h-8 w-8 text-indigo-600" />
            {t('segmentation.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('segmentation.subtitle')}
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('segmentation.createSegment')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('segmentation.stats.totalSegments')}</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLists}</div>
            <p className="text-xs text-muted-foreground">{t('segmentation.stats.activeSegmentLists')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('segmentation.stats.totalContacts')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContacts}</div>
            <p className="text-xs text-muted-foreground">{t('segmentation.stats.acrossAllSegments')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('segmentation.stats.avgSegmentSize')}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.averageListSize)}</div>
            <p className="text-xs text-muted-foreground">{t('segmentation.stats.contactsPerSegment')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder={t('segmentation.filters.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t('segmentation.filters.filterByType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('segmentation.filters.allTypes')}</SelectItem>
                <SelectItem value="allCustomers">{t('segmentation.filters.allCustomers')}</SelectItem>
                <SelectItem value="selected">{t('segmentation.filters.selectedCustomers')}</SelectItem>
                <SelectItem value="tags">{t('segmentation.filters.tagBased')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Segments Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('segmentation.list.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {listsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredLists.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('segmentation.list.noSegmentsFound')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {searchQuery || typeFilter !== "all"
                  ? t('segmentation.list.tryAdjustingFilters')
                  : t('segmentation.list.createFirstSegment')}
              </p>
              {!searchQuery && typeFilter === "all" && (
                <Button onClick={handleCreate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('segmentation.createSegment')}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLists.map((list) => (
                <Card key={list.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header with name and type */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">
                            {list.name}
                          </h3>
                          <Badge className={`gap-1 ${getTypeBadgeColor(list.type)}`}>
                            {getTypeIcon(list.type)}
                            {list.type === "all"
                              ? t('segmentation.filters.allCustomers')
                              : list.type === "selected"
                              ? t('segmentation.list.selected')
                              : t('segmentation.list.tags')}
                          </Badge>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {list.description ? (
                          <p className="line-clamp-2">{list.description}</p>
                        ) : (
                          <p className="text-gray-400 italic">{t('segmentation.list.noDescription')}</p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <Users className="h-4 w-4" />
                          <span>{list.contactCount} {t('segmentation.list.contacts')}</span>
                        </div>
                        <div className="text-gray-500 dark:text-gray-500">
                          {new Date(list.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(list)}
                          className="flex-1"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          {t('segmentation.actions.edit')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicate(list)}
                          className="flex-1"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          {t('segmentation.actions.duplicate')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(list)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('segmentation.createModal.title')}</DialogTitle>
            <DialogDescription>
              {t('segmentation.createModal.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('segmentation.createModal.nameLabel')}</Label>
              <Input
                id="name"
                placeholder={t('segmentation.createModal.namePlaceholder')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('segmentation.createModal.descriptionLabel')}</Label>
              <Textarea
                id="description"
                placeholder={t('segmentation.createModal.descriptionPlaceholder')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('segmentation.createModal.segmentCriteria')}</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setIsSegmentationModalOpen(true)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {formData.type === "all"
                  ? t('segmentation.filters.allCustomers')
                  : formData.type === "selected"
                  ? t('segmentation.createModal.selectedCustomers', { count: formData.selectedContactIds.length })
                  : t('segmentation.createModal.selectedTags', { count: formData.selectedTagIds.length })}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              {t('segmentation.createModal.cancel')}
            </Button>
            <Button onClick={handleSubmitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? t('segmentation.createModal.creating') : t('segmentation.createModal.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('segmentation.editModal.title')}</DialogTitle>
            <DialogDescription>
              {t('segmentation.editModal.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t('segmentation.editModal.nameLabel')}</Label>
              <Input
                id="edit-name"
                placeholder={t('segmentation.editModal.namePlaceholder')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t('segmentation.editModal.descriptionLabel')}</Label>
              <Textarea
                id="edit-description"
                placeholder={t('segmentation.editModal.descriptionPlaceholder')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('segmentation.editModal.segmentCriteria')}</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setIsSegmentationModalOpen(true)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {formData.type === "all"
                  ? t('segmentation.filters.allCustomers')
                  : formData.type === "selected"
                  ? t('segmentation.createModal.selectedCustomers', { count: formData.selectedContactIds.length })
                  : t('segmentation.createModal.selectedTags', { count: formData.selectedTagIds.length })}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              {t('segmentation.editModal.cancel')}
            </Button>
            <Button onClick={handleSubmitEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t('segmentation.editModal.saving') : t('segmentation.editModal.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('segmentation.deleteModal.title')}</DialogTitle>
            <DialogDescription>
              {t('segmentation.deleteModal.description', { name: selectedList?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              {t('segmentation.deleteModal.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedList && deleteMutation.mutate(selectedList.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t('segmentation.deleteModal.deleting') : t('segmentation.deleteModal.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Segmentation Modal */}
      <CustomerSegmentationModal
        isOpen={isSegmentationModalOpen}
        onClose={() => setIsSegmentationModalOpen(false)}
        recipientType={formData.type}
        selectedContactIds={formData.selectedContactIds}
        selectedTagIds={formData.selectedTagIds}
        onSave={handleSegmentationSave}
      />
    </div>
  );
}
