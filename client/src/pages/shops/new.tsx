import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Store,
  ArrowLeft,
  Save,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  User,
  Building,
  Tag,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { createShopSchema, type CreateShopData } from "@shared/schema";
import { useReduxAuth } from "@/hooks/useReduxAuth";

interface Manager {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

const SHOP_CATEGORIES = [
  { value: 'retail', label: 'Retail Store' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Café' },
  { value: 'bar', label: 'Bar/Pub' },
  { value: 'grocery', label: 'Grocery Store' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'salon', label: 'Salon/Spa' },
  { value: 'gym', label: 'Gym/Fitness' },
  { value: 'service', label: 'Service Center' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'clinic', label: 'Medical Clinic' },
  { value: 'dental', label: 'Dental Office' },
  { value: 'veterinary', label: 'Veterinary' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'office', label: 'Office' },
  { value: 'showroom', label: 'Showroom' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'hotel', label: 'Hotel/Lodging' },
  { value: 'bank', label: 'Bank/Financial' },
  { value: 'education', label: 'Education/Training' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'other', label: 'Other' },
];

const DEFAULT_OPERATING_HOURS: Record<string, { open: string; close: string } | { closed: true }> = {
  monday: { open: '09:00', close: '18:00' },
  tuesday: { open: '09:00', close: '18:00' },
  wednesday: { open: '09:00', close: '18:00' },
  thursday: { open: '09:00', close: '18:00' },
  friday: { open: '09:00', close: '18:00' },
  saturday: { open: '10:00', close: '16:00' },
  sunday: { closed: true as const },
};

const FALLBACK_OPERATING_HOURS = { open: '09:00', close: '17:00' };

export default function NewShopPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading } = useReduxAuth();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  type DayHours = { open: string; close: string; closed?: boolean } | { closed: true };
  type OperatingHoursState = Record<string, DayHours>;
  const [operatingHours, setOperatingHours] = useState<OperatingHoursState>(DEFAULT_OPERATING_HOURS);

  const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Monday', short: 'Mon' },
    { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { key: 'thursday', label: 'Thursday', short: 'Thu' },
    { key: 'friday', label: 'Friday', short: 'Fri' },
    { key: 'saturday', label: 'Saturday', short: 'Sat' },
    { key: 'sunday', label: 'Sunday', short: 'Sun' },
  ];

  const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
    const hours24 = Math.floor(i / 2);
    const minutes = i % 2 === 0 ? '00' : '30';
    const value = `${hours24.toString().padStart(2, '0')}:${minutes}`;
    const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
    const ampm = hours24 < 12 ? 'AM' : 'PM';
    const label = `${hours12}:${minutes} ${ampm}`;
    return { value, label };
  });

  const formatTime12hr = (time24: string) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = hours < 12 ? 'AM' : 'PM';
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const updateDayHours = useCallback((day: string, field: 'open' | 'close', value: string) => {
    setOperatingHours(prev => {
      const dayHours = prev[day];
      if ('closed' in dayHours && dayHours.closed === true) {
        const defaultDay = DEFAULT_OPERATING_HOURS[day];
        const baseHours = ('closed' in defaultDay && defaultDay.closed === true)
          ? FALLBACK_OPERATING_HOURS
          : defaultDay as { open: string; close: string };
        return {
          ...prev,
          [day]: { open: field === 'open' ? value : baseHours.open, close: field === 'close' ? value : baseHours.close }
        };
      }
      return {
        ...prev,
        [day]: { ...dayHours, [field]: value }
      };
    });
  }, []);

  const toggleDayClosed = useCallback((day: string, closed: boolean) => {
    setOperatingHours(prev => {
      if (closed) {
        return { ...prev, [day]: { closed: true } };
      }
      const defaultDay = DEFAULT_OPERATING_HOURS[day];
      if ('closed' in defaultDay && defaultDay.closed === true) {
        return { ...prev, [day]: { open: FALLBACK_OPERATING_HOURS.open, close: FALLBACK_OPERATING_HOURS.close } };
      }
      const { open: defaultOpen, close: defaultClose } = defaultDay as { open: string; close: string };
      return { ...prev, [day]: { open: defaultOpen, close: defaultClose } };
    });
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateShopData>({
    resolver: zodResolver(createShopSchema),
    defaultValues: {
      status: 'active',
      country: 'United States',
      operatingHours: JSON.stringify(DEFAULT_OPERATING_HOURS),
      tags: [],
      managerId: undefined,
      category: undefined,
    },
  });

  const { data: managersData, isLoading: managersLoading, error: managersError } = useQuery<Manager[]>({
    queryKey: ['/api/shops/managers/list'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/shops/managers/list');
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch managers: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    enabled: !!isAuthenticated && !authLoading,
    retry: 2,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const createShopMutation = useMutation({
    mutationFn: async (data: CreateShopData) => {
      const response = await apiRequest('POST', '/api/shops', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create shop');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shops'] });
      toast({
        title: t('common.success'),
        description: t('shops.toasts.shopCreated'),
      });
      navigate('/shops');
    },
    onError: (error: any) => {
      if (error.message && error.message.includes("Shop limit reached")) {
        toast({
          title: t('shops.limitDialog.title'),
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: t('common.error'),
          description: error.message || t('shops.toasts.createError'),
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: CreateShopData) => {
    createShopMutation.mutate({
      ...data,
      tags: tags.length > 0 ? tags : undefined,
      operatingHours: JSON.stringify(operatingHours),
    });
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      const newTags = [...tags, tagInput.trim()];
      setTags(newTags);
      setValue('tags', newTags);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    setTags(newTags);
    setValue('tags', newTags);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/shops')}
            className="shrink-0 h-9 w-9 rounded-full"
            data-testid="button-back-shops"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
              {t('shops.newShop')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('shops.subtitle')}</p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5">
            <Info className="h-3.5 w-3.5" />
            <span>{t('shops.form.requiredFields') || 'Fields marked * are required'}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Basic Information */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary">
                  <Store className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">{t('shops.form.basicDetails')}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">{t('shops.subtitle')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">{t('shops.form.name')} <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder={t('shops.form.namePlaceholder')}
                    className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                    data-testid="input-shop-name"
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium">{t('shops.form.category')}</Label>
                  <Select
                    value={watch('category') || ''}
                    onValueChange={(value) => setValue('category', value, { shouldDirty: true })}
                  >
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder={t('shops.form.categoryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {SHOP_CATEGORIES.map(category => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">{t('shops.form.description')}</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder={t('shops.form.descriptionPlaceholder')}
                  rows={3}
                  className="resize-none"
                  data-testid="textarea-description"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm font-medium">{t('shops.form.status')}</Label>
                  <Select
                    value={watch('status')}
                    onValueChange={(value) => setValue('status', value as any)}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t('shops.status.active')}</SelectItem>
                      <SelectItem value="inactive">{t('shops.status.inactive')}</SelectItem>
                      <SelectItem value="maintenance">{t('shops.status.maintenance')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="managerId" className="text-sm font-medium">{t('shops.form.manager')}</Label>
                  <Select
                    value={watch('managerId') || undefined}
                    onValueChange={(value) => setValue('managerId', value)}
                    disabled={managersLoading}
                  >
                    <SelectTrigger data-testid="select-manager">
                      <SelectValue placeholder={managersLoading ? t('shops.loadingManagers') : t('shops.form.managerPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {managersLoading ? (
                        <SelectItem value="loading" disabled>
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t('shops.loadingManagers')}
                          </span>
                        </SelectItem>
                      ) : managersError ? (
                        <SelectItem value="error" disabled>
                          {t('shops.errorLoadingManagers')}
                        </SelectItem>
                      ) : managersData && managersData.length > 0 ? (
                        managersData.map(manager => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.firstName || manager.lastName
                              ? `${manager.firstName || ''} ${manager.lastName || ''}`.trim()
                              : t('users.table.noName')} ({manager.email})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-managers" disabled>
                          {t('shops.noManagersAvailable')}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {managersError && (
                    <p className="text-xs text-destructive">
                      {t('shops.failedLoadManagersHelp')}
                    </p>
                  )}
                  {!managersLoading && !managersError && managersData && managersData.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('shops.noManagersFoundHelp')}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Information */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">{t('shops.form.locationDetails')}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">{t('shops.form.addressPlaceholder') || 'Physical address of the shop'}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium">{t('shops.form.address')}</Label>
                <Input
                  id="address"
                  {...register('address')}
                  placeholder={t('shops.form.addressPlaceholder')}
                  className={errors.address ? 'border-destructive focus-visible:ring-destructive' : ''}
                  data-testid="input-address"
                />
                {errors.address && (
                  <p className="text-xs text-destructive">{errors.address.message}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium">{t('shops.form.city')}</Label>
                  <Input
                    id="city"
                    {...register('city')}
                    placeholder={t('shops.form.cityPlaceholder')}
                    className={errors.city ? 'border-destructive focus-visible:ring-destructive' : ''}
                    data-testid="input-city"
                  />
                  {errors.city && (
                    <p className="text-xs text-destructive">{errors.city.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state" className="text-sm font-medium">{t('shops.form.state')}</Label>
                  <Input
                    id="state"
                    {...register('state')}
                    placeholder={t('shops.form.statePlaceholder')}
                    data-testid="input-state"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zipCode" className="text-sm font-medium">{t('shops.form.zipCode')}</Label>
                  <Input
                    id="zipCode"
                    {...register('zipCode')}
                    placeholder={t('shops.form.zipCodePlaceholder')}
                    data-testid="input-zip"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country" className="text-sm font-medium">{t('shops.form.country')}</Label>
                <Input
                  id="country"
                  {...register('country')}
                  placeholder={t('shops.form.countryPlaceholder')}
                  data-testid="input-country"
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">{t('shops.form.contactInformation')}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">{t('shops.form.emailPlaceholder') || 'How customers can reach this shop'}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">{t('shops.form.phone')} <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      {...register('phone')}
                      placeholder={t('shops.form.phonePlaceholder')}
                      className={`pl-9 ${errors.phone ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      data-testid="input-phone"
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-xs text-destructive">{errors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">{t('shops.form.email')} <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder={t('shops.form.emailPlaceholder')}
                      className={`pl-9 ${errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      data-testid="input-email"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website" className="text-sm font-medium">{t('shops.form.website')}</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="website"
                    {...register('website')}
                    placeholder={t('shops.form.websitePlaceholder')}
                    className={`pl-9 ${errors.website ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    data-testid="input-website"
                  />
                </div>
                {errors.website && (
                  <p className="text-xs text-destructive">{errors.website.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Operating Hours */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">{t('shops.operatingHoursTitle')}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">{t('shops.operatingHoursDescription')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border divide-y">
                {DAYS_OF_WEEK.map(({ key, label, short }) => {
                  const dayHours = operatingHours[key];
                  const isClosed = 'closed' in dayHours && dayHours.closed === true;

                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 transition-colors ${
                        isClosed ? 'bg-muted/30' : ''
                      }`}
                    >
                      <div className="w-20 sm:w-28 shrink-0">
                        <span className="font-medium text-sm hidden sm:inline">{label}</span>
                        <span className="font-medium text-sm sm:hidden">{short}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={!isClosed}
                          onCheckedChange={(checked) => toggleDayClosed(key, !checked)}
                          data-testid={`switch-${key}`}
                          aria-label={t('shops.toggleDayAriaLabel', { day: label })}
                        />
                        <Badge
                          variant={isClosed ? "secondary" : "default"}
                          className={`text-[10px] px-1.5 py-0 h-5 font-normal ${
                            isClosed
                              ? ''
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/30 border-transparent'
                          }`}
                        >
                          {isClosed ? t('shops.closed') : t('shops.open')}
                        </Badge>
                      </div>
                      {!isClosed ? (
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                          <Select
                            value={'open' in dayHours ? dayHours.open : '09:00'}
                            onValueChange={(value) => updateDayHours(key, 'open', value)}
                          >
                            <SelectTrigger className="w-[110px] sm:w-32 h-8 text-xs sm:text-sm" data-testid={`input-${key}-open`} aria-label={t('shops.openingTimeAriaLabel', { day: label })}>
                              <SelectValue>
                                {formatTime12hr('open' in dayHours ? dayHours.open : '09:00')}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map(({ value, label }) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground text-xs shrink-0">to</span>
                          <Select
                            value={'close' in dayHours ? dayHours.close : '18:00'}
                            onValueChange={(value) => updateDayHours(key, 'close', value)}
                          >
                            <SelectTrigger className="w-[110px] sm:w-32 h-8 text-xs sm:text-sm" data-testid={`input-${key}-close`} aria-label={t('shops.closingTimeAriaLabel', { day: label })}>
                              <SelectValue>
                                {formatTime12hr('close' in dayHours ? dayHours.close : '18:00')}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map(({ value, label }) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="flex-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">{t('shops.form.tags')}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">{t('shops.form.tagsPlaceholder')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder={t('shops.form.addTag')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    data-testid="input-tag"
                  />
                  <Button type="button" onClick={handleAddTag} variant="secondary" size="default" data-testid="button-add-tag">
                    {t('common.add')}
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer gap-1 pr-1.5"
                        aria-label={`Remove ${tag}`}
                        onClick={() => handleRemoveTag(tag)}
                        data-testid={`tag-${tag}`}
                      >
                        {tag}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-2 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/shops')}
              className="w-full sm:w-auto"
              data-testid="button-cancel"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || createShopMutation.isPending}
              className="w-full sm:w-auto gap-2"
              data-testid="button-submit"
            >
              {createShopMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t('shops.form.createShop')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}