import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { ArrowLeft, Save, Send, Eye, Users, Tag, User, Edit, Server, CheckCircle, XCircle } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { CustomerSegmentationModal } from "@/components/CustomerSegmentationModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
      const response = await fetch('https://tenginew.zendwise.work/health');
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
        sendNewsletterMutation.mutate(response.newsletter.id);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/newsletter')}
            className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Newsletters
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
              Create Newsletter
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Design and send your newsletter to engage with subscribers
            </p>
          </div>
        </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Newsletter Details Card */}
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-gray-100 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-lg flex items-center justify-center mr-3">
                    <Eye className="h-4 w-4 text-white" />
                  </div>
                  Newsletter Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Newsletter Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter newsletter title..."
                    {...form.register("title")}
                    className="mt-1"
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.title.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="subject">Email Subject Line</Label>
                  <Input
                    id="subject"
                    placeholder="Enter email subject line..."
                    {...form.register("subject")}
                    className="mt-1"
                  />
                  {form.formState.errors.subject && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.subject.message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Content Card */}
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-gray-100 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 dark:from-green-400 dark:to-green-500 rounded-lg flex items-center justify-center mr-3">
                    <Edit className="h-4 w-4 text-white" />
                  </div>
                  Newsletter Content
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="content">Newsletter Content</Label>
                  <Textarea
                    id="content"
                    placeholder="Write your newsletter content here..."
                    {...form.register("content")}
                    className="mt-1 min-h-[400px]"
                  />
                  {form.formState.errors.content && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.content.message}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-2">
                    You can use HTML tags for formatting your newsletter content.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Preview Card */}
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-purple-200/50 dark:border-purple-700/30 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-gray-100 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500 rounded-lg flex items-center justify-center mr-3">
                    <Eye className="h-4 w-4 text-white" />
                  </div>
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border border-gray-200/50 dark:border-gray-600/50 rounded-lg bg-gray-50/70 dark:bg-gray-800/70 backdrop-blur-sm">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Subject: {form.watch("subject") || "Your subject line will appear here"}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">
                    {form.watch("content") || "Your newsletter content will appear here..."}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Segmentation Card */}
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/30 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-gray-100 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-lg flex items-center justify-center mr-3">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  Recipients
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-900 dark:text-gray-100">Target Audience</Label>
                  <div 
                    className="mt-2 p-3 border border-gray-200/50 dark:border-gray-600/50 rounded-lg bg-gray-50/70 dark:bg-gray-800/70 backdrop-blur-sm cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-700/70 transition-colors duration-200"
                    onClick={() => setIsSegmentationModalOpen(true)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const summary = getSegmentationSummary();
                          const IconComponent = summary.icon;
                          return (
                            <>
                              <IconComponent className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {summary.text}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700">
                        Click to modify
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Choose who will receive this newsletter
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Settings Card */}
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-orange-200/50 dark:border-orange-700/30 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-gray-100 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-400 dark:to-orange-500 rounded-lg flex items-center justify-center mr-3">
                    <Save className="h-4 w-4 text-white" />
                  </div>
                  Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={form.watch("status")}
                    onValueChange={(value) => form.setValue("status", value as "draft" | "scheduled")}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      {/**
                       * Do not allow selecting "Sent" directly here because it won't queue
                       * sending jobs. Use the "Send Now" button which creates then triggers send.
                       */}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="scheduledAt">Schedule Date (Optional)</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    className="mt-1"
                    onChange={(e) => {
                      if (e.target.value) {
                        form.setValue("scheduledAt", new Date(e.target.value));
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Server Status */}
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-gray-100 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-gray-600 dark:from-gray-400 dark:to-gray-500 rounded-lg flex items-center justify-center mr-3">
                    <Server className="h-4 w-4 text-white" />
                  </div>
                  Email Server
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 bg-gray-50/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Go Server:</span>
                  {healthLoading ? (
                    <Badge variant="outline" className="gap-1">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
                      Checking...
                    </Badge>
                  ) : healthError ? (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      Offline
                    </Badge>
                  ) : serverHealth ? (
                    <Badge variant="default" className="bg-green-600 gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Online
                    </Badge>
                  ) : (
                    <Badge variant="outline">Unknown</Badge>
                  )}
                </div>
                {!serverHealth && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Server must be online to send newsletters
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-green-200/50 dark:border-green-700/30 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-gray-100 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 dark:from-green-400 dark:to-green-500 rounded-lg flex items-center justify-center mr-3">
                    <Send className="h-4 w-4 text-white" />
                  </div>
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  type="button"
                  onClick={handleSaveAsDraft}
                  variant="outline"
                  className="w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 border-gray-300 dark:border-gray-600 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700/60 dark:hover:to-gray-600/60 transition-all duration-300"
                  disabled={createNewsletterMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save as Draft
                </Button>

                <Button
                  type="button"
                  onClick={handleSchedule}
                  variant="outline"
                  className="w-full bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 border-orange-300 dark:border-orange-600 hover:from-orange-100 hover:to-orange-200 dark:hover:from-orange-800/40 dark:hover:to-orange-700/40 transition-all duration-300"
                  disabled={createNewsletterMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Schedule for Later
                </Button>

                <Button
                  type="button"
                  onClick={handleSendNow}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg transition-all duration-300"
                  disabled={createNewsletterMutation.isPending || sendNewsletterMutation.isPending || !serverHealth}
                >
                  {createNewsletterMutation.isPending || sendNewsletterMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      {createNewsletterMutation.isPending ? "Creating..." : "Sending..."}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Now
                    </>
                  )}
                </Button>

                {(createNewsletterMutation.isPending || sendNewsletterMutation.isPending) && (
                  <div className="flex items-center justify-center p-2">
                    <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-lg flex items-center justify-center mr-2">
                      <div className="animate-spin rounded-full h-2 w-2 border border-white border-t-transparent"></div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {createNewsletterMutation.isPending ? "Creating newsletter..." : 
                       sendNewsletterMutation.isPending ? "Sending newsletter..." : "Processing..."}
                    </p>
                  </div>
                )}

                {!serverHealth && (
                  <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <XCircle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
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
  );
}