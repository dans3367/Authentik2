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
  Store,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Undo2,
  XCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useRealtimeNewsletters } from "@/hooks/useRealtimeNewsletters";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { SendNewsletterWizardModal } from "@/components/SendNewsletterWizardModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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

const STATUS_STYLES: Record<string, { bg: string; text: string; accent: string; icon: typeof FileText; i18nKey: string; animateIcon?: boolean }> = {
  draft:          { bg: 'bg-amber-500/10',   text: 'text-amber-700 dark:text-amber-400',   accent: 'bg-amber-500',   icon: FileText,    i18nKey: 'draft' },
  ready_to_send:  { bg: 'bg-blue-500/10',    text: 'text-blue-700 dark:text-blue-400',     accent: 'bg-blue-500',    icon: Send,        i18nKey: 'readyToSend' },
  pending_review: { bg: 'bg-orange-500/10',  text: 'text-orange-700 dark:text-orange-400', accent: 'bg-orange-500',  icon: ShieldCheck, i18nKey: 'pendingReview' },
  scheduled:      { bg: 'bg-violet-500/10',  text: 'text-violet-700 dark:text-violet-400', accent: 'bg-violet-500',  icon: Clock,       i18nKey: 'scheduled' },
  sending:        { bg: 'bg-violet-500/10',  text: 'text-violet-700 dark:text-violet-400', accent: 'bg-violet-500',  icon: Send,        i18nKey: 'sending', animateIcon: true },
  sent:           { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', accent: 'bg-emerald-500', icon: Send,      i18nKey: 'sent' },
};

const BADGE_BASE = "gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border-0";

const getStatusBadge = (status: string, t: any) => {
  const style = STATUS_STYLES[status];
  if (!style) return <Badge variant="secondary" className={BADGE_BASE}>{status}</Badge>;
  const Icon = style.icon;
  return (
    <Badge variant="secondary" className={`${BADGE_BASE} ${style.bg} ${style.text}`}>
      <Icon className={`h-3 w-3${style.animateIcon ? ' animate-pulse' : ''}`} />
      {t(`advertise.status.${style.i18nKey}`)}
    </Badge>
  );
};

const getStatusAccent = (status: string) =>
  STATUS_STYLES[status]?.accent ?? 'bg-muted-foreground';

export default function AdvertisePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<AdvertiseItem | null>(null);
  const [editRecipientsItem, setEditRecipientsItem] = useState<AdvertiseItem | null>(null);
  const [showEditorPicker, setShowEditorPicker] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
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
    staleTime: 5000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 2,
  });

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

  const { data: archivedItemsData } = useQuery({
    queryKey: ["/api/newsletters", { emailType: "advertise", archived: true, shopId: selectedShopId }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/newsletters?emailType=advertise&archived=true");
      const data = await response.json();
      return data.newsletters || [];
    },
    staleTime: 5000,
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
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) =>
      item.title.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const kanbanColumns = useMemo(() => {
    const groups: Record<string, AdvertiseItem[]> = { drafts: [], ready: [], scheduled: [], sent: [] };
    for (const n of filteredItems) {
      if (n.status === "draft") groups.drafts.push(n);
      else if (n.status === "ready_to_send" || n.status === "pending_review") groups.ready.push(n);
      else if (n.status === "scheduled" || n.status === "sending") groups.scheduled.push(n);
      else if (n.status === "sent") groups.sent.push(n);
    }
    return [
      { key: 'drafts', title: t("advertise.kanban.drafts", "Drafts"), icon: FileText, dot: STATUS_STYLES.draft.accent, items: groups.drafts },
      { key: 'ready_to_send', title: t("advertise.kanban.readyToSend", "Ready to Send"), icon: Send, dot: STATUS_STYLES.ready_to_send.accent, items: groups.ready },
      { key: 'scheduled', title: t("advertise.kanban.scheduled", "Scheduled"), icon: Clock, dot: STATUS_STYLES.scheduled.accent, items: groups.scheduled },
      { key: 'sent', title: t("advertise.kanban.sent", "Sent"), icon: Mail, dot: STATUS_STYLES.sent.accent, items: groups.sent },
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
      <div className="container mx-auto p-4 lg:p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
            <XCircle className="h-7 w-7 text-red-500/60" />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-1">{t("advertise.error.title")}</h3>
            <p className="text-sm text-muted-foreground/60 max-w-sm">
              {error instanceof Error ? error.message : t("advertise.error.loadFailed")}
            </p>
          </div>
          <Button onClick={() => refetch()} className="rounded-xl">{t("advertise.error.tryAgain")}</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-full max-w-md rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const renderItemCard = (item: AdvertiseItem) => {
    const openRate = (item.recipientCount || 0) > 0
      ? ((item.opens || 0) / (item.recipientCount || 1) * 100).toFixed(1)
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
        <div key={item.id} className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/40 bg-muted/20 animate-pulse py-10">
          <Loader2 className="h-5 w-5 text-primary animate-spin mb-2" />
          <p className="text-[11px] text-muted-foreground/50 font-medium">{t("advertise.card.deleting")}</p>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card hover:shadow-lg hover:shadow-black/[0.03] dark:hover:shadow-black/20 hover:border-border/80 transition-all duration-300 cursor-pointer"
        onClick={() => (isDraft || isReadyToSend)
          ? setLocation(`/advertise/create/${item.id}`)
          : setLocation(`/newsletters/${item.id}`)
        }
      >
        <div className={`absolute top-0 left-0 right-0 h-0.5 ${getStatusAccent(item.status)}`} />

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            {getStatusBadge(item.status, t)}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }} className="gap-2.5 rounded-lg cursor-pointer">
                  <Eye className="h-3.5 w-3.5" /><span className="text-sm">{t("advertise.actions.preview")}</span>
                </DropdownMenuItem>
                {(isDraft || isReadyToSend) && item.reviewStatus !== "approved" && (
                  <>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/advertise/create/${item.id}`); }} className="gap-2.5 rounded-lg cursor-pointer">
                      <Pencil className="h-3.5 w-3.5" /><span className="text-sm">{t("advertise.actions.edit")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditRecipientsItem(item); }} className="gap-2.5 rounded-lg cursor-pointer">
                      <UserCog className="h-3.5 w-3.5" /><span className="text-sm">{t("advertise.actions.editRecipients")}</span>
                    </DropdownMenuItem>
                  </>
                )}
                {isReadyToSend && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deployMutation.mutate(item.id); }} disabled={isDeploying} className="gap-2.5 rounded-lg cursor-pointer">
                    <Send className="h-3.5 w-3.5" /><span className="text-sm">{isDeploying ? t("advertise.actions.sending") : t("advertise.actions.sendNow")}</span>
                  </DropdownMenuItem>
                )}
                {isScheduled && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); cancelScheduleMutation.mutate(item.id); }} disabled={isCancellingSchedule} className="gap-2.5 rounded-lg cursor-pointer text-orange-600 focus:text-orange-600">
                    <CalendarClock className="h-3.5 w-3.5" /><span className="text-sm">{isCancellingSchedule ? t("advertise.actions.cancelling") : t("advertise.actions.cancelSchedule")}</span>
                  </DropdownMenuItem>
                )}
                {reviewerEnabled && isReadyToSend && !isPendingReview && !isCurrentUserDesignatedReviewer && item.reviewStatus !== "approved" && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); submitForReviewMutation.mutate(item.id); }} disabled={isSubmittingForReview} className="gap-2.5 rounded-lg cursor-pointer">
                    <ClipboardCheck className="h-3.5 w-3.5" /><span className="text-sm">{isSubmittingForReview ? t("advertise.actions.submitting") : t("advertise.actions.submitForReview")}</span>
                  </DropdownMenuItem>
                )}
                {isPendingReview && isCurrentUserReviewer && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/newsletters/${item.id}`); }} className="gap-2.5 rounded-lg cursor-pointer">
                    <ShieldCheck className="h-3.5 w-3.5" /><span className="text-sm">{t("advertise.actions.review")}</span>
                  </DropdownMenuItem>
                )}
                {isPendingReview && !isCurrentUserReviewer && (item.userId === currentUserId || ['Owner', 'Administrator'].includes((user as any)?.role)) && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); recallToDraftMutation.mutate(item.id); }} disabled={recallToDraftMutation.isPending && recallToDraftMutation.variables === item.id} className="gap-2.5 rounded-lg cursor-pointer text-orange-600 focus:text-orange-600">
                    <Undo2 className="h-3.5 w-3.5" /><span className="text-sm">{recallToDraftMutation.isPending && recallToDraftMutation.variables === item.id ? t("advertise.actions.recalling") : t("advertise.actions.recallToDraft")}</span>
                  </DropdownMenuItem>
                )}
                {isSent && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); archiveMutation.mutate(item.id); }} disabled={archiveMutation.isPending && archiveMutation.variables === item.id} className="gap-2.5 rounded-lg cursor-pointer">
                    <Archive className="h-3.5 w-3.5" /><span className="text-sm">{archiveMutation.isPending && archiveMutation.variables === item.id ? t("advertise.actions.archiving") : t("advertise.actions.archive")}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2.5 rounded-lg cursor-pointer text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}>
                  <Trash2 className="h-3.5 w-3.5" /><span className="text-sm">{t("advertise.actions.delete")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {(item as any).shop?.name && (
            <Badge variant="secondary" className="gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border-0 bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Store className="h-2.5 w-2.5" />
              {(item as any).shop.name}
            </Badge>
          )}

          <div>
            <h3 className="font-bold text-[15px] text-foreground leading-tight group-hover:text-primary transition-colors truncate">
              {item.title}
            </h3>
            <p className="text-xs text-muted-foreground/50 line-clamp-1 mt-0.5">
              {item.subject}
            </p>
          </div>

          {item.reviewStatus === "rejected" && item.reviewNotes && (
            <div className="flex items-start gap-2 rounded-xl bg-red-500/[0.06] dark:bg-red-500/10 border border-red-500/10 px-3 py-2">
              <XCircle className="h-3.5 w-3.5 text-red-500/70 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-red-700 dark:text-red-400">{t("advertise.card.rejectedByReviewer")}</p>
                <p className="text-[11px] text-red-600/60 dark:text-red-400/50 line-clamp-2 mt-0.5">{item.reviewNotes}</p>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-border/30">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {(item.user?.firstName?.[0] || "")}{(item.user?.lastName?.[0] || "")}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-semibold text-foreground/80 truncate">
                  {item.user?.firstName || ""} {item.user?.lastName || ""}
                </span>
                <span className="text-[10px] text-muted-foreground/40 truncate">
                  {item.sentAt
                    ? formatDistanceToNow(new Date(item.sentAt), { addSuffix: true, ...dateFnsLocale })
                    : item.createdAt
                      ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, ...dateFnsLocale })
                      : ""}
                </span>
              </div>
            </div>
          </div>

          {isSent ? (
            <div className="grid grid-cols-3 gap-1.5 pt-3 border-t border-border/30">
              <div className="text-center py-1.5 rounded-lg bg-muted/30">
                <div className="flex items-center justify-center gap-1">
                  <Users className="h-3 w-3 text-blue-500/70" />
                  <span className="text-xs font-bold">{(item.recipientCount || 0).toLocaleString()}</span>
                </div>
                <p className="text-[9px] text-muted-foreground/40 mt-0.5">{t("advertise.metrics.sent")}</p>
              </div>
              <div className="text-center py-1.5 rounded-lg bg-muted/30">
                <div className="flex items-center justify-center gap-1">
                  <Eye className="h-3 w-3 text-emerald-500/70" />
                  <span className="text-xs font-bold">{item.opens || 0}</span>
                </div>
                <p className="text-[9px] text-muted-foreground/40 mt-0.5">{t("advertise.metrics.opened", { rate: openRate })}</p>
              </div>
              <div className="text-center py-1.5 rounded-lg bg-muted/30">
                <div className="flex items-center justify-center gap-1">
                  <MousePointer className="h-3 w-3 text-violet-500/70" />
                  <span className="text-xs font-bold">{item.clickCount || 0}</span>
                </div>
                <p className="text-[9px] text-muted-foreground/40 mt-0.5">{t("advertise.metrics.clicks")}</p>
              </div>
            </div>
          ) : (
            <div className="pt-3 border-t border-border/30">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40">
                <Calendar className="h-3 w-3 shrink-0" />
                {item.status === "scheduled" && item.scheduledAt ? (
                  <span className="truncate">{t("advertise.card.scheduledFor", { date: format(new Date(item.scheduledAt), "MMM d, yyyy h:mm a", { locale: currentLanguage === "es" ? esLocale : undefined }) })}</span>
                ) : (
                  <span className="truncate">{item.updatedAt ? t("advertise.card.lastEdited", { time: formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true, ...dateFnsLocale }) }) : t("advertise.card.lastEditedRecently")}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="container mx-auto p-4 lg:p-6 space-y-5 lg:space-y-6 overflow-y-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pt-1">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl lg:text-[2rem] font-extrabold tracking-tight leading-none">
              {t("advertise.title")}
            </h1>
            <p className="text-sm text-muted-foreground/80 max-w-md">
              {t("advertise.subtitle")}
            </p>
          </div>
          <Button onClick={() => setShowEditorPicker(true)} className="rounded-xl shadow-sm gap-2 h-10 px-5">
            <Plus className="h-4 w-4" />
            {t("advertise.createNew")}
          </Button>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                type="text"
                placeholder={t("advertise.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl border-border/50 bg-card text-sm"
              />
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Tv2 className="h-8 w-8 text-primary/50" />
            </div>
            <h3 className="text-lg font-bold mb-1">{t("advertise.noItemsYet")}</h3>
            <p className="text-sm text-muted-foreground/60 mb-6 max-w-sm">{t("advertise.noItemsDesc")}</p>
            <Button onClick={() => setShowEditorPicker(true)} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" />
              {t("advertise.createFirst")}
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-foreground/80 mb-0.5">{t("advertise.noResultsFound")}</p>
            <p className="text-xs text-muted-foreground/60 mb-4">{t("advertise.noResultsDesc")}</p>
            <Button variant="outline" onClick={() => setSearchQuery("")} className="rounded-xl">
              {t("advertise.clearSearch")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kanbanColumns.map((column) => (
              <div
                key={column.key}
                className="flex flex-col rounded-2xl border border-border/40 bg-muted/10 dark:bg-muted/5 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border/30">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${column.dot}`} />
                    <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                      {column.title}
                    </h3>
                    <span className="text-[10px] font-bold text-muted-foreground/40 bg-muted/60 px-1.5 py-0.5 rounded-md ml-auto">
                      {column.items.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto max-h-[calc(100vh-380px)] min-h-[200px]">
                  {column.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <column.icon className="h-5 w-5 text-muted-foreground/20 mb-2" />
                      <p className="text-[10px] text-muted-foreground/30 font-medium">
                        {t("advertise.kanban.empty")}
                      </p>
                    </div>
                  ) : (
                    column.items.map((item) => renderItemCard(item))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {(items.length > 0 || showArchived || archivedItems.length > 0) && (
          <div className="mt-4">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/50 hover:text-foreground/70 transition-colors group"
            >
              {showArchived ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <Archive className="h-3.5 w-3.5" />
              <span>{showArchived ? t("advertise.archived.hideArchived") : t("advertise.archived.showArchived")}</span>
              {archivedItems.length > 0 && (
                <span className="text-[10px] font-bold bg-muted/60 text-muted-foreground/40 px-1.5 py-0.5 rounded-md">
                  {archivedItems.length}
                </span>
              )}
            </button>

            {showArchived && (
              <div className="mt-3">
                {archivedItems.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-border/30 rounded-2xl bg-muted/5">
                    <Archive className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                    <h4 className="text-sm font-semibold text-muted-foreground/40 mb-0.5">
                      {t("advertise.archived.empty")}
                    </h4>
                    <p className="text-[11px] text-muted-foreground/30 max-w-xs mx-auto">
                      {t("advertise.archived.emptyDesc")}
                    </p>
                  </div>
                ) : (
                  <div className="border border-border/40 rounded-2xl overflow-hidden bg-card">
                    <div className="px-5 py-3 border-b border-border/30">
                      <div className="flex items-center gap-2">
                        <Archive className="h-3.5 w-3.5 text-muted-foreground/40" />
                        <h3 className="text-xs font-bold text-foreground/70 uppercase tracking-wider">
                          {t("advertise.archived.title")}
                        </h3>
                        <span className="text-[10px] text-muted-foreground/30 ml-1">
                          — {t("advertise.archived.subtitle")}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/20">
                            <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.1em]">{t("advertise.archived.name")}</th>
                            <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.1em]">{t("advertise.archived.subject")}</th>
                            <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.1em]">{t("advertise.archived.sentDate")}</th>
                            <th className="text-center px-5 py-3 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.1em]">{t("advertise.archived.recipients")}</th>
                            <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.1em]">{t("advertise.archived.archivedDate")}</th>
                            <th className="text-right px-5 py-3 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.1em]">{t("advertise.archived.actions")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {archivedItems.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-muted/20 transition-colors cursor-pointer"
                              onClick={() => setLocation(`/newsletters/${item.id}`)}
                            >
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                    {(item.user?.firstName?.[0] || "")}{(item.user?.lastName?.[0] || "")}
                                  </div>
                                  <span className="font-semibold text-foreground/80 truncate max-w-[200px] text-sm">{item.title}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-muted-foreground/50 truncate max-w-[200px] text-sm">{item.subject}</td>
                              <td className="px-5 py-3 text-muted-foreground/50 whitespace-nowrap text-sm">
                                {item.sentAt ? format(new Date(item.sentAt), "MMM d, yyyy", { locale: currentLanguage === "es" ? esLocale : undefined }) : "—"}
                              </td>
                              <td className="px-5 py-3 text-center">
                                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground/50">
                                  <Users className="h-3 w-3" />{(item.recipientCount || 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-muted-foreground/50 whitespace-nowrap text-sm">
                                {(item as any).archivedAt ? formatDistanceToNow(new Date((item as any).archivedAt), { addSuffix: true, ...dateFnsLocale }) : "—"}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg text-muted-foreground/40 hover:text-primary" onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg text-muted-foreground/40 hover:text-emerald-600" disabled={unarchiveMutation.isPending && unarchiveMutation.variables === item.id} onClick={(e) => { e.stopPropagation(); unarchiveMutation.mutate(item.id); }}>
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

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("advertise.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("advertise.deleteDialog.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t("advertise.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 rounded-xl"
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
        shopId={(editRecipientsItem as any)?.shopId || selectedShopId || null}
        onSegmentSelected={handleEditRecipientsSegmentSelected}
        initialRecipientType={editRecipientsItem?.recipientType as "all" | "selected" | "tags" | undefined}
        initialSelectedContactIds={editRecipientsItem?.selectedContactIds || []}
        initialSelectedTagIds={editRecipientsItem?.selectedTagIds || []}
        itemLabel="Advertisement"
        returnPath="/advertise"
      />

      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Eye className="h-4 w-4 text-primary" />
              </div>
              {t("advertise.previewDialog.title")}
            </DialogTitle>
            <DialogDescription>{t("advertise.previewDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto p-4 sm:p-6 bg-muted/30 rounded-xl">
              <div className="bg-white text-slate-900 shadow-2xl mx-auto rounded-xl overflow-hidden max-w-[600px] w-full">
                <div className="border-b border-border/20 bg-muted/20 p-4 text-xs text-muted-foreground">
                  <div className="flex gap-2 mb-1">
                    <span className="font-bold text-right w-16">{t("advertise.previewDialog.subject")}</span>
                    <span className="text-foreground font-semibold truncate">{previewItem?.subject || previewItem?.title || t("advertise.previewDialog.noSubject")}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-bold text-right w-16">{t("advertise.previewDialog.status")}</span>
                    <span className="text-foreground capitalize">{(() => {
                      const s = previewItem?.status || "draft";
                      const keyMap: Record<string, string> = { ready_to_send: "readyToSend", pending_review: "pendingReview" };
                      return t(`advertise.status.${keyMap[s] ?? s}`, s);
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
