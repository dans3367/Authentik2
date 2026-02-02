import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Store,
  ArrowLeft,
  Edit,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  User,
  Calendar,
  Tag,
  Building,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { ShopWithManager } from "@shared/schema";

export default function ShopDetailsPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  // Fetch shop data
  const { data: shopData, isLoading } = useQuery<{ shop: ShopWithManager }>({
    queryKey: ['/api/shops', id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/shops/${id}`);
      return response.json();
    },
    enabled: !!id,
  });

  const shop = shopData?.shop;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          label: t('shops.status.active'),
          className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
        };
      case 'inactive':
        return {
          icon: <XCircle className="h-4 w-4" />,
          label: t('shops.status.inactive'),
          className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
        };
      case 'maintenance':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          label: t('shops.status.maintenance'),
          className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800'
        };
      default:
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          label: t('shops.status.active'),
          className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
        };
    }
  };

  // Convert 24hr to 12hr display format
  const formatTime12hr = (time24: string) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = hours < 12 ? 'AM' : 'PM';
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatOperatingHours = (hours?: string) => {
    if (!hours) return <span className="text-gray-400 dark:text-gray-500">{t('shops.notSpecified')}</span>;
    try {
      const parsed = JSON.parse(hours);
      if (typeof parsed === 'string') return parsed;

      // Format complex operating hours
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      return (
        <div className="space-y-2">
          {days.map(day => {
            const dayHours = parsed[day];
            if (!dayHours) return null;
            if (dayHours.closed) {
              return (
                <div key={day} className="flex justify-between text-sm">
                  <span className="capitalize font-medium text-gray-700 dark:text-gray-300">{day}</span>
                  <span className="text-gray-400 dark:text-gray-500">{t('shops.closed')}</span>
                </div>
              );
            }
            return (
              <div key={day} className="flex justify-between text-sm">
                <span className="capitalize font-medium text-gray-700 dark:text-gray-300">{day}</span>
                <span className="text-gray-600 dark:text-gray-400">{formatTime12hr(dayHours.open)} - {formatTime12hr(dayHours.close)}</span>
              </div>
            );
          })}
        </div>
      );
    } catch {
      return hours;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>

          {/* Tabs Skeleton */}
          <Skeleton className="h-10 w-72" />

          {/* Cards Skeleton */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <Store className="h-8 w-8 text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('shops.shopNotFound')}</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{t('shops.shopNotFoundDescription')}</p>
              <Button
                onClick={() => navigate('/shops')}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('shops.backToShops')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(shop.status || 'active');
  const location = [shop.city, shop.state, shop.country].filter(Boolean).join(', ');

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/shops')}
              className="h-10 w-10 rounded-lg bg-white/70 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12 ring-2 ring-gray-100 dark:ring-gray-700">
                <AvatarImage src={shop.logoUrl ?? undefined} />
                <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 text-blue-600 dark:text-blue-300">
                  <Building className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                  {shop.name}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">{shop.category || t('shops.uncategorized')}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={cn("flex items-center gap-1.5 px-3 py-1 border", statusConfig.className)}>
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
            <Link href={`/shops/${shop.id}/edit`}>
              <Button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                <Edit className="mr-2 h-4 w-4" />
                {t('shops.editShop')}
              </Button>
            </Link>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
            <TabsTrigger value="overview">{t('shops.overview')}</TabsTrigger>
            <TabsTrigger value="details">{t('shops.details')}</TabsTrigger>
            <TabsTrigger value="activity">{t('shops.activity')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Basic Information */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{t('shops.locationInformation')}</CardTitle>
                      <CardDescription>{t('shops.locationInformationDescription')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{t('shops.address')}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {shop.address || t('shops.noAddressSpecified')}<br />
                        {shop.city && <>{shop.city}{shop.state ? `, ${shop.state}` : ''} {shop.zipCode}<br /></>}
                        {shop.country}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
                    <Phone className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{t('shops.phone')}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{shop.phone || t('shops.notSpecified')}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
                    <Mail className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{t('shops.email')}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{shop.email || t('shops.notSpecified')}</p>
                    </div>
                  </div>

                  {shop.website && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
                      <Globe className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{t('shops.website')}</p>
                        <a
                          href={shop.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {shop.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{t('shops.operatingInformation')}</CardTitle>
                      <CardDescription>{t('shops.operatingInformationDescription')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-5 w-5 text-gray-400" />
                      <p className="font-medium text-gray-900 dark:text-gray-100">{t('shops.operatingHours')}</p>
                    </div>
                    <div className="pl-7">
                      {formatOperatingHours(shop.operatingHours || undefined)}
                    </div>
                  </div>

                  {shop.manager && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 text-green-600 dark:text-green-300 text-sm">
                          {shop.manager.firstName?.[0] || shop.manager.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {shop.manager.firstName || shop.manager.lastName
                            ? `${shop.manager.firstName || ''} ${shop.manager.lastName || ''}`.trim()
                            : t('shops.manager')}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{shop.manager.email}</p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {shop.manager.role}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {!shop.manager && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
                      <User className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{t('shops.manager')}</p>
                        <p className="text-sm text-gray-400 italic">{t('shops.noManagerAssigned')}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Description */}
            {shop.description && (
              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Store className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <CardTitle className="text-lg">{t('shops.description')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{shop.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Tags */}
            {shop.tags && shop.tags.length > 0 && (
              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                      <Tag className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{t('shops.tags')}</CardTitle>
                      <CardDescription>{t('shops.tagsDescription')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {shop.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        <Tag className="mr-1.5 h-3 w-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Building className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('shops.shopDetails')}</CardTitle>
                    <CardDescription>{t('shops.shopDetailsDescription')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('shops.shopId')}</p>
                    <p className="font-mono text-sm text-gray-900 dark:text-gray-100 break-all">{shop.id}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("flex items-center gap-1.5 px-2 py-0.5 border text-xs", statusConfig.className)}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('shops.created')}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {shop.createdAt && new Date(shop.createdAt).toLocaleDateString()} at {shop.createdAt && new Date(shop.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('shops.lastUpdated')}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {shop.updatedAt && new Date(shop.updatedAt).toLocaleDateString()} at {shop.updatedAt && new Date(shop.updatedAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                    <Activity className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('shops.recentActivity')}</CardTitle>
                    <CardDescription>{t('shops.recentActivityDescription')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                    <Activity className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('shops.activityTracking')}</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                    {t('shops.activityTrackingDescription')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}