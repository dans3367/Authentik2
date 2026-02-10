import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Tag,
  List,
  UserCheck,
  Target,
  Copy,
  LayoutDashboard,
  AlertTriangle,
  BarChart3,
  Calendar,
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

// --- Helper functions ---

function getTypeIcon(type: string) {
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
}

function getTypeBadgeClasses(type: string) {
  switch (type) {
    case "all":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "selected":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "tags":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function getTypeBorderAccent(type: string) {
  switch (type) {
    case "all":
      return "border-l-blue-500";
    case "selected":
      return "border-l-emerald-500";
    case "tags":
      return "border-l-purple-500";
    default:
      return "border-l-gray-400";
  }
}

export default function SegmentationPage() {
  const { t } = useTranslation();

  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: t("navigation.dashboard"), href: "/", icon: LayoutDashboard },
    { label: t("segmentation.title"), icon: Target },
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
  const filteredLists = useMemo(() => {
    return lists.filter((list) => {
      const matchesSearch =
        list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (list.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesType = typeFilter === "all" || list.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [lists, searchQuery, typeFilter]);

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/segment-lists", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists-stats"] });
      toast({
        title: t("segmentation.toasts.success"),
        description: t("segmentation.toasts.createSuccess"),
      });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: t("segmentation.toasts.error"),
        description: error.message || t("segmentation.toasts.createError"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof formData) => {
      const response = await apiRequest("PATCH", `/api/segment-lists/${data.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists-stats"] });
      toast({
        title: t("segmentation.toasts.success"),
        description: t("segmentation.toasts.updateSuccess"),
      });
      setIsEditModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: t("segmentation.toasts.error"),
        description: error.message || t("segmentation.toasts.updateError"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/segment-lists/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists-stats"] });
      toast({
        title: t("segmentation.toasts.success"),
        description: t("segmentation.toasts.deleteSuccess"),
      });
      setIsDeleteModalOpen(false);
      setSelectedList(null);
    },
    onError: (error: any) => {
      toast({
        title: t("segmentation.toasts.error"),
        description: error.message || t("segmentation.toasts.deleteError"),
        variant: "destructive",
      });
    },
  });

  // --- Handlers ---

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
        title: t("segmentation.toasts.error"),
        description: t("segmentation.toasts.nameRequired"),
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleSubmitEdit = () => {
    if (!formData.name.trim()) {
      toast({
        title: t("segmentation.toasts.error"),
        description: t("segmentation.toasts.nameRequired"),
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "all":
        return t("segmentation.filters.allCustomers");
      case "selected":
        return t("segmentation.list.selected", "Selected");
      case "tags":
        return t("segmentation.list.tags", "Tags");
      default:
        return type;
    }
  };

  // --- Loading Skeleton ---
  if (listsLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between bg-card p-6 rounded-xl border shadow-sm animate-pulse">
          <div>
            <div className="h-7 w-48 bg-muted rounded mb-2" />
            <div className="h-4 w-72 bg-muted rounded" />
          </div>
          <div className="h-10 w-36 bg-muted rounded" />
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5">
                <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                <div className="h-7 bg-muted rounded w-1/2 mb-1" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* List skeleton */}
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-9 bg-muted rounded w-full max-w-sm mb-5" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-muted rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      {/* ── Hero Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t("segmentation.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("segmentation.subtitle")}
            </p>
          </div>
        </div>

        <Button onClick={handleCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          {t("segmentation.createSegment")}
        </Button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("segmentation.stats.totalSegments")}
                </p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {stats.totalLists}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("segmentation.stats.activeSegmentLists")}
                </p>
              </div>
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("segmentation.stats.totalContacts")}
                </p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {stats.totalContacts}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("segmentation.stats.acrossAllSegments")}
                </p>
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
                  {t("segmentation.stats.avgSegmentSize")}
                </p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {stats.averageListSize}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("segmentation.stats.contactsPerSegment")}
                </p>
              </div>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Segments List ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {t("segmentation.list.title")}
              </CardTitle>
              <CardDescription className="mt-0.5">
                {t(
                  "segmentation.list.subtitle",
                  "Organize your contacts into segments for targeted email campaigns"
                )}
              </CardDescription>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={t("segmentation.filters.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
                <SelectValue placeholder={t("segmentation.filters.filterByType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("segmentation.filters.allTypes")}</SelectItem>
                <SelectItem value="allCustomers">{t("segmentation.filters.allCustomers")}</SelectItem>
                <SelectItem value="selected">{t("segmentation.filters.selectedCustomers")}</SelectItem>
                <SelectItem value="tags">{t("segmentation.filters.tagBased")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {filteredLists.length === 0 && lists.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-full mb-4">
                <Target className="h-10 w-10 text-indigo-500 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {t("segmentation.list.noSegmentsFound")}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                {t("segmentation.list.createFirstSegment")}
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-1.5" />
                {t("segmentation.createSegment")}
              </Button>
            </div>
          ) : filteredLists.length === 0 ? (
            /* No search results */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                {t("segmentation.list.noSegmentsFound")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("segmentation.list.tryAdjustingFilters")}
              </p>
            </div>
          ) : (
            /* Segment cards */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredLists.map((list) => (
                <div
                  key={list.id}
                  className={`group relative rounded-lg border border-l-4 ${getTypeBorderAccent(
                    list.type
                  )} bg-white/50 dark:bg-gray-800/30 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200`}
                >
                  <div className="p-5 space-y-3">
                    {/* Header with name and type */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base text-foreground truncate mb-1.5">
                          {list.name}
                        </h3>
                        <Badge
                          variant="secondary"
                          className={`gap-1 text-[11px] font-medium ${getTypeBadgeClasses(
                            list.type
                          )}`}
                        >
                          {getTypeIcon(list.type)}
                          {getTypeLabel(list.type)}
                        </Badge>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="text-sm text-muted-foreground min-h-[2.5rem]">
                      {list.description ? (
                        <p className="line-clamp-2">{list.description}</p>
                      ) : (
                        <p className="italic opacity-60">
                          {t("segmentation.list.noDescription")}
                        </p>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          {list.contactCount}{" "}
                          {t("segmentation.list.contacts")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(list.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(list)}
                        className="flex-1 h-8 text-xs hover:bg-muted"
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        {t("segmentation.actions.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(list)}
                        className="flex-1 h-8 text-xs hover:bg-muted"
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        {t("segmentation.actions.duplicate")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(list)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ──────── CREATE DIALOG ──────── */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-md">
                <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              {t("segmentation.createModal.title")}
            </DialogTitle>
            <DialogDescription>
              {t("segmentation.createModal.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("segmentation.createModal.nameLabel")}</Label>
              <Input
                id="name"
                placeholder={t("segmentation.createModal.namePlaceholder")}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("segmentation.createModal.descriptionLabel")}</Label>
              <Textarea
                id="description"
                placeholder={t("segmentation.createModal.descriptionPlaceholder")}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>{t("segmentation.createModal.segmentCriteria")}</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start h-10 text-sm"
                onClick={() => setIsSegmentationModalOpen(true)}
              >
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                {formData.type === "all"
                  ? t("segmentation.filters.allCustomers")
                  : formData.type === "selected"
                    ? t("segmentation.createModal.selectedCustomers", {
                      count: formData.selectedContactIds.length,
                    })
                    : t("segmentation.createModal.selectedTags", {
                      count: formData.selectedTagIds.length,
                    })}
              </Button>

              {/* Visual summary of selection */}
              {formData.type !== "all" && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border text-xs text-muted-foreground">
                  {getTypeIcon(formData.type)}
                  <span className="font-medium">
                    {formData.type === "selected"
                      ? `${formData.selectedContactIds.length} ${t("segmentation.list.contacts")}`
                      : `${formData.selectedTagIds.length} ${t("segmentation.list.tags")}`}
                  </span>
                  <Badge variant="secondary" className={`ml-auto text-[10px] ${getTypeBadgeClasses(formData.type)}`}>
                    {getTypeLabel(formData.type)}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              {t("segmentation.createModal.cancel")}
            </Button>
            <Button onClick={handleSubmitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending
                ? t("segmentation.createModal.creating")
                : t("segmentation.createModal.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────── EDIT DIALOG ──────── */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                <Edit className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              {t("segmentation.editModal.title")}
            </DialogTitle>
            <DialogDescription>
              {t("segmentation.editModal.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("segmentation.editModal.nameLabel")}</Label>
              <Input
                id="edit-name"
                placeholder={t("segmentation.editModal.namePlaceholder")}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">{t("segmentation.editModal.descriptionLabel")}</Label>
              <Textarea
                id="edit-description"
                placeholder={t("segmentation.editModal.descriptionPlaceholder")}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>{t("segmentation.editModal.segmentCriteria")}</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start h-10 text-sm"
                onClick={() => setIsSegmentationModalOpen(true)}
              >
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                {formData.type === "all"
                  ? t("segmentation.filters.allCustomers")
                  : formData.type === "selected"
                    ? t("segmentation.createModal.selectedCustomers", {
                      count: formData.selectedContactIds.length,
                    })
                    : t("segmentation.createModal.selectedTags", {
                      count: formData.selectedTagIds.length,
                    })}
              </Button>

              {/* Visual summary of selection */}
              {formData.type !== "all" && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border text-xs text-muted-foreground">
                  {getTypeIcon(formData.type)}
                  <span className="font-medium">
                    {formData.type === "selected"
                      ? `${formData.selectedContactIds.length} ${t("segmentation.list.contacts")}`
                      : `${formData.selectedTagIds.length} ${t("segmentation.list.tags")}`}
                  </span>
                  <Badge variant="secondary" className={`ml-auto text-[10px] ${getTypeBadgeClasses(formData.type)}`}>
                    {getTypeLabel(formData.type)}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              {t("segmentation.editModal.cancel")}
            </Button>
            <Button onClick={handleSubmitEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending
                ? t("segmentation.editModal.saving")
                : t("segmentation.editModal.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────── DELETE CONFIRMATION DIALOG ──────── */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              {t("segmentation.deleteModal.title")}
            </DialogTitle>
            <DialogDescription>
              {t("segmentation.deleteModal.description", {
                name: selectedList?.name,
              })}
            </DialogDescription>
          </DialogHeader>

          {/* Segment preview in delete dialog */}
          {selectedList && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border my-2">
              <div className="flex items-center gap-2">
                {getTypeIcon(selectedList.type)}
                <span className="text-sm font-medium">{selectedList.name}</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {selectedList.contactCount} {t("segmentation.list.contacts")}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              {t("segmentation.deleteModal.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedList && deleteMutation.mutate(selectedList.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? t("segmentation.deleteModal.deleting")
                : t("segmentation.deleteModal.delete")}
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
