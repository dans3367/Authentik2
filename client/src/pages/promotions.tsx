import { useState, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Megaphone, MoreVertical, Eye, Edit, Trash2, Mail, Gift, FileText, Users, TrendingUp, Target, Settings, LayoutDashboard, Monitor, Smartphone } from 'lucide-react';
import { useReduxAuth } from '@/hooks/useReduxAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { useSetBreadcrumbs } from '@/contexts/PageTitleContext';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { wrapInEmailPreview } from '@/utils/email-preview-wrapper';
import { renderPromotionEmailWrapper } from '@shared/promotionTypeTheme';

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
  termsContent?: string | null;
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
              <div className="h-4 w-[100px] bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-[60px] bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-3 w-[120px] bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
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
            <stat.icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
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
  const [previewPromotion, setPreviewPromotion] = useState<Promotion | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: t('navigation.dashboard'), href: "/", icon: LayoutDashboard },
    { label: t('promotionsPage.title'), icon: Megaphone }
  ]);

  const { data: promotionsData, isLoading, error } = useQuery({
    queryKey: ['/api/promotions'],
  });

  // Fetch global email design for preview
  const { data: emailDesign } = useQuery<{
    companyName?: string;
    headerMode?: string;
    logoUrl?: string;
    logoSize?: string;
    logoAlignment?: string;
    bannerUrl?: string;
    showCompanyName?: string;
    primaryColor?: string;
    fontFamily?: string;
    headerText?: string;
    footerText?: string;
    socialLinks?: { facebook?: string; twitter?: string; instagram?: string; linkedin?: string } | string;
  }>({
    queryKey: ["/api/master-email-design"],
    queryFn: async () => {
      const response = await fetch('/api/master-email-design', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch email design');
      return response.json();
    },
  });

  const parsedSocialLinks = useMemo(() => {
    const raw = emailDesign?.socialLinks;
    if (!raw) return undefined;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return undefined; }
    }
    return raw;
  }, [emailDesign]);

  const tenantSlug: string | null = (promotionsData as any)?.tenantSlug ?? null;

  const wrappedPreviewHtml = useMemo(() => {
    if (!previewPromotion) return '';
    // Preview always shows the Terms link so admins can see the final layout and
    // click through to verify the legal page renders correctly.
    const termsUrl = tenantSlug
      ? `${window.location.origin}/p/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(previewPromotion.id)}/terms`
      : null;
    const themedBody = renderPromotionEmailWrapper({
      type: previewPromotion.type,
      title: previewPromotion.title || '',
      description: previewPromotion.description || '',
      contentHtml: previewPromotion.content || '',
      termsUrl,
    });
    return wrapInEmailPreview(themedBody, {
      companyName: emailDesign?.companyName || '',
      headerMode: emailDesign?.headerMode,
      primaryColor: emailDesign?.primaryColor,
      logoUrl: emailDesign?.logoUrl,
      logoSize: emailDesign?.logoSize,
      logoAlignment: emailDesign?.logoAlignment,
      bannerUrl: emailDesign?.bannerUrl,
      showCompanyName: emailDesign?.showCompanyName,
      headerText: emailDesign?.headerText,
      footerText: emailDesign?.footerText,
      fontFamily: emailDesign?.fontFamily,
      socialLinks: parsedSocialLinks,
    });
  }, [previewPromotion, emailDesign, parsedSocialLinks, tenantSlug]);

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
            <p className="text-gray-600 dark:text-gray-400">{t('promotionsPage.toasts.loadError')}</p>
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
                      <div className="h-5 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                    <div className="mt-2 h-4 w-1/4 bg-gray-200 dark:bg-gray-700 rounded" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
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
                            <TypeIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                              {promotion.title}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={promotionTypeColors[promotion.type]}>
                              {promotionTypeOptions[promotion.type]}
                            </Badge>
                            {promotion.isActive ? (
                              <Badge variant="outline" className="text-green-600 border-green-600 dark:text-green-400 dark:border-green-700">
                                {t('promotionsPage.status.active')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-600 border-gray-600 dark:text-gray-400 dark:border-gray-600">
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
                            <DropdownMenuItem
                              onClick={() => setPreviewPromotion(promotion)}
                            >
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
              <Megaphone className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
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

      {/* Promotion Email Preview Dialog */}
      <Dialog open={!!previewPromotion} onOpenChange={(open) => !open && setPreviewPromotion(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {t('promotionsPage.preview.title', 'Email Preview')}
            </DialogTitle>
            <DialogDescription>
              {t('promotionsPage.preview.description', 'This is how the promotion will appear in an email client.')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Preview:</span>
              <div className="flex bg-muted/50 p-1 rounded-md">
                <Button
                  variant={previewDevice === 'desktop' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setPreviewDevice('desktop')}
                  type="button"
                >
                  <Monitor className="w-3.5 h-3.5 mr-1.5" />
                  Desktop
                </Button>
                <Button
                  variant={previewDevice === 'mobile' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setPreviewDevice('mobile')}
                  type="button"
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                  Mobile
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className={`transition-all duration-300 mx-auto p-4 sm:p-6 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl ${previewDevice === 'mobile' ? 'max-w-[400px]' : 'w-full'}`}>
              <div className="shadow-2xl mx-auto rounded-lg overflow-hidden max-w-[600px] w-full border border-gray-200 dark:border-gray-700">

                {/* Browser chrome */}
                <div className="bg-gray-200 dark:bg-gray-700 px-3 py-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-600">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 bg-white dark:bg-gray-600 rounded px-2 py-0.5 text-center truncate text-gray-600 dark:text-gray-300">
                    {previewPromotion?.title || t('promotionsPage.preview.title', 'Email Preview')}
                  </div>
                </div>

                <div className="bg-white text-slate-900">
                  {/* Simulated email header */}
                  <div className="border-b bg-gray-50 p-4 text-xs sm:text-sm text-gray-500">
                    <div className="flex gap-2 mb-1">
                      <span className="font-semibold text-right w-20">{t('promotionsPage.preview.promotion', 'Promotion')}</span>
                      <span className="text-gray-900 font-semibold truncate">
                        {previewPromotion?.title}
                      </span>
                    </div>
                    <div className="flex gap-2 mb-1">
                      <span className="font-semibold text-right w-20">{t('promotionsPage.preview.type', 'Type')}</span>
                      <span className="text-gray-900 capitalize">
                        {previewPromotion?.type ? promotionTypeOptions[previewPromotion.type] : ''}
                      </span>
                    </div>
                    {previewPromotion?.description && (
                      <div className="flex gap-2">
                        <span className="font-semibold text-right w-20">{t('promotionsPage.preview.descriptionLabel', 'Description')}</span>
                        <span className="text-gray-700 line-clamp-2">
                          {previewPromotion.description}
                        </span>
                      </div>
                    )}
                  </div>

                  <iframe
                    srcDoc={wrappedPreviewHtml}
                    title="Promotion email preview"
                    sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                    className="w-full border-0"
                    style={{ minHeight: '640px', background: '#fff' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
