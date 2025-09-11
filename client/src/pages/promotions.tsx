import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Megaphone, MoreVertical, Eye, Edit, Trash2, Mail, Gift, FileText, Users, TrendingUp, Target, Settings } from 'lucide-react';
import { useReduxAuth } from '@/hooks/useReduxAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Promotion {
  id: string;
  title: string;
  description: string;
  content: string;
  type: 'newsletter' | 'survey' | 'birthday' | 'announcement' | 'sale' | 'event';
  targetAudience: string;
  isActive: boolean;
  usageCount: number;
  maxUses?: number;
  validFrom?: string;
  validTo?: string;
  promotionalCodes?: string[];
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

function CreatePromotionButton() {
  const [, setLocation] = useLocation();

  const handleCreatePromotion = () => {
    setLocation('/promotions/create');
  };

  return (
    <Button onClick={handleCreatePromotion}>
      <Plus className="h-4 w-4 mr-2" />
      Create Promotion
    </Button>
  );
}

export default function PromotionsPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: promotionsData, isLoading, error } = useQuery({
    queryKey: ['/api/promotions'],
  });

  const promotions = (promotionsData as any)?.promotions || [];

  const deletePromotionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/promotions/${id}`);
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
      return apiRequest('PATCH', `/api/promotions/${id}`, { isActive });
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
        <CreatePromotionButton />
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
                          <span>Used {promotion.usageCount}{promotion.maxUses ? `/${promotion.maxUses}` : ''} times</span>
                          <span>Created {format(new Date(promotion.createdAt), 'MMM d, yyyy')}</span>
                          <span>Target: {promotion.targetAudience}</span>
                        </div>
                        {(promotion.validFrom || promotion.validTo || promotion.maxUses) && (
                          <div className="flex items-center gap-4 text-xs text-blue-600 dark:text-blue-400 mt-1">
                            {promotion.maxUses && (
                              <span className="flex items-center gap-1">
                                <Settings className="h-3 w-3" />
                                Max: {promotion.maxUses} uses
                              </span>
                            )}
                            {promotion.validFrom && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                From: {format(new Date(promotion.validFrom), 'MMM d, yyyy')}
                              </span>
                            )}
                            {promotion.validTo && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Until: {format(new Date(promotion.validTo), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        )}
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
              <CreatePromotionButton />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
