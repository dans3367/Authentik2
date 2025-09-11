import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Calendar, Megaphone, MoreVertical, Eye, Edit, Trash2, Mail, Gift, FileText, Users, TrendingUp, Target } from 'lucide-react';
import { useReduxAuth } from '@/hooks/useReduxAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Promotion {
  id: string;
  title: string;
  description: string;
  content: string;
  type: 'newsletter' | 'survey' | 'birthday' | 'announcement' | 'sale' | 'event';
  targetAudience: string;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

const promotionTypeColors = {
  newsletter: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  survey: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  birthday: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  announcement: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  sale: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  event: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
};

const promotionTypeIcons = {
  newsletter: Mail,
  survey: FileText,
  birthday: Gift,
  announcement: Megaphone,
  sale: TrendingUp,
  event: Calendar,
};

function PromotionStats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/promotion-stats'],
  });

  if (isLoading) {
    return (
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
    );
  }

  const statsData = [
    {
      title: 'Total Promotions',
      value: (stats as any)?.totalPromotions || 0,
      icon: Target,
      description: 'All promotional templates',
    },
    {
      title: 'Active Promotions',
      value: (stats as any)?.activePromotions || 0,
      icon: TrendingUp,
      description: 'Currently in use',
    },
    {
      title: 'Used This Month',
      value: (stats as any)?.monthlyUsage || 0,
      icon: Mail,
      description: 'Campaigns sent',
    },
    {
      title: 'Total Reach',
      value: (stats as any)?.totalReach || 0,
      icon: Users,
      description: 'People reached',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
      {statsData.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stat.value}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CreatePromotionDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    type: 'newsletter' as const,
    targetAudience: 'all',
    isActive: true,
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createPromotionMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('/api/promotions', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/promotion-stats'] });
      toast({
        title: "Success",
        description: "Promotion created successfully",
      });
      setOpen(false);
      setFormData({
        title: '',
        description: '',
        content: '',
        type: 'newsletter',
        targetAudience: 'all',
        isActive: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create promotion",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createPromotionMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Promotion
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Promotion</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter promotion title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newsletter">Newsletter</SelectItem>
                  <SelectItem value="survey">Survey</SelectItem>
                  <SelectItem value="birthday">Birthday</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the promotion"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter the promotional content (HTML supported)"
              rows={8}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetAudience">Target Audience</Label>
            <Select value={formData.targetAudience} onValueChange={(value) => setFormData({ ...formData, targetAudience: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contacts</SelectItem>
                <SelectItem value="subscribers">Subscribers Only</SelectItem>
                <SelectItem value="customers">Customers</SelectItem>
                <SelectItem value="prospects">Prospects</SelectItem>
                <SelectItem value="vip">VIP Customers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: !!checked })}
            />
            <Label htmlFor="isActive">Active (available for use)</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPromotionMutation.isPending}>
              {createPromotionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Promotion
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PromotionsPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: promotions, isLoading, error } = useQuery({
    queryKey: ['/api/promotions'],
  });

  const deletePromotionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/promotions/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/promotion-stats'] });
      toast({
        title: "Success",
        description: "Promotion deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete promotion",
        variant: "destructive",
      });
    },
  });

  const togglePromotionMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest(`/api/promotions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotions'] });
      toast({
        title: "Success",
        description: "Promotion status updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update promotion",
        variant: "destructive",
      });
    },
  });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Failed to load promotions. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            Promotions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage promotional content for your email campaigns
          </p>
        </div>
        <CreatePromotionDialog />
      </div>

      {/* Stats Cards */}
      <PromotionStats />

      {/* Promotions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Your Promotions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="h-5 w-1/3 bg-gray-200 rounded animate-pulse" />
                      <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
                    </div>
                    <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : promotions && promotions.length > 0 ? (
            <div className="space-y-4">
              {promotions.map((promotion: Promotion) => {
                const TypeIcon = promotionTypeIcons[promotion.type];
                return (
                  <div key={promotion.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <TypeIcon className="h-5 w-5 text-gray-500" />
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {promotion.title}
                          </h3>
                          <Badge 
                            className={promotionTypeColors[promotion.type]}
                          >
                            {promotion.type}
                          </Badge>
                          {promotion.isActive ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-600 border-gray-600">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        {promotion.description && (
                          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                            {promotion.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>Used {promotion.usageCount} times</span>
                          <span>Created {format(new Date(promotion.createdAt), 'MMM d, yyyy')}</span>
                          <span>Target: {promotion.targetAudience}</span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => togglePromotionMutation.mutate({ 
                              id: promotion.id, 
                              isActive: !promotion.isActive 
                            })}
                          >
                            {promotion.isActive ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the promotion
                                  "{promotion.title}" and remove it from all campaigns.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deletePromotionMutation.mutate(promotion.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Megaphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No promotions yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create your first promotional template to get started with email marketing campaigns.
              </p>
              <CreatePromotionDialog />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
