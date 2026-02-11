import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { CalendarIcon, DollarSign, Target, TrendingUp } from 'lucide-react';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { createCampaignSchema, type CreateCampaignData, type User } from '@shared/schema';

export default function CreateCampaignPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [goals, setGoals] = useState<string[]>([]);
  const [currentGoal, setCurrentGoal] = useState('');

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
    },
  });

  // Fetch eligible reviewers (all users except Employee role)
  const { data: reviewersData, isLoading: reviewersLoading } = useQuery<{ managers: User[] }>({
    queryKey: ['/api/campaigns/managers'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/campaigns/managers');
      return await response.json();
    },
    staleTime: 60_000,
  });

  const reviewers = reviewersData?.managers || [];

  const createCampaignMutation = useMutation({
    mutationFn: async (data: CreateCampaignData) => {
      return apiRequest('POST', '/api/campaigns', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({
        title: 'Success',
        description: 'Campaign created successfully.',
      });
      setLocation('/email-campaigns');
    },
    onError: (error: any) => {
      console.error('Create campaign error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create campaign.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CreateCampaignData) => {
    const campaignData = {
      ...data,
      goals: goals,
    };
    createCampaignMutation.mutate(campaignData);
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addGoal();
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Create New Campaign
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Set up a new marketing campaign to reach your target audience effectively.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Define the core details of your marketing campaign.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campaign Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter campaign name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your campaign objectives and strategy"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select campaign type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="email">Email Marketing</SelectItem>
                          <SelectItem value="sms">SMS Marketing</SelectItem>
                          <SelectItem value="push">Push Notifications</SelectItem>
                          <SelectItem value="social">Social Media</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
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
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Budget and Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Budget & Timeline
              </CardTitle>
              <CardDescription>
                Set your campaign budget and schedule.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="CAD">CAD ($)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a start date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick an end date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Goals and Targeting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Goals & Targeting
              </CardTitle>
              <CardDescription>
                Define your campaign goals and target audience.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="goals">Campaign Goals</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="goals"
                    placeholder="Enter a campaign goal"
                    value={currentGoal}
                    onChange={(e) => setCurrentGoal(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                  <Button type="button" onClick={addGoal} variant="outline">
                    Add
                  </Button>
                </div>
                {goals.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {goals.map((goal, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeGoal(goal)}
                      >
                        {goal} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="targetAudience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Audience</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your target audience demographics, interests, and characteristics"
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="kpis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key Performance Indicators (KPIs)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Define success metrics and KPIs for this campaign (e.g., conversion rate, ROI, engagement rate)"
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Reviewer Approval */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Review & Approval
              </CardTitle>
              <CardDescription>
                Configure approval workflow for this campaign.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="requiresReviewerApproval"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Requires Reviewer Approval
                      </FormLabel>
                      <FormDescription>
                        This campaign will require approval from a manager before it can be activated.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {form.watch('requiresReviewerApproval') && (
                <FormField
                  control={form.control}
                  name="reviewerId"
                  render={({ field }) => (
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
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation('/email-campaigns')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createCampaignMutation.isPending}
            >
              {createCampaignMutation.isPending ? 'Creating...' : 'Create Campaign'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}