import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Plus, 
  Mail, 
  Calendar, 
  Eye,
  Clock,
  MoreHorizontal,
  Users,
  MousePointer,
  Search,
  Edit,
  LayoutDashboard,
  Trash2,
  Send,
  FileText,
  Pencil
} from "lucide-react";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { wrapInEmailPreview } from "@/utils/email-preview-wrapper";
import { format, formatDistanceToNow } from "date-fns";
import type { NewsletterWithUser } from "@shared/schema";

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"><FileText className="h-3 w-3 mr-1" />Draft</Badge>;
    case 'ready_to_send':
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"><Send className="h-3 w-3 mr-1" />Ready to Send</Badge>;
    case 'scheduled':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
    case 'sending':
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"><Send className="h-3 w-3 mr-1 animate-pulse" />Sending</Badge>;
    case 'sent':
      return <Badge variant="default" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"><Send className="h-3 w-3 mr-1" />Sent</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export default function NewsletterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewNewsletter, setPreviewNewsletter] = useState<(NewsletterWithUser & { opens?: number; totalOpens?: number }) | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Email Newsletters", icon: Mail }
  ]);

  const { data: newslettersData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/newsletters'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/newsletters');
      const data = await response.json();
      return data.newsletters || [];
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 2,
  });

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
      if (!response.ok) {
        throw new Error("Failed to fetch email design");
      }
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/newsletters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      toast({ title: "Deleted", description: "Newsletter deleted successfully." });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete newsletter", variant: "destructive" });
    },
  });

  const newsletters: (NewsletterWithUser & { opens?: number; totalOpens?: number })[] = newslettersData || [];

  const filteredNewsletters = useMemo(() => {
    return newsletters.filter((newsletter) => {
      const matchesSearch = searchQuery === "" || 
        newsletter.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        newsletter.subject.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || newsletter.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [newsletters, searchQuery, statusFilter]);

  const stats = useMemo(() => ({
    total: newsletters.length,
    drafts: newsletters.filter(n => n.status === 'draft').length,
    scheduled: newsletters.filter(n => n.status === 'scheduled').length,
    sent: newsletters.filter(n => n.status === 'sent').length,
  }), [newsletters]);

  const parsedSocialLinks = useMemo(() => {
    const raw = emailDesign?.socialLinks;
    if (!raw) return undefined;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    }
    return raw;
  }, [emailDesign]);

  const wrappedPreviewHtml = useMemo(() => {
    if (!previewNewsletter) {
      return "";
    }

    return wrapInEmailPreview(previewNewsletter.content || "", {
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
  }, [previewNewsletter, emailDesign, parsedSocialLinks]);

  if (error) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              {error instanceof Error ? error.message : 'Failed to load newsletter data'}
            </p>
            <Button onClick={() => refetch()}>Try Again</Button>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
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
              Newsletters
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Create and manage email newsletters for your subscribers
            </p>
          </div>
          <Button onClick={() => setLocation('/newsletter/create')} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Create Newsletter
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${statusFilter === 'all' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}
          >
            <div className="flex items-center justify-between">
              <Mail className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total</p>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === "draft" ? "all" : "draft")}
            className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${statusFilter === 'draft' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-500' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}
          >
            <div className="flex items-center justify-between">
              <FileText className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.drafts}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Drafts</p>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === "scheduled" ? "all" : "scheduled")}
            className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${statusFilter === 'scheduled' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}
          >
            <div className="flex items-center justify-between">
              <Clock className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.scheduled}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Scheduled</p>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === "sent" ? "all" : "sent")}
            className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${statusFilter === 'sent' ? 'border-green-500 bg-green-50 dark:bg-green-950/30 ring-1 ring-green-500' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}
          >
            <div className="flex items-center justify-between">
              <Send className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.sent}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Sent</p>
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search newsletters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>

        {/* Newsletter Cards Grid */}
        {newsletters.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No newsletters yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
              Create your first email newsletter to start engaging with your subscribers.
            </p>
            <Button onClick={() => setLocation('/newsletter/create')} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Newsletter
            </Button>
          </div>
        ) : filteredNewsletters.length === 0 ? (
          <div className="text-center py-16">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No newsletters found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Try adjusting your search or filter criteria.
            </p>
            <Button variant="outline" onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
            {filteredNewsletters.map((newsletter) => {
              const openRate = (newsletter.recipientCount || 0) > 0 
                ? ((newsletter.opens || 0) / (newsletter.recipientCount || 1) * 100).toFixed(1)
                : "0";
              const isDraft = newsletter.status === 'draft';
              const isSent = newsletter.status === 'sent';

              return (
                <Card 
                  key={newsletter.id} 
                  className="group relative border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 overflow-hidden cursor-pointer"
                  onClick={() => isDraft 
                    ? setLocation(`/newsletter/create/${newsletter.id}`)
                    : setLocation(`/newsletters/${newsletter.id}`)
                  }
                >
                  {/* Status color bar at top */}
                  <div className={`h-1 w-full ${
                    newsletter.status === 'sent' ? 'bg-green-500' :
                    newsletter.status === 'scheduled' ? 'bg-blue-500' :
                    newsletter.status === 'sending' ? 'bg-purple-500' :
                    'bg-amber-400'
                  }`} />
                  
                  <CardContent className="p-5">
                    <div className="space-y-4">
                      {/* Header: Status badge + Actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {newsletter.title}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {newsletter.subject}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {getStatusBadge(newsletter.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => setLocation(`/newsletters/${newsletter.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPreviewNewsletter(newsletter)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                              {isDraft && (
                                <DropdownMenuItem onClick={() => setLocation(`/newsletter/create/${newsletter.id}`)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit in Designer
                                </DropdownMenuItem>
                              )}
                              {!isSent && (
                                <DropdownMenuItem onClick={() => setLocation(`/newsletter/edit/${newsletter.id}`)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Settings
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600 focus:text-red-600"
                                onClick={() => setDeleteId(newsletter.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Author + Date */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
                            {(newsletter.user?.firstName?.[0] || '')}{(newsletter.user?.lastName?.[0] || '')}
                          </div>
                          <span className="text-gray-600 dark:text-gray-400 truncate text-xs">
                            {newsletter.user?.firstName || ''} {newsletter.user?.lastName || ''}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                          {newsletter.sentAt 
                            ? formatDistanceToNow(new Date(newsletter.sentAt), { addSuffix: true })
                            : newsletter.createdAt
                            ? formatDistanceToNow(new Date(newsletter.createdAt), { addSuffix: true })
                            : ''}
                        </span>
                      </div>

                      {/* Metrics row */}
                      {isSent ? (
                        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Users className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {(newsletter.recipientCount || 0).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Sent</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Eye className="h-3.5 w-3.5 text-green-500" />
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {newsletter.opens || 0}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{openRate}% opened</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <MousePointer className="h-3.5 w-3.5 text-purple-500" />
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {newsletter.clickCount || 0}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Clicks</p>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50">
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <Calendar className="h-3.5 w-3.5" />
                            {newsletter.status === 'scheduled' && newsletter.scheduledAt ? (
                              <span>Scheduled for {format(new Date(newsletter.scheduledAt), 'MMM d, yyyy \'at\' h:mm a')}</span>
                            ) : (
                              <span>Last edited {newsletter.updatedAt ? formatDistanceToNow(new Date(newsletter.updatedAt), { addSuffix: true }) : 'recently'}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Newsletter</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this newsletter? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!previewNewsletter} onOpenChange={(open) => !open && setPreviewNewsletter(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Newsletter Preview
            </DialogTitle>
            <DialogDescription>
              Preview of how this newsletter appears in an email client.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto p-4 sm:p-6 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl">
              <div className="bg-white text-slate-900 shadow-2xl mx-auto rounded overflow-hidden max-w-[600px] w-full">
                <div className="border-b bg-gray-50 p-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex gap-2 mb-1">
                    <span className="font-semibold text-right w-16">Subject:</span>
                    <span className="text-gray-900 font-semibold truncate">
                      {previewNewsletter?.subject || previewNewsletter?.title || "(no subject)"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-right w-16">Status:</span>
                    <span className="text-gray-900 capitalize">{previewNewsletter?.status || "draft"}</span>
                  </div>
                </div>

                <iframe
                  srcDoc={wrappedPreviewHtml}
                  title="Newsletter content preview"
                  sandbox="allow-same-origin"
                  className="w-full border-0"
                  style={{ minHeight: "640px", background: "#fff" }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
