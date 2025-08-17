import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { 
  ArrowLeft,
  Mail, 
  Calendar, 
  Eye, 
  Edit, 
  Send,
  Clock,
  User,
  Users,
  TrendingUp,
  MousePointer,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Newspaper,
  Tag,
  Settings,
  Activity,
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";
import type { NewsletterWithUser, NewsletterTaskStatus } from "@shared/schema";

// Using real task status data from backend via NewsletterTaskStatus type

interface TimelineEvent {
  id: string;
  type: 'created' | 'scheduled' | 'validated' | 'sent' | 'opened' | 'clicked';
  title: string;
  description?: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error' | 'info';
  metadata?: Record<string, any>;
}

export default function NewsletterViewPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch newsletter data with auto-refresh every 10 seconds for sent newsletters
  const { data: newsletterData, isLoading } = useQuery<{ newsletter: NewsletterWithUser }>({
    queryKey: ['/api/newsletters', id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/newsletters/${id}`);
      return response.json();
    },
    enabled: !!id,
    refetchInterval: (data) => {
      // Auto-refresh every 10 seconds if newsletter is sent to get latest engagement metrics
      return data?.newsletter?.status === 'sent' ? 10000 : false;
    },
  });

  const newsletter = newsletterData?.newsletter;

  // Fetch task status data
  const { data: taskStatusData, isLoading: isTaskStatusLoading } = useQuery<{ taskStatuses: NewsletterTaskStatus[] }>({
    queryKey: ['/api/newsletters', id, 'task-status'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/newsletters/${id}/task-status`);
      return response.json();
    },
    enabled: !!id,
  });

  // Initialize tasks if they don't exist
  const initializeTasksMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/newsletters/${id}/initialize-tasks`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters', id, 'task-status'] });
    },
  });

  const taskStatuses = taskStatusData?.taskStatuses || [];

  // Initialize tasks if no task statuses exist
  if (newsletter && taskStatuses.length === 0 && !isTaskStatusLoading && !initializeTasksMutation.isPending) {
    initializeTasksMutation.mutate();
  }

  // Mock timeline events
  const mockTimelineEvents: TimelineEvent[] = [
    {
      id: '1',
      type: 'created' as const,
      title: 'Newsletter Created',
      description: `Created by ${newsletter?.user.firstName} ${newsletter?.user.lastName}`,
      timestamp: newsletter?.createdAt ? new Date(newsletter.createdAt) : new Date(),
      status: 'success' as const
    },
    ...(newsletter?.scheduledAt ? [{
      id: '2',
      type: 'scheduled' as const,
      title: 'Delivery Scheduled',
      description: `Scheduled for ${format(new Date(newsletter.scheduledAt), 'PPP p')}`,
      timestamp: newsletter.updatedAt ? new Date(newsletter.updatedAt) : new Date(),
      status: 'info' as const
    }] : []),
    ...(newsletter?.sentAt ? [{
      id: '3',
      type: 'sent' as const,
      title: 'Newsletter Sent',
      description: `Delivered to ${newsletter.recipientCount || 0} recipients`,
      timestamp: new Date(newsletter.sentAt),
      status: 'success' as const
    }] : []),
    ...(newsletter?.openCount && newsletter.openCount > 0 ? [{
      id: '4',
      type: 'opened' as const,
      title: 'First Opens Detected',
      description: `${newsletter.openCount} total opens so far`,
      timestamp: new Date(Date.now() - Math.random() * 86400000),
      status: 'success' as const
    }] : []),
    ...(newsletter?.clickCount && newsletter.clickCount > 0 ? [{
      id: '5',
      type: 'clicked' as const,
      title: 'Link Clicks Detected',
      description: `${newsletter.clickCount} total clicks recorded`,
      timestamp: new Date(Date.now() - Math.random() * 43200000),
      status: 'success' as const
    }] : [])
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Draft', variant: 'secondary' as const, icon: Edit },
      scheduled: { label: 'Scheduled', variant: 'outline' as const, icon: Clock },
      sent: { label: 'Sent', variant: 'default' as const, icon: CheckCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getTaskStatusIcon = (status: NewsletterTaskStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTimelineIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'created':
        return <Newspaper className="h-4 w-4" />;
      case 'scheduled':
        return <Calendar className="h-4 w-4" />;
      case 'sent':
        return <Send className="h-4 w-4" />;
      case 'opened':
        return <Eye className="h-4 w-4" />;
      case 'clicked':
        return <MousePointer className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getTimelineColor = (status: TimelineEvent['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!newsletter) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <Newspaper className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Newsletter not found</h2>
          <p className="text-muted-foreground mb-4">The newsletter you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/newsletter')}>
            Back to Newsletters
          </Button>
        </div>
      </div>
    );
  }

  const engagementRate = (newsletter.recipientCount || 0) > 0 
    ? (((newsletter.openCount || 0) / (newsletter.recipientCount || 1)) * 100).toFixed(1)
    : '0';

  const clickThroughRate = (newsletter.openCount || 0) > 0 
    ? (((newsletter.clickCount || 0) / (newsletter.openCount || 1)) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/newsletter')}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {newsletter.title}
              </h1>
              {getStatusBadge(newsletter.status)}
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Subject: {newsletter.subject}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {newsletter.status === 'draft' && (
            <Button 
              onClick={() => navigate(`/newsletters/${newsletter.id}/edit`)}
              variant="outline"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          <Button onClick={() => window.print()} variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Options
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Recipients
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {(newsletter.recipientCount || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Total sent to
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Users className="text-white w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Opens
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {newsletter.openCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {engagementRate}% rate
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <Eye className="text-white w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  Clicks
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {newsletter.clickCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {clickThroughRate}% CTR
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <MousePointer className="text-white w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  Performance
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {(newsletter.openCount || 0) > 0 ? 'Good' : 'Pending'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Overall rating
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="text-white w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="status">Task Status</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Newsletter Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Newspaper className="h-5 w-5" />
                  Newsletter Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Created</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {format(new Date(newsletter.createdAt || ''), 'PPP p')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Updated</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {format(new Date(newsletter.updatedAt || ''), 'PPP p')}
                    </p>
                  </div>
                  {newsletter.scheduledAt && (
                    <>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Scheduled</p>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {format(new Date(newsletter.scheduledAt), 'PPP p')}
                        </p>
                      </div>
                    </>
                  )}
                  {newsletter.sentAt && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sent</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {format(new Date(newsletter.sentAt), 'PPP p')}
                      </p>
                    </div>
                  )}
                </div>
                
                <Separator />
                
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Author</p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {newsletter.user.firstName} {newsletter.user.lastName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {newsletter.user.email}
                      </p>
                    </div>
                  </div>
                </div>

                {(newsletter.recipientType !== 'all' || newsletter.selectedContactIds?.length || newsletter.selectedTagIds?.length) && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Targeting</p>
                      <div className="space-y-2">
                        <Badge variant="outline">
                          <Tag className="h-3 w-3 mr-1" />
                          {newsletter.recipientType === 'all' ? 'All Contacts' : 
                           newsletter.recipientType === 'selected' ? 'Selected Contacts' : 'Tagged Contacts'}
                        </Badge>
                        {newsletter.selectedContactIds?.length && (
                          <p className="text-xs text-gray-500">
                            {newsletter.selectedContactIds.length} specific contacts
                          </p>
                        )}
                        {newsletter.selectedTagIds?.length && (
                          <p className="text-xs text-gray-500">
                            {newsletter.selectedTagIds.length} tag groups
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Activity Timeline
                </CardTitle>
                <CardDescription>
                  Recent events and status changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockTimelineEvents.map((event, index) => {
                    const Icon = getTimelineIcon(event.type);
                    return (
                      <div key={event.id} className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full ${getTimelineColor(event.status)} flex items-center justify-center text-white`}>
                          {Icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {event.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                            </p>
                          </div>
                          {event.description && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Newsletter Content</CardTitle>
              <CardDescription>
                Preview of the newsletter content as it appears to recipients
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Subject Line</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {newsletter.subject}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Content Preview</p>
                    <div 
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: newsletter.content }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Processing Status
              </CardTitle>
              <CardDescription>
                Real-time status of newsletter processing tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {taskStatuses.map((task: NewsletterTaskStatus) => (
                  <div key={task.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getTaskStatusIcon(task.status)}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {task.taskName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {task.details}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {task.status === 'running' ? `${task.progress}%` : 
                           task.status === 'completed' ? 'Done' :
                           task.status === 'failed' ? 'Failed' : 'Pending'}
                        </p>
                        {task.duration && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(task.duration / 1000).toFixed(1)}s
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {task.status === 'running' && task.progress && (
                      <Progress value={task.progress} className="h-2" />
                    )}
                    
                    {task.errorMessage && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-800 dark:text-red-200">
                          {task.errorMessage}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      {task.startedAt && (
                        <span>Started: {format(new Date(task.startedAt), 'HH:mm:ss')}</span>
                      )}
                      {task.completedAt && (
                        <span>Completed: {format(new Date(task.completedAt), 'HH:mm:ss')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Engagement Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Open Rate</span>
                    <span className="text-sm font-bold">{engagementRate}%</span>
                  </div>
                  <Progress value={parseFloat(engagementRate)} className="h-2" />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Click-through Rate</span>
                    <span className="text-sm font-bold">{clickThroughRate}%</span>
                  </div>
                  <Progress value={parseFloat(clickThroughRate)} className="h-2" />
                  
                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {newsletter.openCount}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Opens</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {newsletter.clickCount}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Clicks</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {newsletter.openCount === 0 && newsletter.status === 'sent' && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          No opens yet
                        </p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300">
                          It may take time for recipients to open emails
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {parseFloat(engagementRate) > 25 && (
                    <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                          Great engagement!
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300">
                          Your open rate is above industry average
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {newsletter.status === 'draft' && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          Ready to send
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Schedule or send this newsletter to start collecting analytics
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
