import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { updateShopSchema, type UpdateShopData, type ShopWithManager } from "@shared/schema";

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
  { value: 'service', label: 'Service Center' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'office', label: 'Office' },
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

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

// Generate time options in 30-minute increments
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours24 = Math.floor(i / 2);
  const minutes = i % 2 === 0 ? '00' : '30';
  const value = `${hours24.toString().padStart(2, '0')}:${minutes}`;
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  const ampm = hours24 < 12 ? 'AM' : 'PM';
  const label = `${hours12}:${minutes} ${ampm}`;
  return { value, label };
});

// Convert 24hr to 12hr display format
const formatTime12hr = (time24: string) => {
  const [hours, minutes] = time24.split(':').map(Number);
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours < 12 ? 'AM' : 'PM';
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

export default function EditShopPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  
  // Operating hours state
  type DayHours = { open: string; close: string; closed?: boolean } | { closed: true };
  type OperatingHoursState = Record<string, DayHours>;
  const [operatingHours, setOperatingHours] = useState<OperatingHoursState>(DEFAULT_OPERATING_HOURS);
  
  const updateDayHours = useCallback((day: string, field: 'open' | 'close', value: string) => {
    setOperatingHours(prev => {
      const dayHours = prev[day];
      if ('closed' in dayHours && dayHours.closed === true) {
        const defaultForDay = DEFAULT_OPERATING_HOURS[day];
        // Preserve closed=true if the default for that day is closed
        if ('closed' in defaultForDay && defaultForDay.closed === true) {
          return { ...prev, [day]: { closed: true } };
        }
        // TypeScript knows defaultForDay has open/close properties here
        const { open: defaultOpen, close: defaultClose } = defaultForDay as { open: string; close: string };
        return {
          ...prev,
          [day]: { open: field === 'open' ? value : defaultOpen, close: field === 'close' ? value : defaultClose }
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
      const defaultForDay = DEFAULT_OPERATING_HOURS[day];
      // Preserve closed=true if the default for that day is closed
      if ('closed' in defaultForDay && defaultForDay.closed === true) {
        return { ...prev, [day]: { closed: true } };
      }
      // TypeScript knows defaultForDay has open/close properties here
      const { open: defaultOpen, close: defaultClose } = defaultForDay as { open: string; close: string };
      return { ...prev, [day]: { open: defaultOpen, close: defaultClose } };
    });
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UpdateShopData>({
    resolver: zodResolver(updateShopSchema),
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      country: 'United States',
      phone: '',
      email: '',
      status: 'active',
      isActive: true,
      managerId: null,
      category: '',
    },
  });

  // Fetch shop data
  const { data: shopData, isLoading: shopLoading } = useQuery<{ shop: ShopWithManager }>({
    queryKey: ['/api/shops', id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/shops/${id}`);
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch managers
  const { data: managersData, isLoading: managersLoading } = useQuery<Manager[]>({
    queryKey: ['/api/shops/managers/list'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/shops/managers/list');
      return response.json();
    },
  });

  // Update shop mutation
  const updateShopMutation = useMutation({
    mutationFn: async (data: UpdateShopData) => {
      const response = await apiRequest('PUT', `/api/shops/${id}`, data);
      if (!response.ok) {
        throw new Error('Failed to update shop');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shops'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shops', id] });
      toast({
        title: t('common.success'),
        description: t('shops.toasts.shopUpdated'),
      });
      navigate('/shops');
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('shops.toasts.updateError'),
        variant: "destructive",
      });
    },
  });

  // Set form values when shop data is loaded
  useEffect(() => {
    if (shopData?.shop) {
      const shop = shopData.shop;
      reset({
        name: shop.name,
        description: shop.description || '',
        address: shop.address || '',
        city: shop.city || '',
        state: shop.state || '',
        zipCode: shop.zipCode || '',
        country: shop.country || 'United States',
        phone: shop.phone || '',
        email: shop.email || '',
        website: shop.website || '',
        managerId: shop.managerId || null,
        operatingHours: shop.operatingHours || '',
        status: (shop.status as 'active' | 'inactive' | 'maintenance') || 'active',
        category: shop.category || '',
        tags: shop.tags || [],
        socialMedia: shop.socialMedia || '',
        settings: shop.settings || '',
        isActive: shop.isActive ?? true,
      });
      setTags(shop.tags || []);
      
      // Parse and set operating hours
      if (shop.operatingHours) {
        try {
          const parsed = JSON.parse(shop.operatingHours);
          if (typeof parsed === 'object' && parsed !== null) {
            // Normalize and merge with defaults
            const normalizedHours = Object.keys(DEFAULT_OPERATING_HOURS).reduce((acc, day) => {
              const defaultDay = DEFAULT_OPERATING_HOURS[day];
              const parsedDay = parsed[day];
              
              // If parsed data exists for this day, use it; otherwise use default
              if (parsedDay && typeof parsedDay === 'object') {
                // Handle array format by converting to expected object shape
                if (Array.isArray(parsedDay)) {
                  // If it's an array, assume [open, close] format or use defaults
                  acc[day] = parsedDay.length >= 2 
                    ? { open: parsedDay[0], close: parsedDay[1] }
                    : defaultDay;
                } else if ('closed' in parsedDay && parsedDay.closed === true) {
                  // Preserve closed state
                  acc[day] = { closed: true };
                } else if ('open' in parsedDay && 'close' in parsedDay) {
                  // Use existing open/close values
                  acc[day] = { open: parsedDay.open, close: parsedDay.close };
                } else {
                  // Fallback to default if structure is unexpected
                  acc[day] = defaultDay;
                }
              } else {
                // Use default for missing days
                acc[day] = defaultDay;
              }
              
              return acc;
            }, {} as typeof DEFAULT_OPERATING_HOURS);
            
            setOperatingHours(normalizedHours);
          }
        } catch {
          // Keep default operating hours if parsing fails
        }
      }
    }
  }, [shopData, reset]);

  const onSubmit = (data: UpdateShopData) => {
    // Prepare submit data - ensure managerId is explicitly set (null or valid ID)
    const managerId = (!data.managerId || data.managerId === 'no-manager' || data.managerId === '') ? null : data.managerId;
    const submitData = {
      ...data,
      managerId,
      tags: tags.length > 0 ? tags : undefined,
      operatingHours: JSON.stringify(operatingHours),
      isActive: data.isActive !== undefined ? data.isActive : true,
    };

    updateShopMutation.mutate(submitData);
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

  if (shopLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <Skeleton className="h-10 w-64" />
            </div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!shopData?.shop) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="space-y-6">
            <div className="text-center py-8">
              <h2 className="text-2xl font-semibold mb-2">{t('shops.empty.noShops')}</h2>
              <p className="text-muted-foreground mb-4">{t('shops.empty.noShopsDescription')}</p>
              <Button onClick={() => navigate('/shops')} data-testid="button-back-shops">
                {t('shops.backToShops')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/shops')}
                data-testid="button-back-shops"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('shops.editShop')}</h1>
                <p className="text-muted-foreground">{t('shops.subtitle')}</p>
              </div>
            </div>
          </div>

          <form
            key={id}
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
          >
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>{t('shops.form.basicDetails')}</CardTitle>
                <CardDescription>{t('shops.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('shops.form.name')} *</Label>
                    <Input
                      id="name"
                      {...register('name')}
                      placeholder={t('shops.form.namePlaceholder')}
                      data-testid="input-shop-name"
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">{t('shops.form.category')}</Label>
                    <Select
                      value={watch('category')}
                      onValueChange={(value) => setValue('category', value)}
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
                  <Label htmlFor="description">{t('shops.form.description')}</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder={t('shops.form.descriptionPlaceholder')}
                    rows={3}
                    data-testid="textarea-description"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="status">{t('shops.form.status')} *</Label>
                    <Select
                      value={watch('status') || 'active'}
                      onValueChange={(value) => setValue('status', value as 'active' | 'inactive' | 'maintenance')}
                    >
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder={t('shops.form.statusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('shops.status.active')}</SelectItem>
                        <SelectItem value="inactive">{t('shops.status.inactive')}</SelectItem>
                        <SelectItem value="maintenance">{t('shops.status.maintenance')}</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.status && (
                      <p className="text-sm text-destructive">{errors.status.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="managerId">{t('shops.form.manager')}</Label>
                    <Select
                      key={`${managersLoading ? 'loading' : 'loaded'}-${watch('managerId')}`}
                      value={watch('managerId') || 'no-manager'}
                      onValueChange={(value) => setValue('managerId', value === 'no-manager' ? null : value, { shouldDirty: true, shouldTouch: true })}
                      disabled={managersLoading}
                    >
                      <SelectTrigger data-testid="select-manager">
                        <SelectValue placeholder={managersLoading ? t('shops.loadingManagers') : t('shops.form.managerPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no-manager">{t('shops.form.noManager')}</SelectItem>
                        {Array.isArray(managersData) && managersData.map(manager => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.firstName} {manager.lastName} ({manager.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location Information */}
            <Card>
              <CardHeader>
                <CardTitle>{t('shops.form.locationDetails')}</CardTitle>
                <CardDescription>{t('shops.form.locationDetails')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">{t('shops.form.address')}</Label>
                  <Input
                    id="address"
                    {...register('address')}
                    placeholder={t('shops.form.addressPlaceholder')}
                    data-testid="input-address"
                  />
                  {errors.address && (
                    <p className="text-sm text-destructive">{errors.address.message}</p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">{t('shops.form.city')}</Label>
                    <Input
                      id="city"
                      {...register('city')}
                      placeholder={t('shops.form.cityPlaceholder')}
                      data-testid="input-city"
                    />
                    {errors.city && (
                      <p className="text-sm text-destructive">{errors.city.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">{t('shops.form.state')}</Label>
                    <Input
                      id="state"
                      {...register('state')}
                      placeholder={t('shops.form.statePlaceholder')}
                      data-testid="input-state"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zipCode">{t('shops.form.zipCode')}</Label>
                    <Input
                      id="zipCode"
                      {...register('zipCode')}
                      placeholder={t('shops.form.zipCodePlaceholder')}
                      data-testid="input-zip"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">{t('shops.form.country')}</Label>
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
              <CardHeader>
                <CardTitle>{t('shops.form.contactInformation')}</CardTitle>
                <CardDescription>{t('shops.form.contactInformation')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('shops.form.phone')} *</Label>
                    <Input
                      id="phone"
                      {...register('phone')}
                      placeholder={t('shops.form.phonePlaceholder')}
                      data-testid="input-phone"
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive">{errors.phone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{t('shops.form.email')} *</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder={t('shops.form.emailPlaceholder')}
                      data-testid="input-email"
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">{t('shops.form.website')}</Label>
                  <Input
                    id="website"
                    {...register('website')}
                    placeholder={t('shops.form.websitePlaceholder')}
                    data-testid="input-website"
                  />
                  {errors.website && (
                    <p className="text-sm text-destructive">{errors.website.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Operating Hours */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Operating Hours
                </CardTitle>
                <CardDescription>Set the operating hours for each day of the week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {DAYS_OF_WEEK.map(({ key, label }) => {
                    const dayHours = operatingHours[key];
                    const isClosed = dayHours && 'closed' in dayHours && dayHours.closed === true;
                    
                    return (
                      <div key={key} className="flex items-center gap-4 py-2 border-b last:border-b-0">
                        <div className="w-28 font-medium text-sm">{label}</div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`${key}-switch`}
                            checked={!isClosed}
                            onCheckedChange={(checked) => toggleDayClosed(key, !checked)}
                            data-testid={`switch-${key}`}
                            aria-checked={!isClosed}
                            aria-label={`${label} open/closed toggle`}
                          />
                          <span className="text-sm text-muted-foreground w-12">
                            {isClosed ? 'Closed' : 'Open'}
                          </span>
                        </div>
                        {!isClosed && dayHours && (
                          <div className="flex items-center gap-2 flex-1">
                            <Select
                              value={'open' in dayHours ? dayHours.open : '09:00'}
                              onValueChange={(value) => updateDayHours(key, 'open', value)}
                            >
                              <SelectTrigger className="w-32" data-testid={`input-${key}-open`} id={`${key}-open`} aria-label={`${label} opening time`}>
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
                            <span className="text-muted-foreground">to</span>
                            <Select
                              value={'close' in dayHours ? dayHours.close : '18:00'}
                              onValueChange={(value) => updateDayHours(key, 'close', value)}
                            >
                              <SelectTrigger className="w-32" data-testid={`input-${key}-close`} id={`${key}-close`} aria-label={`${label} closing time`}>
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
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle>{t('shops.form.tags')}</CardTitle>
                <CardDescription>{t('shops.form.tagsPlaceholder')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder={t('shops.form.addTag')}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      data-testid="input-tag"
                    />
                    <Button type="button" onClick={handleAddTag} variant="secondary" data-testid="button-add-tag">
                      <Tag className="h-4 w-4 mr-2" />
                      {t('common.add')}
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map(tag => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => handleRemoveTag(tag)}
                          data-testid={`tag-${tag}`}
                        >
                          {tag} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <div className="flex flex-col sm:flex-row gap-4 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/shops')}
                  disabled={updateShopMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-cancel"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={updateShopMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-submit"
                >
                  {updateShopMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('shops.form.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {t('shops.form.saveChanges')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}