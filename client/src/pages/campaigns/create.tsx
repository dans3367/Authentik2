import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  CalendarIcon, DollarSign, Target, TrendingUp, Newspaper, Search,
  Plus, X, ArrowLeft, Save, Loader2, Mail, Zap, Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { createCampaignSchema, type CreateCampaignData, type User } from '@shared/schema';

function getStatusColor(status: string) {
  switch (status) {
    case 'sent': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'draft': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    case 'scheduled': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'sending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

export default function CreateCampaignPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [goals, setGoals] = useState<string[]>([]);
  const [currentGoal, setCurrentGoal] = useState('');
  const [selectedNewsletterIds, setSelectedNewsletterIds] = useState<string[]>([]);
  const [newsletterSearch, setNewsletterSearch] = useState('');

  const form = useForm<CreateCampaignData>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'email',
      status: 'draft',
      currency: 'USD',
      goals: [],
      requiresReviewerApproval: false,
      reviewerId: '',
      newsletterIds: [],
    },
  });

  // Fetch eligible reviewers
  const { data: reviewersData, isLoading: reviewersLoading } = useQuery<{ managers: User[] }>({
    queryKey: ['/api/campaigns/managers'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/campaigns/managers');
      return await response.json();
    },
    staleTime: 60_000,
  });

  // Fetch available newsletters
  const { data: newslettersData, isLoading: newslettersLoading } = useQuery<{ newsletters: any[] }>({
    queryKey: ['/api/campaigns/newsletters/available'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/campaigns/newsletters/available');
      return await response.json();
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
      form.setValue('newsletterIds', next);
      return next;
    });
  };

  const createCampaignMutation = useMutation({
    mutationFn: async (data: CreateCampaignData) => {
      return apiRequest('POST', '/api/campaigns', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns/stats/overview'] });
      toast({ title: 'Success', description: 'Campaign created successfully.' });
      setLocation('/email-campaigns');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create campaign.', variant: 'destructive' });
    },
  });

  const onSubmit = (data: CreateCampaignData) => {
    createCampaignMutation.mutate({
      ...data,
      goals,
      newsletterIds: selectedNewsletterIds,
    });
  };

  const addGoal = () => {
    if (currentGoal.trim() && !goals.includes(currentGoal.trim())) {
      const newGoals = [...goals, currentGoal.trim()];
      setGoals(newGoals);
      form.setValue('goals', newGoals);
      setCurrentGoal('');
    }
  };

  const removeGoal = (goalToRemove: string) => {
    const newGoals = goals.filter(goal => goal !== goalToRemove);
    setGoals(newGoals);
    form.setValue('goals', newGoals);
  };

  const today = new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div className="container mx-auto p-4 lg:p-6 max-w-4xl space-y-6">
      {/* ── Hero Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Create New Campaign</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Group newsletters together to track aggregated performance
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setLocation('/email-campaigns')} className="shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Campaigns
        </Button>
      </div>

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
                  <CardTitle className="text-base">Basic Information</CardTitle>
                  <CardDescription className="mt-0.5">Define the core details of your campaign</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-5">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Q1 Newsletter Blast" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe your campaign objectives and strategy" className="min-h-[100px] resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campaign Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="email"><span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-purple-500" /> Email</span></SelectItem>
                        <SelectItem value="sms"><span className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-orange-500" /> SMS</span></SelectItem>
                        <SelectItem value="push"><span className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-indigo-500" /> Push</span></SelectItem>
                        <SelectItem value="social"><span className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5 text-pink-500" /> Social</span></SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
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
              {/* Selected newsletters summary */}
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
                  <CardTitle className="text-base">Budget & Timeline</CardTitle>
                  <CardDescription className="mt-0.5">Set your campaign budget and schedule</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField control={form.control} name="budget" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="number" step="0.01" min="0" placeholder="0.00" value={field.value ?? ''} onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)} className="pl-9" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger></FormControl>
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
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                            {field.value ? format(field.value, 'PPP') : <span>Pick a start date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar selected={field.value} onSelect={field.onChange} disabled={{ before: today }} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                            {field.value ? format(field.value, 'PPP') : <span>Pick an end date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar selected={field.value} onSelect={field.onChange} disabled={{ before: today }} />
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
                  <CardTitle className="text-base">Goals & Targeting</CardTitle>
                  <CardDescription className="mt-0.5">Define your campaign goals and target audience</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-5">
              <div>
                <Label htmlFor="goals">Campaign Goals</Label>
                <div className="flex gap-2 mt-2">
                  <Input id="goals" placeholder="Enter a campaign goal" value={currentGoal} onChange={(e) => setCurrentGoal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGoal(); } }} />
                  <Button type="button" onClick={addGoal} variant="outline" size="sm" className="shrink-0 h-9 px-4">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
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
                  <FormLabel>Target Audience</FormLabel>
                  <FormControl><Textarea placeholder="Describe your target audience" className="min-h-[80px] resize-none" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="kpis" render={({ field }) => (
                <FormItem>
                  <FormLabel>Key Performance Indicators (KPIs)</FormLabel>
                  <FormControl><Textarea placeholder="Define success metrics (e.g., open rate > 30%, click rate > 5%)" className="min-h-[80px] resize-none" {...field} /></FormControl>
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
                  <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Review & Approval</CardTitle>
                  <CardDescription className="mt-0.5">Configure approval workflow for this campaign</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-5">
              <FormField control={form.control} name="requiresReviewerApproval" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/30">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">Requires Reviewer Approval</FormLabel>
                    <FormDescription className="text-xs">Campaign will need manager approval before activation</FormDescription>
                  </div>
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />

              {form.watch('requiresReviewerApproval') && (
                <FormField control={form.control} name="reviewerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Reviewer</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={reviewersLoading ? "Loading reviewers..." : "Select a reviewer"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {reviewersLoading ? (
                          <SelectItem value="loading" disabled>Loading reviewers...</SelectItem>
                        ) : reviewers.length === 0 ? (
                          <SelectItem value="no-reviewers" disabled>No reviewers available</SelectItem>
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
            <Button type="button" variant="outline" onClick={() => setLocation('/email-campaigns')} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" disabled={createCampaignMutation.isPending} className="gap-1.5 min-w-[140px]">
              {createCampaignMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
              ) : (
                <><Save className="h-4 w-4" /> Create Campaign</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}