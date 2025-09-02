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
  MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import type { NewsletterWithUser } from "@shared/schema";

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'scheduled':
        return <Badge variant="outline">Scheduled</Badge>;
      case 'sent':
        return <Badge variant="default">Sent</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              Email Newsletters
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/30 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Total Newsletters
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.totalNewsletters}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    All campaigns
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                  <FileText className="text-white w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Draft
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.draftNewsletters}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    In progress
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-600 dark:from-gray-400 dark:to-gray-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Edit className="text-white w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-orange-200/50 dark:border-orange-700/30 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    Scheduled
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.scheduledNewsletters}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Ready to send
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-400 dark:to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Clock className="text-white w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-green-200/50 dark:border-green-700/30 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    Sent
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.sentNewsletters}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Delivered campaigns
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 dark:from-green-400 dark:to-green-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Send className="text-white w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Newsletters List */}
        {isLoading ? (
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Mail className="h-10 w-10 text-white animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Loading newsletters...
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Please wait while we fetch your newsletters.
              </p>
            </CardContent>
          </Card>
        ) : newsletters.length === 0 ? (
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
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
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg transition-all duration-300"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Newsletter
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {newsletters.map((newsletter) => (
              <Card key={newsletter.id} className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {newsletter.title}
                        </h3>
                        {getStatusBadge(newsletter.status)}
                      </div>
                      
                      <p className="text-gray-600 dark:text-gray-400 mb-3">
                        Subject: {newsletter.subject}
                      </p>
                      
                      <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                          Created {format(new Date(newsletter.createdAt || new Date()), 'MMM d, yyyy')}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-green-500 dark:text-green-400" />
                          {newsletter.opens || 0} unique opens
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                          {newsletter.recipientCount} recipients
                        </div>
                        
                        <div className="text-gray-600 dark:text-gray-300">
                          By {newsletter.user.firstName} {newsletter.user.lastName}
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
                        <DropdownMenuItem onClick={() => setLocation(`/newsletters/${newsletter.id}`)} className="hover:bg-blue-50 dark:hover:bg-blue-900/30">
                          <Eye className="h-4 w-4 mr-2 text-blue-500" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLocation(`/newsletters/${newsletter.id}/edit`)} className="hover:bg-green-50 dark:hover:bg-green-900/30">
                          <Edit className="h-4 w-4 mr-2 text-green-500" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-gray-200/50 dark:bg-gray-600/50" />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteNewsletter(newsletter.id)}
                          className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-gray-900 dark:text-gray-100">Delete Newsletter</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                Are you sure you want to delete this newsletter? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg transition-all duration-300"
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