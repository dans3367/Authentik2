import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  ArrowUpDown,
  Search,
  AlertTriangle,
  Edit,
  LayoutDashboard
} from "lucide-react";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { NewsletterWithUser } from "@shared/schema";
import type { ColumnDef } from "@tanstack/react-table";
import NewsletterWorkerProgress from "@/components/NewsletterWorkerProgress";
// Status badge helper function
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">Draft</Badge>;
    case 'scheduled':
      return <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">Scheduled</Badge>;
    case 'sent':
      return <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300">Sent</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};
// Column definitions for the newsletter table
const createColumns = (
  setLocation: (location: string) => void,
  handleDeleteNewsletter: (id: string) => void
): ColumnDef<NewsletterWithUser & { opens?: number; totalOpens?: number }>[] => [
  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-medium hover:bg-transparent"
        >
          Title
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    size: 300, // Fixed width for title column
    cell: ({ row }) => {
      const newsletter = row.original;
      return (
        <div className="space-y-1">
          <div 
            className="font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
            onClick={() => setLocation(`/newsletters/${newsletter.id}`)}
          >
            {newsletter.title}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {newsletter.subject}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => getStatusBadge(row.getValue("status")),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
    size: 120, // Fixed width for status column
  },
  {
    accessorKey: "user",
    header: "Author",
    cell: ({ row }) => {
      const user = row.getValue("user") as { firstName?: string; lastName?: string };
      const firstName = user?.firstName || '';
      const lastName = user?.lastName || '';
      const initials = (firstName[0] || '') + (lastName[0] || '');
      const displayName = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'Unknown User';
      
      return (
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
            {initials || '?'}
          </div>
          <div className="text-sm text-gray-900 dark:text-gray-100">
            {displayName}
          </div>
        </div>
      );
    },
    size: 180, // Fixed width for author column
  },
  {
    accessorKey: "recipientCount",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-medium hover:bg-transparent"
        >
          <Users className="mr-2 h-4 w-4" />
          Recipients
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="text-center font-medium">
        {row.getValue("recipientCount") || 0}
      </div>
    ),
    size: 120, // Fixed width for recipients column
  },
  {
    id: "metrics",
    header: "Engagement",
    cell: ({ row }) => {
      const newsletter = row.original;
      const openRate = (newsletter.recipientCount || 0) > 0
        ? ((newsletter.opens || 0) / (newsletter.recipientCount || 1) * 100).toFixed(1)
        : "0.0";
      return (
        <div className="space-y-2">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <Eye className="h-3 w-3 text-green-500" />
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {newsletter.opens || 0}
              </span>
              <span className="text-gray-500 dark:text-gray-400">opens</span>
            </div>
            <div className="flex items-center space-x-1">
              <MousePointer className="h-3 w-3 text-blue-500" />
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {newsletter.clickCount || 0}
              </span>
              <span className="text-gray-500 dark:text-gray-400">clicks</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {openRate}% open rate
          </div>
        </div>
      );
    },
    size: 200, // Fixed width for engagement column
  },
  {
    id: "dates",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-medium hover:bg-transparent"
        >
          <Calendar className="mr-2 h-4 w-4" />
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    accessorFn: (row) => row.sentAt || row.scheduledAt || row.createdAt,
    cell: ({ row }) => {
      const newsletter = row.original;
      const status = newsletter.status;
      if (status === 'sent' && newsletter.sentAt) {
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Sent
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {format(new Date(newsletter.sentAt), 'MMM d, yyyy HH:mm')}
            </div>
          </div>
        );
      } else if (status === 'scheduled' && newsletter.scheduledAt) {
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Scheduled
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {format(new Date(newsletter.scheduledAt), 'MMM d, yyyy HH:mm')}
            </div>
          </div>
        );
      } else {
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Created
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {format(new Date(newsletter.createdAt || new Date()), 'MMM d, yyyy HH:mm')}
            </div>
          </div>
        );
      }
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const newsletter = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLocation(`/newsletters/${newsletter.id}`)}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLocation(`/newsletters/${newsletter.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
export default function NewsletterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Email Newsletters", icon: Mail }
  ]);
  // Fetch newsletters with fresh data on each page load
  const { data: newslettersData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/newsletters'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/newsletters');
      const data = await response.json();
      // The API returns { newsletters: [...] }
      return data.newsletters || [];
    },
    staleTime: 0, // Always consider data stale to ensure fresh fetches
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retry: 2, // Retry failed requests
  });
  // Fetch newsletter stats with fresh data on each page load
  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ['/api/newsletter-stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/newsletter-stats');
      const data = await response.json();
      return data;
    },
    staleTime: 0, // Always consider data stale to ensure fresh fetches
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retry: 2, // Retry failed requests
  });
  // Process the data - newslettersData is already an array from our queryFn
  const newsletters = newslettersData || [];
  const stats = statsData || {
    totalNewsletters: 0,
    draftNewsletters: 0,
    scheduledNewsletters: 0,
    sentNewsletters: 0
  };
  const allNewsletters: (NewsletterWithUser & { opens?: number; totalOpens?: number })[] = newsletters;
  // Filter newsletters based on search query and status
  const filteredNewsletters = allNewsletters.filter((newsletter) => {
    const matchesSearch = searchQuery === "" || 
      newsletter.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      newsletter.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${newsletter.user.firstName} ${newsletter.user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || newsletter.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  // Show error state if there's an error
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
            <Button 
              onClick={() => {
                refetch();
                refetchStats();
              }}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-6 lg:space-y-8">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-72" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-[100px] bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-[60px] bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-3 w-[120px] bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Newsletter List Skeleton */}
        <Card>
          <CardHeader>
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="h-5 w-1/3 bg-gray-200 rounded" />
                      <div className="h-8 w-8 bg-gray-200 rounded" />
                    </div>
                    <div className="mt-2 h-4 w-1/4 bg-gray-200 rounded" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-3 w-3/4 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-2/3 bg-gray-200 rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 lg:p-6 space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
              Newsletters
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Create and manage email newsletters to engage with your subscribers
            </p>
          </div>
          <Button onClick={() => setLocation('/newsletter/create')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Newsletter
          </Button>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {/* Total Newsletters */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Newsletters
              </CardTitle>
              <Mail className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalNewsletters}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                All newsletter campaigns
              </p>
            </CardContent>
          </Card>

          {/* Draft Newsletters */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Drafts
              </CardTitle>
              <Edit className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.draftNewsletters}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                In progress
              </p>
            </CardContent>
          </Card>

          {/* Scheduled Newsletters */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Scheduled
              </CardTitle>
              <Clock className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.scheduledNewsletters}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pending delivery
              </p>
            </CardContent>
          </Card>

          {/* Sent Newsletters */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Sent
              </CardTitle>
              <Mail className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.sentNewsletters}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Delivered campaigns
              </p>
            </CardContent>
          </Card>
        </div>
        {/* Newsletters List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              All Newsletters
            </CardTitle>
          </CardHeader>
          <CardContent>
        {newsletters.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No newsletters yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create your first email newsletter to start engaging with your subscribers.
              </p>
              <Button onClick={() => setLocation('/newsletter/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Newsletter
              </Button>
            </div>
        ) : filteredNewsletters.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No newsletters found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Try adjusting your search or filter criteria.
              </p>
              <Button 
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
        ) : (
          <>
              {/* Desktop Table View */}
              <div className="hidden lg:block w-full">
                <DataTable
                  columns={createColumns(setLocation, () => {})}
                  data={newsletters}
                  searchKey="title"
                  searchPlaceholder="Search newsletters..."
                  showColumnVisibility={true}
                  showPagination={true}
                  pageSize={10}
                />
              </div>
              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {/* Search Input for Mobile */}
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search newsletters..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                {/* Mobile Cards */}
                {filteredNewsletters.map((newsletter) => {
                  const openRate = (newsletter.recipientCount || 0) > 0 
                    ? ((newsletter.opens || 0) / (newsletter.recipientCount || 1) * 100).toFixed(1)
                    : "0.0";
                  return (
                    <Card key={newsletter.id} className="border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow duration-200">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Header with Title and Status */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h3 
                                className="font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate"
                                onClick={() => setLocation(`/newsletters/${newsletter.id}`)}
                              >
                                {newsletter.title}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 overflow-hidden" style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'}}>
                                {newsletter.subject}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2 ml-3">
                              {getStatusBadge(newsletter.status)}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setLocation(`/newsletters/${newsletter.id}`)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          {/* Author and Date */}
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2">
                              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-medium">
                                {newsletter.user.firstName?.[0] || 'U'}{newsletter.user.lastName?.[0] || 'U'}
                              </div>
                              <span className="text-gray-600 dark:text-gray-400">
                                {newsletter.user.firstName || 'Unknown'} {newsletter.user.lastName || 'User'}
                              </span>
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">
                              {newsletter.status === 'sent' && newsletter.sentAt ? (
                                <div className="text-right">
                                  <div className="text-xs">Sent</div>
                                  <div className="text-xs">{format(new Date(newsletter.sentAt), 'MMM d, HH:mm')}</div>
                                </div>
                              ) : newsletter.status === 'scheduled' && newsletter.scheduledAt ? (
                                <div className="text-right">
                                  <div className="text-xs text-blue-600 dark:text-blue-400">Scheduled</div>
                                  <div className="text-xs">{format(new Date(newsletter.scheduledAt), 'MMM d, HH:mm')}</div>
                                </div>
                              ) : (
                                <div className="text-right">
                                  <div className="text-xs">Created</div>
                                  <div className="text-xs">{format(new Date(newsletter.createdAt || new Date()), 'MMM d, HH:mm')}</div>
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Metrics */}
                          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <div className="text-center">
                              <div className="flex items-center justify-center space-x-1 text-sm">
                                <Users className="h-3 w-3 text-gray-500" />
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {newsletter.recipientCount || 0}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">Recipients</div>
                            </div>
                            <div className="text-center">
                              <div className="flex items-center justify-center space-x-1 text-sm">
                                <Eye className="h-3 w-3 text-green-500" />
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {newsletter.opens || 0}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">Opens</div>
                            </div>
                            <div className="text-center">
                              <div className="flex items-center justify-center space-x-1 text-sm">
                                <MousePointer className="h-3 w-3 text-blue-500" />
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {newsletter.clickCount || 0}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">Clicks</div>
                            </div>
                          </div>
                          {/* Open Rate */}
                          <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                            {openRate}% open rate
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {/* Mobile Pagination */}
                {filteredNewsletters.length > 10 && (
                  <div className="flex items-center justify-center space-x-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {/* Add pagination logic */}}
                      disabled={true}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Page 1 of {Math.ceil(filteredNewsletters.length / 10)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {/* Add pagination logic */}}
                      disabled={true}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
          </>
        )}
          </CardContent>
        </Card>

        {/* Newsletter Worker Progress - Only show if there are active jobs */}
        <div className="space-y-6">
          <NewsletterWorkerProgress 
            showWorkerStats={true}
            autoRefresh={true}
            refreshInterval={3000}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
