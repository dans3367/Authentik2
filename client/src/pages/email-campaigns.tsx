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
  DollarSign,
  LayoutDashboard,
  Mail,
  Zap,
  CheckCircle2,
  FileText,
  BarChart3,
  AlertTriangle,
  MousePointerClick,
  Eye,
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
import { useToast } from "@/hooks/use-toast";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { apiRequest } from "@/lib/queryClient";
import { type Campaign } from "@shared/schema";

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

function getTypeBadgeClasses(type: string) {
  switch (type) {
    case "email":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
    case "sms":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case "push":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300";
    case "social":
      return "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300";
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
    default:
      return <Mail className="h-4 w-4" />;
  }
}

export default function EmailCampaignsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: t("navigation.dashboard"), href: "/", icon: LayoutDashboard },
    { label: t("emailCampaigns.title"), icon: Target },
  ]);

  // Fetch campaigns
  const { data: campaignsData, isLoading, error } = useQuery({
    queryKey: ["/api/campaigns"],
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["/api/campaign-stats"],
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest("DELETE", `/api/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-stats"] });
      toast({
        title: t("emailCampaigns.toasts.success"),
        description: t("emailCampaigns.toasts.deleteSuccess"),
      });
      setIsDeleteModalOpen(false);
      setSelectedCampaign(null);
    },
    onError: (error: any) => {
      console.error("Delete campaign error:", error);
      toast({
        title: t("emailCampaigns.toasts.error"),
        description: error.message || t("emailCampaigns.toasts.deleteError"),
        variant: "destructive",
      });
    },
  });

  const handleDelete = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsDeleteModalOpen(true);
  };

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    const campaigns = (campaignsData as any)?.campaigns || [];
    return campaigns.filter((campaign: Campaign) => {
      const matchesSearch =
        campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        campaign.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
      const matchesType = typeFilter === "all" || campaign.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [campaignsData, searchTerm, statusFilter, typeFilter]);

  const allCampaigns = (campaignsData as any)?.campaigns || [];

  // --- Loading Skeleton ---
  if (isLoading) {
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

        {/* List skeleton */}
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-9 bg-muted rounded w-full max-w-sm mb-5" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-muted rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full mb-4">
            <AlertTriangle className="h-10 w-10 text-red-500 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {t("emailCampaigns.errorState.title")}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {error?.message || t("emailCampaigns.errorState.defaultMessage")}
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
              {t("emailCampaigns.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("emailCampaigns.subtitle")}
            </p>
          </div>
        </div>

        <Button
          onClick={() => setLocation("/campaigns/create")}
          className="shrink-0"
          data-testid="button-create-campaign"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {t("emailCampaigns.createCampaign")}
        </Button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("emailCampaigns.stats.totalCampaigns")}
                </p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {statsData?.totalCampaigns || 0}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("emailCampaigns.stats.allCampaignsCreated")}
                </p>
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("emailCampaigns.stats.activeCampaigns")}
                </p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {statsData?.activeCampaigns || 0}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("emailCampaigns.stats.currentlyRunning")}
                </p>
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("emailCampaigns.stats.draftCampaigns")}
                </p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {statsData?.draftCampaigns || 0}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("emailCampaigns.stats.inPreparation")}
                </p>
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("emailCampaigns.stats.completedCampaigns")}
                </p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {statsData?.completedCampaigns || 0}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("emailCampaigns.stats.successfullyFinished")}
                </p>
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
              <CardTitle className="text-base">
                {t("emailCampaigns.list.title")}
              </CardTitle>
              <CardDescription className="mt-0.5">
                {t("emailCampaigns.list.subtitle")}
              </CardDescription>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={t("emailCampaigns.filters.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
                data-testid="input-search-campaigns"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm" data-testid="select-status-filter">
                <SelectValue placeholder={t("emailCampaigns.filters.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("emailCampaigns.filters.allStatuses")}</SelectItem>
                <SelectItem value="draft">{t("emailCampaigns.filters.draft")}</SelectItem>
                <SelectItem value="active">{t("emailCampaigns.filters.active")}</SelectItem>
                <SelectItem value="paused">{t("emailCampaigns.filters.paused")}</SelectItem>
                <SelectItem value="completed">{t("emailCampaigns.filters.completed")}</SelectItem>
                <SelectItem value="cancelled">{t("emailCampaigns.filters.cancelled")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm" data-testid="select-type-filter">
                <SelectValue placeholder={t("emailCampaigns.filters.allTypes")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("emailCampaigns.filters.allTypes")}</SelectItem>
                <SelectItem value="email">{t("emailCampaigns.filters.email")}</SelectItem>
                <SelectItem value="sms">{t("emailCampaigns.filters.sms")}</SelectItem>
                <SelectItem value="push">{t("emailCampaigns.filters.push")}</SelectItem>
                <SelectItem value="social">{t("emailCampaigns.filters.social")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {filteredCampaigns.length === 0 && allCampaigns.length === 0 ? (
            /* Empty state — no campaigns at all */
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-full mb-4">
                <Target className="h-10 w-10 text-purple-500 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {t("emailCampaigns.list.noCampaignsFound")}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                {t("emailCampaigns.list.createFirstCampaign")}
              </p>
              <Button
                onClick={() => setLocation("/campaigns/create")}
                data-testid="button-create-campaign-empty"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                {t("emailCampaigns.createCampaign")}
              </Button>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            /* No search results */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                {t("emailCampaigns.list.noResults")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("emailCampaigns.list.tryAdjustingFilters")}
              </p>
            </div>
          ) : (
            /* Campaign cards */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCampaigns.map((campaign: Campaign) => (
                <div
                  key={campaign.id}
                  className={`group relative rounded-lg border border-l-4 ${getTypeBorderAccent(
                    campaign.type
                  )} bg-white/50 dark:bg-gray-800/30 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200`}
                >
                  <div className="p-5 space-y-3">
                    {/* Header with name and badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base text-foreground truncate mb-1.5">
                          {campaign.name}
                        </h3>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant="secondary"
                            className={`gap-1 text-[11px] font-medium ${getTypeBadgeClasses(
                              campaign.type
                            )}`}
                          >
                            {getTypeIcon(campaign.type)}
                            {campaign.type}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={`text-[11px] font-medium ${getStatusBadgeClasses(
                              campaign.status
                            )}`}
                          >
                            {campaign.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="text-sm text-muted-foreground min-h-[2.5rem]">
                      {campaign.description ? (
                        <p className="line-clamp-2">{campaign.description}</p>
                      ) : (
                        <p className="italic opacity-60">—</p>
                      )}
                    </div>

                    {/* Stats row: Budget & Performance */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <div className="flex items-center gap-1.5">
                        {campaign.budget ? (
                          <>
                            <DollarSign className="h-3.5 w-3.5" />
                            <span className="font-medium">
                              {parseFloat(campaign.budget).toLocaleString()} {campaign.currency}
                            </span>
                          </>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1" title={t("emailCampaigns.list.impressions")}>
                          <Eye className="h-3.5 w-3.5" />
                          <span>{campaign.impressions?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex items-center gap-1" title={t("emailCampaigns.list.clicks")}>
                          <MousePointerClick className="h-3.5 w-3.5" />
                          <span>{campaign.clicks?.toLocaleString() || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline row */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {campaign.startDate ? (
                        <span>
                          {format(new Date(campaign.startDate), "MMM dd, yyyy")}
                          {campaign.endDate && ` — ${format(new Date(campaign.endDate), "MMM dd, yyyy")}`}
                        </span>
                      ) : (
                        <span>{t("emailCampaigns.list.notScheduled")}</span>
                      )}
                    </div>

                    <Separator />

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation(`/email-campaigns/edit/${campaign.id}`)}
                        className="flex-1 h-8 text-xs hover:bg-muted"
                        data-testid={`button-edit-${campaign.id}`}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        {t("emailCampaigns.actions.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(campaign)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/50"
                        data-testid={`button-actions-${campaign.id}`}
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

      {/* ──────── DELETE CONFIRMATION DIALOG ──────── */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              {t("emailCampaigns.deleteDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("emailCampaigns.deleteDialog.description", {
                name: selectedCampaign?.name,
              })}
            </DialogDescription>
          </DialogHeader>

          {/* Campaign preview in delete dialog */}
          {selectedCampaign && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border my-2">
              <div className="flex items-center gap-2">
                {getTypeIcon(selectedCampaign.type)}
                <span className="text-sm font-medium">{selectedCampaign.name}</span>
              </div>
              <div className="ml-auto">
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${getStatusBadgeClasses(selectedCampaign.status)}`}
                >
                  {selectedCampaign.status}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              {t("emailCampaigns.deleteDialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedCampaign && deleteCampaignMutation.mutate(selectedCampaign.id)}
              disabled={deleteCampaignMutation.isPending}
              data-testid={`button-confirm-delete-${selectedCampaign?.id}`}
            >
              {deleteCampaignMutation.isPending
                ? t("emailCampaigns.deleteDialog.deleting")
                : t("emailCampaigns.deleteDialog.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}