import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Plus,
  Mail,
  Calendar,
  Eye,
  Clock,
  Users,
  MousePointer,
  Search,
  LayoutDashboard,
  Trash2,
  Send,
  FileText,
  MoreVertical,
  Pencil,
  Loader2,
  UserCog,
  ShieldCheck,
  ClipboardCheck,
  CalendarClock,
  Tv2,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Undo2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { useState, useMemo, useCallback, useRef } from "react";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useRealtimeNewsletters } from "@/hooks/useRealtimeNewsletters";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { SendNewsletterWizardModal } from "@/components/SendNewsletterWizardModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAppSelector } from "@/store";
import { wrapInEmailPreview } from "@/utils/email-preview-wrapper";
import { EditorPickerModal } from "@/components/EditorPickerModal";
import { format, formatDistanceToNow } from "date-fns";
import { es as esLocale } from "date-fns/locale/es";
import type { NewsletterWithUser } from "@shared/schema";

type AdvertiseItem = NewsletterWithUser & {
  opens?: number;
  totalOpens?: number;
  publishedAt?: string | null;
  webSlug?: string | null;
};

const getStatusBadge = (status: string, t: any) => {
  switch (status) {
    case "draft":
      return <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"><FileText className="h-3 w-3 mr-1" />{t("advertise.status.draft")}</Badge>;
    case "ready_to_send":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"><Send className="h-3 w-3 mr-1" />{t("advertise.status.readyToSend")}</Badge>;
    case "pending_review":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"><ShieldCheck className="h-3 w-3 mr-1" />{t("advertise.status.pendingReview")}</Badge>;
    case "scheduled":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"><Clock className="h-3 w-3 mr-1" />{t("advertise.status.scheduled")}</Badge>;
    case "sending":
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"><Send className="h-3 w-3 mr-1 animate-pulse" />{t("advertise.status.sending")}</Badge>;
    case "sent":
      return <Badge variant="default" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"><Send className="h-3 w-3 mr-1" />{t("advertise.status.sent")}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export default function AdvertisePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<AdvertiseItem | null>(null);
  const [editRecipientsItem, setEditRecipientsItem] = useState<AdvertiseItem | null>(null);
  const [showEditorPicker, setShowEditorPicker] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t, currentLanguage } = useLanguage();
  const queryClient = useQueryClient();
  const { user } = useReduxAuth();
  const currentUserId = (user as any)?.id;
  const tenantId = (user as any)?.tenantId as string | undefined;
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);
  const dateFnsLocale = currentLanguage === "es" ? { locale: esLocale } : {};

  useSetBreadcrumbs([
    { label: t("advertise.breadcrumbDashboard", "Dashboard"), href: "/", icon: LayoutDashboard },
    { label: t("advertise.breadcrumbAdvertise", "Advertise"), icon: Tv2 },
  ]);

  const { data: itemsData, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/newsletters", { emailType: "advertise", shopId: selectedShopId }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/newsletters?emailType=advertise");
      const data = await response.json();
      return data.newsletters || [];
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const handleRefresh = useCallback(() => {
    if (refreshCooldown || isLoading) return;
    refetch();
    setLastRefreshed(new Date());
    setRefreshCooldown(true);
    cooldownTimer.current = setTimeout(() => setRefreshCooldown(false), 5000);
  }, [refreshCooldown, isLoading, refetch]);

  const { data: reviewerSettings } = useQuery<{ enabled: boolean; reviewerId: string | null; reviewer: any }>({
    queryKey: ["/api/newsletters/reviewer-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/newsletters/reviewer-settings");
      return response.json();
    },
  });

  const reviewerEnabled = reviewerSettings?.enabled ?? false;
  const isCurrentUserDesignatedReviewer = reviewerSettings?.reviewerId === currentUserId;

  const { data: emailDesign } = useQuery<{
    companyName?: string;
    headerMode?: string;
    logoUrl?: string;
    logoSize?: string;
    logoAlignment?: string;
    bannerUrl?: string;
    showCompanyName?: string;
    primaryColor?: string;
    fontFamily?: string;
    headerText?: string;
    footerText?: string;
    socialLinks?: { facebook?: string; twitter?: string; instagram?: string; linkedin?: string } | string;
  }>({
    queryKey: ["/api/master-email-design"],
    queryFn: async () => {
      const response = await fetch("/api/master-email-design", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch email design");
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/newsletters/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData<AdvertiseItem[]>(
        ["/api/newsletters", { emailType: "advertise" }],
        (old) => old ? old.filter((n) => n.id !== id) : []
      );
      queryClient.setQueryData<AdvertiseItem[]>(
        ["/api/newsletters", { emailType: "advertise", archived: true }],
        (old) => old ? old.filter((n) => n.id !== id) : []
      );
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: t("advertise.toast.deleted"), description: t("advertise.toast.deletedDesc") });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({ title: t("advertise.toast.error"), description: error.message || t("advertise.toast.deleteError"), variant: "destructive" });
    },
  });

  const deployMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/newsletters/${id}/send`);
      return response.json();
    },
    onSuccess: (data: any, id: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: t("advertise.toast.deployed"), description: data.message || t("advertise.toast.deployedDesc") });
      setLocation(`/newsletters/${data.newsletterId || data.id || id}`);
    },
    onError: (error: any) => {
      toast({ title: t("advertise.toast.deployFailed"), description: error.message || t("advertise.toast.deployFailedDesc"), variant: "destructive" });
    },
  });

  const cancelScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/newsletters/${id}/cancel-schedule`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: t("advertise.toast.scheduleCancelled"), description: t("advertise.toast.scheduleCancelledDesc") });
    },
    onError: (error: any) => {
      toast({ title: t("advertise.toast.cancelFailed"), description: error.message || t("advertise.toast.cancelFailedDesc"), variant: "destructive" });
    },
  });

  const submitForReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/newsletters/${id}/submit-for-review`);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: t("advertise.toast.submittedForReview"), description: data.message || t("advertise.toast.submittedForReviewDesc") });
    },
    onError: (error: any) => {
      toast({ title: t("advertise.toast.submissionFailed"), description: error.message || t("advertise.toast.submissionFailedDesc"), variant: "destructive" });
    },
  });

  const recallToDraftMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/newsletters/${id}/recall-review`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: t("advertise.toast.recalledToDraft"), description: t("advertise.toast.recalledToDraftDesc") });
    },
    onError: (error: any) => {
      toast({ title: t("advertise.toast.recallFailed"), description: error.message || t("advertise.toast.recallFailedDesc"), variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/newsletters/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: t("advertise.toast.archived"), description: t("advertise.toast.archivedDesc") });
    },
    onError: (error: any) => {
      toast({ title: t("advertise.toast.error"), description: error.message || t("advertise.toast.archiveError"), variant: "destructive" });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/newsletters/${id}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: t("advertise.toast.unarchived"), description: t("advertise.toast.unarchivedDesc") });
    },
    onError: (error: any) => {
      toast({ title: t("advertise.toast.error"), description: error.message || t("advertise.toast.unarchiveError"), variant: "destructive" });
    },
  });

  // Fetch archived items (always enabled so the toggle button appears when archived items exist)
  const { data: archivedItemsData } = useQuery({
    queryKey: ["/api/newsletters", { emailType: "advertise", archived: true, shopId: selectedShopId }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/newsletters?emailType=advertise&archived=true");
      const data = await response.json();
      return data.newsletters || [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { newsletters: realtimeArchivedItems } = useRealtimeNewsletters(archivedItemsData, tenantId, selectedShopId, true, "advertise");
  const archivedItems: AdvertiseItem[] = realtimeArchivedItems || [];

  const handleEditRecipientsSegmentSelected = async (segmentData: {
    segmentListId: string | null;
    recipientType: "all" | "selected" | "tags";
    selectedContactIds: string[];
    selectedTagIds: string[];
  }) => {
    if (!editRecipientsItem) return;
    try {
      await apiRequest("PUT", `/api/newsletters/${editRecipientsItem.id}`, {
        recipientType: segmentData.recipientType,
        selectedContactIds: segmentData.selectedContactIds,
        selectedTagIds: segmentData.selectedTagIds,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: t("advertise.toast.recipientsUpdated"), description: t("advertise.toast.recipientsUpdatedDesc") });
      setEditRecipientsItem(null);
    } catch (error: any) {
      toast({ title: t("advertise.toast.error"), description: error.message || t("advertise.toast.recipientsError"), variant: "destructive" });
    }
  };

  const { newsletters: realtimeItems } = useRealtimeNewsletters(itemsData, tenantId, selectedShopId, false, "advertise");
  const items: AdvertiseItem[] = realtimeItems || [];

  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      searchQuery === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subject.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  const kanbanColumns = useMemo(() => {
    const drafts = filteredItems.filter((n) => n.status === "draft");
    const readyToSend = filteredItems.filter((n) => ["ready_to_send", "pending_review"].includes(n.status));
    const scheduled = filteredItems.filter((n) => ["scheduled", "sending"].includes(n.status));
    const sent = filteredItems.filter((n) => n.status === "sent");
    return [
      { key: "drafts", title: t("advertise.kanban.drafts", "Drafts"), icon: FileText, color: "amber", borderColor: "border-amber-300 dark:border-amber-700", bgHeader: "bg-amber-50 dark:bg-amber-950/40", textColor: "text-amber-700 dark:text-amber-300", badgeBg: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300", accentBar: "bg-amber-400", items: drafts },
      { key: "ready_to_send", title: t("advertise.kanban.readyToSend", "Ready to Send"), icon: Send, color: "blue", borderColor: "border-blue-300 dark:border-blue-700", bgHeader: "bg-blue-50 dark:bg-blue-950/40", textColor: "text-blue-700 dark:text-blue-300", badgeBg: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300", accentBar: "bg-blue-400", items: readyToSend },
      { key: "scheduled", title: t("advertise.kanban.scheduled", "Scheduled"), icon: Clock, color: "purple", borderColor: "border-purple-300 dark:border-purple-700", bgHeader: "bg-purple-50 dark:bg-purple-950/40", textColor: "text-purple-700 dark:text-purple-300", badgeBg: "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300", accentBar: "bg-purple-400", items: scheduled },
      { key: "sent", title: t("advertise.kanban.sent", "Sent"), icon: Mail, color: "green", borderColor: "border-green-300 dark:border-green-700", bgHeader: "bg-green-50 dark:bg-green-950/40", textColor: "text-green-700 dark:text-green-300", badgeBg: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300", accentBar: "bg-green-400", items: sent },
    ];
  }, [filteredItems, t]);

  const parsedSocialLinks = useMemo(() => {
    const raw = emailDesign?.socialLinks;
    if (!raw) return undefined;
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch { return undefined; }
    }
    return raw;
  }, [emailDesign]);

  const wrappedPreviewHtml = useMemo(() => {
    if (!previewItem) return "";
    return wrapInEmailPreview(previewItem.content || "", {
      companyName: emailDesign?.companyName || "",
      headerMode: emailDesign?.headerMode,
      primaryColor: emailDesign?.primaryColor,
      logoUrl: emailDesign?.logoUrl,
      logoSize: emailDesign?.logoSize,
      logoAlignment: emailDesign?.logoAlignment,
      bannerUrl: emailDesign?.bannerUrl,
      showCompanyName: emailDesign?.showCompanyName,
      headerText: emailDesign?.headerText,
      footerText: emailDesign?.footerText,
      fontFamily: emailDesign?.fontFamily,
      socialLinks: parsedSocialLinks,
    });
  }, [previewItem, emailDesign, parsedSocialLinks]);

  if (error) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-red-600">{t("advertise.error.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              {error instanceof Error ? error.message : t("advertise.error.loadFailed")}
            </p>
            <Button onClick={() => refetch()}>{t("advertise.error.tryAgain")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-72" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-4 lg:p-6 space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
              {t("advertise.title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t("advertise.subtitle")}
            </p>
          </div>
          <Button onClick={() => setShowEditorPicker(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            {t("advertise.createNew")}
          </Button>
        </div>

        {/* Search and Refresh */}
        {items.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="relative w-[24rem]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t("advertise.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              />
            </div>
            <div className="flex items-center gap-3">
              {lastRefreshed && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {t("advertise.lastUpdated")} {format(lastRefreshed, currentLanguage === "es" ? "h:mm:ss a" : "h:mm:ss a", { locale: currentLanguage === "es" ? esLocale : undefined })}
                </span>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isLoading || refreshCooldown}
                title={t("advertise.refresh")}
                className="rounded-xl h-[42px] w-[42px] border-gray-200 dark:border-gray-700"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        )}

        {/* Kanban Board */}
        {items.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Tv2 className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t("advertise.noItemsYet")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
              {t("advertise.noItemsDesc")}
            </p>
            <Button onClick={() => setShowEditorPicker(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              {t("advertise.createFirst")}
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t("advertise.noResultsFound")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t("advertise.noResultsDesc")}
            </p>
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              {t("advertise.clearSearch")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {kanbanColumns.map((column) => (
              <div
                key={column.key}
                className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 overflow-hidden"
              >
                {/* Column Header */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${column.accentBar}`} />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {column.title}
                      </h3>
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                        {column.items.length}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Column Body */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-380px)] min-h-[200px]">
                  {column.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <column.icon className="h-5 w-5 text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                        {t("advertise.kanban.empty")}
                      </p>
                    </div>
                  ) : (
                    column.items.map((item) => {
                      const openRate = (item.recipientCount || 0) > 0
                        ? (((item.opens || 0) / (item.recipientCount || 1)) * 100).toFixed(1)
                        : "0";
                      const isDraft = item.status === "draft";
                      const isSent = item.status === "sent";
                      const isReadyToSend = item.status === "ready_to_send";
                      const isPendingReview = item.status === "pending_review";
                      const isScheduled = item.status === "scheduled";
                      const isCurrentUserReviewer = item.reviewerId === currentUserId;
                      const isDeleting = deleteMutation.isPending && deleteMutation.variables === item.id;
                      const isDeploying = deployMutation.isPending && deployMutation.variables === item.id;
                      const isSubmittingForReview = submitForReviewMutation.isPending && submitForReviewMutation.variables === item.id;
                      const isCancellingSchedule = cancelScheduleMutation.isPending && cancelScheduleMutation.variables === item.id;

                      if (isDeleting) {
                        return (
                          <Card key={item.id} className="flex flex-col items-center justify-center border-dashed border-2 border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 animate-pulse py-8">
                            <Loader2 className="h-6 w-6 text-blue-500 animate-spin mb-3" />
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t("advertise.card.deleting")}</p>
                          </Card>
                        );
                      }

                      return (
                        <Card
                          key={item.id}
                          className={`group relative rounded-xl hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer bg-white dark:bg-gray-800 border-t-[3px] ${
                            item.status === "sent" ? "border-t-green-500" :
                            item.status === "ready_to_send" ? "border-t-blue-500" :
                            item.status === "pending_review" ? "border-t-blue-500" :
                            item.status === "scheduled" || item.status === "sending" ? "border-t-purple-500" :
                            "border-t-amber-400"
                          } border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600`}
                          onClick={() =>
                            isDraft || isReadyToSend
                              ? setLocation(`/advertise/create/${item.id}`)
                              : setLocation(`/newsletters/${item.id}`)
                          }
                        >
                          <CardContent className="p-5">
                            <div className="space-y-4">
                              {/* Row 1: Status badge + kebab menu */}
                              <div className="flex items-center justify-between">
                                {getStatusBadge(item.status, t)}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" aria-label="Actions" className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      {t("advertise.actions.preview")}
                                    </DropdownMenuItem>
                                    {(isDraft || isReadyToSend) && item.reviewStatus !== "approved" && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/advertise/create/${item.id}`); }}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        {t("advertise.actions.edit")}
                                      </DropdownMenuItem>
                                    )}
                                    {(isDraft || isReadyToSend) && item.reviewStatus !== "approved" && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditRecipientsItem(item); }}>
                                        <UserCog className="h-4 w-4 mr-2" />
                                        {t("advertise.actions.editRecipients")}
                                      </DropdownMenuItem>
                                    )}
                                    {isReadyToSend && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deployMutation.mutate(item.id); }} disabled={isDeploying}>
                                        <Send className="h-4 w-4 mr-2" />
                                        {isDeploying ? t("advertise.actions.sending") : t("advertise.actions.sendNow")}
                                      </DropdownMenuItem>
                                    )}
                                    {isScheduled && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); cancelScheduleMutation.mutate(item.id); }} disabled={isCancellingSchedule} className="text-blue-600 focus:text-blue-600 focus:bg-blue-50 dark:focus:bg-blue-950/50">
                                        <CalendarClock className="h-4 w-4 mr-2" />
                                        {isCancellingSchedule ? t("advertise.actions.cancelling") : t("advertise.actions.cancelSchedule")}
                                      </DropdownMenuItem>
                                    )}
                                    {reviewerEnabled && isReadyToSend && !isPendingReview && !isCurrentUserDesignatedReviewer && item.reviewStatus !== "approved" && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); submitForReviewMutation.mutate(item.id); }} disabled={isSubmittingForReview}>
                                        <ClipboardCheck className="h-4 w-4 mr-2" />
                                        {isSubmittingForReview ? t("advertise.actions.submitting") : t("advertise.actions.submitForReview")}
                                      </DropdownMenuItem>
                                    )}
                                    {isPendingReview && isCurrentUserReviewer && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/newsletters/${item.id}`); }}>
                                        <ShieldCheck className="h-4 w-4 mr-2" />
                                        {t("advertise.actions.review")}
                                      </DropdownMenuItem>
                                    )}
                                    {isPendingReview && !isCurrentUserReviewer && (item.userId === currentUserId || ['Owner', 'Administrator'].includes((user as any)?.role)) && (
                                      <DropdownMenuItem
                                        onClick={(e) => { e.stopPropagation(); recallToDraftMutation.mutate(item.id); }}
                                        disabled={recallToDraftMutation.isPending && recallToDraftMutation.variables === item.id}
                                        className="text-blue-600 focus:text-blue-600 focus:bg-blue-50 dark:focus:bg-blue-950/50"
                                      >
                                        <Undo2 className="h-4 w-4 mr-2" />
                                        {recallToDraftMutation.isPending && recallToDraftMutation.variables === item.id
                                          ? t("advertise.actions.recalling")
                                          : t("advertise.actions.recallToDraft")}
                                      </DropdownMenuItem>
                                    )}
                                    {isSent && (
                                      <DropdownMenuItem
                                        onClick={(e) => { e.stopPropagation(); archiveMutation.mutate(item.id); }}
                                        disabled={archiveMutation.isPending && archiveMutation.variables === item.id}
                                      >
                                        <Archive className="h-4 w-4 mr-2" />
                                        {archiveMutation.isPending && archiveMutation.variables === item.id
                                          ? t("advertise.actions.archiving")
                                          : t("advertise.actions.archive")}
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50" onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}>
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      {t("advertise.actions.delete")}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {/* Row 2: Title + Subject */}
                              <div>
                                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                  {item.title}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{item.subject}</p>
                              </div>

                              {/* Rejection notice */}
                              {item.reviewStatus === "rejected" && item.reviewNotes && (
                                <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 px-3 py-2">
                                  <XCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-semibold text-red-700 dark:text-red-300">{t("advertise.card.rejectedByReviewer")}</p>
                                    <p className="text-[11px] text-red-600/80 dark:text-red-400/70 line-clamp-2 mt-0.5">{item.reviewNotes}</p>
                                  </div>
                                </div>
                              )}

                              {/* Row 4: Author + Date */}
                              <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm">
                                    {(item.user?.firstName?.[0] || "")}{(item.user?.lastName?.[0] || "")}
                                  </div>
                                  <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                      {item.user?.firstName || ""} {item.user?.lastName || ""}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                      {item.sentAt
                                        ? formatDistanceToNow(new Date(item.sentAt), { addSuffix: true, ...dateFnsLocale })
                                        : item.createdAt
                                          ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, ...dateFnsLocale })
                                          : ""}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Row 5: Metrics or date */}
                              {isSent ? (
                                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                  <div className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Users className="h-3 w-3 text-blue-500" />
                                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{(item.recipientCount || 0).toLocaleString()}</span>
                                    </div>
                                    <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">{t("advertise.metrics.sent")}</p>
                                  </div>
                                  <div className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Eye className="h-3 w-3 text-green-500" />
                                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{item.opens || 0}</span>
                                    </div>
                                    <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">{t("advertise.metrics.opened", { rate: openRate })}</p>
                                  </div>
                                  <div className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <MousePointer className="h-3 w-3 text-purple-500" />
                                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{item.clickCount || 0}</span>
                                    </div>
                                    <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">{t("advertise.metrics.clicks")}</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                                    {item.status === "scheduled" && item.scheduledAt ? (
                                      <span className="truncate">{t("advertise.card.scheduledFor", { date: format(new Date(item.scheduledAt), "MMM d, yyyy h:mm a") })}</span>
                                    ) : (
                                      <span className="truncate">
                                        {item.updatedAt
                                          ? t("advertise.card.lastEdited", { time: formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true, ...dateFnsLocale }) })
                                          : t("advertise.card.lastEditedRecently")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Archived Section */}
        {(items.length > 0 || showArchived || archivedItems.length > 0) && (
          <div className="mt-8">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors group"
            >
              {showArchived ? (
                <ChevronDown className="h-4 w-4 transition-transform" />
              ) : (
                <ChevronRight className="h-4 w-4 transition-transform" />
              )}
              <Archive className="h-4 w-4" />
              <span>{showArchived ? t("advertise.archived.hideArchived") : t("advertise.archived.showArchived")}</span>
              {showArchived && archivedItems.length > 0 && (
                <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                  {archivedItems.length}
                </span>
              )}
            </button>

            {showArchived && (
              <div className="mt-4">
                {archivedItems.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
                    <Archive className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      {t("advertise.archived.empty")}
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
                      {t("advertise.archived.emptyDesc")}
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                    <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <Archive className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {t("advertise.archived.title")}
                        </h3>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          — {t("advertise.archived.subtitle")}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-700/50">
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("advertise.archived.name")}</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("advertise.archived.subject")}</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("advertise.archived.sentDate")}</th>
                            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("advertise.archived.recipients")}</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("advertise.archived.archivedDate")}</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("advertise.archived.actions")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {archivedItems.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                              onClick={() => setLocation(`/newsletters/${item.id}`)}
                            >
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                    {(item.user?.firstName?.[0] || "")}{(item.user?.lastName?.[0] || "")}
                                  </div>
                                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                                    {item.title}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                                {item.subject}
                              </td>
                              <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {item.sentAt
                                  ? format(new Date(item.sentAt), "MMM d, yyyy", { locale: currentLanguage === "es" ? esLocale : undefined })
                                  : "—"}
                              </td>
                              <td className="px-5 py-3 text-center">
                                <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                  <Users className="h-3 w-3" />
                                  {(item.recipientCount || 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {(item as any).archivedAt
                                  ? formatDistanceToNow(new Date((item as any).archivedAt), { addSuffix: true, ...dateFnsLocale })
                                  : "—"}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                                    onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400"
                                    disabled={unarchiveMutation.isPending && unarchiveMutation.variables === item.id}
                                    onClick={(e) => { e.stopPropagation(); unarchiveMutation.mutate(item.id); }}
                                  >
                                    <ArchiveRestore className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("advertise.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("advertise.deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("advertise.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
            >
              {t("advertise.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SendNewsletterWizardModal
        isOpen={!!editRecipientsItem}
        onClose={() => setEditRecipientsItem(null)}
        newsletterId={editRecipientsItem?.id || null}
        newsletterTitle={editRecipientsItem?.title || ""}
        newsletterReviewStatus={(editRecipientsItem as any)?.reviewStatus}
        onSegmentSelected={handleEditRecipientsSegmentSelected}
        initialRecipientType={editRecipientsItem?.recipientType as "all" | "selected" | "tags" | undefined}
        initialSelectedContactIds={editRecipientsItem?.selectedContactIds || []}
        initialSelectedTagIds={editRecipientsItem?.selectedTagIds || []}
        itemLabel="Advertisement"
        returnPath="/advertise"
      />

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {t("advertise.previewDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("advertise.previewDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto p-4 sm:p-6 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl">
              <div className="bg-white text-slate-900 shadow-2xl mx-auto rounded overflow-hidden max-w-[600px] w-full">
                <div className="border-b bg-gray-50 p-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex gap-2 mb-1">
                    <span className="font-semibold text-right w-16">{t("advertise.previewDialog.subject")}</span>
                    <span className="text-gray-900 font-semibold truncate">
                      {previewItem?.subject || previewItem?.title || t("advertise.previewDialog.noSubject")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-right w-16">{t("advertise.previewDialog.status")}</span>
                    <span className="text-gray-900 capitalize">{(() => {
                      const s = previewItem?.status || "draft";
                      const keyMap: Record<string, string> = {
                        ready_to_send: "readyToSend",
                        pending_review: "pendingReview",
                      };
                      const i18nKey = `advertise.status.${keyMap[s] ?? s}`;
                      return t(i18nKey, s);
                    })()}</span>
                  </div>
                </div>
                <iframe
                  srcDoc={wrappedPreviewHtml}
                  title="Email preview"
                  sandbox="allow-same-origin"
                  className="w-full border-0"
                  style={{ minHeight: "640px", background: "#fff" }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditorPickerModal
        open={showEditorPicker}
        onOpenChange={setShowEditorPicker}
        createBasePath="/advertise/create"
      />
    </>
  );
}
