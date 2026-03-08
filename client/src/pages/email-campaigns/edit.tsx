import { useEffect, useState, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

import {
  ArrowLeft,
  Save,
  Loader2,
  Target,
  DollarSign,
  TrendingUp,
  CalendarIcon,
  X,
  LayoutDashboard,
  Mail,
  Zap,
  AlertTriangle,
  Plus,
  ClipboardCheck,
  Newspaper,
  Search,
  Check,
  Eye,
  MousePointerClick,
  Send,
  Users,
  ArrowUpRight,
  BarChart3,
} from "lucide-react";

import {
  createCampaignSchema,
  type CreateCampaignData,
  type Campaign,
  type User,
} from "@shared/schema";

function getStatusColor(status: string) {
  switch (status) {
    case 'sent': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'draft': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    case 'scheduled': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'sending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

export default function EditCampaignPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/email-campaigns/edit/:id");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [goals, setGoals] = useState<string[]>([]);
  const [currentGoal, setCurrentGoal] = useState("");
  const [selectedNewsletterIds, setSelectedNewsletterIds] = useState<string[]>([]);
  const [newsletterSearch, setNewsletterSearch] = useState("");

  useSetBreadcrumbs([
    { label: t("navigation.dashboard"), href: "/", icon: LayoutDashboard },
    { label: t("emailCampaigns.title"), href: "/email-campaigns", icon: Target },
    { label: t("emailCampaigns.edit.title"), icon: Target },
  ]);

  if (!match || !params?.id) {
    setLocation("/email-campaigns");
    return null;
  }

  const campaignId = params.id;

  // Fetch existing campaign (now includes newsletters + aggregatedStats)
  const { data: campaignData, isLoading: isCampaignLoading, error: campaignError } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    queryFn: async ({ queryKey }) => {
      const res = await apiRequest("GET", `${queryKey[0]}/${queryKey[1]}`);
      return res.json();
    },
  });

  // Fetch eligible reviewers
  const { data: reviewersData, isLoading: reviewersLoading } = useQuery<{ managers: User[] }>({
    queryKey: ["/api/campaigns/managers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/campaigns/managers");
      return res.json();
    },
    staleTime: 60_000,
  });

  // Fetch available newsletters for the picker
  const { data: newslettersData, isLoading: newslettersLoading } = useQuery<{ newsletters: any[] }>({
    queryKey: ["/api/campaigns/newsletters/available"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/campaigns/newsletters/available");
      return res.json();
    },
    staleTime: 30_000,
  });

  const reviewers = reviewersData?.managers || [];
  const allNewsletters = newslettersData?.newsletters || [];

  // Filter newsletters by search
  const filteredNewsletters = useMemo(() => {
    if (!newsletterSearch.trim()) return allNewsletters;
    const q = newsletterSearch.toLowerCase();
    return allNewsletters.filter((nl: any) =>
      nl.title?.toLowerCase().includes(q) || nl.subject?.toLowerCase().includes(q)
    );
  }, [allNewsletters, newsletterSearch]);

  const toggleNewsletter = (nlId: string) => {
    setSelectedNewsletterIds(prev => {
      const next = prev.includes(nlId) ? prev.filter(id => id !== nlId) : [...prev, nlId];
      form.setValue("newsletterIds", next);
      return next;
    });
  };

  const form = useForm<CreateCampaignData>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "email",
      status: "draft",
      budget: undefined,
      currency: "USD",
      startDate: undefined,
      endDate: undefined,
      targetAudience: "",
      goals: [],
      kpis: "",
      settings: "",
      requiresReviewerApproval: false,
      reviewerId: "",
      newsletterIds: [],
    },
  });

  // Prefill form when campaign loads
  useEffect(() => {
    const loaded: Campaign | undefined = (campaignData as any)?.campaign;
    if (loaded) {
      const nlIds = (loaded as any).newsletterIds || [];
      form.reset({
        name: loaded.name || "",
        description: (loaded as any).description || "",
        type: (loaded as any).type || "email",
        status: (loaded as any).status || "draft",
        budget: loaded.budget ? parseFloat(String(loaded.budget)) : undefined,
        currency: (loaded as any).currency || "USD",
        startDate: loaded.startDate ? new Date(loaded.startDate as any) : undefined,
        endDate: loaded.endDate ? new Date(loaded.endDate as any) : undefined,
        targetAudience: (loaded as any).targetAudience || "",
        goals: (loaded as any).goals || [],
        kpis: (loaded as any).kpis || "",
        settings: (loaded as any).settings || "",
        requiresReviewerApproval: (loaded as any).requiresReviewerApproval || false,
        reviewerId: (loaded as any).reviewerId || "",
        newsletterIds: nlIds,
      });
      setGoals(((loaded as any).goals as string[]) || []);
      setSelectedNewsletterIds(nlIds);
    }
  }, [campaignData, form]);

  const updateCampaignMutation = useMutation({
    mutationFn: async (data: CreateCampaignData) => {
      return apiRequest("PUT", `/api/campaigns/${campaignId}`, data);
    },
    onSuccess: async () => {
      toast({ title: "Success", description: "Campaign updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats/overview"] });
      setLocation("/email-campaigns");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to update campaign.", variant: "destructive" });
    },
  });

  const onSubmit = (data: CreateCampaignData) => {
    updateCampaignMutation.mutate({
      ...data,
      goals,
      newsletterIds: selectedNewsletterIds,
      budget: typeof data.budget === "number" ? data.budget : undefined,
    });
  };

  const addGoal = () => {
    if (currentGoal.trim() && !goals.includes(currentGoal.trim())) {
      const newGoals = [...goals, currentGoal.trim()];
      setGoals(newGoals);
      form.setValue("goals", newGoals);
      setCurrentGoal("");
    }
  };

  const removeGoal = (goalToRemove: string) => {
    const newGoals = goals.filter((g) => g !== goalToRemove);
    setGoals(newGoals);
    form.setValue("goals", newGoals);
  };

  // --- Loading Skeleton ---
  if (isCampaignLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6 max-w-4xl space-y-6">
        <div className="bg-card p-6 rounded-xl border shadow-sm animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-muted rounded-lg" />
            <div>
              <div className="h-6 w-40 bg-muted rounded mb-1" />
              <div className="h-4 w-64 bg-muted rounded" />
            </div>
          </div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 bg-muted rounded w-1/3 mb-1" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-9 bg-muted rounded" />
              <div className="h-9 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // --- Error / Not Found State ---
  if (campaignError || !(campaignData as any)?.campaign) {
    return (
      <div className="container mx-auto p-4 lg:p-6 max-w-4xl">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full mb-4">
            <AlertTriangle className="h-10 w-10 text-red-500 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Campaign not found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            The campaign you're looking for doesn't exist or has been deleted.
          </p>
          <Button onClick={() => setLocation("/email-campaigns")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const aggregatedStats = (campaignData as any)?.aggregatedStats || {};
  const campaignNewsletters: any[] = (campaignData as any)?.newsletters || [];

  return (
    <div className="container mx-auto p-4 lg:p-6 max-w-4xl space-y-6">
      {/* ── Hero Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t("emailCampaigns.edit.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Edit campaign details and manage associated newsletters
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setLocation("/email-campaigns")} className="shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Campaigns
        </Button>
      </div>

      {/* ── Aggregated Stats Overview ── */}
      {selectedNewsletterIds.length > 0 && (
        <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-base">Aggregated Newsletter Performance</CardTitle>
                <CardDescription className="mt-0.5">
                  Combined stats across {selectedNewsletterIds.length} newsletter{selectedNewsletterIds.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-muted">
                <Send className="h-4 w-4 text-blue-500 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Sent</p>
                  <p className="text-sm font-bold">{(aggregatedStats.totalSent || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-muted">
                <Users className="h-4 w-4 text-green-500 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Delivered</p>
                  <p className="text-sm font-bold">{(aggregatedStats.totalDelivered || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-muted">
                <Eye className="h-4 w-4 text-purple-500 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Open Rate</p>
                  <p className="text-sm font-bold">{aggregatedStats.openRate || 0}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-muted">
                <MousePointerClick className="h-4 w-4 text-orange-500 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Click Rate</p>
                  <p className="text-sm font-bold">{aggregatedStats.clickRate || 0}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-muted">
                <ArrowUpRight className="h-4 w-4 text-red-500 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Bounced</p>
                  <p className="text-sm font-bold">{(aggregatedStats.totalBounced || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-muted">
                <BarChart3 className="h-4 w-4 text-indigo-500 shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Recipients</p>
                  <p className="text-sm font-bold">{(aggregatedStats.totalRecipients || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Per-newsletter breakdown */}
            {campaignNewsletters.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Per-Newsletter Breakdown</p>
                <div className="border rounded-lg divide-y">
                  {campaignNewsletters.map((nl: any) => (
                    <div key={nl.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{nl.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{nl.subject}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                        <div className="text-center" title="Open Rate">
                          <p className="font-semibold text-foreground">{nl.stats?.openRate || 0}%</p>
                          <p>Opens</p>
                        </div>
                        <div className="text-center" title="Click Rate">
                          <p className="font-semibold text-foreground">{nl.stats?.clickRate || 0}%</p>
                          <p>Clicks</p>
                        </div>
                        <div className="text-center" title="Sent">
                          <p className="font-semibold text-foreground">{(nl.stats?.totalSent || 0).toLocaleString()}</p>
                          <p>Sent</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* ── Basic Information ── */}
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-base">{t("emailCampaigns.edit.basicInfo.title")}</CardTitle>
                  <CardDescription className="mt-0.5">{t("emailCampaigns.edit.basicInfo.description")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-5">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("emailCampaigns.edit.basicInfo.name")}</FormLabel>
                  <FormControl><Input placeholder={t("emailCampaigns.edit.basicInfo.namePlaceholder")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("emailCampaigns.edit.basicInfo.descriptionLabel")}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t("emailCampaigns.edit.basicInfo.descriptionPlaceholder")} className="min-h-[100px] resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("emailCampaigns.edit.basicInfo.type")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-campaign-type">
                          <SelectValue placeholder={t("emailCampaigns.edit.basicInfo.typePlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="email"><span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-purple-500" /> {t("emailCampaigns.edit.basicInfo.typeEmail")}</span></SelectItem>
                        <SelectItem value="sms"><span className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-orange-500" /> {t("emailCampaigns.edit.basicInfo.typeSms")}</span></SelectItem>
                        <SelectItem value="push"><span className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-indigo-500" /> {t("emailCampaigns.edit.basicInfo.typePush")}</span></SelectItem>
                        <SelectItem value="social"><span className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5 text-pink-500" /> {t("emailCampaigns.edit.basicInfo.typeSocial")}</span></SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("emailCampaigns.edit.basicInfo.status")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-campaign-status">
                          <SelectValue placeholder={t("emailCampaigns.edit.basicInfo.statusPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">{t("emailCampaigns.filters.draft")}</SelectItem>
                        <SelectItem value="active">{t("emailCampaigns.filters.active")}</SelectItem>
                        <SelectItem value="paused">{t("emailCampaigns.filters.paused")}</SelectItem>
                        <SelectItem value="completed">{t("emailCampaigns.filters.completed")}</SelectItem>
                        <SelectItem value="cancelled">{t("emailCampaigns.filters.cancelled")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* ── Newsletter Selection ── */}
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <Newspaper className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Newsletters</CardTitle>
                  <CardDescription className="mt-0.5">
                    Select newsletters to include in this campaign for aggregated analytics
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-4">
              {/* Selected newsletter badges */}
              {selectedNewsletterIds.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2">
                  {selectedNewsletterIds.map(nlId => {
                    const nl = allNewsletters.find((n: any) => n.id === nlId);
                    return nl ? (
                      <Badge key={nlId} variant="secondary" className="py-1 pl-2.5 pr-1.5 gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => toggleNewsletter(nlId)}>
                        {nl.title}
                        <X className="h-3 w-3" />
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search newsletters by title..."
                  value={newsletterSearch}
                  onChange={(e) => setNewsletterSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>

              {/* Newsletter list */}
              <div className="max-h-[300px] overflow-y-auto border rounded-lg divide-y">
                {newslettersLoading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Loading newsletters...</div>
                ) : filteredNewsletters.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {allNewsletters.length === 0 ? 'No newsletters available yet' : 'No newsletters match your search'}
                  </div>
                ) : (
                  filteredNewsletters.map((nl: any) => {
                    const isSelected = selectedNewsletterIds.includes(nl.id);
                    return (
                      <div
                        key={nl.id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
                          isSelected && "bg-purple-50/50 dark:bg-purple-900/10"
                        )}
                        onClick={() => toggleNewsletter(nl.id)}
                      >
                        <div className={cn(
                          "flex items-center justify-center h-5 w-5 rounded border-2 shrink-0 transition-colors",
                          isSelected ? "bg-purple-600 border-purple-600 text-white" : "border-gray-300 dark:border-gray-600"
                        )}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{nl.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{nl.subject}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className={`text-[10px] ${getStatusColor(nl.status)}`}>
                            {nl.status}
                          </Badge>
                          {nl.sentAt && (
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(nl.sentAt), "MMM dd")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedNewsletterIds.length} newsletter{selectedNewsletterIds.length !== 1 ? 's' : ''} selected
              </p>
            </CardContent>
          </Card>

          {/* ── Budget & Timeline ── */}
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-base">{t("emailCampaigns.edit.budget.title")}</CardTitle>
                  <CardDescription className="mt-0.5">{t("emailCampaigns.edit.budget.description")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField control={form.control} name="budget" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("emailCampaigns.edit.budget.budget")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="number" step="0.01" min="0" placeholder={t("emailCampaigns.edit.budget.budgetPlaceholder")} value={field.value ?? ""} onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)} className="pl-9" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("emailCampaigns.edit.budget.currency")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t("emailCampaigns.edit.budget.currencyPlaceholder")} /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="CAD">CAD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("emailCampaigns.edit.budget.startDate")}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>{t("emailCampaigns.edit.budget.startDatePlaceholder")}</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent selected={field.value} onSelect={field.onChange} disabled={{ before: today }} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("emailCampaigns.edit.budget.endDate")}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>{t("emailCampaigns.edit.budget.endDatePlaceholder")}</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent selected={field.value} onSelect={field.onChange} disabled={{ before: today }} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* ── Goals & Targeting ── */}
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-base">{t("emailCampaigns.edit.goals.title")}</CardTitle>
                  <CardDescription className="mt-0.5">{t("emailCampaigns.edit.goals.description")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-5">
              <div>
                <FormLabel htmlFor="goals">{t("emailCampaigns.edit.goals.goalsLabel")}</FormLabel>
                <div className="flex gap-2 mt-2">
                  <Input id="goals" placeholder={t("emailCampaigns.edit.goals.goalsPlaceholder")} value={currentGoal} onChange={(e) => setCurrentGoal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGoal(); } }} />
                  <Button type="button" onClick={addGoal} variant="outline" size="sm" className="shrink-0 h-9 px-4">
                    <Plus className="h-3.5 w-3.5 mr-1" /> {t("emailCampaigns.edit.goals.addGoal")}
                  </Button>
                </div>
                {goals.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {goals.map((goal, index) => (
                      <Badge key={`${goal}-${index}`} variant="secondary" className="py-1 pl-2.5 pr-1.5 gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => removeGoal(goal)}>
                        {goal} <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <FormField control={form.control} name="targetAudience" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("emailCampaigns.edit.goals.targetAudience")}</FormLabel>
                  <FormControl><Textarea placeholder={t("emailCampaigns.edit.goals.targetAudiencePlaceholder")} className="min-h-[80px] resize-none" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="kpis" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("emailCampaigns.edit.goals.kpis")}</FormLabel>
                  <FormControl><Textarea placeholder={t("emailCampaigns.edit.goals.kpisPlaceholder")} className="min-h-[80px] resize-none" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── Review & Approval ── */}
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <ClipboardCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <CardTitle className="text-base">{t("emailCampaigns.edit.review.title")}</CardTitle>
                  <CardDescription className="mt-0.5">{t("emailCampaigns.edit.review.description")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-5">
              <FormField control={form.control} name="requiresReviewerApproval" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/30">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">{t("emailCampaigns.edit.review.requiresApproval")}</FormLabel>
                    <FormDescription className="text-xs">{t("emailCampaigns.edit.review.requiresApprovalDescription")}</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

              {form.watch("requiresReviewerApproval") && (
                <FormField control={form.control} name="reviewerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("emailCampaigns.edit.review.selectReviewer")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={reviewersLoading ? t("emailCampaigns.edit.review.loadingReviewers") : t("emailCampaigns.edit.review.selectReviewerPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {reviewersLoading ? (
                          <SelectItem value="loading" disabled>{t("emailCampaigns.edit.review.loadingReviewers")}</SelectItem>
                        ) : reviewers.length === 0 ? (
                          <SelectItem value="no-reviewers" disabled>{t("emailCampaigns.edit.review.noReviewers")}</SelectItem>
                        ) : (
                          reviewers.map((reviewer: User) => (
                            <SelectItem key={reviewer.id} value={reviewer.id}>
                              {reviewer.firstName} {reviewer.lastName} - {reviewer.email} ({reviewer.role})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </CardContent>
          </Card>

          {/* ── Action Buttons ── */}
          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="outline" onClick={() => setLocation("/email-campaigns")} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> {t("emailCampaigns.edit.actions.cancel")}
            </Button>
            <Button type="submit" disabled={updateCampaignMutation.isPending} className="gap-1.5 min-w-[140px]" data-testid="button-save-campaign">
              {updateCampaignMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {t("emailCampaigns.edit.actions.saving")}</>
              ) : (
                <><Save className="h-4 w-4" /> {t("emailCampaigns.edit.actions.saveChanges")}</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
