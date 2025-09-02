import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Plus, 
  Mail, 
  Calendar, 
  Eye, 
  Edit, 
  Trash2, 
  Send,
  Clock,
  FileText,
  MoreHorizontal,
  Filter,
  TrendingUp,
  Users,
  MousePointer,
  ArrowUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
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
  },
  {
    id: "metrics",
    header: "Engagement",
    cell: ({ row }) => {
      const newsletter = row.original;
      const openRate = newsletter.recipientCount > 0 
        ? ((newsletter.opens || 0) / newsletter.recipientCount * 100).toFixed(1)
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
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleDeleteNewsletter(newsletter.id)}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default function NewsletterPage() {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newsletterToDelete, setNewsletterToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // Fetch newsletters
  const { data: newslettersData, isLoading, error } = useQuery({
    queryKey: ['/api/newsletters'],
  });

  // Fetch newsletter stats
  const { data: statsData } = useQuery({
    queryKey: ['/api/newsletter-stats'],
  });

  // Delete newsletter mutation
  const deleteNewsletterMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest('DELETE', `/api/newsletters/${id}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletter-stats'] });
      toast({
        title: "Success",
        description: "Newsletter deleted successfully",
      });
      setShowDeleteDialog(false);
      setNewsletterToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete newsletter",
        variant: "destructive",
      });
    },
  });

  const newsletters: (NewsletterWithUser & { opens?: number; totalOpens?: number })[] = (newslettersData as any)?.newsletters || [];
  const stats = (statsData as any) || {
    totalNewsletters: 0,
    draftNewsletters: 0,
    scheduledNewsletters: 0,
    sentNewsletters: 0,
  };

  const handleDeleteNewsletter = (id: string) => {
    setNewsletterToDelete(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (newsletterToDelete) {
      deleteNewsletterMutation.mutate(newsletterToDelete);
    }
  };



  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:bg-gradient-to-br dark:from-slate-800 dark:via-slate-700 dark:to-slate-800">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                  >
                    <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Filter
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filter newsletters by status</p>
                </TooltipContent>
              </Tooltip>
              <Button 
                onClick={() => setLocation('/newsletter/create')} 
                size="sm"
                className="h-8 sm:h-9 px-3 sm:px-4 shadow-sm text-xs sm:text-sm"
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
          <Card className="bg-yellow-400 dark:bg-yellow-400 border-0 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden">
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
          <Card className="bg-slate-800 dark:bg-slate-900 border-0 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300">
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
          <Card className="bg-gray-100 dark:bg-gray-200 border-0 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300">
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
          <Card className="bg-gray-100 dark:bg-gray-200 border-0 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300">
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

        {/* Secondary Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Open Rate Analytics - Dark Card with Chart */}
          <Card className="bg-slate-800 dark:bg-slate-900 border-0 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-semibold text-white">Open Rate Analytics</h3>
                  </div>
                  <Button size="sm" variant="ghost" className="text-gray-400 hover:bg-white/10 text-xs">
                    Details
                  </Button>
                </div>
                <div>
                  <div className="text-4xl font-bold text-white">58.3%</div>
                  <div className="text-sm text-gray-400 mt-1">Average Open Rate</div>
                </div>
                <div className="h-20 flex items-end">
                  <svg viewBox="0 0 200 60" className="w-full h-full">
                    <path 
                      d="M0,50 Q50,30 100,35 T200,20" 
                      stroke="#eab308" 
                      strokeWidth="3" 
                      fill="none"
                      className="drop-shadow-sm"
                    />
                    <circle cx="180" cy="25" r="4" fill="#eab308" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Campaign Management - Light Card */}
          <Card className="bg-gray-100 dark:bg-gray-200 border-0 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-black">Campaign Management</h3>
                  <Mail className="w-5 h-5 text-black" />
                </div>
                <div className="text-center py-8">
                  <div className="w-24 h-24 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto">
                    <Send className="w-12 h-12 text-white" />
                  </div>
                </div>
                <Button className="w-full bg-yellow-400 hover:bg-yellow-500 text-black border-0 rounded-2xl font-semibold">
                  Campaign Analytics Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Newsletters List */}
        {newsletters.length === 0 ? (
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 rounded-3xl">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Mail className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No newsletters yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Get started by creating your first newsletter. You can design beautiful emails 
                to engage with your subscribers and grow your audience.
              </p>
              <Button 
                onClick={() => setLocation('/newsletter/create')}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg transition-all duration-300 rounded-2xl"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Newsletter
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 rounded-3xl">
            <CardContent className="p-6">
              <DataTable
                columns={createColumns(setLocation, handleDeleteNewsletter)}
                data={newsletters}
                searchKey="title"
                searchPlaceholder="Search newsletters..."
                showColumnVisibility={true}
                showPagination={true}
                pageSize={10}
              />
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-gray-900 dark:text-gray-100">Delete Newsletter</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                Are you sure you want to delete this newsletter? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 rounded-2xl">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg transition-all duration-300 rounded-2xl"
                disabled={deleteNewsletterMutation.isPending}
              >
                {deleteNewsletterMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
