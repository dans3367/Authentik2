import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Megaphone, ChevronDown, ChevronUp, Save, Upload, Wand2, Code, Copy, RefreshCw } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { generatePromotionalCodes, parseUserCodes, validatePromotionalCodes, formatCodesForDisplay, type CodeFormat } from '@/utils/codeGeneration';
import RichTextEditor from '@/components/LazyRichTextEditor';

const getPromotionTypeOptions = (t: any) => [
  { value: 'newsletter', label: t('promotionsPage.types.newsletter') },
  { value: 'survey', label: t('promotionsPage.types.survey') },
  { value: 'birthday', label: t('promotionsPage.types.birthday') },
  { value: 'announcement', label: t('promotionsPage.types.announcement') },
  { value: 'sale', label: t('promotionsPage.types.sale') },
  { value: 'event', label: t('promotionsPage.types.event') },
];

const getTargetAudienceOptions = (t: any) => [
  { value: 'all', label: t('promotionsPage.createPage.targetOptions.all') },
  { value: 'subscribers', label: t('promotionsPage.createPage.targetOptions.subscribers') },
  { value: 'customers', label: t('promotionsPage.createPage.targetOptions.customers') },
  { value: 'prospects', label: t('promotionsPage.createPage.targetOptions.prospects') },
  { value: 'vip', label: t('promotionsPage.createPage.targetOptions.vip') },
];

const getCodeFormatOptions = (t: any) => [
  { value: 'alphanumeric', label: t('promotionsPage.createPage.codeFormats.alphanumeric') },
  { value: 'alphabetic', label: t('promotionsPage.createPage.codeFormats.alphabetic') },
  { value: 'numeric', label: t('promotionsPage.createPage.codeFormats.numeric') },
];

const promotionTypeColors = {
  newsletter: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  survey: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  birthday: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  announcement: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  sale: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  event: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
};

export default function EditPromotionPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/promotions/:id/edit');
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // If route doesn't match, redirect to promotions list
  if (!match) {
    setLocation('/promotions');
    return null;
  }

  const promotionId = params?.id;

  // If no promotion ID, redirect
  if (!promotionId) {
    setLocation('/promotions');
    return null;
  }

  // Debug logging
  console.log('🔍 Edit page - Route match:', { match, params, promotionId });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    type: 'newsletter' as const,
    targetAudience: 'all',
    isActive: true,
    maxUses: '',
    validFrom: '',
    validTo: '',
    promotionalCodes: [] as string[],
  });
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Code generation state
  const [codeGenerationMode, setCodeGenerationMode] = useState<'upload' | 'generate'>('upload');
  const [userCodesInput, setUserCodesInput] = useState('');
  const [generateOptions, setGenerateOptions] = useState({
    count: 10,
    length: 8,
    format: 'alphanumeric' as CodeFormat,
    prefix: '',
    suffix: '',
  });
  const [isCodeSectionOpen, setIsCodeSectionOpen] = useState(false);

  // Get options with translations
  const promotionTypeOptions = getPromotionTypeOptions(t);
  const targetAudienceOptions = getTargetAudienceOptions(t);
  const codeFormatOptions = getCodeFormatOptions(t);

  // Fetch promotion data
  const { data: promotion, isLoading, error } = useQuery({
    queryKey: [`/api/promotions/${promotionId}`],
    queryFn: async () => {
      console.log('🔍 Fetching promotion with ID:', promotionId);
      const res = await apiRequest('GET', `/api/promotions/${promotionId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to fetch promotion' }));
        throw new Error(errorData.message || 'Failed to fetch promotion');
      }
      const json = await res.json();
      console.log('🔍 Promotion data received (JSON):', json);
      return json;
    },
    enabled: !!promotionId,
    retry: 1,
  });

  console.log('🔍 Query state:', { promotion, isLoading, error, enabled: !!promotionId });

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

      // Set user codes input if codes exist
      if (promotionData.promotionalCodes && promotionData.promotionalCodes.length > 0) {
        setUserCodesInput(formatCodesForDisplay(promotionData.promotionalCodes));
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
    const validation = validatePromotionalCodes(codes);

    if (validation.errors.length > 0) {
      setFormData({ ...formData, promotionalCodes: validation.valid });
    } else {
      setFormData({ ...formData, promotionalCodes: validation.valid });
    }
  };

  const handleGenerateCodes = () => {
    try {
      const codes = generatePromotionalCodes(generateOptions);
      setFormData({ ...formData, promotionalCodes: codes });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: t('promotionsPage.validation.error'),
        description: t('promotionsPage.validation.fillRequired'),
        variant: "destructive",
      });
      return;
    }

    // Validate promotional codes if any are provided
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

    // Prepare data with proper date conversion and validation
    const submitData = {
      ...formData,
      maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
      validFrom: formData.validFrom ? new Date(formData.validFrom + 'T00:00:00') : undefined,
      validTo: formData.validTo ? new Date(formData.validTo + 'T23:59:59') : undefined,
      promotionalCodes: formData.promotionalCodes.length > 0 ? formData.promotionalCodes : undefined,
    };

    // Validate date range
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
    <div className="container mx-auto p-4 lg:p-6 space-y-6 lg:space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('promotionsPage.createPage.backToPromotions')}
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            {t('promotionsPage.editPage.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('promotionsPage.editPage.subtitle')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  {t('promotionsPage.createPage.basicInformation')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">{t('promotionsPage.createPage.title')}</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder={t('promotionsPage.createPage.titlePlaceholder')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">{t('promotionsPage.createPage.type')}</Label>
                    <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {promotionTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t('promotionsPage.createPage.description')}</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('promotionsPage.createPage.descriptionPlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetAudience">{t('promotionsPage.createPage.targetAudience')}</Label>
                  <Select value={formData.targetAudience} onValueChange={(value) => setFormData({ ...formData, targetAudience: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {targetAudienceOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: !!checked })}
                  />
                  <Label htmlFor="isActive">{t('promotionsPage.createPage.active')}</Label>
                </div>
              </CardContent>
            </Card>

            {/* Content Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('promotionsPage.createPage.promotionContent')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="content">{t('promotionsPage.createPage.content')}</Label>
                  <RichTextEditor
                    value={formData.content}
                    onChange={(html) => setFormData({ ...formData, content: html })}
                    placeholder={t('promotionsPage.createPage.contentPlaceholder')}
                    className="min-h-[300px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('promotionsPage.createPage.contentHelp')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Code Generation Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  {t('promotionsPage.createPage.promotionalCodes')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Collapsible open={isCodeSectionOpen} onOpenChange={setIsCodeSectionOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-between mb-4"
                    >
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        {t('promotionsPage.createPage.codeGenerationOptions')}
                      </div>
                      {formData.promotionalCodes.length > 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {formData.promotionalCodes.length} codes
                        </span>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4">
                    {/* Code Generation Mode Selection */}
                    <div className="space-y-3">
                      <Label>{t('promotionsPage.createPage.chooseMethod')}</Label>
                      <RadioGroup
                        value={codeGenerationMode}
                        onValueChange={(value: 'upload' | 'generate') => setCodeGenerationMode(value)}
                        className="grid grid-cols-1 gap-4"
                      >
                        <div className="flex items-center space-x-2 border rounded-lg p-3">
                          <RadioGroupItem value="upload" id="upload" />
                          <Label htmlFor="upload" className="flex items-center gap-2 cursor-pointer flex-1">
                            <Upload className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{t('promotionsPage.createPage.uploadOwnCodes')}</div>
                              <div className="text-sm text-muted-foreground">{t('promotionsPage.createPage.uploadCodesDescription')}</div>
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 border rounded-lg p-3">
                          <RadioGroupItem value="generate" id="generate" />
                          <Label htmlFor="generate" className="flex items-center gap-2 cursor-pointer flex-1">
                            <Wand2 className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{t('promotionsPage.createPage.generateCodes')}</div>
                              <div className="text-sm text-muted-foreground">{t('promotionsPage.createPage.generateCodesDescription')}</div>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Upload Mode */}
                    {codeGenerationMode === 'upload' && (
                      <div className="space-y-3">
                        <Label htmlFor="userCodes">{t('promotionsPage.createPage.promotionalCodes')}</Label>
                        <Textarea
                          id="userCodes"
                          value={userCodesInput}
                          onChange={(e) => handleUserCodesChange(e.target.value)}
                          placeholder={t('promotionsPage.createPage.promotionalCodesPlaceholder')}
                          rows={6}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('promotionsPage.createPage.codesParsed')}
                        </p>
                      </div>
                    )}

                    {/* Generate Mode */}
                    {codeGenerationMode === 'generate' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="codeCount">{t('promotionsPage.createPage.numberOfCodes')}</Label>
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
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="codeLength">{t('promotionsPage.createPage.codeLength')}</Label>
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
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="codeFormat">{t('promotionsPage.createPage.codeFormat')}</Label>
                          <Select
                            value={generateOptions.format}
                            onValueChange={(value: CodeFormat) => setGenerateOptions({ ...generateOptions, format: value })}
                          >
                            <SelectTrigger>
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
                            <Label htmlFor="codePrefix">{t('promotionsPage.createPage.prefix')}</Label>
                            <Input
                              id="codePrefix"
                              value={generateOptions.prefix}
                              onChange={(e) => setGenerateOptions({
                                ...generateOptions,
                                prefix: e.target.value.toUpperCase()
                              })}
                              placeholder={t('promotionsPage.createPage.prefixPlaceholder')}
                              maxLength={10}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="codeSuffix">{t('promotionsPage.createPage.suffix')}</Label>
                            <Input
                              id="codeSuffix"
                              value={generateOptions.suffix}
                              onChange={(e) => setGenerateOptions({
                                ...generateOptions,
                                suffix: e.target.value.toUpperCase()
                              })}
                              placeholder={t('promotionsPage.createPage.suffixPlaceholder')}
                              maxLength={10}
                            />
                          </div>
                        </div>

                        <Button
                          type="button"
                          onClick={handleGenerateCodes}
                          className="w-full"
                          variant="secondary"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {t('promotionsPage.createPage.generateCodes')}
                        </Button>
                      </div>
                    )}

                    {/* Display Generated/Uploaded Codes */}
                    {formData.promotionalCodes.length > 0 && (
                      <div className="space-y-3 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <Label>{t('promotionsPage.createPage.generatedCodes', { count: formData.promotionalCodes.length })}</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleCopyCodesList}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              {t('promotionsPage.createPage.copyAll')}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setFormData({ ...formData, promotionalCodes: [] });
                                setUserCodesInput('');
                              }}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Clear
                            </Button>
                          </div>
                        </div>
                        <div className="bg-muted p-3 rounded-md max-h-40 overflow-y-auto">
                          <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                            {formatCodesForDisplay(formData.promotionalCodes)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            {/* Advanced Settings */}
            <Card>
              <CardHeader>
                <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto hover:bg-transparent"
                    >
                      <CardTitle className="flex items-center gap-2">
                        {t('promotionsPage.createPage.advancedSettings')}
                      </CardTitle>
                      {isAdvancedOpen ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              </CardHeader>
              <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="validFrom">{t('promotionsPage.createPage.validFrom')}</Label>
                        <Input
                          id="validFrom"
                          type="date"
                          value={formData.validFrom}
                          onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('promotionsPage.createPage.validFromHelp')}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="validTo">{t('promotionsPage.createPage.validTo')}</Label>
                        <Input
                          id="validTo"
                          type="date"
                          value={formData.validTo}
                          onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('promotionsPage.createPage.validToHelp')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxUses">{t('promotionsPage.createPage.maxUses')}</Label>
                      <Input
                        id="maxUses"
                        type="number"
                        min="1"
                        value={formData.maxUses}
                        onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                        placeholder={t('promotionsPage.createPage.maxUsesPlaceholder')}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('promotionsPage.createPage.maxUsesHelp')}
                      </p>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('promotionsPage.editPage.actions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  type="submit"
                  className="w-full"
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
              <CardHeader>
                <CardTitle>{t('promotionsPage.editPage.promotionInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">{t('promotionsPage.editPage.created')}</p>
                  <p className="font-medium">
                    {(promotion as any)?.createdAt ? new Date((promotion as any).createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('promotionsPage.editPage.lastUpdated')}</p>
                  <p className="font-medium">
                    {(promotion as any)?.updatedAt ? new Date((promotion as any).updatedAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('promotionsPage.editPage.timesUsed')}</p>
                  <p className="font-medium">{(promotion as any)?.usageCount || 0}</p>
                </div>
                {(promotion as any)?.maxUses && (
                  <div>
                    <p className="text-muted-foreground">{t('promotionsPage.editPage.maxUses')}</p>
                    <p className="font-medium">{(promotion as any).maxUses}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
