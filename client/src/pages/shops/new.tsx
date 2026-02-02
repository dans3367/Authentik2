import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Separator } from "@/components/ui/separator";
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
  Tag
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

// Fallback times used when reopening a day that is closed by default
const FALLBACK_OPERATING_HOURS = { open: '09:00', close: '17:00' };

export default function NewShopPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useReduxAuth();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Operating hours state
  type DayHours = { open: string; close: string; closed?: boolean } | { closed: true };
  type OperatingHoursState = Record<string, DayHours>;
  const [operatingHours, setOperatingHours] = useState<OperatingHoursState>(DEFAULT_OPERATING_HOURS);

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

  const updateDayHours = useCallback((day: string, field: 'open' | 'close', value: string) => {
    setOperatingHours(prev => {
      const dayHours = prev[day];
      if ('closed' in dayHours && dayHours.closed === true) {
        const defaultDay = DEFAULT_OPERATING_HOURS[day];
        // Use fallback times if default is closed, otherwise use default times
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
      // Use fallback times if default is closed, otherwise use default times
      if ('closed' in defaultDay && defaultDay.closed === true) {
        return { ...prev, [day]: { open: FALLBACK_OPERATING_HOURS.open, close: FALLBACK_OPERATING_HOURS.close } };
      }
      // TypeScript knows defaultDay has open/close properties here
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


  // Fetch managers
  const { data: managersData, isLoading: managersLoading, error: managersError } = useQuery<Manager[]>({
    queryKey: ['/api/shops/managers/list'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/shops/managers/list');
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch managers: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        return data;
      } catch (error) {
        throw error;
      }
    },
    enabled: !!isAuthenticated && !authLoading,
    retry: 2,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });


  // Debug function to create test managers
  const createTestManagers = async () => {
    try {
      const response = await apiRequest('POST', '/api/dev/create-test-managers');
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Test Managers Created",
          description: `Created: ${result.created.join(', ')}`,
        });
        // Refetch managers
        window.location.reload();
      } else {
        // Handle non-ok responses
        const errorText = await response.text();
        toast({
          title: "Error Creating Test Managers",
          description: `Failed to create test managers: ${response.status} ${errorText}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      // Handle caught errors
      console.error("Error creating test managers:", error);
      toast({
        title: "Error Creating Test Managers",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  // Create shop mutation
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
      toast({
        title: t('common.success'),
        description: t('shops.toasts.shopCreated'),
      });
      navigate('/shops');
    },
    onError: (error: any) => {
      // Handle shop limit errors specifically
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

  // Show loading state while authentication is being determined
  if (authLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-4">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    navigate('/auth');
    return null;
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
                <h1 className="text-3xl font-bold tracking-tight">{t('shops.newShop')}</h1>
                <p className="text-muted-foreground">{t('shops.subtitle')}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                    <Label htmlFor="status">{t('shops.form.status')}</Label>
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
                    <Label htmlFor="managerId">{t('shops.form.manager')}</Label>
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
                            Loading managers...
                          </SelectItem>
                        ) : managersError ? (
                          <SelectItem value="error" disabled>
                            Error loading managers
                          </SelectItem>
                        ) : managersData && managersData.length > 0 ? (
                          managersData.map(manager => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.firstName || manager.lastName
                                ? `${manager.firstName || ''} ${manager.lastName || ''}`.trim()
                                : 'No name'} ({manager.email})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-managers" disabled>
                            No managers available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {managersError && (
                      <p className="text-sm text-destructive">
                        Failed to load managers. Please try refreshing the page.
                      </p>
                    )}
                    {!managersLoading && !managersError && managersData && managersData.length === 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          No managers found. Only users with "Manager" or "Owner" role can be assigned to shops.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={createTestManagers}
                          data-testid="button-create-test-managers"
                        >
                          Create Test Managers
                        </Button>
                      </div>
                    )}
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
                  {t('shops.operatingHoursTitle')}
                </CardTitle>
                <CardDescription>{t('shops.operatingHoursDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {DAYS_OF_WEEK.map(({ key, label }) => {
                    const dayHours = operatingHours[key];
                    const isClosed = 'closed' in dayHours && dayHours.closed === true;

                    return (
                      <div key={key} className="flex items-center gap-4 py-2 border-b last:border-b-0">
                        <div className="w-28 font-medium text-sm">{label}</div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!isClosed}
                            onCheckedChange={(checked) => toggleDayClosed(key, !checked)}
                            data-testid={`switch-${key}`}
                            aria-label={t('shops.toggleDayAriaLabel', { day: label })}
                          />
                          <span className="text-sm text-muted-foreground w-12">
                            {isClosed ? t('shops.closed') : t('shops.open')}
                          </span>
                        </div>
                        {!isClosed && (
                          <div className="flex items-center gap-2 flex-1">
                            <Select
                              value={'open' in dayHours ? dayHours.open : '09:00'}
                              onValueChange={(value) => updateDayHours(key, 'open', value)}
                            >
                              <SelectTrigger className="w-32" data-testid={`input-${key}-open`} aria-label={t('shops.openingTimeAriaLabel', { day: label })}>
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
                            <span className="text-muted-foreground">{t('shops.timeTo')}</span>
                            <Select
                              value={'close' in dayHours ? dayHours.close : '18:00'}
                              onValueChange={(value) => updateDayHours(key, 'close', value)}
                            >
                              <SelectTrigger className="w-32" data-testid={`input-${key}-close`} aria-label={t('shops.closingTimeAriaLabel', { day: label })}>
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
                  className="w-full sm:w-auto"
                  data-testid="button-cancel"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                  data-testid="button-submit"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {t('shops.form.createShop')}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}