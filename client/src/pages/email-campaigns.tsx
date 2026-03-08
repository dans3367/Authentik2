import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Target,
  TrendingUp,
  Calendar,
  LayoutDashboard,
  Mail,
  Zap,
  CheckCircle2,
  FileText,
  BarChart3,
  AlertTriangle,
  MousePointerClick,
  Eye,
  Send,
  Newspaper,
  Users,
  ArrowUpRight,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { apiRequest } from "@/lib/queryClient";

// --- Status & Type Helpers ---

function getStatusBadgeClasses(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "draft":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    case "paused":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    case "completed":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "cancelled":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function getTypeBorderAccent(type: string) {
  switch (type) {
    case "email":
      return "border-l-purple-500";
    case "sms":
      return "border-l-orange-500";
    case "push":
      return "border-l-indigo-500";
    case "social":
      return "border-l-pink-500";
    case "intake_form":
      return "border-l-teal-500";
    default:
      return "border-l-gray-400";
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case "email":
      return <Mail className="h-4 w-4" />;
    case "sms":
      return <Zap className="h-4 w-4" />;
    case "push":
      return <Target className="h-4 w-4" />;
    case "social":
      return <TrendingUp className="h-4 w-4" />;
    case "intake_form":
      return <ClipboardList className="h-4 w-4" />;
    default:
      return <Mail className="h-4 w-4" />;
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case "email": return "Email";
    case "sms": return "SMS";
    case "push": return "Push";
    case "social": return "Social";
    case "intake_form": return "Intake Form";
    default: return type;
  }
}

export default function EmailCampaignsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);

  useSetBreadcrumbs([
    { label: t("navigation.dashboard"), href: "/", icon: LayoutDashboard },
    { label: "Campaigns", icon: Target },
  ]);

  // Fetch campaigns (enriched with newsletter count + aggregated stats)
  const { data: campaignsData, isLoading, error } = useQuery({
    queryKey: ["/api/campaigns"],
  });

  // Fetch overview stats
  const { data: stats } = useQuery({
    queryKey: ["/api/campaigns/stats/overview"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/campaigns/stats/overview");
      return res.json();
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest("DELETE", `/api/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats/overview"] });
      toast({ title: "Success", description: "Campaign deleted successfully." });
      setIsDeleteModalOpen(false);
      setSelectedCampaign(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete campaign.", variant: "destructive" });
    },
  });

  const handleDelete = (campaign: any) => {
    setSelectedCampaign(campaign);
    setIsDeleteModalOpen(true);
  };

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    const campaigns = (campaignsData as any)?.campaigns || [];
    return campaigns.filter((campaign: any) => {
      const matchesSearch =
        campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        campaign.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [campaignsData, searchTerm, statusFilter]);

  const allCampaigns = (campaignsData as any)?.campaigns || [];

  // --- Loading Skeleton ---
  if (isLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between bg-card p-6 rounded-xl border shadow-sm animate-pulse">
          <div>
            <div className="h-7 w-48 bg-muted rounded mb-2" />
            <div className="h-4 w-72 bg-muted rounded" />
          </div>
          <div className="h-10 w-36 bg-muted rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5">
                <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                <div className="h-7 bg-muted rounded w-1/2 mb-1" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-9 bg-muted rounded w-full max-w-sm mb-5" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full mb-4">
            <AlertTriangle className="h-10 w-10 text-red-500 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Failed to load campaigns</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {(error as any)?.message || "An unexpected error occurred."}
          </p>
        </div>
      </div>
    );
  }

  const statsData = stats as any;

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      {/* ── Hero Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Campaigns
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Group newsletters and intake forms into campaigns to track aggregated performance
            </p>
          </div>
        </div>

        <Button
          onClick={() => setLocation("/campaigns/create")}
          className="shrink-0"
          data-testid="button-create-campaign"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Create Campaign
        </Button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Campaigns</p>
                <p className="text-2xl font-bold mt-1 text-foreground">{statsData?.totalCampaigns || 0}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">All campaigns created</p>
              </div>
              <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active</p>
                <p className="text-2xl font-bold mt-1 text-foreground">{statsData?.activeCampaigns || 0}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Currently running</p>
              </div>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Drafts</p>
                <p className="text-2xl font-bold mt-1 text-foreground">{statsData?.draftCampaigns || 0}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">In preparation</p>
              </div>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</p>
                <p className="text-2xl font-bold mt-1 text-foreground">{statsData?.completedCampaigns || 0}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Successfully finished</p>
              </div>
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Campaigns List ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">All Campaigns</CardTitle>
              <CardDescription className="mt-0.5">
                View and manage campaigns with aggregated analytics
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {filteredCampaigns.length === 0 && allCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-full mb-4">
                <Target className="h-10 w-10 text-purple-500 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">No campaigns yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Create your first campaign to start grouping newsletters and tracking aggregated performance.
              </p>
              <Button onClick={() => setLocation("/campaigns/create")}>
                <Plus className="h-4 w-4 mr-1.5" />
                Create Campaign
              </Button>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">No matching campaigns</p>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCampaigns.map((campaign: any) => {
                const agg = campaign.aggregatedStats || {};
                const nlCount = campaign.newsletterCount || 0;
                const fmCount = campaign.formCount || 0;
                const fmStats = campaign.formStats || {};

                return (
                  <div
                    key={campaign.id}
                    className={`group relative rounded-lg border border-l-4 ${getTypeBorderAccent(
                      campaign.type
                    )} bg-white/50 dark:bg-gray-800/30 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 cursor-pointer`}
                    onClick={() => setLocation(`/email-campaigns/edit/${campaign.id}`)}
                  >
                    <div className="p-5">
                      {/* Row 1: Name, badges, actions */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="font-semibold text-base text-foreground truncate">
                              {campaign.name}
                            </h3>
                            <Badge variant="outline" className="text-[10px] font-medium shrink-0 gap-1">
                              {getTypeIcon(campaign.type)}
                              {getTypeLabel(campaign.type)}
                            </Badge>
                            <Badge variant="secondary" className={`text-[11px] font-medium shrink-0 ${getStatusBadgeClasses(campaign.status)}`}>
                              {campaign.status}
                            </Badge>
                          </div>
                          {campaign.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{campaign.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/email-campaigns/edit/${campaign.id}`);
                            }}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(campaign);
                            }}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Row 2: Type counts + timeline */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                        {nlCount > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Newspaper className="h-3.5 w-3.5" />
                            <span className="font-medium">{nlCount} newsletter{nlCount !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {fmCount > 0 && (
                          <div className="flex items-center gap-1.5">
                            <ClipboardList className="h-3.5 w-3.5" />
                            <span className="font-medium">{fmCount} form{fmCount !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {campaign.startDate ? (
                            <span>
                              {format(new Date(campaign.startDate), "MMM dd, yyyy")}
                              {campaign.endDate && ` — ${format(new Date(campaign.endDate), "MMM dd, yyyy")}`}
                            </span>
                          ) : (
                            <span>Not scheduled</span>
                          )}
                        </div>
                      </div>

                      {/* Row 3: Aggregated Stats */}
                      {nlCount > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40">
                            <Send className="h-3.5 w-3.5 text-blue-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Sent</p>
                              <p className="text-sm font-semibold">{(agg.totalSent || 0).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40">
                            <Users className="h-3.5 w-3.5 text-green-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Delivered</p>
                              <p className="text-sm font-semibold">{(agg.totalDelivered || 0).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40">
                            <Eye className="h-3.5 w-3.5 text-purple-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Open Rate</p>
                              <p className="text-sm font-semibold">{agg.openRate || 0}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40">
                            <MousePointerClick className="h-3.5 w-3.5 text-orange-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Click Rate</p>
                              <p className="text-sm font-semibold">{agg.clickRate || 0}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40">
                            <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Bounced</p>
                              <p className="text-sm font-semibold">{(agg.totalBounced || 0).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40">
                            <BarChart3 className="h-3.5 w-3.5 text-indigo-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Recipients</p>
                              <p className="text-sm font-semibold">{(agg.totalRecipients || 0).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Row 4: Form Signup Stats */}
                      {fmCount > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-teal-50/50 dark:bg-teal-900/10">
                            <ClipboardList className="h-3.5 w-3.5 text-teal-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Forms</p>
                              <p className="text-sm font-semibold">{fmStats.totalForms || 0}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-teal-50/50 dark:bg-teal-900/10">
                            <Users className="h-3.5 w-3.5 text-teal-600" />
                            <div>
                              <p className="text-xs text-muted-foreground">Total Signups</p>
                              <p className="text-sm font-semibold">{(fmStats.totalSignups || 0).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {nlCount === 0 && fmCount === 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground italic px-3 py-2 rounded-md bg-muted/30">
                          <Target className="h-3.5 w-3.5" />
                          No newsletters or forms attached — add items to see aggregated analytics
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ──────── DELETE CONFIRMATION DIALOG ──────── */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              Delete Campaign
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedCampaign?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedCampaign && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border my-2">
              <div className="flex items-center gap-2">
                {getTypeIcon(selectedCampaign.type)}
                <span className="text-sm font-medium">{selectedCampaign.name}</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {selectedCampaign.newsletterCount > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {selectedCampaign.newsletterCount} newsletters
                  </Badge>
                )}
                <Badge variant="secondary" className={`text-[10px] ${getStatusBadgeClasses(selectedCampaign.status)}`}>
                  {selectedCampaign.status}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => selectedCampaign && deleteCampaignMutation.mutate(selectedCampaign.id)}
              disabled={deleteCampaignMutation.isPending}
            >
              {deleteCampaignMutation.isPending ? "Deleting..." : "Delete Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}