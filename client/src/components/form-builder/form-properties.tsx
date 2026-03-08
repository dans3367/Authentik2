import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Trash2, X, Plus, ChevronDown, ClipboardList, FileQuestion, Mail, Megaphone, Loader2, FileText, Search, Star, Eye } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { FormCategory } from '@/types/form-builder';
import { apiRequest } from '@/lib/queryClient';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { FormLanguage, languageOptions } from '@/utils/form-translations';

interface FormPropertiesProps {
  formTitle: string;
  onUpdateFormTitle: (title: string) => void;
  onUpdateSettings?: (settings: any) => void;
  settings?: {
    description?: string;
    showProgressBar?: boolean;
    allowSaveProgress?: boolean;
    showFormTitle?: boolean;
    compactMode?: boolean;
    language?: FormLanguage;
    promotionEnabled?: boolean;
    promotionId?: string;
    templateEmailEnabled?: boolean;
    templateId?: string;
  };
  elements?: any[];
  tags?: string[];
  onUpdateTags?: (tags: string[]) => void;
  category?: FormCategory;
  onUpdateCategory?: (category: FormCategory) => void;
  onClearForm?: () => void;
  hideClearButton?: boolean;
}

export function FormProperties({
  formTitle,
  onUpdateFormTitle,
  onUpdateSettings,
  settings = {},
  elements = [],
  tags = [],
  onUpdateTags,
  category = 'intake',
  onUpdateCategory,
  onClearForm,
  hideClearButton = false
}: FormPropertiesProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [availableTags, setAvailableTags] = useState<Array<{ id: string, name: string, color: string }>>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<FormCategory | null>(null);
  const [availablePromotions, setAvailablePromotions] = useState<Array<{ id: string, title: string, description?: string, content: string, type: string, targetAudience: string, isActive: boolean, usageCount?: number }>>([]);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(false);
  const [promotionPickerOpen, setPromotionPickerOpen] = useState(false);
  const [promotionPickerSearch, setPromotionPickerSearch] = useState('');
  const [previewPromotion, setPreviewPromotion] = useState<typeof availablePromotions[number] | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<Array<{ id: string, name: string, subjectLine: string, category: string, body: string, preview?: string | null, isFavorite?: boolean, usageCount?: number, tags?: string[] }>>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templatePickerSearch, setTemplatePickerSearch] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<typeof availableTemplates[number] | null>(null);
  const [masterEmailDesign, setMasterEmailDesign] = useState<{
    companyName?: string; headerMode?: string; logoUrl?: string; logoSize?: string; logoAlignment?: string;
    bannerUrl?: string; showCompanyName?: string; primaryColor?: string; secondaryColor?: string;
    accentColor?: string; fontFamily?: string; headerText?: string; footerText?: string;
    socialLinks?: { facebook?: string; twitter?: string; instagram?: string; linkedin?: string };
  } | null>(null);

  const {
    description = '',
    showProgressBar = false,
    allowSaveProgress = false,
    showFormTitle = true,
    compactMode = false,
    language = 'en' as FormLanguage,
    promotionEnabled = false,
    promotionId = '',
    templateEmailEnabled = false,
    templateId = '',
  } = settings;

  const handleSettingChange = (key: string, value: any) => {
    if (onUpdateSettings) {
      onUpdateSettings((prev: typeof settings) => ({
        ...prev,
        [key]: value,
      }));
    }
  };

  // Fetch available tags and promotions on component mount
  useEffect(() => {
    fetchAvailableTags();
    fetchAvailablePromotions();
    fetchAvailableTemplates();
    fetchMasterEmailDesign();
  }, []);

  const fetchMasterEmailDesign = async () => {
    try {
      const response = await fetch('/api/master-email-design', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMasterEmailDesign(data);
      }
    } catch (error) {
      console.error('Failed to fetch master email design:', error);
    }
  };

  const fetchAvailableTags = async () => {
    try {
      setIsLoadingTags(true);
      const response = await apiRequest('GET', '/api/form-tags');
      const data = await response.json();
      setAvailableTags(data.tags || []);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const fetchAvailablePromotions = async () => {
    try {
      setIsLoadingPromotions(true);
      const response = await apiRequest('GET', '/api/promotions?isActive=true');
      const data = await response.json();
      setAvailablePromotions((data.promotions || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description || '',
        content: p.content || '',
        type: p.type,
        targetAudience: p.targetAudience || 'all',
        isActive: p.isActive,
        usageCount: p.usageCount || 0,
      })));
    } catch (error) {
      console.error('Failed to fetch promotions:', error);
    } finally {
      setIsLoadingPromotions(false);
    }
  };

  const fetchAvailableTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const response = await apiRequest('GET', '/api/templates?limit=100');
      const data = await response.json();
      setAvailableTemplates((data.templates || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        subjectLine: t.subjectLine,
        category: t.category,
        body: t.body || '',
        preview: t.preview || null,
        isFavorite: t.isFavorite || false,
        usageCount: t.usageCount || 0,
        tags: t.tags || [],
      })));
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear all form data? This action cannot be undone.')) {
      onClearForm?.();
    }
  };

  const handleAssignTag = (tagId: string) => {
    if (!tags.includes(tagId)) {
      onUpdateTags?.([...tags, tagId]);
    }
  };

  const handleRemoveTag = (tagId: string) => {
    onUpdateTags?.(tags.filter(id => id !== tagId));
  };

  const getTagById = (tagId: string) => {
    return availableTags.find(tag => tag.id === tagId);
  };

  const handleCategoryClick = (newCategory: FormCategory) => {
    if (newCategory === 'email-signup' && elements.length > 0 && category !== 'email-signup') {
      setPendingCategory(newCategory);
      setIsWarningOpen(true);
    } else {
      onUpdateCategory?.(newCategory);
    }
  };

  const confirmCategoryChange = () => {
    if (pendingCategory) {
      onUpdateCategory?.(pendingCategory);
      setPendingCategory(null);
    }
    setIsWarningOpen(false);
  };

  return (
    <Card className="w-80 border-l border-neutral-200">
      <AlertDialog open={isWarningOpen} onOpenChange={setIsWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('formBuilder.properties.categoryChangeTitle', 'Change Form Type?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('formBuilder.properties.categoryChangeWarning', 'Switching to Email Signup will clear all existing form elements. This action cannot be undone. Are you sure you want to continue?')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingCategory(null)}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCategoryChange} className="bg-red-600 hover:bg-red-700">{t('common.continue', 'Continue')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-neutral-50 transition-colors">
            <CardTitle className="text-base flex items-center justify-between">
              {t('formBuilder.properties.title', 'Form Properties')}
              <svg
                className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Form Title */}
            <div>
              <Label htmlFor="form-title" className="text-sm font-medium text-neutral-700 mb-2">
                {t('formBuilder.properties.formTitle', 'Form Title')}
              </Label>
              <Input
                id="form-title"
                value={formTitle}
                onChange={(e) => onUpdateFormTitle(e.target.value)}
                placeholder={t('formBuilder.properties.formTitlePlaceholder', 'Enter form title...')}
                className="focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Form Category */}
            <div>
              <Label className="text-sm font-medium text-neutral-700 mb-2">
                {t('formBuilder.properties.formCategory', 'Form Type')}
              </Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => handleCategoryClick('intake')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all duration-200 ${category === 'intake'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                >
                  <ClipboardList className="w-5 h-5" />
                  <span className="text-xs font-medium">{t('formBuilder.properties.intakeForms', 'Intake')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryClick('survey')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all duration-200 ${category === 'survey'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                >
                  <FileQuestion className="w-5 h-5" />
                  <span className="text-xs font-medium">{t('formBuilder.properties.surveyForms', 'Survey')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryClick('email-signup')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all duration-200 ${category === 'email-signup'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                >
                  <Mail className="w-5 h-5" />
                  <span className="text-xs font-medium">{t('formBuilder.properties.emailSignupForms', 'Email Signup')}</span>
                </button>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">
                {category === 'intake'
                  ? t('formBuilder.properties.intakeHint', 'Sign-ups, newsletters, lead capture')
                  : category === 'survey'
                    ? t('formBuilder.properties.surveyHint', 'Questionnaires, reviews, feedback')
                    : t('formBuilder.properties.emailSignupHint', 'Email-only collection with communication consent')}
              </p>
            </div>

            {/* Form Language */}
            <div>
              <Label className="text-sm font-medium text-neutral-700 mb-2">
                {t('formBuilder.properties.formLanguage', 'Form Language')}
              </Label>
              <select
                value={language}
                onChange={(e) => handleSettingChange('language', e.target.value as FormLanguage)}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              >
                {languageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-neutral-400 mt-1">
                {t('formBuilder.properties.formLanguageHint', 'Changes button texts (Submit, Reset) to the selected language')}
              </p>
            </div>

            {/* Form Description */}
            <div>
              <Label htmlFor="form-description" className="text-sm font-medium text-neutral-700 mb-2">
                {t('formBuilder.properties.formDescription', 'Form Description')}
              </Label>
              <Textarea
                id="form-description"
                value={description}
                onChange={(e) => handleSettingChange('description', e.target.value)}
                placeholder={t('formBuilder.properties.formDescriptionPlaceholder', 'Add a description to help users understand the form...')}
                className="focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                rows={3}
              />
            </div>

            {/* Tags */}
            <div>
              <Label className="text-sm font-medium text-neutral-700 mb-2">
                {t('formBuilder.properties.tags', 'Tags')}
              </Label>

              {/* Assigned Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tagId) => {
                    const tag = getTagById(tagId);
                    if (!tag) return null;
                    return (
                      <span
                        key={tagId}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md"
                        style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                      >
                        {tag.name}
                        <button
                          onClick={() => handleRemoveTag(tagId)}
                          className="hover:opacity-70 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Assign Tags Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                    disabled={isLoadingTags}
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      {t('formBuilder.properties.assignTags', 'Assign Tags')}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {availableTags.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-neutral-500">
                      {t('formBuilder.properties.noTags', 'No tags available')}
                    </div>
                  )}
                  {availableTags
                    .filter(tag => !tags.includes(tag.id))
                    .map((tag) => (
                      <DropdownMenuItem
                        key={tag.id}
                        onClick={() => handleAssignTag(tag.id)}
                        className="cursor-pointer"
                      >
                        <span
                          className="inline-flex items-center gap-2 px-2 py-1 text-xs rounded-md"
                          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>



            {/* Template Email Section - All form types */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                {t('formBuilder.properties.templateEmailSection', 'Confirmation Email Template')}
              </h4>
              <p className="text-[10px] text-neutral-400">
                {t('formBuilder.properties.templateEmailHint', 'Automatically send a template-based email to the submitter when this form is completed.')}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <Label htmlFor="enable-template-email" className="text-xs text-neutral-600">
                    {t('formBuilder.properties.enableTemplateEmail', 'Send Template Email on Submit')}
                  </Label>
                </div>
                <Switch
                  id="enable-template-email"
                  checked={templateEmailEnabled}
                  onCheckedChange={(checked) => {
                    if (onUpdateSettings) {
                      onUpdateSettings((prev: typeof settings) => ({
                        ...prev,
                        templateEmailEnabled: checked,
                        ...(checked ? {} : { templateId: '' }),
                      }));
                    }
                  }}
                />
              </div>
              {templateEmailEnabled && (
                <div className="space-y-2">
                  {/* Selected template chip or choose button */}
                  {templateId && availableTemplates.find(t => t.id === templateId) ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg border border-blue-200 bg-blue-50">
                      <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-blue-900 truncate">
                          {availableTemplates.find(t => t.id === templateId)?.name}
                        </p>
                        <p className="text-[10px] text-blue-600 truncate">
                          {availableTemplates.find(t => t.id === templateId)?.subjectLine}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSettingChange('templateId', '')}
                        className="p-0.5 rounded-full hover:bg-blue-200 transition-colors"
                      >
                        <X className="w-3 h-3 text-blue-600" />
                      </button>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center gap-2"
                    onClick={() => {
                      setTemplatePickerSearch('');
                      setPreviewTemplate(null);
                      setTemplatePickerOpen(true);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                    {templateId
                      ? t('formBuilder.properties.changeTemplate', 'Change Template')
                      : t('formBuilder.properties.browseTemplates', 'Browse & Select Template')}
                  </Button>

                  {/* Template Picker Modal */}
                  <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
                    <DialogContent className="max-w-5xl h-[80vh] p-0 flex flex-col">
                      <div className="px-6 pt-6 pb-4">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            {t('formBuilder.properties.templatePickerTitle', 'Select Email Template')}
                          </DialogTitle>
                          <DialogDescription>
                            {t('formBuilder.properties.templatePickerDesc', 'Choose the template to send as a confirmation email when someone submits this form.')}
                          </DialogDescription>
                        </DialogHeader>
                      </div>

                      <div className="px-6 flex-1 overflow-hidden flex flex-col gap-4">
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                          <Input
                            placeholder={t('formBuilder.properties.searchTemplates', 'Search templates by name or subject...')}
                            value={templatePickerSearch}
                            onChange={(e) => setTemplatePickerSearch(e.target.value)}
                            className="pl-10"
                          />
                        </div>

                        {/* Split pane: list + preview */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 flex-1 overflow-hidden">
                          {/* Template list */}
                          <div className="border rounded-lg overflow-hidden flex flex-col">
                            <div className="p-3 border-b bg-neutral-50 dark:bg-neutral-800 flex-shrink-0">
                              <Label className="text-sm font-medium">
                                {t('formBuilder.properties.availableTemplates', 'Available Templates')}
                                <span className="ml-1 text-neutral-400 font-normal">
                                  ({availableTemplates.filter(t =>
                                    !templatePickerSearch ||
                                    t.name.toLowerCase().includes(templatePickerSearch.toLowerCase()) ||
                                    t.subjectLine.toLowerCase().includes(templatePickerSearch.toLowerCase())
                                  ).length})
                                </span>
                              </Label>
                            </div>
                            <ScrollArea className="flex-1">
                              {isLoadingTemplates ? (
                                <div className="flex items-center justify-center py-12">
                                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                </div>
                              ) : availableTemplates.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                                  <FileText className="w-10 h-10 mb-2 opacity-40" />
                                  <p className="text-sm">{t('formBuilder.properties.noTemplates', 'No templates available. Create one in the Templates page.')}</p>
                                </div>
                              ) : (
                                <div className="p-2 space-y-1.5">
                                  {availableTemplates
                                    .filter(t =>
                                      !templatePickerSearch ||
                                      t.name.toLowerCase().includes(templatePickerSearch.toLowerCase()) ||
                                      t.subjectLine.toLowerCase().includes(templatePickerSearch.toLowerCase())
                                    )
                                    .map((tmpl) => (
                                      <button
                                        key={tmpl.id}
                                        type="button"
                                        onClick={() => setPreviewTemplate(tmpl)}
                                        className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-150 ${previewTemplate?.id === tmpl.id
                                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                                          : 'border-transparent hover:border-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                                          }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <h4 className="font-medium text-sm truncate">{tmpl.name}</h4>
                                              {tmpl.isFavorite && (
                                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                                              )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1 mb-1">
                                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                {tmpl.category}
                                              </Badge>
                                            </div>
                                            <p className="text-xs text-neutral-500 truncate">
                                              {tmpl.subjectLine}
                                            </p>
                                          </div>
                                          <div className="text-[10px] text-neutral-400 flex-shrink-0">
                                            {tmpl.usageCount || 0}× used
                                          </div>
                                        </div>
                                      </button>
                                    ))}
                                </div>
                              )}
                            </ScrollArea>
                          </div>

                          {/* Preview pane — email client style */}
                          <div className="border rounded-lg overflow-hidden flex flex-col">
                            <div className="p-3 border-b bg-neutral-50 dark:bg-neutral-800 flex-shrink-0">
                              <Label className="text-sm font-medium">
                                {t('formBuilder.properties.templatePreview', 'Preview')}
                              </Label>
                            </div>
                            <ScrollArea className="flex-1">
                              {previewTemplate ? (() => {
                                const d = masterEmailDesign || {};
                                const primaryColor = d.primaryColor || '#3B82F6';
                                const fontFamily = d.fontFamily || 'Arial, sans-serif';
                                const footerText = d.footerText || '© 2025 All rights reserved.';
                                const companyName = d.companyName || 'Your Company';
                                const showCompanyName = (d.showCompanyName ?? 'true') === 'true';
                                const headerMode = d.headerMode || 'logo';
                                const logoAlignment = (d.logoAlignment as 'left' | 'center' | 'right') || 'center';
                                const logoSizeMap: Record<string, string> = { small: '48px', medium: '72px', large: '96px', xlarge: '120px' };
                                const logoH = logoSizeMap[d.logoSize || 'medium'] || '72px';
                                const mlr = (align: string) => ({
                                  marginLeft: align === 'center' ? 'auto' : align === 'right' ? 'auto' : '0',
                                  marginRight: align === 'center' ? 'auto' : align === 'right' ? '0' : 'auto',
                                });
                                const isSafe = (url?: string) => {
                                  if (!url) return false;
                                  try { const p = new URL(url.trim()); return p.protocol === 'http:' || p.protocol === 'https:'; }
                                  catch { return url.trim().toLowerCase().startsWith('http://') || url.trim().toLowerCase().startsWith('https://'); }
                                };
                                const hasSocial = isSafe(d.socialLinks?.facebook) || isSafe(d.socialLinks?.twitter) || isSafe(d.socialLinks?.instagram) || isSafe(d.socialLinks?.linkedin);

                                return (
                                  <div className="bg-slate-100 dark:bg-slate-900/40 p-4">
                                    {/* Simulated email container */}
                                    <div className="bg-white text-slate-900 shadow-lg mx-auto rounded overflow-hidden max-w-[520px] w-full" style={{ fontFamily }}>
                                      {/* Email client header bar */}
                                      <div className="border-b bg-gray-50 px-4 py-3 text-xs text-gray-500">
                                        <div className="flex gap-2 mb-0.5">
                                          <span className="font-semibold w-12 text-right">To:</span>
                                          <span className="text-gray-900">customer@example.com</span>
                                        </div>
                                        <div className="flex gap-2">
                                          <span className="font-semibold w-12 text-right">Subject:</span>
                                          <span className="text-gray-900 font-bold truncate">{previewTemplate.subjectLine}</span>
                                        </div>
                                      </div>

                                      {/* Global email design header */}
                                      {headerMode === 'banner' && d.bannerUrl && isSafe(d.bannerUrl) ? (
                                        <div>
                                          <img
                                            src={d.bannerUrl}
                                            alt="Email banner"
                                            style={{ display: 'block', width: '100%', height: 'auto' }}
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                          />
                                          {(showCompanyName || d.headerText) && (
                                            <div className="px-6 py-3 text-center" style={{ backgroundColor: primaryColor, color: '#ffffff' }}>
                                              {showCompanyName && (
                                                <h1 className="text-lg font-bold mb-0.5 tracking-tight">{companyName}</h1>
                                              )}
                                              {d.headerText && (
                                                <p className="text-xs opacity-90">{d.headerText}</p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div
                                          className="px-6 py-5"
                                          style={{ backgroundColor: primaryColor, color: '#ffffff', textAlign: logoAlignment }}
                                        >
                                          {d.logoUrl && isSafe(d.logoUrl) ? (
                                            <img
                                              src={d.logoUrl}
                                              alt="Logo"
                                              className="mb-2 object-contain"
                                              style={{ height: logoH, display: 'block', ...mlr(logoAlignment) }}
                                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                          ) : (
                                            <div
                                              className="h-10 w-10 bg-white/20 rounded-full mb-2 flex items-center justify-center"
                                              style={mlr(logoAlignment)}
                                            >
                                              <span className="text-base font-bold opacity-80">{companyName.charAt(0)}</span>
                                            </div>
                                          )}
                                          {showCompanyName && (
                                            <h1 className="text-lg font-bold mb-1 tracking-tight">{companyName}</h1>
                                          )}
                                          {d.headerText && (
                                            <p className="text-xs opacity-90 max-w-xs leading-normal" style={mlr(logoAlignment)}>
                                              {d.headerText}
                                            </p>
                                          )}
                                        </div>
                                      )}

                                      {/* Template body content */}
                                      <div className="px-6 py-5">
                                        <div dangerouslySetInnerHTML={{ __html: previewTemplate.body }} />
                                      </div>

                                      {/* Global footer */}
                                      <div className="bg-slate-100 px-6 py-5 text-center border-t border-slate-200">
                                        {hasSocial && (
                                          <div className="flex justify-center gap-4 mb-4">
                                            {isSafe(d.socialLinks?.facebook) && (
                                              <span className="text-slate-400 text-xs">Facebook</span>
                                            )}
                                            {isSafe(d.socialLinks?.twitter) && (
                                              <span className="text-slate-400 text-xs">Twitter</span>
                                            )}
                                            {isSafe(d.socialLinks?.instagram) && (
                                              <span className="text-slate-400 text-xs">Instagram</span>
                                            )}
                                            {isSafe(d.socialLinks?.linkedin) && (
                                              <span className="text-slate-400 text-xs">LinkedIn</span>
                                            )}
                                          </div>
                                        )}
                                        <div className="text-[10px] text-slate-500 space-y-1 max-w-xs mx-auto">
                                          <p>{footerText}</p>
                                          <p className="text-slate-400">
                                            You are receiving this email because you submitted a form.
                                            <br />
                                            <span className="underline cursor-pointer">Unsubscribe</span>
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Template metadata below the email */}
                                    <div className="mt-3 px-1 space-y-1">
                                      <p className="text-[10px] text-neutral-400">
                                        <span className="font-medium text-neutral-500">{t('formBuilder.properties.templateName', 'Template')}:</span>{' '}
                                        {previewTemplate.name}
                                      </p>
                                      {previewTemplate.tags && previewTemplate.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {previewTemplate.tags.map((tag) => (
                                            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })() : (
                                <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
                                  <Eye className="w-10 h-10 mb-3 opacity-40" />
                                  <p className="text-sm">{t('formBuilder.properties.selectToPreview', 'Select a template to preview')}</p>
                                </div>
                              )}
                            </ScrollArea>
                          </div>
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="px-6 py-4 border-t bg-white dark:bg-neutral-900 flex items-center justify-between">
                        <div className="text-xs text-neutral-400">
                          {previewTemplate
                            ? `Selected: ${previewTemplate.name}`
                            : t('formBuilder.properties.noTemplateSelected', 'No template selected')}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setTemplatePickerOpen(false)}
                          >
                            {t('common.cancel', 'Cancel')}
                          </Button>
                          <Button
                            type="button"
                            disabled={!previewTemplate}
                            onClick={() => {
                              if (previewTemplate) {
                                handleSettingChange('templateId', previewTemplate.id);
                                setTemplatePickerOpen(false);
                              }
                            }}
                          >
                            {t('formBuilder.properties.useTemplate', 'Use This Template')}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>

            {/* Promotion Section - Only for email-signup */}
            {category === 'email-signup' && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-neutral-700">
                  {t('formBuilder.properties.promotionSection', 'Promotion')}
                </h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-emerald-600" />
                    <Label htmlFor="enable-promotion" className="text-xs text-neutral-600">
                      {t('formBuilder.properties.enablePromotion', 'Enable Promotion')}
                    </Label>
                  </div>
                  <Switch
                    id="enable-promotion"
                    checked={promotionEnabled}
                    onCheckedChange={(checked) => {
                      if (onUpdateSettings) {
                        onUpdateSettings((prev: typeof settings) => ({
                          ...prev,
                          promotionEnabled: checked,
                          ...(checked ? {} : { promotionId: '' }),
                        }));
                      }
                    }}
                  />
                </div>
                {promotionEnabled && (
                  <div className="space-y-2">
                    {/* Selected promotion chip or choose button */}
                    {promotionId && availablePromotions.find(p => p.id === promotionId) ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg border border-emerald-200 bg-emerald-50">
                        <Megaphone className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-emerald-900 truncate">
                            {availablePromotions.find(p => p.id === promotionId)?.title}
                          </p>
                          <p className="text-[10px] text-emerald-600 truncate">
                            {availablePromotions.find(p => p.id === promotionId)?.type}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSettingChange('promotionId', '')}
                          className="p-0.5 rounded-full hover:bg-emerald-200 transition-colors"
                        >
                          <X className="w-3 h-3 text-emerald-600" />
                        </button>
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full flex items-center gap-2"
                      onClick={() => {
                        setPromotionPickerSearch('');
                        setPreviewPromotion(null);
                        setPromotionPickerOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      {promotionId
                        ? t('formBuilder.properties.changePromotion', 'Change Promotion')
                        : t('formBuilder.properties.browsePromotions', 'Browse & Select Promotion')}
                    </Button>

                    {/* Promotion Picker Modal */}
                    <Dialog open={promotionPickerOpen} onOpenChange={setPromotionPickerOpen}>
                      <DialogContent className="max-w-5xl h-[80vh] p-0 flex flex-col">
                        <div className="px-6 pt-6 pb-4">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Megaphone className="w-5 h-5 text-emerald-600" />
                              {t('formBuilder.properties.promotionPickerTitle', 'Select Promotion')}
                            </DialogTitle>
                            <DialogDescription>
                              {t('formBuilder.properties.promotionPickerDesc', 'Choose a promotion to send to the user\'s email upon successful signup.')}
                            </DialogDescription>
                          </DialogHeader>
                        </div>

                        <div className="px-6 flex-1 overflow-hidden flex flex-col gap-4">
                          {/* Search */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                            <Input
                              placeholder={t('formBuilder.properties.searchPromotions', 'Search promotions by name or type...')}
                              value={promotionPickerSearch}
                              onChange={(e) => setPromotionPickerSearch(e.target.value)}
                              className="pl-10"
                            />
                          </div>

                          {/* Split pane: list + preview */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 flex-1 overflow-hidden">
                            {/* Promotion list */}
                            <div className="border rounded-lg overflow-hidden flex flex-col">
                              <div className="p-3 border-b bg-neutral-50 dark:bg-neutral-800 flex-shrink-0">
                                <Label className="text-sm font-medium">
                                  {t('formBuilder.properties.availablePromotions', 'Available Promotions')}
                                  <span className="ml-1 text-neutral-400 font-normal">
                                    ({availablePromotions.filter(p =>
                                      !promotionPickerSearch ||
                                      p.title.toLowerCase().includes(promotionPickerSearch.toLowerCase()) ||
                                      p.type.toLowerCase().includes(promotionPickerSearch.toLowerCase())
                                    ).length})
                                  </span>
                                </Label>
                              </div>
                              <ScrollArea className="flex-1">
                                {isLoadingPromotions ? (
                                  <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                  </div>
                                ) : availablePromotions.length === 0 ? (
                                  <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                                    <Megaphone className="w-10 h-10 mb-2 opacity-40" />
                                    <p className="text-sm">{t('formBuilder.properties.noPromotions', 'No active promotions available. Create one in the Promotions page.')}</p>
                                  </div>
                                ) : (
                                  <div className="p-2 space-y-1.5">
                                    {availablePromotions
                                      .filter(p =>
                                        !promotionPickerSearch ||
                                        p.title.toLowerCase().includes(promotionPickerSearch.toLowerCase()) ||
                                        p.type.toLowerCase().includes(promotionPickerSearch.toLowerCase())
                                      )
                                      .map((promo) => (
                                        <button
                                          key={promo.id}
                                          type="button"
                                          onClick={() => setPreviewPromotion(promo)}
                                          className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-150 ${previewPromotion?.id === promo.id
                                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm'
                                            : 'border-transparent hover:border-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                                            }`}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                              <h4 className="font-medium text-sm truncate mb-1">{promo.title}</h4>
                                              <div className="flex flex-wrap items-center gap-1 mb-1">
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                  {promo.type}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                  {promo.targetAudience}
                                                </Badge>
                                              </div>
                                              {promo.description && (
                                                <p className="text-xs text-neutral-500 truncate">
                                                  {promo.description}
                                                </p>
                                              )}
                                            </div>
                                            <div className="text-[10px] text-neutral-400 flex-shrink-0">
                                              {promo.usageCount || 0}× used
                                            </div>
                                          </div>
                                        </button>
                                      ))}
                                  </div>
                                )}
                              </ScrollArea>
                            </div>

                            {/* Preview pane — email client style */}
                            <div className="border rounded-lg overflow-hidden flex flex-col">
                              <div className="p-3 border-b bg-neutral-50 dark:bg-neutral-800 flex-shrink-0">
                                <Label className="text-sm font-medium">
                                  {t('formBuilder.properties.promotionPreview', 'Preview')}
                                </Label>
                              </div>
                              <ScrollArea className="flex-1">
                                {previewPromotion ? (() => {
                                  const d = masterEmailDesign || {};
                                  const primaryColor = d.primaryColor || '#3B82F6';
                                  const fontFamily = d.fontFamily || 'Arial, sans-serif';
                                  const footerText = d.footerText || '© 2025 All rights reserved.';
                                  const companyName = d.companyName || 'Your Company';
                                  const showCompanyName = (d.showCompanyName ?? 'true') === 'true';
                                  const headerMode = d.headerMode || 'logo';
                                  const logoAlignment = (d.logoAlignment as 'left' | 'center' | 'right') || 'center';
                                  const logoSizeMap: Record<string, string> = { small: '48px', medium: '72px', large: '96px', xlarge: '120px' };
                                  const logoH = logoSizeMap[d.logoSize || 'medium'] || '72px';
                                  const mlr = (align: string) => ({
                                    marginLeft: align === 'center' ? 'auto' : align === 'right' ? 'auto' : '0',
                                    marginRight: align === 'center' ? 'auto' : align === 'right' ? '0' : 'auto',
                                  });
                                  const isSafe = (url?: string) => {
                                    if (!url) return false;
                                    try { const p = new URL(url.trim()); return p.protocol === 'http:' || p.protocol === 'https:'; }
                                    catch { return url.trim().toLowerCase().startsWith('http://') || url.trim().toLowerCase().startsWith('https://'); }
                                  };
                                  const hasSocial = isSafe(d.socialLinks?.facebook) || isSafe(d.socialLinks?.twitter) || isSafe(d.socialLinks?.instagram) || isSafe(d.socialLinks?.linkedin);

                                  return (
                                    <div className="bg-slate-100 dark:bg-slate-900/40 p-4">
                                      <div className="bg-white text-slate-900 shadow-lg mx-auto rounded overflow-hidden max-w-[520px] w-full" style={{ fontFamily }}>
                                        {/* Email client header bar */}
                                        <div className="border-b bg-gray-50 px-4 py-3 text-xs text-gray-500">
                                          <div className="flex gap-2 mb-0.5">
                                            <span className="font-semibold w-12 text-right">To:</span>
                                            <span className="text-gray-900">customer@example.com</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold w-12 text-right">Subject:</span>
                                            <span className="text-gray-900 font-bold truncate">{previewPromotion.title}</span>
                                          </div>
                                        </div>

                                        {/* Global email design header */}
                                        {headerMode === 'banner' && d.bannerUrl && isSafe(d.bannerUrl) ? (
                                          <div>
                                            <img
                                              src={d.bannerUrl}
                                              alt="Email banner"
                                              style={{ display: 'block', width: '100%', height: 'auto' }}
                                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                            {(showCompanyName || d.headerText) && (
                                              <div className="px-6 py-3 text-center" style={{ backgroundColor: primaryColor, color: '#ffffff' }}>
                                                {showCompanyName && (
                                                  <h1 className="text-lg font-bold mb-0.5 tracking-tight">{companyName}</h1>
                                                )}
                                                {d.headerText && (
                                                  <p className="text-xs opacity-90">{d.headerText}</p>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div
                                            className="px-6 py-5"
                                            style={{ backgroundColor: primaryColor, color: '#ffffff', textAlign: logoAlignment }}
                                          >
                                            {d.logoUrl && isSafe(d.logoUrl) ? (
                                              <img
                                                src={d.logoUrl}
                                                alt="Logo"
                                                className="mb-2 object-contain"
                                                style={{ height: logoH, display: 'block', ...mlr(logoAlignment) }}
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                              />
                                            ) : (
                                              <div
                                                className="h-10 w-10 bg-white/20 rounded-full mb-2 flex items-center justify-center"
                                                style={mlr(logoAlignment)}
                                              >
                                                <span className="text-base font-bold opacity-80">{companyName.charAt(0)}</span>
                                              </div>
                                            )}
                                            {showCompanyName && (
                                              <h1 className="text-lg font-bold mb-1 tracking-tight">{companyName}</h1>
                                            )}
                                            {d.headerText && (
                                              <p className="text-xs opacity-90 max-w-xs leading-normal" style={mlr(logoAlignment)}>
                                                {d.headerText}
                                              </p>
                                            )}
                                          </div>
                                        )}

                                        {/* Promotion body content */}
                                        <div className="px-6 py-5">
                                          <div dangerouslySetInnerHTML={{ __html: previewPromotion.content }} />
                                        </div>

                                        {/* Global footer */}
                                        <div className="bg-slate-100 px-6 py-5 text-center border-t border-slate-200">
                                          {hasSocial && (
                                            <div className="flex justify-center gap-4 mb-4">
                                              {isSafe(d.socialLinks?.facebook) && (
                                                <span className="text-slate-400 text-xs">Facebook</span>
                                              )}
                                              {isSafe(d.socialLinks?.twitter) && (
                                                <span className="text-slate-400 text-xs">Twitter</span>
                                              )}
                                              {isSafe(d.socialLinks?.instagram) && (
                                                <span className="text-slate-400 text-xs">Instagram</span>
                                              )}
                                              {isSafe(d.socialLinks?.linkedin) && (
                                                <span className="text-slate-400 text-xs">LinkedIn</span>
                                              )}
                                            </div>
                                          )}
                                          <div className="text-[10px] text-slate-500 space-y-1 max-w-xs mx-auto">
                                            <p>{footerText}</p>
                                            <p className="text-slate-400">
                                              You are receiving this email because you signed up.
                                              <br />
                                              <span className="underline cursor-pointer">Unsubscribe</span>
                                            </p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Promotion metadata below the email */}
                                      <div className="mt-3 px-1 space-y-1">
                                        <p className="text-[10px] text-neutral-400">
                                          <span className="font-medium text-neutral-500">{t('formBuilder.properties.promotionSection', 'Promotion')}:</span>{' '}
                                          {previewPromotion.title}
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{previewPromotion.type}</Badge>
                                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{previewPromotion.targetAudience}</Badge>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })() : (
                                  <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
                                    <Eye className="w-10 h-10 mb-3 opacity-40" />
                                    <p className="text-sm">{t('formBuilder.properties.selectToPreviewPromotion', 'Select a promotion to preview')}</p>
                                  </div>
                                )}
                              </ScrollArea>
                            </div>
                          </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t bg-white dark:bg-neutral-900 flex items-center justify-between">
                          <div className="text-xs text-neutral-400">
                            {previewPromotion
                              ? `Selected: ${previewPromotion.title}`
                              : t('formBuilder.properties.noPromotionSelected', 'No promotion selected')}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setPromotionPickerOpen(false)}
                            >
                              {t('common.cancel', 'Cancel')}
                            </Button>
                            <Button
                              type="button"
                              disabled={!previewPromotion}
                              onClick={() => {
                                if (previewPromotion) {
                                  handleSettingChange('promotionId', previewPromotion.id);
                                  setPromotionPickerOpen(false);
                                }
                              }}
                            >
                              {t('formBuilder.properties.usePromotion', 'Use This Promotion')}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <p className="text-[10px] text-neutral-400">
                      {t('formBuilder.properties.promotionHint', 'The selected promotion will be sent to the user\'s email upon successful signup.')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Form Options */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-neutral-700">{t('formBuilder.properties.formOptions', 'Form Options')}</h4>

              {category !== 'email-signup' && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="compact-mode"
                    checked={compactMode}
                    onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
                    className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="compact-mode" className="text-xs text-neutral-600">
                    {t('formBuilder.properties.compactMode', 'Compact Mode (2 fields per row)')}
                  </Label>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="show-title"
                  checked={showFormTitle}
                  onChange={(e) => handleSettingChange('showFormTitle', e.target.checked)}
                  className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="show-title" className="text-xs text-neutral-600">
                  {t('formBuilder.properties.showFormTitle', 'Show form title')}
                </Label>
              </div>

              {category !== 'email-signup' && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="show-progress"
                    checked={showProgressBar}
                    onChange={(e) => handleSettingChange('showProgressBar', e.target.checked)}
                    className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="show-progress" className="text-xs text-neutral-600">
                    {t('formBuilder.properties.showProgressBar', 'Show progress bar')}
                  </Label>
                </div>
              )}


            </div>

            {/* Form Info */}
            <div className="pt-2 border-t border-neutral-200">
              <div className="text-xs text-neutral-500 space-y-1">
                <div className="flex justify-between">
                  <span>{t('formBuilder.properties.fields', 'Fields')}:</span>
                  <span className="font-medium">{elements.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('formBuilder.properties.required', 'Required')}:</span>
                  <span className="font-medium">{elements.filter(el => el.required).length}</span>
                </div>
              </div>
            </div>

            {/* Clear Form Button */}
            {!hideClearButton && (
              <div className="pt-2 border-t border-neutral-200">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearForm}
                  className="w-full flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('formBuilder.properties.clearForm', 'Clear form')}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}