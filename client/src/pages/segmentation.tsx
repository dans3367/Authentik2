import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { useAppSelector } from "@/store";
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
  Globe,
  Store,
  Check,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  isUniversal: boolean;
  selectedShopIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface ShopOption {
  id: string;
  name: string;
  status: string;
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

function getTypeBorderAccent(type: string, isUniversal?: boolean) {
  if (isUniversal) return "border-l-amber-500";
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

  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all_types");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUniversalCreateModalOpen, setIsUniversalCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSegmentationModalOpen, setIsSegmentationModalOpen] = useState(false);
  const [segmentationModalTarget, setSegmentationModalTarget] = useState<"create" | "universal" | "edit">("create");
  const [selectedList, setSelectedList] = useState<SegmentList | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "all" as "all" | "selected" | "tags",
    selectedContactIds: [] as string[],
    selectedTagIds: [] as string[],
  });
  // Universal segment form
  const [universalFormData, setUniversalFormData] = useState({
    name: "",
    description: "",
    type: "all" as "all" | "selected" | "tags",
    selectedContactIds: [] as string[],
    selectedTagIds: [] as string[],
    selectedShopIds: [] as string[],
  });

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const shopParam = selectedShopId ? `?shopId=${selectedShopId}` : '';

  // Fetch segment lists (scoped to selected shop)
  const { data: listsData, isLoading: listsLoading } = useQuery({
    queryKey: ["/api/segment-lists", { shopId: selectedShopId }],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/segment-lists${shopParam}`);
      return response.json();
    },
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ["/api/segment-lists-stats", { shopId: selectedShopId }],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/segment-lists/stats${shopParam}`);
      return response.json();
    },
  });

  // Fetch tenant shops for universal segment creation
  const { data: shopsData } = useQuery({
    queryKey: ["/api/shops", { limit: 100 }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/shops?limit=100");
      return res.json();
    },
    staleTime: Infinity,
  });
  const allShops: ShopOption[] = (shopsData?.shops || []).filter((s: ShopOption) => s.status === 'active');

  // Fetch contact counts per shop (for universal segment modal)
  const { data: shopContactCountsData } = useQuery<{ counts: Record<string, number> }>({
    queryKey: ["/api/segment-lists/shop-contact-counts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/segment-lists/shop-contact-counts");
      return res.json();
    },
    enabled: isUniversalCreateModalOpen,
    staleTime: 30_000,
  });
  const shopContactCounts: Record<string, number> = shopContactCountsData?.counts || {};

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
      const matchesType = typeFilter === "all_types" || typeFilter === "universal" ? list.isUniversal : list.type === typeFilter;
      const matchesFilter = typeFilter === "all_types" || (typeFilter === "universal" ? list.isUniversal : (!list.isUniversal && list.type === typeFilter));
      return matchesSearch && matchesFilter;
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

  const createUniversalMutation = useMutation({
    mutationFn: async (data: typeof universalFormData & { isUniversal: boolean }) => {
      const response = await apiRequest("POST", "/api/segment-lists", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/segment-lists-stats"] });
      toast({
        title: t("segmentation.toasts.success"),
        description: t("segmentation.toasts.crossStoreCreateSuccess", "Cross-store segment created successfully."),
      });
      setIsUniversalCreateModalOpen(false);
      resetUniversalForm();
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

  const resetUniversalForm = () => {
    setUniversalFormData({
      name: "",
      description: "",
      type: "all",
      selectedContactIds: [],
      selectedTagIds: [],
      selectedShopIds: [],
    });
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleCreateUniversal = () => {
    resetUniversalForm();
    setIsUniversalCreateModalOpen(true);
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
    if (list.isUniversal) {
      createUniversalMutation.mutate({
        name: `${list.name} (Copy)`,
        description: list.description || "",
        type: list.type,
        selectedContactIds: list.selectedContactIds,
        selectedTagIds: list.selectedTagIds,
        selectedShopIds: list.selectedShopIds || [],
        isUniversal: true,
      });
    } else {
      createMutation.mutate({
        name: `${list.name} (Copy)`,
        description: list.description || "",
        type: list.type,
        selectedContactIds: list.selectedContactIds,
        selectedTagIds: list.selectedTagIds,
      });
    }
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

  const handleSubmitUniversalCreate = () => {
    if (!universalFormData.name.trim()) {
      toast({
        title: t("segmentation.toasts.error"),
        description: t("segmentation.toasts.nameRequired"),
        variant: "destructive",
      });
      return;
    }
    if (universalFormData.selectedShopIds.length === 0) {
      toast({
        title: t("segmentation.toasts.error"),
        description: t("segmentation.toasts.shopsRequired", "Please select at least one store."),
        variant: "destructive",
      });
      return;
    }
    createUniversalMutation.mutate({ ...universalFormData, isUniversal: true });
  };

  const handleUniversalShopToggle = (shopId: string) => {
    setUniversalFormData((prev) => ({
      ...prev,
      selectedShopIds: prev.selectedShopIds.includes(shopId)
        ? prev.selectedShopIds.filter((id) => id !== shopId)
        : [...prev.selectedShopIds, shopId],
    }));
  };

  const handleSelectAllShops = () => {
    if (universalFormData.selectedShopIds.length === allShops.length) {
      setUniversalFormData((prev) => ({ ...prev, selectedShopIds: [] }));
    } else {
      setUniversalFormData((prev) => ({ ...prev, selectedShopIds: allShops.map((s) => s.id) }));
    }
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
    if (segmentationModalTarget === "universal") {
      setUniversalFormData({
        ...universalFormData,
        type: data.recipientType,
        selectedContactIds: data.selectedContactIds,
        selectedTagIds: data.selectedTagIds,
      });
    } else {
      setFormData({
        ...formData,
        type: data.recipientType,
        selectedContactIds: data.selectedContactIds,
        selectedTagIds: data.selectedTagIds,
      });
    }
  };

  /** Get shop names for display on universal segment cards */
  const getShopNames = (shopIds: string[]) => {
    if (!shopIds || shopIds.length === 0) return "";
    const names = shopIds.map((id) => allShops.find((s) => s.id === id)?.name).filter(Boolean);
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
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
      <div className="container mx-auto p-4 lg:p-6 space-y-6 lg:space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between animate-pulse">
          <div>
            <div className="h-8 w-56 bg-muted rounded mb-2" />
            <div className="h-4 w-80 bg-muted rounded" />
          </div>
          <div className="h-10 w-36 bg-muted rounded" />
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-4 w-4 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-7 bg-muted rounded w-1/4 mb-1" />
                <div className="h-3 bg-muted rounded w-1/2" />
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
    <div className="container mx-auto p-4 lg:p-6 space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            {t("segmentation.title")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t("segmentation.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCreateUniversal}>
            <Globe className="h-4 w-4 mr-2" />
            {t("segmentation.createCrossStore", "Create Cross-Store Segment")}
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t("segmentation.createSegment")}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t("segmentation.stats.totalSegments")}
            </CardTitle>
            <Target className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.totalLists}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("segmentation.stats.activeSegmentLists")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t("segmentation.stats.totalContacts")}
            </CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.totalContacts}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("segmentation.stats.acrossAllSegments")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t("segmentation.stats.avgSegmentSize")}
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.averageListSize}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("segmentation.stats.contactsPerSegment")}
            </p>
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
                <SelectItem value="all_types">{t("segmentation.filters.allTypes")}</SelectItem>
                <SelectItem value="all">{t("segmentation.filters.allCustomers")}</SelectItem>
                <SelectItem value="selected">{t("segmentation.filters.selectedCustomers")}</SelectItem>
                <SelectItem value="tags">{t("segmentation.filters.tagBased")}</SelectItem>
                <SelectItem value="universal">{t("segmentation.filters.crossStore", "Cross-Store")}</SelectItem>
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
                    list.type, list.isUniversal
                  )} bg-white/50 dark:bg-gray-800/30 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200`}
                >
                  <div className="p-5 space-y-3">
                    {/* Header with name and type */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base text-foreground truncate mb-1.5">
                          {list.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {list.isUniversal && (
                            <Badge
                              variant="secondary"
                              className="gap-1 text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            >
                              <Globe className="h-3 w-3" />
                              {t("segmentation.list.crossStoreBadge", "Cross-Store")}
                            </Badge>
                          )}
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
                    </div>

                    {/* Shop names for cross-store segments */}
                    {list.isUniversal && list.selectedShopIds?.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                        <Store className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{getShopNames(list.selectedShopIds)}</span>
                      </div>
                    )}

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
                onClick={() => { setSegmentationModalTarget("create"); setIsSegmentationModalOpen(true); }}
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
                onClick={() => { setSegmentationModalTarget("edit"); setIsSegmentationModalOpen(true); }}
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
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <DialogTitle>{t("segmentation.deleteModal.title")}</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
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

      {/* ──────── UNIVERSAL CREATE DIALOG ──────── */}
      <Dialog open={isUniversalCreateModalOpen} onOpenChange={setIsUniversalCreateModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                <Globe className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              {t("segmentation.crossStoreModal.title", "Create Cross-Store Segment")}
            </DialogTitle>
            <DialogDescription>
              {t("segmentation.crossStoreModal.description", "Create a segment that spans multiple stores. Contacts from all selected stores will be included.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="universal-name">{t("segmentation.createModal.nameLabel")}</Label>
              <Input
                id="universal-name"
                placeholder={t("segmentation.createModal.namePlaceholder")}
                value={universalFormData.name}
                onChange={(e) => setUniversalFormData({ ...universalFormData, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="universal-description">{t("segmentation.createModal.descriptionLabel")}</Label>
              <Textarea
                id="universal-description"
                placeholder={t("segmentation.createModal.descriptionPlaceholder")}
                value={universalFormData.description}
                onChange={(e) => setUniversalFormData({ ...universalFormData, description: e.target.value })}
                rows={2}
              />
            </div>

            <Separator />

            {/* Shop selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t("segmentation.crossStoreModal.selectShops", "Select Stores")}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSelectAllShops}
                >
                  {universalFormData.selectedShopIds.length === allShops.length
                    ? t("segmentation.crossStoreModal.deselectAll", "Deselect All")
                    : t("segmentation.crossStoreModal.selectAll", "Select All")}
                </Button>
              </div>

              {allShops.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-2">
                  {t("segmentation.crossStoreModal.noShops", "No active stores found.")}
                </p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto rounded-md border p-2">
                  {allShops.map((shop) => {
                    const isSelected = universalFormData.selectedShopIds.includes(shop.id);
                    return (
                      <label
                        key={shop.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleUniversalShopToggle(shop.id)}
                        />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Store className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{shop.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                            {shopContactCounts[shop.id] ?? 0} {t("segmentation.list.contacts")}
                          </span>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-amber-600 flex-shrink-0" />}
                      </label>
                    );
                  })}
                </div>
              )}

              {universalFormData.selectedShopIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("segmentation.crossStoreModal.shopsSelected", "{{count}} store(s) selected", { count: universalFormData.selectedShopIds.length })}
                  {" — "}
                  {universalFormData.selectedShopIds.reduce((sum, id) => sum + (shopContactCounts[id] ?? 0), 0).toLocaleString()}{" "}
                  {t("segmentation.crossStoreModal.totalContacts", "total contacts")}
                </p>
              )}
            </div>

            <Separator />

            {/* Segment criteria */}
            <div className="space-y-2">
              <Label>{t("segmentation.createModal.segmentCriteria")}</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start h-10 text-sm"
                onClick={() => { setSegmentationModalTarget("universal"); setIsSegmentationModalOpen(true); }}
              >
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                {universalFormData.type === "all"
                  ? t("segmentation.filters.allCustomers")
                  : universalFormData.type === "selected"
                    ? t("segmentation.createModal.selectedCustomers", {
                      count: universalFormData.selectedContactIds.length,
                    })
                    : t("segmentation.createModal.selectedTags", {
                      count: universalFormData.selectedTagIds.length,
                    })}
              </Button>

              {universalFormData.type !== "all" && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border text-xs text-muted-foreground">
                  {getTypeIcon(universalFormData.type)}
                  <span className="font-medium">
                    {universalFormData.type === "selected"
                      ? `${universalFormData.selectedContactIds.length} ${t("segmentation.list.contacts")}`
                      : `${universalFormData.selectedTagIds.length} ${t("segmentation.list.tags")}`}
                  </span>
                  <Badge variant="secondary" className={`ml-auto text-[10px] ${getTypeBadgeClasses(universalFormData.type)}`}>
                    {getTypeLabel(universalFormData.type)}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUniversalCreateModalOpen(false)}>
              {t("segmentation.createModal.cancel")}
            </Button>
            <Button onClick={handleSubmitUniversalCreate} disabled={createUniversalMutation.isPending}>
              {createUniversalMutation.isPending
                ? t("segmentation.createModal.creating")
                : t("segmentation.crossStoreModal.create", "Create Cross-Store Segment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Segmentation Modal */}
      <CustomerSegmentationModal
        isOpen={isSegmentationModalOpen}
        onClose={() => setIsSegmentationModalOpen(false)}
        recipientType={segmentationModalTarget === "universal" ? universalFormData.type : formData.type}
        selectedContactIds={segmentationModalTarget === "universal" ? universalFormData.selectedContactIds : formData.selectedContactIds}
        selectedTagIds={segmentationModalTarget === "universal" ? universalFormData.selectedTagIds : formData.selectedTagIds}
        onSave={handleSegmentationSave}
      />
    </div>
  );
}
