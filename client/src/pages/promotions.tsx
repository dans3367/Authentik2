import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Megaphone, MoreVertical, Eye, Edit, Trash2, Mail, Gift, FileText, Users, TrendingUp, Target, Settings, LayoutDashboard } from 'lucide-react';
import { useReduxAuth } from '@/hooks/useReduxAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useSetBreadcrumbs } from '@/contexts/PageTitleContext';
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

const getPromotionTypeOptions = (t: any) => ({
  newsletter: t('promotionsPage.types.newsletter'),
  survey: t('promotionsPage.types.survey'),
  birthday: t('promotionsPage.types.birthday'),
  announcement: t('promotionsPage.types.announcement'),
  sale: t('promotionsPage.types.sale'),
  event: t('promotionsPage.types.event'),
});

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
  const { t } = useTranslation();
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
      title: t('promotionsPage.stats.totalPromotions'),
      value: (stats as any)?.totalPromotions || 0,
      icon: Target,
      description: t('promotionsPage.stats.allPromotionalTemplates'),
    },
    {
      title: t('promotionsPage.stats.activePromotions'),
      value: (stats as any)?.activePromotions || 0,
      icon: TrendingUp,
      description: t('promotionsPage.stats.currentlyInUse'),
    },
    {
      title: t('promotionsPage.stats.monthlyUsage'),
      value: (stats as any)?.monthlyUsage || 0,
      icon: Mail,
      description: t('promotionsPage.stats.campaignsSent'),
    },
    {
      title: t('promotionsPage.stats.totalReach'),
      value: (stats as any)?.totalReach || 0,
      icon: Users,
      description: t('promotionsPage.stats.peopleReached'),
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
  const { t } = useTranslation();

  const handleCreatePromotion = () => {
    setLocation('/promotions/create');
  };

  return (
    <Button onClick={handleCreatePromotion}>
      <Plus className="h-4 w-4 mr-2" />
      {t('promotionsPage.createPromotion')}
    </Button>
  );
}

export default function PromotionsPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: t('navigation.dashboard'), href: "/", icon: LayoutDashboard },
    { label: t('promotionsPage.title'), icon: Megaphone }
  ]);

  const { data: promotionsData, isLoading, error } = useQuery({
    queryKey: ['/api/promotions'],
  });

  const promotions = (promotionsData as any)?.promotions || [];
  const promotionTypeOptions = getPromotionTypeOptions(t);

  const deletePromotionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/promotions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/promotion-stats'] });
      toast({
        title: t('promotionsPage.toasts.success'),
        description: t('promotionsPage.toasts.promotionDeleted'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('promotionsPage.toasts.error'),
        description: error.message || t('promotionsPage.toasts.deleteError'),
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
        title: t('promotionsPage.toasts.success'),
        description: t('promotionsPage.toasts.statusUpdated'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('promotionsPage.toasts.error'),
        description: error.message || t('promotionsPage.toasts.statusError'),
        variant: "destructive",
      });
    },
  });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">{t('promotionsPage.toasts.error')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{t('promotionsPage.toasts.loadError')}</p>
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
            {t('promotionsPage.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('promotionsPage.subtitle')}
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
            {t('promotionsPage.list.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
          ) : promotions && promotions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
              {promotions.map((promotion: Promotion) => {
                const TypeIcon = promotionTypeIcons[promotion.type];
                return (
                  <Card key={promotion.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <TypeIcon className="h-5 w-5 text-gray-500" />
                            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                              {promotion.title}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={promotionTypeColors[promotion.type]}>
                              {promotionTypeOptions[promotion.type]}
                            </Badge>
                            {promotion.isActive ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                {t('promotionsPage.status.active')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-600 border-gray-600">
                                {t('promotionsPage.status.inactive')}
                              </Badge>
                            )}
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
                              {t('promotionsPage.actions.preview')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setLocation(`/promotions/${promotion.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              {t('promotionsPage.actions.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => togglePromotionMutation.mutate({ id: promotion.id, isActive: !promotion.isActive })}
                            >
                              {promotion.isActive ? t('promotionsPage.actions.deactivate') : t('promotionsPage.actions.activate')}
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t('promotionsPage.actions.delete')}
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('promotionsPage.confirmDelete.title')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('promotionsPage.confirmDelete.description', { title: promotion.title })}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('promotionsPage.confirmDelete.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deletePromotionMutation.mutate(promotion.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    {t('promotionsPage.confirmDelete.delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {promotion.description && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                          {promotion.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>{t('promotionsPage.list.used', { count: promotion.usageCount, max: promotion.maxUses ? `/${promotion.maxUses}` : '' })}</span>
                        <span>{t('promotionsPage.list.created', { date: format(new Date(promotion.createdAt), 'MMM d, yyyy') })}</span>
                        <span>{t('promotionsPage.list.target', { target: promotion.targetAudience })}</span>
                      </div>
                      {(promotion.validFrom || promotion.validTo || promotion.maxUses) && (
                        <div className="flex flex-wrap items-center gap-4 text-xs text-blue-600 dark:text-blue-400 mt-2">
                          {promotion.maxUses && (
                            <span className="flex items-center gap-1">
                              <Settings className="h-3 w-3" />
                              {t('promotionsPage.list.max', { max: promotion.maxUses })}
                            </span>
                          )}
                          {promotion.validFrom && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {t('promotionsPage.list.from', { date: format(new Date(promotion.validFrom), 'MMM d, yyyy') })}
                            </span>
                          )}
                          {promotion.validTo && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {t('promotionsPage.list.until', { date: format(new Date(promotion.validTo), 'MMM d, yyyy') })}
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Megaphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('promotionsPage.list.noPromotions')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('promotionsPage.list.noPromotionsDescription')}
              </p>
              <CreatePromotionButton />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
