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
  Store,
  ShoppingBag,
  SlidersHorizontal,
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

type CardBadgeKind = "shop" | "tag" | "custom" | "all";

function getCardBadgeKind(list: SegmentList): CardBadgeKind {
  if (list.isUniversal) return "shop";
  if (list.type === "tags") return "tag";
  if (list.type === "selected") return "custom";
  return "all";
}

function getCardBadgeIcon(kind: CardBadgeKind) {
  switch (kind) {
    case "shop":
      return <ShoppingBag className="h-3 w-3" />;
    case "tag":
      return <Tag className="h-3 w-3" />;
    case "custom":
      return <SlidersHorizontal className="h-3 w-3" />;
    default:
      return <Users className="h-3 w-3" />;
  }
}

function getCardBadgeClasses(kind: CardBadgeKind) {
  switch (kind) {
    case "shop":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "tag":
      return "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
    case "custom":
      return "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    default:
      return "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSegmentationModalOpen, setIsSegmentationModalOpen] = useState(false);
  const [segmentationModalTarget, setSegmentationModalTarget] = useState<"create" | "edit">("create");
  const [selectedList, setSelectedList] = useState<SegmentList | null>(null);
  const [formData, setFormData] = useState({
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
    mutationFn: async (data: typeof formData & { isUniversal: boolean }) => {
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
    mutationFn: async (data: { id: string } & typeof formData & { isUniversal: boolean }) => {
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
      selectedShopIds: [],
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
      selectedShopIds: list.selectedShopIds || [],
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (list: SegmentList) => {
    setSelectedList(list);
    setIsDeleteModalOpen(true);
  };

  const handleDuplicate = async (list: SegmentList) => {
    createMutation.mutate({
      name: `${list.name} (Copy)`,
      description: list.description || "",
      type: list.type,
      selectedContactIds: list.selectedContactIds,
      selectedTagIds: list.selectedTagIds,
      selectedShopIds: list.selectedShopIds || [],
      isUniversal: list.selectedShopIds != null && list.selectedShopIds.length > 0,
    });
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
    createMutation.mutate({ ...formData, isUniversal: formData.selectedShopIds.length > 0 });
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
      updateMutation.mutate({ id: selectedList.id, ...formData, isUniversal: formData.selectedShopIds.length > 0 });
    }
  };

  const handleSegmentationSave = (data: {
    recipientType: "all" | "selected" | "tags" | "shops";
    selectedContactIds: string[];
    selectedTagIds: string[];
    selectedShopIds: string[];
  }) => {
    // 'shops' is a UI-only value meaning "filter by store(s)".
    // Store it as type 'all' in formData so it passes backend validation,
    // but selectedShopIds carries the actual filter intent.
    setFormData({
      ...formData,
      type: data.recipientType === "shops" ? "all" : data.recipientType,
      selectedContactIds: data.selectedContactIds,
      selectedTagIds: data.selectedTagIds,
      selectedShopIds: data.selectedShopIds,
    });
  };

  /** Split shop names into visible names + overflow count for chip display */
  const getShopChips = (shopIds: string[]) => {
    const names = (shopIds || [])
      .map((id) => allShops.find((s) => s.id === id)?.name)
      .filter((n): n is string => Boolean(n));
    const visible = names.slice(0, 2);
    const overflow = Math.max(0, names.length - visible.length);
    return { visible, overflow };
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

  const getCardBadgeLabel = (kind: CardBadgeKind) => {
    switch (kind) {
      case "shop":
        return t("segmentation.cardBadge.shop", "SHOP-BASED");
      case "tag":
        return t("segmentation.cardBadge.tag", "TAG-BASED");
      case "custom":
        return t("segmentation.cardBadge.custom", "CUSTOM");
      default:
        return t("segmentation.cardBadge.all", "ALL CUSTOMERS");
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
            <Target className="h-4 w-4 text-gray-400 dark:text-gray-500" />
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
            <Users className="h-4 w-4 text-gray-400 dark:text-gray-500" />
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
            <BarChart3 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
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
                {selectedShopId
                  ? t("segmentation.list.shopTitle", { name: allShops.find((s) => s.id === selectedShopId)?.name ?? "" }) || t("segmentation.list.title")
                  : t("segmentation.list.allShopsTitle")}
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
              {filteredLists.map((list) => {
                const badgeKind = getCardBadgeKind(list);
                const shopChips = getShopChips(list.selectedShopIds || []);
                const updatedAt = list.updatedAt || list.createdAt;
                return (
                  <div
                    key={list.id}
                    className="group relative flex flex-col rounded-xl border border-gray-200 dark:border-neutral-800 bg-background hover:shadow-md hover:border-gray-300 dark:hover:border-neutral-700 transition-all duration-200"
                  >
                    <div className="p-5 flex flex-col flex-1">
                      {/* Pill badge */}
                      <div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase ${getCardBadgeClasses(
                            badgeKind
                          )}`}
                        >
                          {getCardBadgeIcon(badgeKind)}
                          {getCardBadgeLabel(badgeKind)}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="mt-3 text-lg font-semibold text-foreground tracking-tight line-clamp-1">
                        {list.name}
                      </h3>

                      {/* Description */}
                      <p
                        className={`mt-2 text-sm leading-relaxed line-clamp-2 min-h-[2.5rem] ${
                          list.description
                            ? "text-muted-foreground"
                            : "text-muted-foreground/60 italic"
                        }`}
                      >
                        {list.description || t("segmentation.list.noDescription")}
                      </p>

                      {/* Sub-info row: shop names / tag count / rule count */}
                      <div className="mt-3 flex items-center gap-1.5 text-sm text-foreground/80 min-h-[1.75rem]">
                        {badgeKind === "shop" && shopChips.visible.length > 0 ? (
                          <>
                            <span className="truncate">{shopChips.visible.join(", ")}</span>
                            {shopChips.overflow > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-xs text-foreground/70">
                                +{shopChips.overflow}
                              </span>
                            )}
                          </>
                        ) : badgeKind === "tag" && list.selectedTagIds?.length > 0 ? (
                          <span className="text-muted-foreground">
                            {list.selectedTagIds.length}{" "}
                            {t("segmentation.list.tags", "tags")}
                          </span>
                        ) : badgeKind === "custom" && list.selectedContactIds?.length > 0 ? (
                          <span className="text-muted-foreground">
                            {list.selectedContactIds.length}{" "}
                            {t("segmentation.list.rules", "rules")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {t("segmentation.filters.allCustomers")}
                          </span>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="my-4 border-t border-gray-200 dark:border-neutral-800" />

                      {/* Stats row */}
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-2xl font-bold text-foreground tabular-nums leading-none">
                            {list.contactCount.toLocaleString()}
                          </div>
                          <div className="mt-1.5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                            {t("segmentation.list.contacts")}
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-5 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {t("segmentation.list.updated", "Updated")}{" "}
                          {new Date(updatedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(list)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            aria-label={t("segmentation.actions.edit")}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDuplicate(list)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            aria-label={t("segmentation.actions.duplicate")}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(list)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/50"
                            aria-label={t("segmentation.actions.delete", "Delete")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                {formData.selectedShopIds.length > 0
                  ? t("segmentation.segmentationModal.shopsSelected", { count: formData.selectedShopIds.length })
                  : formData.type === "all"
                    ? t("segmentation.filters.allCustomers")
                    : formData.type === "selected"
                      ? t("segmentation.createModal.selectedCustomers", { count: formData.selectedContactIds.length })
                      : t("segmentation.createModal.selectedTags", { count: formData.selectedTagIds.length })}
              </Button>

              {/* Visual summary of selection */}
              {(formData.type !== "all" || formData.selectedShopIds.length > 0) && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border text-xs text-muted-foreground">
                  {formData.selectedShopIds.length > 0 ? <Store className="h-4 w-4" /> : getTypeIcon(formData.type)}
                  <span className="font-medium">
                    {formData.selectedShopIds.length > 0
                      ? `${formData.selectedShopIds.length} ${t("segmentation.list.shops", "stores")}`
                      : formData.type === "selected"
                        ? `${formData.selectedContactIds.length} ${t("segmentation.list.contacts")}`
                        : `${formData.selectedTagIds.length} ${t("segmentation.list.tags")}`}
                  </span>
                  <Badge variant="secondary" className={`ml-auto text-[10px] ${formData.selectedShopIds.length > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : getTypeBadgeClasses(formData.type)}`}>
                    {formData.selectedShopIds.length > 0 ? t("segmentation.segmentationModal.tabs.shops", "Shops") : getTypeLabel(formData.type)}
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
                {formData.selectedShopIds.length > 0
                  ? t("segmentation.segmentationModal.shopsSelected", { count: formData.selectedShopIds.length })
                  : formData.type === "all"
                    ? t("segmentation.filters.allCustomers")
                    : formData.type === "selected"
                      ? t("segmentation.createModal.selectedCustomers", { count: formData.selectedContactIds.length })
                      : t("segmentation.createModal.selectedTags", { count: formData.selectedTagIds.length })}
              </Button>

              {/* Visual summary of selection */}
              {(formData.type !== "all" || formData.selectedShopIds.length > 0) && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border text-xs text-muted-foreground">
                  {formData.selectedShopIds.length > 0 ? <Store className="h-4 w-4" /> : getTypeIcon(formData.type)}
                  <span className="font-medium">
                    {formData.selectedShopIds.length > 0
                      ? `${formData.selectedShopIds.length} ${t("segmentation.list.shops", "stores")}`
                      : formData.type === "selected"
                        ? `${formData.selectedContactIds.length} ${t("segmentation.list.contacts")}`
                        : `${formData.selectedTagIds.length} ${t("segmentation.list.tags")}`}
                  </span>
                  <Badge variant="secondary" className={`ml-auto text-[10px] ${formData.selectedShopIds.length > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : getTypeBadgeClasses(formData.type)}`}>
                    {formData.selectedShopIds.length > 0 ? t("segmentation.segmentationModal.tabs.shops", "Shops") : getTypeLabel(formData.type)}
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

      {/* Customer Segmentation Modal */}
      <CustomerSegmentationModal
        isOpen={isSegmentationModalOpen}
        onClose={() => setIsSegmentationModalOpen(false)}
        recipientType={formData.type}
        selectedContactIds={formData.selectedContactIds}
        selectedTagIds={formData.selectedTagIds}
        selectedShopIds={formData.selectedShopIds}
        allShops={allShops}
        onSave={handleSegmentationSave}
      />
    </div>
  );
}
