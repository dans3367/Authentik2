import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, Megaphone, Save, Upload, Wand2, Code, Copy, Check, Trash2, Mail, FileText, Gift, TrendingUp, Calendar, Eye, LayoutDashboard, AlertCircle, Ticket, ScrollText } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { generatePromotionalCodes, parseUserCodes, validatePromotionalCodes, formatCodesForDisplay, CODE_GENERATION_PRESETS, type CodeFormat } from '@/utils/codeGeneration';
import { getPromotionTypeTheme } from '@shared/promotionTypeTheme';
import { useSetBreadcrumbs } from '@/contexts/PageTitleContext';
import RichTextEditor from '@/components/LazyRichTextEditor';
import { cn } from '@/lib/utils';

const promotionTypeIcons: Record<string, any> = {
  newsletter: Mail,
  survey: FileText,
  birthday: Gift,
  announcement: Megaphone,
  sale: TrendingUp,
  event: Calendar,
};

const getPromotionTypeOptions = (t: any) => [
  { value: 'newsletter', label: t('promotionsPage.types.newsletter'), description: 'Regular email newsletters', icon: Mail },
  { value: 'survey', label: t('promotionsPage.types.survey'), description: 'Customer surveys & feedback', icon: FileText },
  { value: 'birthday', label: t('promotionsPage.types.birthday'), description: 'Birthday celebrations', icon: Gift },
  { value: 'announcement', label: t('promotionsPage.types.announcement'), description: 'Important announcements', icon: Megaphone },
  { value: 'sale', label: t('promotionsPage.types.sale'), description: 'Sales & discounts', icon: TrendingUp },
  { value: 'event', label: t('promotionsPage.types.event'), description: 'Events & webinars', icon: Calendar },
];

const getCodeFormatOptions = (t: any) => [
  { value: 'alphanumeric', label: t('promotionsPage.createPage.codeFormats.alphanumeric') },
  { value: 'alphabetic', label: t('promotionsPage.createPage.codeFormats.alphabetic') },
  { value: 'numeric', label: t('promotionsPage.createPage.codeFormats.numeric') },
];

const promotionTypeColors: Record<string, string> = {
  newsletter: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  survey: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  birthday: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  announcement: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  sale: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  event: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
};

const promotionTypeBorderColors: Record<string, string> = {
  newsletter: 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950',
  survey: 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950',
  birthday: 'border-pink-300 dark:border-pink-700 bg-pink-50 dark:bg-pink-950',
  announcement: 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950',
  sale: 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950',
  event: 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950',
};

// Step definitions
const STEPS = [
  { id: 'details', label: 'Details', icon: Megaphone },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'codes', label: 'Codes', icon: Code },
  { id: 'terms', label: 'Terms', icon: ScrollText },
  { id: 'review', label: 'Review', icon: Check },
] as const;

type StepId = typeof STEPS[number]['id'];

export default function EditPromotionPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/promotions/:id/edit');
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const promotionId = params?.id;

  useSetBreadcrumbs([
    { label: t('navigation.dashboard'), href: "/", icon: LayoutDashboard },
    { label: t('promotionsPage.title'), href: "/promotions", icon: Megaphone },
    { label: t('promotionsPage.editPage.title') }
  ]);

  const [currentStep, setCurrentStep] = useState<StepId>('details');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    termsContent: '',
    type: 'newsletter' as string,
    targetAudience: 'all',
    isActive: true,
    maxUses: '',
    validFrom: '',
    validTo: '',
    promotionalCodes: [] as string[],
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Code generation state
  const [codeGenerationMode, setCodeGenerationMode] = useState<'upload' | 'generate' | 'single'>('generate');
  const [userCodesInput, setUserCodesInput] = useState('');
  const [singleCodeInput, setSingleCodeInput] = useState('');
  const [generateOptions, setGenerateOptions] = useState({
    count: 10,
    length: 8,
    format: 'alphanumeric' as CodeFormat,
    prefix: '',
    suffix: '',
  });

  const updateField = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [fieldErrors]);

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  // Get options with translations
  const promotionTypeOptions = getPromotionTypeOptions(t);
  const codeFormatOptions = getCodeFormatOptions(t);

  // Fetch promotion data
  const { data: promotion, isLoading, error } = useQuery({
    queryKey: [`/api/promotions/${promotionId}`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/promotions/${promotionId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to fetch promotion' }));
        throw new Error(errorData.message || 'Failed to fetch promotion');
      }
      return await res.json();
    },
    enabled: !!promotionId,
    retry: 1,
  });

  // Route guard - must be after all hooks
  useEffect(() => {
    if (!match || !promotionId) {
      setLocation('/promotions');
    }
  }, [match, promotionId, setLocation]);

  // Populate form when promotion data loads
  useEffect(() => {
    if (promotion) {
      const promotionData = promotion as any;
      const validFrom = promotionData.validFrom ? new Date(promotionData.validFrom).toISOString().split('T')[0] : '';
      const validTo = promotionData.validTo ? new Date(promotionData.validTo).toISOString().split('T')[0] : '';

      setFormData({
        title: promotionData.title || '',
        description: promotionData.description || '',
        content: promotionData.content || '',
        termsContent: promotionData.termsContent || '',
        type: promotionData.type || 'newsletter',
        targetAudience: promotionData.targetAudience || 'all',
        isActive: promotionData.isActive ?? true,
        maxUses: promotionData.maxUses ? String(promotionData.maxUses) : '',
        validFrom,
        validTo,
        promotionalCodes: promotionData.promotionalCodes || [],
      });

      if (promotionData.promotionalCodes && promotionData.promotionalCodes.length > 0) {
        if (promotionData.promotionalCodes.length === 1) {
          setSingleCodeInput(promotionData.promotionalCodes[0]);
          setCodeGenerationMode('single');
        } else {
          setUserCodesInput(formatCodesForDisplay(promotionData.promotionalCodes));
          setCodeGenerationMode('upload');
        }
      }
    }
  }, [promotion]);

  const updatePromotionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PATCH', `/api/promotions/${promotionId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotions'] });
      queryClient.invalidateQueries({ queryKey: [`/api/promotions/${promotionId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/promotion-stats'] });
      toast({
        title: t('promotionsPage.toasts.success'),
        description: t('promotionsPage.toasts.promotionUpdated'),
      });
      setLocation('/promotions');
    },
    onError: (error: any) => {
      toast({
        title: t('promotionsPage.toasts.error'),
        description: error.message || t('promotionsPage.toasts.updateError'),
        variant: "destructive",
      });
    },
  });

  // Code generation handlers
  const handleUserCodesChange = (value: string) => {
    setUserCodesInput(value);
    const codes = parseUserCodes(value);
    if (codes.length > 0) {
      const validation = validatePromotionalCodes(codes);
      setFormData(prev => ({ ...prev, promotionalCodes: validation.valid }));
    } else {
      setFormData(prev => ({ ...prev, promotionalCodes: [] }));
    }
  };

  const handleGenerateCodes = () => {
    try {
      const codes = generatePromotionalCodes(generateOptions);
      setFormData(prev => ({ ...prev, promotionalCodes: codes }));
      toast({
        title: t('promotionsPage.toasts.success'),
        description: t('promotionsPage.toasts.codesGenerated', { count: codes.length }),
      });
    } catch (error: any) {
      toast({
        title: t('promotionsPage.toasts.error'),
        description: error.message || t('promotionsPage.toasts.codesError'),
        variant: "destructive",
      });
    }
  };

  const handleCopyCodesList = async () => {
    if (formData.promotionalCodes.length === 0) return;
    try {
      await navigator.clipboard.writeText(formatCodesForDisplay(formData.promotionalCodes));
      toast({
        title: t('promotionsPage.toasts.success'),
        description: t('promotionsPage.toasts.codesCopied'),
      });
    } catch (error) {
      toast({
        title: t('promotionsPage.toasts.error'),
        description: t('promotionsPage.toasts.copyError'),
        variant: "destructive",
      });
    }
  };

  const handleSingleCodeChange = (value: string) => {
    const normalized = value.trim().toUpperCase();
    setSingleCodeInput(value.toUpperCase());
    setFormData(prev => ({ ...prev, promotionalCodes: normalized ? [normalized] : [] }));
  };

  const handleClearCodes = () => {
    setFormData(prev => ({ ...prev, promotionalCodes: [] }));
    setUserCodesInput('');
    setSingleCodeInput('');
  };

  // Step validation
  const validateStep = useCallback((step: StepId): boolean => {
    const errors: Record<string, string> = {};

    if (step === 'details') {
      if (!formData.title.trim()) errors.title = t('promotionsPage.validation.fillRequired');
    }

    if (step === 'content') {
      if (!formData.content.trim() || formData.content === '<p></p>') {
        errors.content = t('promotionsPage.validation.fillRequired');
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, t]);

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      toast({
        title: t('promotionsPage.validation.error'),
        description: t('promotionsPage.validation.fillRequired'),
        variant: "destructive",
      });
      return;
    }
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const handleSubmit = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = t('promotionsPage.validation.fillRequired');
    if (!formData.content.trim() || formData.content === '<p></p>') errors.content = t('promotionsPage.validation.fillRequired');

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast({
        title: t('promotionsPage.validation.error'),
        description: t('promotionsPage.validation.fillRequired'),
        variant: "destructive",
      });
      return;
    }

    if (formData.promotionalCodes.length > 0) {
      const validation = validatePromotionalCodes(formData.promotionalCodes);
      if (validation.errors.length > 0) {
        toast({
          title: t('promotionsPage.validation.error'),
          description: validation.errors.join('. '),
          variant: "destructive",
        });
        return;
      }
    }

    const trimmedTerms = formData.termsContent.replace(/<[^>]*>/g, '').trim();
    const submitData = {
      ...formData,
      maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
      validFrom: formData.validFrom ? new Date(formData.validFrom + 'T00:00:00') : undefined,
      validTo: formData.validTo ? new Date(formData.validTo + 'T23:59:59') : undefined,
      promotionalCodes: formData.promotionalCodes.length > 0 ? formData.promotionalCodes : undefined,
      termsContent: trimmedTerms ? formData.termsContent : null,
    };

    if (submitData.validFrom && submitData.validTo && submitData.validFrom >= submitData.validTo) {
      toast({
        title: t('promotionsPage.validation.error'),
        description: t('promotionsPage.validation.dateRangeInvalid'),
        variant: "destructive",
      });
      return;
    }

    updatePromotionMutation.mutate(submitData);
  };

  const handleCancel = () => {
    setLocation('/promotions');
  };

  // Completion status per step
  const stepStatus = useMemo(() => ({
    details: !!(formData.title.trim() && formData.type),
    content: !!(formData.content.trim() && formData.content !== '<p></p>'),
    codes: true,
    terms: true,
    review: true,
  }), [formData]);

  const hasTerms = !!(formData.termsContent.replace(/<[^>]*>/g, '').trim());

  const TypeIcon = promotionTypeIcons[formData.type] || Megaphone;

  // Early return for invalid routes (after hooks)
  if (!match || !promotionId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading promotion...</p>
        </div>
      </div>
    );
  }

  if (error || !promotion) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-destructive">Failed to load promotion</p>
              <Button onClick={handleCancel} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Promotions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const promotionData = promotion as any;

  return (
    <div className="container mx-auto p-4 lg:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('promotionsPage.createPage.backToPromotions')}
        </Button>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            promotionTypeColors[formData.type]
          )}>
            <TypeIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
              {t('promotionsPage.editPage.title')}
            </h1>
            <p className="text-muted-foreground mt-0.5">
              {t('promotionsPage.editPage.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;
            const isAccessible = index <= currentStepIndex || stepStatus[STEPS[index - 1]?.id as StepId];

            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => isAccessible && setCurrentStep(step.id)}
                  disabled={!isAccessible}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium",
                    isActive && "bg-primary text-primary-foreground shadow-md",
                    isCompleted && !isActive && "bg-primary/10 text-primary hover:bg-primary/20",
                    !isActive && !isCompleted && isAccessible && "text-muted-foreground hover:bg-muted",
                    !isAccessible && "text-muted-foreground/40 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all",
                    isActive && "bg-primary-foreground/20 text-primary-foreground",
                    isCompleted && !isActive && "bg-primary text-primary-foreground",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}>
                    {isCompleted && !isActive ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <StepIcon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-2 rounded-full transition-colors",
                    index < currentStepIndex ? "bg-primary" : "bg-border"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form Content */}
        <div className="lg:col-span-2">
          {/* Step 1: Details */}
          {currentStep === 'details' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-primary" />
                    {t('promotionsPage.createPage.basicInformation')}
                  </CardTitle>
                  <CardDescription>Update the basic details of your promotion</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-medium">
                      {t('promotionsPage.createPage.title')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => updateField('title', e.target.value)}
                      placeholder={t('promotionsPage.createPage.titlePlaceholder')}
                      className={cn(
                        "h-11",
                        fieldErrors.title && "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                    {fieldErrors.title && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {fieldErrors.title}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium">
                      {t('promotionsPage.createPage.description')}
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      placeholder={t('promotionsPage.createPage.descriptionPlaceholder')}
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  <Separator />

                  {/* Promotion Type Cards */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('promotionsPage.createPage.type')}</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {promotionTypeOptions.map((option) => {
                        const Icon = option.icon;
                        const isSelected = formData.type === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateField('type', option.value)}
                            className={cn(
                              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                              isSelected
                                ? promotionTypeBorderColors[option.value] + " ring-2 ring-offset-2 ring-primary/30"
                                : "border-border hover:border-primary/30 hover:bg-muted/50"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                              isSelected ? promotionTypeColors[option.value] : "bg-muted text-muted-foreground"
                            )}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-medium">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <div className="space-y-0.5">
                      <Label htmlFor="isActive" className="text-sm font-medium cursor-pointer">
                        {t('promotionsPage.createPage.active')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Toggle whether this promotion is currently active
                      </p>
                    </div>
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => updateField('isActive', checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Scheduling Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    {t('promotionsPage.createPage.advancedSettings')}
                  </CardTitle>
                  <CardDescription>Set validity period and usage limits</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="validFrom" className="text-sm font-medium">
                        {t('promotionsPage.createPage.validFrom')}
                      </Label>
                      <Input
                        id="validFrom"
                        type="date"
                        value={formData.validFrom}
                        onChange={(e) => updateField('validFrom', e.target.value)}
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('promotionsPage.createPage.validFromHelp')}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="validTo" className="text-sm font-medium">
                        {t('promotionsPage.createPage.validTo')}
                      </Label>
                      <Input
                        id="validTo"
                        type="date"
                        value={formData.validTo}
                        min={formData.validFrom || undefined}
                        onChange={(e) => updateField('validTo', e.target.value)}
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('promotionsPage.createPage.validToHelp')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxUses" className="text-sm font-medium">
                      {t('promotionsPage.createPage.maxUses')}
                    </Label>
                    <Input
                      id="maxUses"
                      type="number"
                      min="1"
                      value={formData.maxUses}
                      onChange={(e) => updateField('maxUses', e.target.value)}
                      placeholder={t('promotionsPage.createPage.maxUsesPlaceholder')}
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('promotionsPage.createPage.maxUsesHelp')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Content */}
          {currentStep === 'content' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {t('promotionsPage.createPage.promotionContent')}
                </CardTitle>
                <CardDescription>Edit the content for your promotional material</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label htmlFor="content" className="text-sm font-medium">
                    {t('promotionsPage.createPage.content')} <span className="text-destructive">*</span>
                  </Label>
                  <RichTextEditor
                    value={formData.content}
                    onChange={(html) => updateField('content', html)}
                    placeholder={t('promotionsPage.createPage.contentPlaceholder')}
                    className={cn(
                      "min-h-[400px]",
                      fieldErrors.content && "border-destructive"
                    )}
                  />
                  {fieldErrors.content ? (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {fieldErrors.content}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t('promotionsPage.createPage.contentHelp')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Codes */}
          {currentStep === 'codes' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-primary" />
                  {t('promotionsPage.createPage.promotionalCodes')}
                </CardTitle>
                <CardDescription>
                  Manage promotional codes for this promotion (optional)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs value={codeGenerationMode} onValueChange={(v: string) => setCodeGenerationMode(v as 'upload' | 'generate' | 'single')}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="generate" className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4" />
                      {t('promotionsPage.createPage.generateCodes')}
                    </TabsTrigger>
                    <TabsTrigger value="single" className="flex items-center gap-2">
                      <Ticket className="h-4 w-4" />
                      Single Code
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      {t('promotionsPage.createPage.uploadOwnCodes')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="generate" className="space-y-5 mt-4">
                    {/* Quick Presets */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Quick presets</Label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(CODE_GENERATION_PRESETS).map(([key, preset]) => (
                          <Button
                            key={key}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setGenerateOptions(prev => ({
                              ...prev,
                              length: preset.length,
                              format: preset.format,
                            }))}
                            className={cn(
                              "text-xs capitalize",
                              generateOptions.length === preset.length && generateOptions.format === preset.format
                                && "border-primary bg-primary/5 text-primary"
                            )}
                          >
                            {key} ({preset.length} chars)
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="codeCount" className="text-sm font-medium">
                          {t('promotionsPage.createPage.numberOfCodes')}
                        </Label>
                        <Input
                          id="codeCount"
                          type="number"
                          min="1"
                          max="10000"
                          value={generateOptions.count}
                          onChange={(e) => setGenerateOptions({
                            ...generateOptions,
                            count: parseInt(e.target.value) || 1
                          })}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="codeLength" className="text-sm font-medium">
                          {t('promotionsPage.createPage.codeLength')}
                        </Label>
                        <Input
                          id="codeLength"
                          type="number"
                          min="4"
                          max="20"
                          value={generateOptions.length}
                          onChange={(e) => setGenerateOptions({
                            ...generateOptions,
                            length: parseInt(e.target.value) || 8
                          })}
                          className="h-11"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t('promotionsPage.createPage.codeFormat')}</Label>
                      <Select
                        value={generateOptions.format}
                        onValueChange={(value: CodeFormat) => setGenerateOptions({
                          ...generateOptions,
                          format: value
                        })}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {codeFormatOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="codePrefix" className="text-sm font-medium">
                          {t('promotionsPage.createPage.prefix')}
                        </Label>
                        <Input
                          id="codePrefix"
                          value={generateOptions.prefix}
                          onChange={(e) => setGenerateOptions({
                            ...generateOptions,
                            prefix: e.target.value.toUpperCase()
                          })}
                          placeholder={t('promotionsPage.createPage.prefixPlaceholder')}
                          maxLength={10}
                          className="h-11 font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="codeSuffix" className="text-sm font-medium">
                          {t('promotionsPage.createPage.suffix')}
                        </Label>
                        <Input
                          id="codeSuffix"
                          value={generateOptions.suffix}
                          onChange={(e) => setGenerateOptions({
                            ...generateOptions,
                            suffix: e.target.value.toUpperCase()
                          })}
                          placeholder={t('promotionsPage.createPage.suffixPlaceholder')}
                          maxLength={10}
                          className="h-11 font-mono"
                        />
                      </div>
                    </div>

                    {/* Code Preview */}
                    <div className="p-3 rounded-lg bg-muted/50 border border-dashed">
                      <p className="text-xs text-muted-foreground mb-1">Preview format:</p>
                      <code className="text-sm font-mono font-semibold">
                        {generateOptions.prefix}{generateOptions.format === 'numeric' ? '0'.repeat(generateOptions.length) : 'X'.repeat(generateOptions.length)}{generateOptions.suffix}
                      </code>
                    </div>

                    <Button
                      type="button"
                      onClick={handleGenerateCodes}
                      className="w-full h-11"
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate {generateOptions.count} Codes
                    </Button>
                  </TabsContent>

                  <TabsContent value="single" className="space-y-4 mt-4">
                    <div className="space-y-3">
                      <Label htmlFor="singleCode" className="text-sm font-medium">
                        Promotional Code
                      </Label>
                      <Input
                        id="singleCode"
                        value={singleCodeInput}
                        onChange={(e) => handleSingleCodeChange(e.target.value)}
                        placeholder="e.g. SUMMER2025"
                        maxLength={50}
                        className="h-11 font-mono text-sm uppercase"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use a single shared code that every recipient can redeem.
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="upload" className="space-y-4 mt-4">
                    <div className="space-y-3">
                      <Label htmlFor="userCodes" className="text-sm font-medium">
                        {t('promotionsPage.createPage.promotionalCodes')}
                      </Label>
                      <Textarea
                        id="userCodes"
                        value={userCodesInput}
                        onChange={(e) => handleUserCodesChange(e.target.value)}
                        placeholder={t('promotionsPage.createPage.promotionalCodesPlaceholder')}
                        rows={8}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('promotionsPage.createPage.codesHelp')}
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Generated/Uploaded Codes Display */}
                {formData.promotionalCodes.length > 0 && (
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono">
                          {formData.promotionalCodes.length} codes
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button type="button" variant="outline" size="sm" onClick={handleCopyCodesList}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('promotionsPage.createPage.copyAll')}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button type="button" variant="outline" size="sm" onClick={handleClearCodes}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Clear all codes</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg border max-h-40 overflow-y-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                        {formData.promotionalCodes.slice(0, 50).join('\n')}
                        {formData.promotionalCodes.length > 50 && `\n... and ${formData.promotionalCodes.length - 50} more`}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 4: Terms */}
          {currentStep === 'terms' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-primary" />
                  Terms &amp; Conditions
                </CardTitle>
                <CardDescription>
                  Optional legal terms. When provided, a "Terms and Conditions" link is appended to the promotional email, linking to a branded page on your blog.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label htmlFor="termsContent" className="text-sm font-medium">
                    Legal Terms
                  </Label>
                  <RichTextEditor
                    value={formData.termsContent}
                    onChange={(html) => updateField('termsContent', html)}
                    placeholder="Eligibility, restrictions, expiry details, etc."
                    className="min-h-[360px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to skip. Recipients will see a "Terms and Conditions" link at the bottom of the promotion email only when terms are set.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Review */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    Review Your Changes
                  </CardTitle>
                  <CardDescription>Review all details before updating your promotion</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Title & Type */}
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                      promotionTypeColors[formData.type]
                    )}>
                      <TypeIcon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold">{formData.title || 'Untitled Promotion'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={promotionTypeColors[formData.type]}>
                          {promotionTypeOptions.find(opt => opt.value === formData.type)?.label}
                        </Badge>
                        {formData.isActive ? (
                          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-700">
                            {t('promotionsPage.status.active')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            {t('promotionsPage.status.inactive')}
                          </Badge>
                        )}
                      </div>
                      {formData.description && (
                        <p className="text-sm text-muted-foreground mt-2">{formData.description}</p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Email-accurate content preview */}
                  {(() => {
                    const theme = getPromotionTypeTheme(formData.type);
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            {t('promotionsPage.createPage.previewContent')}
                          </Label>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            as it will appear in email
                          </span>
                        </div>
                        <div className="rounded-lg border bg-[#f3f4f6] dark:bg-gray-900 p-4">
                          <div
                            style={{
                              maxWidth: 600,
                              margin: '20px auto',
                              padding: '32px 24px',
                              background: `linear-gradient(135deg, ${theme.bgStart} 0%, ${theme.bgEnd} 100%)`,
                              borderRadius: 12,
                              border: `2px solid ${theme.border}`,
                              fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                            }}
                          >
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 16px', color: theme.titleColor }}>
                              {formData.title || 'Untitled Promotion'}
                            </h2>
                            {formData.description && (
                              <p style={{ margin: '0 0 20px', color: theme.bodyColor, fontSize: '1rem', lineHeight: 1.5 }}>
                                {formData.description}
                              </p>
                            )}
                            <div
                              style={{ color: theme.bodyColor, fontSize: '1rem', lineHeight: 1.6 }}
                              dangerouslySetInnerHTML={{
                                __html: formData.content && formData.content !== '<p></p>'
                                  ? formData.content
                                  : '<p style="color:#94a3b8;font-style:italic;">No content provided</p>',
                              }}
                            />
                            {hasTerms && (
                              <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${theme.border}`, textAlign: 'center', fontSize: 12, lineHeight: 1.5, color: theme.bodyColor }}>
                                <a href="#" onClick={(e) => e.preventDefault()} style={{ color: theme.accent, textDecoration: 'underline' }}>
                                  Terms and Conditions
                                </a>
                              </div>
                            )}
                            <hr style={{ margin: '32px 0 16px', border: 'none', borderTop: `1px solid ${theme.border}` }} />
                            <p style={{ margin: 0, fontSize: '0.85rem', color: theme.bodyColor, opacity: 0.75, textAlign: 'center' }}>
                              This is a special promotion for valued subscribers.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <Separator />

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {formData.maxUses && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Max Uses</p>
                        <p className="text-sm font-medium">{formData.maxUses}</p>
                      </div>
                    )}
                    {formData.validFrom && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valid From</p>
                        <p className="text-sm font-medium">{new Date(formData.validFrom).toLocaleDateString()}</p>
                      </div>
                    )}
                    {formData.validTo && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valid Until</p>
                        <p className="text-sm font-medium">{new Date(formData.validTo).toLocaleDateString()}</p>
                      </div>
                    )}
                    {formData.promotionalCodes.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Promo Codes</p>
                        <p className="text-sm font-medium">{formData.promotionalCodes.length} codes</p>
                      </div>
                    )}
                    {hasTerms && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Terms</p>
                        <p className="text-sm font-medium flex items-center gap-1">
                          <ScrollText className="h-3.5 w-3.5" /> Attached
                        </p>
                      </div>
                    )}
                  </div>

                  {hasTerms && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                          Terms &amp; Conditions preview
                        </Label>
                        <div className="p-4 rounded-lg border bg-card max-h-48 overflow-y-auto">
                          <div
                            className="prose prose-sm dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: formData.termsContent }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          A "Terms and Conditions" link will appear at the bottom of the promotional email.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Promotion Info Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t('promotionsPage.editPage.promotionInfo')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t('promotionsPage.editPage.created')}</p>
                      <p className="text-sm font-medium">
                        {promotionData?.createdAt ? new Date(promotionData.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t('promotionsPage.editPage.lastUpdated')}</p>
                      <p className="text-sm font-medium">
                        {promotionData?.updatedAt ? new Date(promotionData.updatedAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t('promotionsPage.editPage.timesUsed')}</p>
                      <p className="text-sm font-medium">{promotionData?.usageCount || 0}</p>
                    </div>
                    {promotionData?.maxUses && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{t('promotionsPage.editPage.maxUses')}</p>
                        <p className="text-sm font-medium">{promotionData.maxUses}</p>
                      </div>
                    )}
                  </div>

                  {/* Usage Progress */}
                  {promotionData?.maxUses && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Usage</span>
                        <span className="text-xs font-medium">
                          {promotionData?.usageCount || 0} / {promotionData.maxUses}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min((promotionData?.usageCount || 0) / promotionData.maxUses * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Live Preview Card */}
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                {t('promotionsPage.createPage.preview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Mini preview card */}
              <div className={cn(
                "rounded-xl border-2 p-4 transition-colors",
                promotionTypeBorderColors[formData.type] || "border-border"
              )}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center",
                    promotionTypeColors[formData.type]
                  )}>
                    <TypeIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {formData.title || t('promotionsPage.createPage.titlePlaceholder')}
                    </p>
                    <Badge className={cn("text-[10px] px-1.5 py-0", promotionTypeColors[formData.type])}>
                      {promotionTypeOptions.find(opt => opt.value === formData.type)?.label}
                    </Badge>
                  </div>
                </div>

                {formData.description && (
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{formData.description}</p>
                )}

                {formData.content && formData.content !== '<p></p>' && (
                  <div
                    className="text-xs text-muted-foreground prose prose-xs dark:prose-invert max-w-none line-clamp-3 mb-2"
                    dangerouslySetInnerHTML={{ __html: formData.content }}
                  />
                )}

                <div className="flex items-center justify-end pt-2 border-t mt-2">
                  {formData.isActive ? (
                    <span className="text-[10px] text-green-600 font-medium">Active</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Inactive</span>
                  )}
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completion</p>
                {[
                  { label: 'Title set', done: !!formData.title.trim() },
                  { label: 'Content written', done: !!(formData.content.trim() && formData.content !== '<p></p>') },
                  { label: 'Codes added', done: formData.promotionalCodes.length > 0, optional: true },
                  { label: 'Terms attached', done: hasTerms, optional: true },
                  { label: 'Schedule set', done: !!(formData.validFrom || formData.validTo), optional: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0",
                      item.done ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400" : "bg-muted text-muted-foreground"
                    )}>
                      {item.done ? (
                        <Check className="h-2.5 w-2.5" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      )}
                    </div>
                    <span className={cn(
                      "text-xs",
                      item.done ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {item.label}
                      {item.optional && !item.done && <span className="text-muted-foreground/60 ml-1">(optional)</span>}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="sticky bottom-0 mt-8 -mx-4 px-4 py-4 bg-background/95 backdrop-blur-sm border-t lg:-mx-6 lg:px-6">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <Button
            type="button"
            variant="ghost"
            onClick={currentStepIndex === 0 ? handleCancel : handleBack}
            disabled={updatePromotionMutation.isPending}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStepIndex === 0 ? t('promotionsPage.createPage.cancel') : 'Back'}
          </Button>

          <div className="flex items-center gap-3">
            {currentStep !== 'review' ? (
              <Button type="button" onClick={handleNext} className="min-w-[120px]">
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={updatePromotionMutation.isPending}
                className="min-w-[160px]"
              >
                {updatePromotionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('promotionsPage.editPage.updating')}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t('promotionsPage.editPage.updatePromotion')}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
