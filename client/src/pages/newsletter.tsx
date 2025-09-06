import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Plus, 
  Mail, 
  Calendar, 
  Eye,  Send,
  Clock,
  FileText,
  MoreHorizontal,
  TrendingUp,
  Users,
  MousePointer,
  ArrowUpDown,
  Search,
  AlertTriangle,
  Edit
} from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { NewsletterWithUser } from "@shared/schema";
import type { ColumnDef } from "@tanstack/react-table";
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
      const user = row.getValue("user") as { firstName: string; lastName: string };
      return (
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <div className="text-sm text-gray-900 dark:text-gray-100">
            {user.firstName} {user.lastName}
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
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  // Fetch newsletters with fresh data on each page load
  const { data: newslettersData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/newsletters'],
    queryFn: async () => {
      console.log('Fetching newsletters...');
      const response = await apiRequest('GET', '/api/newsletters');
      const data = await response.json();
      console.log('Newsletters data:', data);
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
      console.log('Fetching newsletter stats...');
      const response = await apiRequest('GET', '/api/newsletter-stats');
      const data = await response.json();
      console.log('Stats data:', data);
      return data;
    },
    staleTime: 0, // Always consider data stale to ensure fresh fetches
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retry: 2, // Retry failed requests
  });
  // Force refresh data when component mounts or location changes
  useEffect(() => {
    // Invalidate cache and refetch fresh data
    queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
          queryClient.invalidateQueries({ queryKey: ['/api/newsletter-stats'] });
    refetch();
    refetchStats();
  }, [location, refetch, refetchStats, queryClient]);
  // Process the data - newslettersData is already an array from our queryFn
  const newsletters = newslettersData || [];
  const stats = statsData || {
    totalNewsletters: 0,
    draftNewsletters: 0,
    scheduledNewsletters: 0,
    sentNewsletters: 0
  };
  // Log data for debugging
  console.log('Processing data:', { newslettersData, statsData, newsletters, stats, isLoading, error });  const allNewsletters: (NewsletterWithUser & { opens?: number; totalOpens?: number })[] = newsletters;
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:bg-gradient-to-br dark:from-slate-800 dark:via-slate-700 dark:to-slate-800">
        <div className="container mx-auto p-6">
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-red-200/50 dark:border-red-700/30 rounded-2xl">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-red-800 dark:text-red-300">
                Error Loading Newsletters
              </h3>
              <p className="text-red-600 dark:text-red-400 mb-4">
                {error instanceof Error ? error.message : 'Failed to load newsletter data'}
              </p>
              <Button 
                onClick={() => {
                  refetch();
                  refetchStats();
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:bg-gradient-to-br dark:from-slate-800 dark:via-slate-700 dark:to-slate-800">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Header Skeleton */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-9 w-64 mb-2" />
                <Skeleton className="h-5 w-96" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-32" />
              </div>
            </div>
          </div>
          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="rounded-2xl">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-8 w-12" />
                    </div>
                    <Skeleton className="h-12 w-16" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Secondary Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="rounded-2xl">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                    <Skeleton className="h-12 w-20" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Newsletter List Skeleton */}
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Table header */}
                <div className="flex items-center justify-between">
                  <Skeleton className="h-10 w-64" />
                  <Skeleton className="h-8 w-24" />
                </div>
                {/* Table rows */}
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-700 rounded-lg">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-64" />
                      </div>
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:bg-gradient-to-br dark:from-slate-800 dark:via-slate-700 dark:to-slate-800">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                Email Newsletters
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Create and manage email campaigns to engage your subscribers
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <Button 
                onClick={() => setLocation('/newsletter/create')} 
                size="sm"
                className="h-8 sm:h-9 px-3 sm:px-4  text-xs sm:text-sm"
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Create Newsletter
              </Button>
            </div>
          </div>
        </div>
        {/* Stats Cards - Modern Style like Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Total Newsletters - Yellow Card */}
          <Card className="bg-yellow-400 dark:bg-yellow-400 border-0 rounded-2xl  transition-all duration-300 relative overflow-hidden">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-black">Total Newsletters</h3>
                  <Button size="sm" variant="ghost" className="text-black hover:bg-black/10 text-xs">
                    More
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-black">{stats.totalNewsletters}</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-black">Active Campaigns</span>
                      </div>
                      <span className="text-black font-medium">78%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                        <span className="text-black">Draft Campaigns</span>
                      </div>
                      <span className="text-black font-medium">22%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Draft Newsletters - Dark Card */}
          <Card className="bg-slate-800 dark:bg-slate-900 border-0 rounded-2xl  transition-all duration-300">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Draft Newsletters</h3>
                  <div className="text-sm text-gray-400">/ {new Date().getFullYear()}</div>
                </div>
                <div className="flex items-center justify-center h-32">
                  <div className="w-24 h-24 border-4 border-gray-600 rounded-full flex items-center justify-center relative">
                    <div className="absolute inset-0 border-4 border-blue-500 rounded-full" style={{clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)'}}></div>
                    <Edit className="w-8 h-8 text-white" />
                  </div>
                </div>
                <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white border-0 rounded-2xl">
                  <Edit className="w-4 h-4 mr-2" />
                  View Drafts ({stats.draftNewsletters})
                </Button>
              </div>
            </CardContent>
          </Card>
          {/* Scheduled Newsletters - Light Card */}
          <Card className="bg-gray-100 dark:bg-gray-200 border-0 rounded-2xl  transition-all duration-300">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-black">Scheduled</h3>
                  <Clock className="w-5 h-5 text-black" />
                </div>
                <div className="flex items-center justify-center space-x-2 py-4">
                  <div className="flex space-x-1">
                    <div className="w-8 h-8 bg-gray-300 rounded-lg flex items-center justify-center text-black text-sm font-medium">S</div>
                    <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-black text-sm font-medium">C</div>
                    <div className="w-8 h-8 bg-gray-300 rounded-lg flex items-center justify-center text-black text-sm font-medium">H</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-black">{stats.scheduledNewsletters}</div>
                  <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                    <span className="text-green-500">+5%</span>
                    <span>Ready to send</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Sent Newsletters - Light Card with Chart */}
          <Card className="bg-gray-100 dark:bg-gray-200 border-0 rounded-2xl  transition-all duration-300">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-black">Sent Campaigns</h3>
                  <div className="bg-green-500 rounded-full px-3 py-1 text-xs text-white font-medium">{stats.sentNewsletters}</div>
                </div>
                <div className="h-20 flex items-end justify-center space-x-1">
                  {[40, 60, 20, 80, 45, 90, 30, 70].map((height, index) => (
                    <div
                      key={index}
                      className={`w-6 rounded-t-lg ${index === 5 ? 'bg-yellow-400' : 'bg-gray-400'}`}
                      style={{ height: `${height}%` }}
                    ></div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Jan</span>
                  <span>Feb</span>
                  <span>Mar</span>
                  <span>Apr</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Newsletters List */}
        {newsletters.length === 0 ? (
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 rounded-2xl">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                No newsletters yet
              </h3>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
                Create your first email newsletter to start engaging with your subscribers and build meaningful connections.
              </p>
              <Button 
                onClick={() => setLocation('/newsletter/create')}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white  transition-all duration-300 rounded-2xl"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Newsletter
              </Button>
            </CardContent>
          </Card>
        ) : filteredNewsletters.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-3">
                No newsletters found
              </h3>
              <p className="text-muted-foreground mb-6">
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
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 rounded-2xl">
            <CardContent className="p-6">
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
            </CardContent>
          </Card>
        )}
        {/* Delete Confirmation Dialog */}
      </div>
    </div>
    </TooltipProvider>
  );
}
