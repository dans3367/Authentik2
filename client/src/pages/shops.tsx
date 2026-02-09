import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Store,
  Plus,
  Search,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  User,
  MoreVertical,
  Edit,
  Eye,
  Trash,
  Power,
  Filter,
  Download,
  Building,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import type { ShopWithManager, ShopFilters } from "@shared/schema";

interface ShopStats {
  totalShops: number;
  activeShops: number;
  shopsByCategory: Record<string, number>;
}

interface ShopLimits {
  currentShops: number;
  maxShops: number | null;
  canAddShop: boolean;
  planName: string;
}

interface ShopsResponse {
  shops: ShopWithManager[];
  stats: ShopStats;
  limits: ShopLimits;
}

function getShopCategoryIcon(category?: string) {
  switch (category?.toLowerCase()) {
    case 'restaurant':
      return <Store className="h-4 w-4" />;
    case 'retail':
      return <Building className="h-4 w-4" />;
    case 'service':
      return <Globe className="h-4 w-4" />;
    default:
      return <Store className="h-4 w-4" />;
  }
}

function getStatusBadge(status: string) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-600" />,
          label: 'Active',
        };
      case 'inactive':
        return {
          icon: <XCircle className="h-4 w-4 text-red-600" />,
          label: 'Inactive',
        };
      case 'maintenance':
        return {
          icon: <AlertCircle className="h-4 w-4 text-orange-600" />,
          label: 'Maintenance',
        };
      default:
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-600" />,
          label: 'Active',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center">
            {config.icon}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Shop Card Component for mobile/tablet view
interface ShopCardProps {
  shop: ShopWithManager;
  onToggleStatus: (shopId: string, isActive: boolean) => void;
  onDelete: (shopId: string) => void;
  t: (key: string) => string;
}

function ShopCard({ shop, onToggleStatus, onDelete, t }: ShopCardProps) {
  const location = [shop.city, shop.state, shop.country].filter(Boolean).join(', ');

  return (
    <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300 overflow-hidden">
      <CardContent className="p-0">
        {/* Header with status indicator */}
        <div className="relative">
          <div className={cn(
            "absolute top-0 left-0 right-0 h-1",
            shop.status === 'active' ? "bg-green-500" :
              shop.status === 'inactive' ? "bg-red-500" :
                shop.status === 'maintenance' ? "bg-orange-500" : "bg-green-500"
          )} />
        </div>

        <div className="p-4 pt-5">
          {/* Shop Info Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Avatar className="h-12 w-12 ring-2 ring-gray-100 dark:ring-gray-700">
                  <AvatarImage src={shop.logoUrl ?? undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 text-blue-600 dark:text-blue-300">
                    {getShopCategoryIcon(shop.category || undefined)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{shop.name}</h3>
                <Badge variant="secondary" className="mt-1 text-xs">
                  {shop.category || 'Uncategorized'}
                </Badge>
              </div>
            </div>

            {/* Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('shops.table.actions')}</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href={`/shops/${shop.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    {t('shops.actions.viewShop')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/shops/${shop.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    {t('shops.actions.editShop')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onToggleStatus(shop.id, shop.status === 'active')}
                >
                  <Power className="mr-2 h-4 w-4" />
                  {shop.status === 'active' ? t('shops.status.inactive') : t('shops.status.active')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => onDelete(shop.id)}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  {t('shops.actions.deleteShop')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Status */}
          <div className="mb-4">
            {getStatusBadge(shop.status || 'active')}
          </div>

          {/* Details Grid */}
          <div className="space-y-3">
            {/* Manager */}
            <div className="flex items-center space-x-2 text-sm">
              <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-600 dark:text-gray-300 truncate">
                {shop.manager
                  ? (shop.manager.firstName || shop.manager.lastName
                    ? `${shop.manager.firstName || ''} ${shop.manager.lastName || ''}`.trim()
                    : shop.manager.email)
                  : <span className="text-gray-400 italic">{t('shops.table.noManager')}</span>
                }
              </span>
            </div>

            {/* Location */}
            {location && (
              <div className="flex items-center space-x-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-300 truncate">{location}</span>
              </div>
            )}

            {/* Contact Info */}
            {shop.phone && (
              <div className="flex items-center space-x-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-300">{shop.phone}</span>
              </div>
            )}

            {shop.email && (
              <div className="flex items-center space-x-2 text-sm">
                <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-300 truncate">{shop.email}</span>
              </div>
            )}

            {/* Created Date */}
            {shop.createdAt && (
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>{format(new Date(shop.createdAt), "MMM d, yyyy")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700/30 flex gap-2">
          <Link href={`/shops/${shop.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Eye className="mr-2 h-4 w-4" />
              {t('shops.actions.viewShop')}
            </Button>
          </Link>
          <Link href={`/shops/${shop.id}/edit`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Edit className="mr-2 h-4 w-4" />
              {t('shops.actions.editShop')}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ShopsPage() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'maintenance'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deleteShopId, setDeleteShopId] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create a ref to hold the current search params
  const searchParamsRef = useRef({
    search: searchTerm,
    status: statusFilter,
    category: categoryFilter,
  });

  // Update the ref whenever search params change
  searchParamsRef.current = {
    search: searchTerm,
    status: statusFilter,
    category: categoryFilter,
  };

  // Fetch shops data with stable query key
  const { data, isLoading, error, isFetching, refetch } = useQuery<ShopsResponse>({
    queryKey: ['/api/shops'],
    queryFn: async () => {
      console.log('🏪 [Frontend] Starting shops query...');

      const params = new URLSearchParams();
      const currentParams = searchParamsRef.current;

      console.log('🔍 [Frontend] Search parameters:', currentParams);

      if (currentParams.search) params.append('search', currentParams.search);
      if (currentParams.status !== 'all') params.append('status', currentParams.status);
      if (currentParams.category !== 'all') params.append('category', currentParams.category);

      const queryString = params.toString();
      const requestUrl = `/api/shops${queryString ? '?' + queryString : ''}`;

      console.log('🌐 [Frontend] Making API request to:', requestUrl);
      console.log('📤 [Frontend] Request details:', {
        method: 'GET',
        url: requestUrl,
        timestamp: new Date().toISOString()
      });

      try {
        const response = await apiRequest('GET', requestUrl);

        console.log('📥 [Frontend] API response received:', {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
          headers: {
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length')
          }
        });

        if (!response.ok) {
          console.error('❌ [Frontend] API request failed:', {
            status: response.status,
            statusText: response.statusText,
            url: requestUrl
          });

          // Try to get error details from response
          let errorDetails;
          try {
            errorDetails = await response.text();
            console.error('❌ [Frontend] Error response body:', errorDetails);
          } catch (parseError) {
            console.error('❌ [Frontend] Could not parse error response:', parseError);
          }

          // Preserve status code and server message for permission errors
          const err = new Error(
            response.status === 403
              ? ((() => { try { return JSON.parse(errorDetails || '{}').message; } catch { return ''; } })() || 'Insufficient permissions')
              : `Failed to fetch shops: ${response.status} ${response.statusText}`
          );
          (err as any).status = response.status;
          throw err;
        }

        const responseData = await response.json();

        console.log('✅ [Frontend] Shops data received:', {
          shopsCount: responseData.shops?.length || 0,
          hasStats: !!responseData.stats,
          hasLimits: !!responseData.limits,
          hasPagination: !!responseData.pagination,
          firstShop: responseData.shops?.[0]?.name || 'No shops'
        });

        return responseData;
      } catch (fetchError) {
        console.error('❌ [Frontend] Network or parsing error:', {
          error: fetchError,
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
          stack: fetchError instanceof Error ? fetchError.stack : undefined,
          url: requestUrl
        });
        throw fetchError;
      }
    },
  });

  // Debug logging for query state changes
  useEffect(() => {
    console.log('🔄 [Frontend] Query state changed:', {
      isLoading,
      isFetching,
      hasError: !!error,
      errorMessage: error instanceof Error ? error.message : String(error || 'No error'),
      dataReceived: !!data,
      shopsCount: data?.shops?.length || 0
    });

    if (error) {
      console.error('❌ [Frontend] Shops query error details:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }, [isLoading, isFetching, error, data]);

  // Debug modal state and limits
  useEffect(() => {
    console.log('🔧 [Frontend] Modal state changed:', {
      showLimitModal,
      limits: data?.limits,
      canAddShop: data?.limits?.canAddShop,
      currentShops: data?.limits?.currentShops,
      maxShops: data?.limits?.maxShops
    });
  }, [showLimitModal, data?.limits]);

  // Debounce search and filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('🔍 [Frontend] Triggering refetch due to parameter change:', {
        searchTerm,
        statusFilter,
        categoryFilter
      });
      refetch();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, categoryFilter, refetch]);

  // Toggle shop status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ shopId, isActive }: { shopId: string; isActive: boolean }) => {
      const response = await apiRequest('PATCH', `/api/shops/${shopId}/toggle-status`, { isActive });
      if (!response.ok) {
        throw new Error('Failed to update shop status');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all queries that start with '/api/shops'
      queryClient.invalidateQueries({ queryKey: ['/api/shops'] });
      toast({
        title: t('common.success'),
        description: data.message || t('shops.toasts.statusUpdated'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('shops.toasts.updateError'),
        variant: "destructive",
      });
    },
  });

  // Delete shop mutation
  const deleteShopMutation = useMutation({
    mutationFn: async (shopId: string) => {
      const response = await apiRequest('DELETE', `/api/shops/${shopId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shops'] });
      setDeleteShopId(null);
      toast({
        title: t('common.success'),
        description: t('shops.toasts.shopDeleted'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('shops.toasts.deleteError'),
        variant: "destructive",
      });
    },
  });

  // Define columns for the data table
  const columns: ColumnDef<ShopWithManager>[] = [
    {
      accessorKey: "shop",
      header: t('shops.table.shop').toUpperCase(),
      cell: ({ row }) => {
        const shop = row.original;
        return (
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={shop.logoUrl ?? undefined} />
                <AvatarFallback className="bg-gray-100 text-gray-600 text-sm">
                  {getShopCategoryIcon(shop.category || undefined)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div>
              <div className="font-medium text-gray-900">{shop.name}</div>
              <div className="text-sm text-gray-500">{shop.category || 'Uncategorized'}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: t('shops.table.status').toUpperCase(),
      cell: ({ row }) => {
        const status = row.getValue("status") as string || 'active';
        return getStatusBadge(status);
      },
    },
    {
      accessorKey: "manager",
      header: t('shops.table.manager').toUpperCase(),
      cell: ({ row }) => {
        const shop = row.original;
        if (!shop.manager) {
          return <span className="text-gray-400">{t('shops.table.noManager')}</span>;
        }
        return (
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-gray-900">
              {shop.manager.firstName || shop.manager.lastName
                ? `${shop.manager.firstName || ''} ${shop.manager.lastName || ''}`.trim()
                : shop.manager.email}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "location",
      header: t('shops.table.location').toUpperCase(),
      cell: ({ row }) => {
        const shop = row.original;
        const location = [shop.city, shop.state, shop.country].filter(Boolean).join(', ');
        return (
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span className="text-gray-900">{location || 'No location'}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "contact",
      header: "CONTACT",
      cell: ({ row }) => {
        const shop = row.original;
        return (
          <div className="space-y-1">
            {shop.phone && (
              <div className="flex items-center space-x-2 text-sm">
                <Phone className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">{shop.phone}</span>
              </div>
            )}
            {shop.email && (
              <div className="flex items-center space-x-2 text-sm">
                <Mail className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">{shop.email}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "CREATED",
      cell: ({ row }) => {
        const createdAt = row.getValue("createdAt");
        if (!createdAt) return null;
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center text-gray-500">
                  <Calendar className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{format(new Date(createdAt as string), "MMM d, yyyy")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      id: "actions",
      header: t('shops.table.actions').toUpperCase(),
      cell: ({ row }) => {
        const shop = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('shops.table.actions')}</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/shops/${shop.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  {t('shops.actions.viewShop')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/shops/${shop.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  {t('shops.actions.editShop')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => toggleStatusMutation.mutate({
                  shopId: shop.id,
                  isActive: shop.status !== 'active'
                })}
              >
                <Power className="mr-2 h-4 w-4" />
                {shop.status === 'active' ? t('shops.status.inactive') : t('shops.status.active')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => setDeleteShopId(shop.id)}
              >
                <Trash className="mr-2 h-4 w-4" />
                {t('shops.actions.deleteShop')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  // Filter shops based on search and filters
  const filteredShops = useMemo(() => {
    return (data?.shops || []).filter((shop: ShopWithManager) => {
      const matchesSearch = searchTerm === "" ||
        shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shop.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shop.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shop.phone?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || shop.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || shop.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [data?.shops, searchTerm, statusFilter, categoryFilter]);

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set((data?.shops || []).map(shop => shop.category).filter(Boolean));
    return Array.from(cats);
  }, [data?.shops]);

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="space-y-6">
          {/* Header */}
          {isLoading ? (
            <div className="flex items-center justify-between">
              <div className="mb-8">
                <div className="flex items-center space-x-4">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-10 w-24" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="mb-8">
                <div className="flex items-center space-x-4">
                  <Store className="text-blue-600 dark:text-blue-500 w-8 h-8" />
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                      {t('shops.title')}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {t('shops.subtitle')}
                    </p>
                  </div>
                </div>
              </div>
              {data?.limits && !data.limits.canAddShop ? (
                <Button
                  onClick={() => setShowLimitModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('shops.addShop')}
                </Button>
              ) : (
                <Link href="/shops/new">
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t('shops.addShop')}
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* Stats Cards */}
          {!isLoading && data?.stats && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">{t('shops.stats.totalShops')}</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{data.stats.totalShops}</p>
                    </div>
                    <Store className="text-blue-500 w-8 h-8" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Across all locations</p>
                </CardContent>
              </Card>
              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">{t('shops.stats.activeShops')}</p>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">{data.stats.activeShops}</p>
                    </div>
                    <CheckCircle className="text-green-500 w-8 h-8" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {data.stats.totalShops > 0
                      ? `${Math.round((data.stats.activeShops / data.stats.totalShops) * 100)}% of total shops`
                      : '0% of total shops'}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">{t('shops.filters.allCategories')}</p>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {Object.keys(data.stats.shopsByCategory).length || 0}
                      </p>
                    </div>
                    <Building className="text-purple-500 w-8 h-8" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Different shop types</p>
                </CardContent>
              </Card>
              <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600">Shop Slots</p>
                      <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {data.limits?.currentShops || 0}{data.limits?.maxShops ? `/${data.limits.maxShops}` : ''}
                      </p>
                    </div>
                    <Store className="text-orange-500 w-8 h-8" />
                  </div>
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {data.limits?.planName} {data.limits?.maxShops ? `(${data.limits.maxShops - data.limits.currentShops} remaining)` : '(Unlimited)'}
                    </p>
                    {data.limits?.maxShops && (
                      <div className="mt-3">
                        <div className="grid grid-cols-10 gap-1">
                          {Array.from({ length: Math.min(data.limits.maxShops, 50) }).map((_, index) => (
                            <div
                              key={index}
                              className={cn(
                                "w-2 h-2 rounded-sm",
                                index < data.limits.currentShops
                                  ? "bg-orange-600 dark:bg-orange-500"
                                  : "bg-gray-200 dark:bg-gray-700"
                              )}
                              title={index < data.limits.currentShops ? "Used" : "Available"}
                            />
                          ))}
                        </div>
                        {data.limits.maxShops > 50 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Showing first 50 of {data.limits.maxShops} slots
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}



          {/* Filters */}
          {!isLoading && (
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('shops.filters.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t('shops.filters.filterByStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('shops.filters.allStatuses')}</SelectItem>
                    <SelectItem value="active">{t('shops.status.active')}</SelectItem>
                    <SelectItem value="inactive">{t('shops.status.inactive')}</SelectItem>
                    <SelectItem value="maintenance">{t('shops.status.maintenance')}</SelectItem>
                  </SelectContent>
                </Select>
                {categories.length > 0 && (
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t('shops.filters.allCategories')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('shops.filters.allCategories')}</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category || 'uncategorized'}>
                          {category || 'Uncategorized'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          {/* Shops Table */}
          {isLoading ? (
            <div className="space-y-6">
              {/* Stats Cards Skeleton */}
              <div className="grid gap-4 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-8 w-12" />
                        </div>
                        <Skeleton className="h-8 w-8 rounded" />
                      </div>
                      <Skeleton className="h-3 w-24 mt-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Filters Skeleton */}
              <div className="flex items-center justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-[180px]" />
                  <Skeleton className="h-10 w-[180px]" />
                </div>
              </div>

              {/* Mobile/Tablet Card Skeleton - shown below lg breakpoint */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
                    <CardContent className="p-0">
                      <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-t" />
                      <div className="p-4 pt-5 space-y-4">
                        <div className="flex items-center space-x-3">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-5 w-20" />
                          </div>
                          <Skeleton className="h-8 w-8" />
                        </div>
                        <Skeleton className="h-5 w-16" />
                        <div className="space-y-3">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      </div>
                      <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700/30 flex gap-2">
                        <Skeleton className="h-8 flex-1" />
                        <Skeleton className="h-8 flex-1" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop Table Skeleton - shown only at lg breakpoint and above */}
              <Card className="hidden lg:block bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
                <CardContent className="p-0">
                  <div className="space-y-4 p-6">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : error ? (
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
              <CardContent className="py-8">
                {((error as any)?.status === 403 || (error instanceof Error && error.message?.startsWith('403:'))) ? (
                  <div className="text-center space-y-3">
                    <AlertCircle className="mx-auto h-10 w-10 text-orange-500" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('common.permissionDenied', 'Permission Denied')}</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm max-w-md mx-auto">
                      {error.message || t('common.permissionDeniedDescription', 'You do not have permission to access this section. Contact your administrator to request access.')}
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-gray-600 dark:text-gray-300">{t('shops.toasts.fetchError')}</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className={cn("relative transition-opacity duration-200", isFetching && "opacity-50")}>
              {isFetching && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}
              {filteredShops.length === 0 ? (
                <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
                  <CardContent className="py-8">
                    <div className="text-center">
                      <Store className="mx-auto h-12 w-12 text-blue-500 dark:text-blue-400 mb-4" />
                      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('shops.empty.noShops')}</h3>
                      <p className="text-gray-600 dark:text-gray-300 mb-4">
                        {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                          ? t('shops.empty.tryAdjusting')
                          : t('shops.empty.noShopsDescription')}
                      </p>
                      {!searchTerm && statusFilter === 'all' && categoryFilter === 'all' && (
                        <Link href="/shops/new">
                          <Button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                            <Plus className="mr-2 h-4 w-4" />
                            {t('shops.empty.createFirstShop')}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Mobile/Tablet Card Grid - shown below lg breakpoint */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
                    {filteredShops.map((shop) => (
                      <ShopCard
                        key={shop.id}
                        shop={shop}
                        onToggleStatus={(shopId, isActive) =>
                          toggleStatusMutation.mutate({ shopId, isActive })
                        }
                        onDelete={setDeleteShopId}
                        t={t}
                      />
                    ))}
                  </div>

                  {/* Desktop Table - shown only at lg breakpoint and above */}
                  <Card className="hidden lg:block bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30">
                    <CardContent className="p-0">
                      <DataTable columns={columns} data={filteredShops} showColumnVisibility={false} />
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!deleteShopId} onOpenChange={() => setDeleteShopId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('shops.deleteDialog.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('shops.deleteDialog.description', { name: '' })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('shops.deleteDialog.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteShopId && deleteShopMutation.mutate(deleteShopId)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('shops.deleteDialog.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Shop Limit Modal */}
          <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  {t('shops.limitDialog.title')}
                </DialogTitle>
                <DialogDescription>
                  {t('shops.limitDialog.description', { current: data?.limits?.currentShops, max: data?.limits?.maxShops, plan: data?.limits?.planName })}
                  {' '}{t('shops.limitDialog.upgradeMessage')}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowLimitModal(false)}
                  className="w-full sm:w-auto"
                >
                  {t('shops.limitDialog.close')}
                </Button>
                <Button
                  onClick={() => {
                    setShowLimitModal(false);
                    // TODO: Add navigation to upgrade page when available
                    toast({
                      title: t('shops.limitDialog.upgradePlan'),
                      description: t('shops.limitDialog.upgradeMessage'),
                    });
                  }}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                >
                  {t('shops.limitDialog.upgradePlan')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}