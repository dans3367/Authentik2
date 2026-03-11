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
} from "lucide-react";
import { useState, useMemo } from "react";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { SendNewsletterWizardModal } from "@/components/SendNewsletterWizardModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const getStatusBadge = (status: string) => {
  switch (status) {
    case "draft":
      return <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"><FileText className="h-3 w-3 mr-1" />Draft</Badge>;
    case "ready_to_send":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"><Send className="h-3 w-3 mr-1" />Ready to Send</Badge>;
    case "pending_review":
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800"><ShieldCheck className="h-3 w-3 mr-1" />Pending Review</Badge>;
    case "scheduled":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
    case "sending":
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"><Send className="h-3 w-3 mr-1 animate-pulse" />Sending</Badge>;
    case "sent":
      return <Badge variant="default" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"><Send className="h-3 w-3 mr-1" />Sent</Badge>;
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
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t, currentLanguage } = useLanguage();
  const queryClient = useQueryClient();
  const { user } = useReduxAuth();
  const currentUserId = (user as any)?.id;
  const dateFnsLocale = currentLanguage === "es" ? { locale: esLocale } : {};

  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Advertise", icon: Tv2 },
  ]);

  const { data: itemsData, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/newsletters", { emailType: "advertise" }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/newsletters?emailType=advertise");
      const data = await response.json();
      return data.newsletters || [];
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const { data: reviewerSettings } = useQuery<{ enabled: boolean; reviewerId: string | null; reviewer: any }>({
    queryKey: ["/api/newsletters/reviewer-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/newsletters/reviewer-settings");
      return response.json();
    },
  });

  const reviewerEnabled = reviewerSettings?.enabled ?? false;

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: "Deleted", description: "Promotional email deleted successfully." });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete.", variant: "destructive" });
    },
  });

  const deployMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/newsletters/${id}/send`);
      return response.json();
    },
    onSuccess: (data: any, id: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: "Sent", description: data.message || "Promotional email is being sent." });
      setLocation(`/newsletters/${data.newsletterId || data.id || id}`);
    },
    onError: (error: any) => {
      toast({ title: "Send Failed", description: error.message || "Failed to send email.", variant: "destructive" });
    },
  });

  const cancelScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/newsletters/${id}/cancel-schedule`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: "Schedule Cancelled", description: "The scheduled send has been cancelled." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to cancel schedule.", variant: "destructive" });
    },
  });

  const submitForReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/newsletters/${id}/submit-for-review`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: "Submitted", description: "Submitted for reviewer approval." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to submit.", variant: "destructive" });
    },
  });

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
      toast({ title: "Updated", description: "Recipients updated successfully." });
      setEditRecipientsItem(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update recipients.", variant: "destructive" });
    }
  };

  const items: AdvertiseItem[] = itemsData || [];

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
      { key: "drafts", title: "Drafts", icon: FileText, color: "amber", borderColor: "border-amber-300 dark:border-amber-700", bgHeader: "bg-amber-50 dark:bg-amber-950/40", textColor: "text-amber-700 dark:text-amber-300", badgeBg: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300", accentBar: "bg-amber-400", items: drafts },
      { key: "ready_to_send", title: "Ready to Send", icon: Send, color: "blue", borderColor: "border-blue-300 dark:border-blue-700", bgHeader: "bg-blue-50 dark:bg-blue-950/40", textColor: "text-blue-700 dark:text-blue-300", badgeBg: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300", accentBar: "bg-blue-400", items: readyToSend },
      { key: "scheduled", title: "Scheduled", icon: Clock, color: "purple", borderColor: "border-purple-300 dark:border-purple-700", bgHeader: "bg-purple-50 dark:bg-purple-950/40", textColor: "text-purple-700 dark:text-purple-300", badgeBg: "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300", accentBar: "bg-purple-400", items: scheduled },
      { key: "sent", title: "Sent", icon: Mail, color: "green", borderColor: "border-green-300 dark:border-green-700", bgHeader: "bg-green-50 dark:bg-green-950/40", textColor: "text-green-700 dark:text-green-300", badgeBg: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300", accentBar: "bg-green-400", items: sent },
    ];
  }, [filteredItems]);

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
        <div className="text-center py-16">
          <p className="text-red-600 mb-4">Failed to load promotional emails.</p>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
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
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Tv2 className="h-7 w-7 text-orange-500" />
              Advertise
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Create and send promotional email campaigns to your contacts.
            </p>
          </div>
          <Button onClick={() => setShowEditorPicker(true)} className="bg-orange-600 hover:bg-orange-700">
            <Plus className="h-4 w-4 mr-2" />
            New Promotional Email
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search promotional emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
          />
        </div>

        {/* Kanban Board */}
        {items.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-950/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Tv2 className="h-8 w-8 text-orange-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No promotional emails yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
              Create your first promotional email campaign to reach your audience.
            </p>
            <Button onClick={() => setShowEditorPicker(true)} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-2" />
              Create First Campaign
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No results found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Try adjusting your search.</p>
            <Button variant="outline" onClick={() => setSearchQuery("")}>Clear Search</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {kanbanColumns.map((column) => (
              <div key={column.key} className={`flex flex-col rounded-xl border ${column.borderColor} bg-gray-50/60 dark:bg-gray-900/40 overflow-hidden`}>
                {/* Column Header */}
                <div className={`${column.bgHeader} px-4 py-3 border-b ${column.borderColor}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${column.accentBar}`} />
                      <column.icon className={`h-4 w-4 ${column.textColor}`} />
                      <h3 className={`text-sm font-semibold ${column.textColor}`}>{column.title}</h3>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${column.badgeBg}`}>
                      {column.items.length}
                    </span>
                  </div>
                </div>

                {/* Column Body */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-380px)] min-h-[200px]">
                  {column.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className={`w-10 h-10 rounded-xl ${column.bgHeader} flex items-center justify-center mb-3`}>
                        <column.icon className={`h-5 w-5 ${column.textColor} opacity-50`} />
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Nothing here yet</p>
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
                            <Loader2 className="h-6 w-6 text-orange-500 animate-spin mb-3" />
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Deleting...</p>
                          </Card>
                        );
                      }

                      return (
                        <Card
                          key={item.id}
                          className={`group relative rounded-xl hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer bg-white dark:bg-gray-800 border-t-[3px] ${
                            item.status === "sent" ? "border-t-green-500" :
                            item.status === "ready_to_send" ? "border-t-blue-500" :
                            item.status === "pending_review" ? "border-t-orange-500" :
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
                              {/* Status + menu */}
                              <div className="flex items-center justify-between">
                                {getStatusBadge(item.status)}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}>
                                      <Eye className="h-4 w-4 mr-2" />Preview
                                    </DropdownMenuItem>
                                    {(isDraft || isReadyToSend) && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/advertise/create/${item.id}`); }}>
                                        <Pencil className="h-4 w-4 mr-2" />Edit
                                      </DropdownMenuItem>
                                    )}
                                    {(isDraft || isReadyToSend) && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditRecipientsItem(item); }}>
                                        <UserCog className="h-4 w-4 mr-2" />Edit Recipients
                                      </DropdownMenuItem>
                                    )}
                                    {isReadyToSend && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deployMutation.mutate(item.id); }} disabled={isDeploying}>
                                        <Send className="h-4 w-4 mr-2" />{isDeploying ? "Sending..." : "Send Now"}
                                      </DropdownMenuItem>
                                    )}
                                    {isScheduled && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); cancelScheduleMutation.mutate(item.id); }} disabled={isCancellingSchedule} className="text-orange-600 focus:text-orange-600 focus:bg-orange-50 dark:focus:bg-orange-950/50">
                                        <CalendarClock className="h-4 w-4 mr-2" />{isCancellingSchedule ? "Cancelling..." : "Cancel Schedule"}
                                      </DropdownMenuItem>
                                    )}
                                    {reviewerEnabled && (isDraft || isReadyToSend) && !isPendingReview && item.reviewStatus !== "approved" && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); submitForReviewMutation.mutate(item.id); }} disabled={isSubmittingForReview}>
                                        <ClipboardCheck className="h-4 w-4 mr-2" />{isSubmittingForReview ? "Submitting..." : "Submit for Review"}
                                      </DropdownMenuItem>
                                    )}
                                    {isPendingReview && isCurrentUserReviewer && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/newsletters/${item.id}`); }}>
                                        <ShieldCheck className="h-4 w-4 mr-2" />Review
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50" onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}>
                                      <Trash2 className="h-4 w-4 mr-2" />Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {/* Title + Subject */}
                              <div>
                                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-snug group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate">
                                  {item.title}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{item.subject}</p>
                              </div>

                              {/* Author + Date */}
                              <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm">
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

                              {/* Metrics or date */}
                              {isSent ? (
                                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                  <div className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Users className="h-3 w-3 text-blue-500" />
                                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{(item.recipientCount || 0).toLocaleString()}</span>
                                    </div>
                                    <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">Sent</p>
                                  </div>
                                  <div className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Eye className="h-3 w-3 text-green-500" />
                                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{item.opens || 0}</span>
                                    </div>
                                    <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">Opens ({openRate}%)</p>
                                  </div>
                                  <div className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <MousePointer className="h-3 w-3 text-purple-500" />
                                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{item.clickCount || 0}</span>
                                    </div>
                                    <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">Clicks</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                                    {item.status === "scheduled" && item.scheduledAt ? (
                                      <span className="truncate">Scheduled for {format(new Date(item.scheduledAt), "MMM d, yyyy h:mm a")}</span>
                                    ) : (
                                      <span className="truncate">
                                        {item.updatedAt
                                          ? `Last edited ${formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true, ...dateFnsLocale })}`
                                          : "Recently edited"}
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
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promotional Email</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The promotional email will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Recipients */}
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
              <Eye className="h-5 w-5" />Preview
            </DialogTitle>
            <DialogDescription>Email preview as it will appear to recipients.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto p-4 sm:p-6 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl">
              <div className="bg-white text-slate-900 shadow-2xl mx-auto rounded overflow-hidden max-w-[600px] w-full">
                <div className="border-b bg-gray-50 p-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex gap-2 mb-1">
                    <span className="font-semibold w-16">Subject</span>
                    <span className="text-gray-900 font-semibold truncate">{previewItem?.subject || previewItem?.title || "No Subject"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold w-16">Status</span>
                    <span className="text-gray-900 capitalize">{previewItem?.status || "draft"}</span>
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
