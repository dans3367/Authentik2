import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Trash2, X, Plus, ChevronDown } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';

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
  };
  elements?: any[];
  tags?: string[];
  onUpdateTags?: (tags: string[]) => void;
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
  onClearForm,
  hideClearButton = false
}: FormPropertiesProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [availableTags, setAvailableTags] = useState<Array<{id: string, name: string, color: string}>>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  
  const {
    description = '',
    showProgressBar = false,
    allowSaveProgress = false,
    showFormTitle = true,
    compactMode = false,
  } = settings;

  const handleSettingChange = (key: string, value: any) => {
    if (onUpdateSettings) {
      onUpdateSettings({
        ...settings,
        [key]: value,
      });
    }
  };

  // Fetch available tags on component mount
  useEffect(() => {
    fetchAvailableTags();
  }, []);

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

  return (
    <Card className="w-80 border-l border-neutral-200">
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
placeholder={t('formBuilder.properties.formTitlePlaceholder','Enter form title...')}
                className="focus:ring-2 focus:ring-blue-500"
              />
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
placeholder={t('formBuilder.properties.formDescriptionPlaceholder','Add a description to help users understand the form...')}
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



            {/* Form Options */}
            <div className="space-y-3">
<h4 className="text-sm font-medium text-neutral-700">{t('formBuilder.properties.formOptions','Form Options')}</h4>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="compact-mode"
                  checked={compactMode}
                  onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
                  className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                />
<Label htmlFor="compact-mode" className="text-xs text-neutral-600">
                  {t('formBuilder.properties.compactMode','Compact Mode (2 fields per row)')}
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="show-title"
                  checked={showFormTitle}
                  onChange={(e) => handleSettingChange('showFormTitle', e.target.checked)}
                  className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                />
<Label htmlFor="show-title" className="text-xs text-neutral-600">
                  {t('formBuilder.properties.showFormTitle','Show form title')}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="show-progress"
                  checked={showProgressBar}
                  onChange={(e) => handleSettingChange('showProgressBar', e.target.checked)}
                  className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                />
<Label htmlFor="show-progress" className="text-xs text-neutral-600">
                  {t('formBuilder.properties.showProgressBar','Show progress bar')}
                </Label>
              </div>

              
            </div>

            {/* Form Info */}
            <div className="pt-2 border-t border-neutral-200">
              <div className="text-xs text-neutral-500 space-y-1">
                <div className="flex justify-between">
<span>{t('formBuilder.properties.fields','Fields')}:</span>
                  <span className="font-medium">{elements.length}</span>
                </div>
                <div className="flex justify-between">
<span>{t('formBuilder.properties.required','Required')}:</span>
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
{t('formBuilder.properties.clearForm','Clear form')}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}