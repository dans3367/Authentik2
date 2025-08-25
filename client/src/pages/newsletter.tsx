import { useState, useEffect } from "react";
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
  Search,
  Filter,
  Users,
  TrendingUp,
  X,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
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

export default function NewsletterPage() {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newsletterToDelete, setNewsletterToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // Fetch newsletters with fresh data on each page load
  const { data: newslettersData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/newsletters'],
    staleTime: 0, // Always consider data stale to ensure fresh fetches
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  // Fetch newsletter stats with fresh data on each page load
  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ['/api/newsletter-stats'],
    staleTime: 0, // Always consider data stale to ensure fresh fetches
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
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

  const allNewsletters: (NewsletterWithUser & { opens?: number; totalOpens?: number })[] = (newslettersData as any)?.newsletters || [];
  
  // Filter newsletters based on search query and status
  const filteredNewsletters = allNewsletters.filter((newsletter) => {
    const matchesSearch = searchQuery === "" || 
      newsletter.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      newsletter.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${newsletter.user.firstName} ${newsletter.user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || newsletter.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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

  // Force refresh data when component mounts or location changes
  useEffect(() => {
    refetch();
    refetchStats();
  }, [location, refetch, refetchStats]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="font-medium">Draft</Badge>;
      case 'scheduled':
        return <Badge variant="warning" className="font-medium">Scheduled</Badge>;
      case 'sent':
        return <Badge variant="success" className="font-medium">Sent</Badge>;
      default:
        return <Badge variant="outline" className="font-medium">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <TooltipProvider>
        <div className="w-full">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
            {/* Header Skeleton */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-5 w-96" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-36" />
              </div>
            </div>

            {/* Search Bar Skeleton */}
            <Card className="p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Skeleton className="h-10 w-full max-w-sm" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-14" />
                </div>
              </div>
            </Card>

            {/* Stats Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-12" />
                      </div>
                      <Skeleton className="h-12 w-12 rounded-lg" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Newsletter List Skeleton */}
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-6 w-48" />
                          <Skeleton className="h-5 w-16" />
                        </div>
                        <Skeleton className="h-4 w-full max-w-md" />
                        <div className="flex items-center gap-6">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-6">
                        <Skeleton className="h-9 w-9" />
                        <Skeleton className="h-9 w-9" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="w-full">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              Email Newsletters
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
              Create and manage email campaigns to engage your subscribers
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap lg:flex-nowrap lg:justify-end">
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

        {/* Search Bar */}
        <Card className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search newsletters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-6" />
            <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline">Filter:</span>
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="h-8 px-3 text-xs"
              >
                All
              </Button>
              <Button
                variant={statusFilter === "draft" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("draft")}
                className="h-8 px-3 text-xs"
              >
                Draft
              </Button>
              <Button
                variant={statusFilter === "scheduled" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("scheduled")}
                className="h-8 px-3 text-xs"
              >
                Scheduled
              </Button>
              <Button
                variant={statusFilter === "sent" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("sent")}
                className="h-8 px-3 text-xs"
              >
                Sent
              </Button>
            </div>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Card className="group transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 border-border/50 hover:border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground/80 group-hover:text-muted-foreground transition-colors">
                    Total Newsletters
                  </p>
                  <p className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {stats.totalNewsletters}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-200 hover:shadow-lg hover:shadow-secondary/5 border-border/50 hover:border-secondary/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground/80 group-hover:text-muted-foreground transition-colors">
                    Draft
                  </p>
                  <p className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {stats.draftNewsletters}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Edit className="h-6 w-6 text-secondary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/5 border-border/50 hover:border-orange-200/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground/80 group-hover:text-muted-foreground transition-colors">
                    Scheduled
                  </p>
                  <p className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {stats.scheduledNewsletters}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-950/30 dark:to-orange-950/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group transition-all duration-200 hover:shadow-lg hover:shadow-green-500/5 border-border/50 hover:border-green-200/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground/80 group-hover:text-muted-foreground transition-colors">
                    Sent
                  </p>
                  <p className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {stats.sentNewsletters}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-100 to-green-50 dark:from-green-950/30 dark:to-green-950/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Send className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Newsletters List */}
        {isLoading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Loading newsletters...
              </h3>
              <p className="text-muted-foreground">
                Please wait while we fetch your newsletters.
              </p>
            </CardContent>
          </Card>
        ) : allNewsletters.length === 0 ? (
          <Card>
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
                size="lg"
                className="h-11 px-8"
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
          <div className="space-y-4">
            {filteredNewsletters.map((newsletter) => (
              <Card key={newsletter.id} className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 border-border/50 hover:border-primary/20 hover:bg-accent/5">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                        <h3 className="text-lg font-semibold truncate group-hover:text-primary transition-colors duration-200 sm:flex-1">
                          {newsletter.title}
                        </h3>
                        <div className="sm:flex-shrink-0">
                          {getStatusBadge(newsletter.status)}
                        </div>
                      </div>
                      
                      <p className="text-muted-foreground/90 line-clamp-2 leading-relaxed text-sm">
                        {newsletter.subject}
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-sm text-muted-foreground/80">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
                          <span className="font-medium truncate">{format(new Date(newsletter.createdAt || new Date()), 'MMM d, yyyy')}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <span className="font-medium">{newsletter.opens || 0} opens</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <span className="font-medium">{newsletter.recipientCount} recipients</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 ring-2 ring-background shadow-sm flex-shrink-0">
                            <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                              {newsletter.user.firstName?.[0]}{newsletter.user.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate">by {newsletter.user.firstName} {newsletter.user.lastName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 lg:ml-6 self-start lg:self-start pt-2 lg:pt-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setLocation(`/newsletters/${newsletter.id}`)}
                            className="h-9 w-9 opacity-60 group-hover:opacity-100 hover:bg-primary/10 hover:text-primary transition-all duration-200"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>View newsletter details</p>
                        </TooltipContent>
                      </Tooltip>
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-9 w-9 opacity-60 group-hover:opacity-100 hover:bg-accent hover:text-accent-foreground transition-all duration-200">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>More actions</p>
                          </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="w-48 shadow-lg border-border/50">
                          <DropdownMenuItem 
                            onClick={() => setLocation(`/newsletters/${newsletter.id}`)}
                            className="cursor-pointer"
                          >
                            <Eye className="h-4 w-4 mr-3" />
                            <span>View Details</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setLocation(`/newsletters/${newsletter.id}/edit`)}
                            className="cursor-pointer"
                          >
                            <Edit className="h-4 w-4 mr-3" />
                            <span>Edit Newsletter</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteNewsletter(newsletter.id)}
                            className="text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4 mr-3" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Newsletter</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this newsletter? This action cannot be undone and all associated data will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteNewsletterMutation.isPending}
              >
                {deleteNewsletterMutation.isPending ? "Deleting..." : "Delete Newsletter"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>
    </TooltipProvider>
  );
}