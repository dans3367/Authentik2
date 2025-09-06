import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { ArrowLeft, Save, Send, Eye, Users, Tag, User, Edit, Server, CheckCircle, XCircle, Loader2, Clock } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { CustomerSegmentationModal } from "@/components/CustomerSegmentationModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { createNewsletterSchema, type CreateNewsletterData } from "@shared/schema";

export default function NewsletterCreatePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const [isSegmentationModalOpen, setIsSegmentationModalOpen] = useState(false);
  const [segmentationData, setSegmentationData] = useState({
    recipientType: 'all' as 'all' | 'selected' | 'tags',
    selectedContactIds: [] as string[],
    selectedTagIds: [] as string[],
  });

  const form = useForm<CreateNewsletterData>({
    resolver: zodResolver(createNewsletterSchema),
    defaultValues: {
      title: "",
      subject: "",
      content: "",
      status: "draft",
      recipientType: "all",
      selectedContactIds: [],
      selectedTagIds: [],
    },
  });

  // Query to check Go server health
  const { data: serverHealth, isLoading: healthLoading, error: healthError } = useQuery({
    queryKey: ['/go-server-health'],
    queryFn: async () => {
      const response = await fetch('https://tenginex.zendwise.work/health');
      if (!response.ok) throw new Error('Go server not available');
      return response.json();
    },
    refetchInterval: 10000, // Check health every 10 seconds
  });

  // Create newsletter mutation
  const createNewsletterMutation = useMutation({
    mutationFn: (data: CreateNewsletterData) => 
      apiRequest('POST', '/api/newsletters', data).then(res => res.json()),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletter-stats'] });
      toast({
        title: "Success",
        description: "Newsletter created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create newsletter",
        variant: "destructive",
      });
    },
  });

  // Send newsletter mutation
  const sendNewsletterMutation = useMutation({
    mutationFn: async (newsletterId: string) => {
      console.log('[Newsletter Frontend] Sending newsletter:', newsletterId);
      const response = await apiRequest('POST', `/api/newsletters/${newsletterId}/send`);
      const result = await response.json();
      console.log('[Newsletter Frontend] Send response:', result);
      return result;
    },
    onSuccess: (response, newsletterId) => {
      console.log('[Newsletter Frontend] Send successful:', response);
      // Invalidate all newsletter-related queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters', newsletterId] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletter-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/go-server-tracking'] });
      toast({
        title: "Newsletter Sent Successfully",
        description: `Newsletter sent to ${response.successful} recipients${response.failed > 0 ? `, ${response.failed} failed` : ''}`,
      });
      setLocation('/newsletter');
    },
    onError: (error: any) => {
      console.error('[Newsletter Frontend] Send failed:', error);
      toast({
        title: "Failed to Send Newsletter",
        description: error.message || "Failed to send newsletter",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateNewsletterData) => {
    const newsletterData = {
      ...data,
      ...segmentationData,
    };
    createNewsletterMutation.mutate(newsletterData, {
      onSuccess: () => {
        setLocation('/newsletter');
      },
    });
  };

  const handleSaveAsDraft = () => {
    const data = form.getValues();
    const newsletterData = {
      ...data,
      ...segmentationData,
      status: "draft" as const,
    };
    createNewsletterMutation.mutate(newsletterData, {
      onSuccess: () => {
        setLocation('/newsletter');
      },
    });
  };

  const handleSchedule = () => {
    const data = form.getValues();
    const newsletterData = {
      ...data,
      ...segmentationData,
      status: "scheduled" as const,
    };
    createNewsletterMutation.mutate(newsletterData, {
      onSuccess: () => {
        setLocation('/newsletter');
      },
    });
  };

  const handleSendNow = () => {
    const data = form.getValues();
    
    // Validate required fields
    if (!data.title || !data.subject || !data.content) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in title, subject, and content fields.",
      });
      return;
    }

    if (!serverHealth) {
      toast({
        variant: "destructive",
        title: "Server Unavailable",
        description: "Go server must be online to send newsletters",
      });
      return;
    }

    if (!accessToken) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "Please make sure you are logged in.",
      });
      return;
    }

    // First create the newsletter, then send it
    const newsletterData = {
      ...data,
      ...segmentationData,
      status: "draft" as const, // Create as draft first
    };
    
    console.log('[Newsletter Frontend] Creating newsletter with data:', newsletterData);
    createNewsletterMutation.mutate(newsletterData, {
      onSuccess: (response) => {
        console.log('[Newsletter Frontend] Newsletter created:', response);
        // After creating, send the newsletter
        sendNewsletterMutation.mutate(response.id);
      },
      onError: (error) => {
        console.error('[Newsletter Frontend] Failed to create newsletter:', error);
      }
    });
  };

  const handleSegmentationSave = (data: {
    recipientType: 'all' | 'selected' | 'tags';
    selectedContactIds: string[];
    selectedTagIds: string[];
  }) => {
    setSegmentationData(data);
  };

  // Query to get contact and tag counts for display
  const { data: contactsData } = useQuery({
    queryKey: ['/api/email-contacts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email-contacts');
      return response.json();
    },
  });

  const { data: tagsData } = useQuery({
    queryKey: ['/api/contact-tags'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/contact-tags');
      return response.json();
    },
  });

  const contacts = (contactsData as any)?.contacts || [];
  const tags = (tagsData as any)?.tags || [];

  const getSegmentationSummary = () => {
    switch (segmentationData.recipientType) {
      case 'all':
        return { 
          text: `All customers (${contacts.length} total)`, 
          icon: Users 
        };
      case 'selected':
        return { 
          text: `${segmentationData.selectedContactIds.length} selected customers`, 
          icon: User 
        };
      case 'tags':
        const selectedTagNames = segmentationData.selectedTagIds.map(tagId => {
          const tag = tags.find((t: any) => t.id === tagId);
          return tag?.name || 'Unknown Tag';
        });
        return { 
          text: `${segmentationData.selectedTagIds.length} selected tags${selectedTagNames.length > 0 ? ` (${selectedTagNames.join(', ')})` : ''}`, 
          icon: Tag 
        };
      default:
        return { text: 'All customers', icon: Users };
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6 max-w-6xl space-y-8">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation('/newsletter')}
                  className="self-start"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Newsletters
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Return to newsletter list</p>
              </TooltipContent>
            </Tooltip>
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">
                Create Newsletter
              </h1>
              <p className="text-muted-foreground text-lg">
                Design and send your newsletter to engage with subscribers
              </p>
            </div>
          </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Newsletter Details Card */}
            <Card className="group transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 border-border/50 hover:border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Edit className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xl font-semibold tracking-tight">Newsletter Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium">Newsletter Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter an engaging newsletter title..."
                    {...form.register("title")}
                    className="h-11"
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      {form.formState.errors.title.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-sm font-medium">Email Subject Line</Label>
                  <Input
                    id="subject"
                    placeholder="Write a compelling subject line..."
                    {...form.register("subject")}
                    className="h-11"
                  />
                  {form.formState.errors.subject && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      {form.formState.errors.subject.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This will appear as the email subject in your recipients' inboxes
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Content Card */}
            <Card className="group transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/5 border-border/50 hover:border-emerald-200/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-950/30 dark:to-emerald-950/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Edit className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xl font-semibold tracking-tight">Newsletter Content</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label htmlFor="content" className="text-sm font-medium">Newsletter Content</Label>
                  <Textarea
                    id="content"
                    placeholder="Write your newsletter content here..."
                    {...form.register("content")}
                    className="min-h-[400px] resize-none"
                  />
                  {form.formState.errors.content && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      {form.formState.errors.content.message}
                    </p>
                  )}
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border/50">
                    <Edit className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      You can use HTML tags for rich formatting in your newsletter content.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Preview Card */}
            <Card className="group transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/5 border-border/50 hover:border-purple-200/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-950/30 dark:to-purple-950/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Eye className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-lg font-semibold tracking-tight">Live Preview</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 border border-border/50 rounded-lg bg-muted/30 space-y-3">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Email Subject
                    </div>
                    <div className="text-sm font-medium line-clamp-2">
                      {form.watch("subject") || "Your subject line will appear here"}
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Content Preview
                    </div>
                    <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto leading-relaxed">
                      {form.watch("content") || "Your newsletter content will appear here as you type..."}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Segmentation Card */}
            <Card className="group transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/5 border-border/50 hover:border-blue-200/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950/30 dark:to-blue-950/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-lg font-semibold tracking-tight">Recipients</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Target Audience</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className="p-4 border border-border/50 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors group"
                        onClick={() => setIsSegmentationModalOpen(true)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {(() => {
                              const summary = getSegmentationSummary();
                              const IconComponent = summary.icon;
                              return (
                                <>
                                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <IconComponent className="h-4 w-4 text-primary" />
                                  </div>
                                  <span className="text-sm font-medium">
                                    {summary.text}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            Edit
                          </Badge>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click to modify recipient selection</p>
                    </TooltipContent>
                  </Tooltip>
                  <p className="text-xs text-muted-foreground">
                    Choose who will receive this newsletter
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Settings Card */}
            <Card className="group transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/5 border-border/50 hover:border-orange-200/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-950/30 dark:to-orange-950/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Save className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-lg font-semibold tracking-tight">Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                  <Select
                    value={form.watch("status")}
                    onValueChange={(value) => form.setValue("status", value as "draft" | "scheduled")}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Use "Send Now" button to send immediately
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduledAt" className="text-sm font-medium">Schedule Date (Optional)</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    className="h-11"
                    onChange={(e) => {
                      if (e.target.value) {
                        form.setValue("scheduledAt", new Date(e.target.value));
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Set a future date and time for scheduled sending
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Server Status */}
            <Card className="group transition-all duration-200 hover:shadow-lg hover:shadow-gray-500/5 border-border/50 hover:border-gray-200/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-950/30 dark:to-gray-950/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Server className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <span className="text-lg font-semibold tracking-tight">Email Server</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center">
                      <Server className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium">Go Server Status</span>
                  </div>
                  {healthLoading ? (
                    <Badge variant="outline" className="gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking...
                    </Badge>
                  ) : healthError ? (
                    <Badge variant="destructive" className="gap-2">
                      <XCircle className="h-3 w-3" />
                      Offline
                    </Badge>
                  ) : serverHealth ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                      <CheckCircle className="h-3 w-3" />
                      Online
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Unknown</Badge>
                  )}
                </div>
                {!serverHealth && (
                  <div className="flex items-center gap-2 p-3 mt-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive">
                      Server must be online to send newsletters
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card className="group transition-all duration-200 hover:shadow-lg hover:shadow-green-500/5 border-border/50 hover:border-green-200/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-100 to-green-50 dark:from-green-950/30 dark:to-green-950/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Send className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-lg font-semibold tracking-tight">Actions</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={handleSaveAsDraft}
                      variant="outline"
                      className="w-full h-11"
                      disabled={createNewsletterMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save as Draft
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Save newsletter without sending</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={handleSchedule}
                      variant="outline"
                      className="w-full h-11 border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950/20"
                      disabled={createNewsletterMutation.isPending}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Schedule for Later
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Schedule newsletter for future sending</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={handleSendNow}
                      className="w-full h-11 shadow-lg"
                      disabled={createNewsletterMutation.isPending || sendNewsletterMutation.isPending || !serverHealth}
                    >
                      {createNewsletterMutation.isPending || sendNewsletterMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {createNewsletterMutation.isPending ? "Creating..." : "Sending..."}
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Now
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Send newsletter immediately to recipients</p>
                  </TooltipContent>
                </Tooltip>

                {(createNewsletterMutation.isPending || sendNewsletterMutation.isPending) && (
                  <div className="flex items-center justify-center gap-3 p-4 bg-muted/50 border border-border/50 rounded-lg">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                    <p className="text-sm font-medium">
                      {createNewsletterMutation.isPending ? "Creating newsletter..." : 
                       sendNewsletterMutation.isPending ? "Sending newsletter..." : "Processing..."}
                    </p>
                  </div>
                )}

                {!serverHealth && (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                      <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      Go server must be online to send newsletters
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>

          {/* Customer Segmentation Modal */}
          <CustomerSegmentationModal
            isOpen={isSegmentationModalOpen}
            onClose={() => setIsSegmentationModalOpen(false)}
            recipientType={segmentationData.recipientType}
            selectedContactIds={segmentationData.selectedContactIds}
            selectedTagIds={segmentationData.selectedTagIds}
            onSave={handleSegmentationSave}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}