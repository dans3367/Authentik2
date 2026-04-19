import { useState, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, Calendar, Megaphone, Save, Upload, Wand2, Code, Copy, Check, CheckCircle2, Mail, FileText, Gift, TrendingUp, Trash2, LayoutDashboard, Eye, AlertCircle, Ticket, ScrollText, Palette } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

const DESIGN_TEMPLATES = [
  { id: 'template-1', label: 'Classic Minimal', color: 'bg-white dark:bg-slate-950', textColor: 'text-slate-900 dark:text-slate-100', borderColor: 'border-slate-200 dark:border-slate-800' },
  { id: 'template-2', label: 'Modern Vibrant', color: 'bg-blue-100 dark:bg-blue-900/40', textColor: 'text-blue-900 dark:text-blue-100', borderColor: 'border-blue-400 dark:border-blue-700' },
  { id: 'template-3', label: 'Elegant Dark', color: 'bg-zinc-800 dark:bg-zinc-950', textColor: 'text-zinc-100 dark:text-zinc-100', borderColor: 'border-zinc-600 dark:border-zinc-800' },
  { id: 'template-4', label: 'Playful Brand', color: 'bg-rose-100 dark:bg-rose-900/40', textColor: 'text-rose-900 dark:text-rose-100', borderColor: 'border-rose-400 dark:border-rose-700' },
  { id: 'template-5', label: 'Premium Gold', color: 'bg-amber-100 dark:bg-amber-900/40', textColor: 'text-amber-900 dark:text-amber-100', borderColor: 'border-amber-400 dark:border-amber-600' },
  { id: 'template-6', label: 'Fresh Green', color: 'bg-green-100 dark:bg-green-900/40', textColor: 'text-green-900 dark:text-green-100', borderColor: 'border-green-400 dark:border-green-700' },
  { id: 'template-7', label: 'Sweet Pink', color: 'bg-pink-100 dark:bg-pink-900/40', textColor: 'text-pink-900 dark:text-pink-100', borderColor: 'border-pink-400 dark:border-pink-700' },
  { id: 'template-8', label: 'Royal Purple', color: 'bg-purple-100 dark:bg-purple-900/40', textColor: 'text-purple-900 dark:text-purple-100', borderColor: 'border-purple-400 dark:border-purple-700' },
  { id: 'template-9', label: 'Warm Orange', color: 'bg-orange-100 dark:bg-orange-900/40', textColor: 'text-orange-900 dark:text-orange-100', borderColor: 'border-orange-400 dark:border-orange-700' },
  { id: 'template-10', label: 'Deep Indigo', color: 'bg-indigo-100 dark:bg-indigo-900/40', textColor: 'text-indigo-900 dark:text-indigo-100', borderColor: 'border-indigo-400 dark:border-indigo-700' }
] as const;

// Step definitions
const STEPS = [
  { id: 'details', label: 'Details', icon: Megaphone },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'codes', label: 'Codes', icon: Code },
  { id: 'terms', label: 'Terms', icon: ScrollText },
  { id: 'review', label: 'Review', icon: Check },
] as const;

type StepId = typeof STEPS[number]['id'];

export default function CreatePromotionPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  useSetBreadcrumbs([
    { label: t('navigation.dashboard'), href: "/", icon: LayoutDashboard },
    { label: t('promotionsPage.title'), href: "/promotions", icon: Megaphone },
    { label: t('promotionsPage.createPage.title') }
  ]);

  const [currentStep, setCurrentStep] = useState<StepId>('details');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    termsContent: '',
    type: 'newsletter' as string,
    designTemplate: 'template-1',
    borderStyle: 'solid',
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
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [fieldErrors]);

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  const createPromotionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/promotions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/promotion-stats'] });
      toast({
        title: t('promotionsPage.toasts.success'),
        description: t('promotionsPage.toasts.promotionCreated'),
      });
      setLocation('/promotions');
    },
    onError: (error: any) => {
      toast({
        title: t('promotionsPage.toasts.error'),
        description: error.message || t('promotionsPage.toasts.createError'),
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
    if (!formData.title.trim() || (!formData.content.trim() || formData.content === '<p></p>')) {
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
    const metadataObj = { 
      designTemplate: formData.designTemplate,
      borderStyle: formData.borderStyle
    };
    const submitData = {
      ...formData,
      metadata: JSON.stringify(metadataObj),
      maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
      validFrom: formData.validFrom ? new Date(formData.validFrom + 'T00:00:00') : undefined,
      validTo: formData.validTo ? new Date(formData.validTo + 'T23:59:59') : undefined,
      promotionalCodes: formData.promotionalCodes.length > 0 ? formData.promotionalCodes : undefined,
      termsContent: trimmedTerms ? formData.termsContent : undefined,
    };

    if (submitData.validFrom && submitData.validTo && submitData.validFrom >= submitData.validTo) {
      toast({
        title: t('promotionsPage.validation.error'),
        description: t('promotionsPage.validation.dateRangeInvalid'),
        variant: "destructive",
      });
      return;
    }

    createPromotionMutation.mutate(submitData);
  };

  const handleCancel = () => {
    setLocation('/promotions');
  };

  const promotionTypeOptions = getPromotionTypeOptions(t);
  const codeFormatOptions = getCodeFormatOptions(t);

  // Completion status per step
  const stepStatus = useMemo(() => ({
    details: !!(formData.title.trim() && formData.type),
    content: !!(formData.content.trim() && formData.content !== '<p></p>'),
    codes: true, // always valid (codes are optional)
    terms: true, // always valid (terms are optional)
    review: true,
  }), [formData]);

  const hasTerms = !!(formData.termsContent.replace(/<[^>]*>/g, '').trim());

  const TypeIcon = promotionTypeIcons[formData.type] || Megaphone;

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
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
          {t('promotionsPage.createPage.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('promotionsPage.createPage.subtitle')}
        </p>
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

      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* Main Form Content */}
        <div className="flex-1 min-w-0">
          {/* Step 1: Details */}
          {currentStep === 'details' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-primary" />
                    {t('promotionsPage.createPage.basicInformation')}
                  </CardTitle>
                  <CardDescription>Set up the basic details for your promotion</CardDescription>
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
                              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center relative",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/30 hover:bg-muted/50"
                            )}
                          >
                            {isSelected && (
                              <div className="absolute -top-2 -right-2 bg-background rounded-full">
                                <CheckCircle2 className="h-5 w-5 text-green-500 fill-green-100 dark:fill-green-900/50" />
                              </div>
                            )}
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-medium">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Design Templates */}
                  <div className="space-y-3 pt-2">
                    <Label className="text-sm font-medium">Design Template</Label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {DESIGN_TEMPLATES.map((option) => {
                        const isSelected = formData.designTemplate === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => updateField('designTemplate', option.id)}
                            className={cn(
                              "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center relative",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/30 hover:bg-muted/50"
                            )}
                          >
                            {isSelected && (
                              <div className="absolute -top-2 -right-2 bg-background rounded-full shadow-sm z-10">
                                <CheckCircle2 className="h-5 w-5 text-green-500 fill-green-100 dark:fill-green-900/50" />
                              </div>
                            )}
                            <div className={cn(
                              "w-full h-12 rounded-lg flex items-center justify-center transition-colors mb-1 shadow-sm",
                              option.color
                            )}>
                              <Palette className="h-5 w-5 opacity-60" />
                            </div>
                            <span className="text-xs font-medium">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Border Style */}
                  <div className="space-y-3 pt-2">
                    <Label className="text-sm font-medium">Border Style</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => updateField('borderStyle', 'solid')}
                        className={cn(
                          "flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all relative",
                          formData.borderStyle === 'solid'
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/30 hover:bg-muted/50 text-muted-foreground"
                        )}
                      >
                        {formData.borderStyle === 'solid' && (
                          <div className="absolute -top-2 -right-2 bg-background rounded-full shadow-sm z-10">
                            <CheckCircle2 className="h-5 w-5 text-green-500 fill-green-100 dark:fill-green-900/50" />
                          </div>
                        )}
                        <div className="w-5 h-5 rounded border-[3px] border-solid border-current"></div>
                        <span className="text-sm font-medium">Solid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('borderStyle', 'dotted')}
                        className={cn(
                          "flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all relative",
                          formData.borderStyle === 'dotted'
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/30 hover:bg-muted/50 text-muted-foreground"
                        )}
                      >
                        {formData.borderStyle === 'dotted' && (
                          <div className="absolute -top-2 -right-2 bg-background rounded-full shadow-sm z-10">
                            <CheckCircle2 className="h-5 w-5 text-green-500 fill-green-100 dark:fill-green-900/50" />
                          </div>
                        )}
                        <div className="w-5 h-5 rounded border-[3px] border-dotted border-current"></div>
                        <span className="text-sm font-medium">Dotted</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <div className="space-y-0.5">
                      <Label htmlFor="isActive" className="text-sm font-medium cursor-pointer">
                        {t('promotionsPage.createPage.active')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Activate this promotion immediately after creation
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
                <CardDescription>Write the content for your promotional material</CardDescription>
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
                  Add promotional codes to your promotion (optional)
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
                      {userCodesInput.trim() && (
                        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {formData.promotionalCodes.length}
                          </span>{' '}
                          unique code{formData.promotionalCodes.length === 1 ? '' : 's'} will be included from your list.
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Generated/Uploaded Codes Display */}
                {formData.promotionalCodes.length > 0 && codeGenerationMode === 'generate' && (
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
                    Review Your Promotion
                  </CardTitle>
                  <CardDescription>Review all details before creating your promotion</CardDescription>
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
                      <div className={cn(
                        "max-w-[600px] mx-auto my-5 px-6 py-8 rounded-xl border-[3px] transition-all",
                        DESIGN_TEMPLATES.find(t => t.id === formData.designTemplate)?.borderColor || "border-border",
                        formData.borderStyle === 'dotted' ? "border-dotted" : "border-solid",
                        DESIGN_TEMPLATES.find(t => t.id === formData.designTemplate)?.color || "",
                        DESIGN_TEMPLATES.find(t => t.id === formData.designTemplate)?.textColor || "text-foreground"
                      )}>
                        <h2 className="text-2xl font-bold mb-4">
                          {formData.title || 'Untitled Promotion'}
                        </h2>
                        {formData.description && (
                          <p className="mb-5 text-base leading-relaxed opacity-80">
                            {formData.description}
                          </p>
                        )}
                        <div
                          className="text-base leading-relaxed opacity-90 [&_*]:!text-inherit"
                          dangerouslySetInnerHTML={{
                            __html: formData.content && formData.content !== '<p></p>'
                              ? formData.content
                              : '<p style="font-style:italic;" class="opacity-50 text-sm">No content provided</p>',
                          }}
                        />
                        {currentStepIndex >= 2 && (
                          <div className={cn(
                            "mt-6 mb-2 mx-auto max-w-[200px] p-3 rounded backdrop-blur-sm border border-dashed border-current text-center transition-all",
                            DESIGN_TEMPLATES.find(t => t.id === formData.designTemplate)?.color ? "bg-background/20 opacity-90" : "bg-muted/50 text-foreground"
                          )}>
                            <span className="text-[10px] uppercase tracking-wider font-bold opacity-70 mb-1 block">Promo Code</span>
                            <code className="text-base font-mono font-bold tracking-widest drop-shadow-sm">
                              {codeGenerationMode === 'single'
                                ? (singleCodeInput || 'YOURCODE')
                                : codeGenerationMode === 'upload'
                                  ? (userCodesInput.split('\n')[0] || 'YOURCODE').toUpperCase()
                                  : `${generateOptions.prefix}${generateOptions.format === 'numeric' ? '0'.repeat(generateOptions.length) : 'X'.repeat(generateOptions.length)}${generateOptions.suffix}`
                              }
                            </code>
                          </div>
                        )}
                        {hasTerms && (
                          <div className={cn(
                            "mt-6 pt-4 text-center text-xs opacity-70 border-t",
                            DESIGN_TEMPLATES.find(t => t.id === formData.designTemplate)?.borderColor || "border-border"
                          )}>
                            <a href="#" onClick={(e) => e.preventDefault()} className="underline hover:opacity-100 transition-opacity">
                              Terms and Conditions
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

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

              {/* Info Banner */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {t('promotionsPage.createPage.advancedHelp.title')}
                </h4>
                <ul className="space-y-1.5 text-sm text-blue-800 dark:text-blue-200">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{t('promotionsPage.createPage.advancedHelp.maxUsesGlobal')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{t('promotionsPage.createPage.advancedHelp.dateRangeControls')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{t('promotionsPage.createPage.advancedHelp.expiredHidden')}</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-[340px] lg:shrink-0 lg:sticky lg:top-[5.5rem] lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1 space-y-6">
          {/* Live Preview Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                {t('promotionsPage.createPage.preview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Mini preview card */}
              <div className={cn(
                "rounded-xl border-[3px] p-4 transition-all relative overflow-hidden",
                DESIGN_TEMPLATES.find(t => t.id === formData.designTemplate)?.borderColor || "border-border",
                formData.borderStyle === 'dotted' ? "border-dotted" : "border-solid",
                DESIGN_TEMPLATES.find(t => t.id === formData.designTemplate)?.color || "",
                DESIGN_TEMPLATES.find(t => t.id === formData.designTemplate)?.textColor || "text-foreground"
              )}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center opacity-80 bg-background/20"
                  )}>
                    <TypeIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {formData.title || t('promotionsPage.createPage.titlePlaceholder')}
                    </p>
                    <Badge className="text-[10px] px-1.5 py-0 bg-background/20 text-inherit border-none shadow-none hover:bg-background/30">
                      {promotionTypeOptions.find(opt => opt.value === formData.type)?.label}
                    </Badge>
                  </div>
                </div>

                {formData.description && (
                  <p className="text-xs mb-2 line-clamp-2 opacity-80">{formData.description}</p>
                )}

                {formData.content && formData.content !== '<p></p>' && (
                  <div
                    className="text-xs max-w-none line-clamp-3 mb-2 opacity-90 [&_*]:!text-inherit"
                    dangerouslySetInnerHTML={{ __html: formData.content }}
                  />
                )}

                {currentStepIndex >= 2 && (
                  <div className={cn(
                    "mt-3 mb-2 p-2 rounded backdrop-blur-sm border border-dashed border-current text-center transition-all",
                    DESIGN_TEMPLATES.find(t => t.id === formData.designTemplate)?.color ? "bg-background/20 opacity-90" : "bg-muted/50 text-foreground"
                  )}>
                    <span className="text-[9px] uppercase tracking-wider font-bold opacity-70 mb-1 block">Code Example</span>
                    <code className="text-sm font-mono font-bold tracking-widest drop-shadow-sm">
                      {codeGenerationMode === 'single'
                        ? (singleCodeInput || 'YOURCODE')
                        : codeGenerationMode === 'upload'
                          ? (userCodesInput.split('\n')[0] || 'YOURCODE').toUpperCase()
                          : `${generateOptions.prefix}${generateOptions.format === 'numeric' ? '0'.repeat(generateOptions.length) : 'X'.repeat(generateOptions.length)}${generateOptions.suffix}`
                      }
                    </code>
                  </div>
                )}

                <div className={cn(
                  "flex items-center justify-end pt-2 border-t mt-2",
                  DESIGN_TEMPLATES.find(t => t.id === formData.designTemplate)?.borderColor || "border-border"
                )}>
                  {formData.isActive ? (
                    <span className="text-[10px] text-green-600 font-medium bg-green-100 dark:bg-green-900/50 px-1.5 py-0.5 rounded">Active</span>
                  ) : (
                    <span className="text-[10px] opacity-70">Inactive</span>
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
        </aside>
      </div>

      {/* Bottom Action Bar */}
      <div className="sticky bottom-0 mt-8 -mx-4 px-4 py-4 bg-background/95 backdrop-blur-sm border-t lg:-mx-6 lg:px-6">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <Button
            type="button"
            variant="ghost"
            onClick={currentStepIndex === 0 ? handleCancel : handleBack}
            disabled={createPromotionMutation.isPending}
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
                disabled={createPromotionMutation.isPending}
                className="min-w-[160px]"
              >
                {createPromotionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('promotionsPage.createPage.creating')}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t('promotionsPage.createPage.createPromotion')}
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
