import { useState, useEffect, useCallback } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Megaphone, Save, Upload, Wand2, Code, Copy, Trash2, Mail, FileText, Gift, TrendingUp, Calendar, Users, Eye, LayoutDashboard, AlertCircle } from 'lucide-react';
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
  { value: 'newsletter', label: t('promotionsPage.types.newsletter'), icon: Mail },
  { value: 'survey', label: t('promotionsPage.types.survey'), icon: FileText },
  { value: 'birthday', label: t('promotionsPage.types.birthday'), icon: Gift },
  { value: 'announcement', label: t('promotionsPage.types.announcement'), icon: Megaphone },
  { value: 'sale', label: t('promotionsPage.types.sale'), icon: TrendingUp },
  { value: 'event', label: t('promotionsPage.types.event'), icon: Calendar },
];

const getTargetAudienceOptions = (t: any) => [
  { value: 'all', label: t('promotionsPage.createPage.targetOptions.all'), icon: Users },
  { value: 'subscribers', label: t('promotionsPage.createPage.targetOptions.subscribers'), icon: Mail },
  { value: 'customers', label: t('promotionsPage.createPage.targetOptions.customers'), icon: Users },
  { value: 'prospects', label: t('promotionsPage.createPage.targetOptions.prospects'), icon: Eye },
  { value: 'vip', label: t('promotionsPage.createPage.targetOptions.vip'), icon: TrendingUp },
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

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
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
  const [codeGenerationMode, setCodeGenerationMode] = useState<'upload' | 'generate'>('generate');
  const [userCodesInput, setUserCodesInput] = useState('');
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

  // Get options with translations
  const promotionTypeOptions = getPromotionTypeOptions(t);
  const targetAudienceOptions = getTargetAudienceOptions(t);
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
        type: promotionData.type || 'newsletter',
        targetAudience: promotionData.targetAudience || 'all',
        isActive: promotionData.isActive ?? true,
        maxUses: promotionData.maxUses ? String(promotionData.maxUses) : '',
        validFrom,
        validTo,
        promotionalCodes: promotionData.promotionalCodes || [],
      });

      if (promotionData.promotionalCodes && promotionData.promotionalCodes.length > 0) {
        setUserCodesInput(formatCodesForDisplay(promotionData.promotionalCodes));
        setCodeGenerationMode('upload');
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

  const handleClearCodes = () => {
    setFormData(prev => ({ ...prev, promotionalCodes: [] }));
    setUserCodesInput('');
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

    const submitData = {
      ...formData,
      maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
      validFrom: formData.validFrom ? new Date(formData.validFrom + 'T00:00:00') : undefined,
      validTo: formData.validTo ? new Date(formData.validTo + 'T23:59:59') : undefined,
      promotionalCodes: formData.promotionalCodes.length > 0 ? formData.promotionalCodes : undefined,
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
        <div className="flex items-center gap-3 mb-1">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information Card */}
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

              <Separator />

              {/* Target Audience */}
              <div className="space-y-2">
                <Label htmlFor="targetAudience" className="text-sm font-medium">
                  {t('promotionsPage.createPage.targetAudience')}
                </Label>
                <Select value={formData.targetAudience} onValueChange={(value) => updateField('targetAudience', value)}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {targetAudienceOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            {option.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
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

          {/* Content Card */}
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

          {/* Code Generation Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                {t('promotionsPage.createPage.promotionalCodes')}
              </CardTitle>
              <CardDescription>Manage promotional codes for this promotion</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs value={codeGenerationMode} onValueChange={(v: string) => setCodeGenerationMode(v as 'upload' | 'generate')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="generate" className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4" />
                    {t('promotionsPage.createPage.generateCodes')}
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
                      onValueChange={(value: CodeFormat) => setGenerateOptions({ ...generateOptions, format: value })}
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

          {/* Scheduling & Limits Card */}
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

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions Card */}
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('promotionsPage.editPage.actions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                type="button"
                className="w-full h-11"
                onClick={handleSubmit}
                disabled={updatePromotionMutation.isPending}
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
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleCancel}
                disabled={updatePromotionMutation.isPending}
              >
                {t('promotionsPage.createPage.cancel')}
              </Button>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('promotionsPage.editPage.promotionInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{t('promotionsPage.editPage.created')}</p>
                  <p className="text-sm font-medium">
                    {(promotion as any)?.createdAt ? new Date((promotion as any).createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{t('promotionsPage.editPage.lastUpdated')}</p>
                  <p className="text-sm font-medium">
                    {(promotion as any)?.updatedAt ? new Date((promotion as any).updatedAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{t('promotionsPage.editPage.timesUsed')}</p>
                  <p className="text-sm font-medium">{(promotion as any)?.usageCount || 0}</p>
                </div>
                {(promotion as any)?.maxUses && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{t('promotionsPage.editPage.maxUses')}</p>
                      <p className="text-sm font-medium">{(promotion as any).maxUses}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Usage Progress */}
              {(promotion as any)?.maxUses && (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Usage</span>
                    <span className="text-xs font-medium">
                      {(promotion as any)?.usageCount || 0} / {(promotion as any).maxUses}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: `${Math.min(((promotion as any)?.usageCount || 0) / (promotion as any).maxUses * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
