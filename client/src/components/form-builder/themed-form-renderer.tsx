import { FormElement, FormTheme } from '@/types/form-builder';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RateScale } from '@/components/ui/rate-scale';
import { NumberInput } from '@/components/ui/number-input';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { HeadlessUIBooleanSwitch, HeadlessUIRadioGroup, HeadlessUICheckbox, HeadlessUIDateTimePicker, HeadlessUISelect } from './headlessui-form-components';
import { ThemedFullName } from '@/components/ui/themed-full-name';
import { useTranslation as useLabelTranslation } from '@/hooks/use-translation';
import { useTranslation as useI18n } from 'react-i18next';

// Extended type for preview elements that includes buttons and spacer
type PreviewFormElement = FormElement | {
  id: string;
  type: 'submit-button' | 'reset-button' | 'spacer';
  label: string;
  name: string;
  required: boolean;
  styling?: {
    width: 'full' | 'half' | 'third';
    size: 'small' | 'medium' | 'large';
  };
};

interface ThemedFormRendererProps {
  element: PreviewFormElement;
  themeStyles: FormTheme['styles'];
  onChange?: (fieldName: string, value: any) => void;
  onReset?: () => void;
}

export function ThemedFormRenderer({ element, themeStyles, onChange, onReset }: ThemedFormRendererProps) {
  const { getLabel } = useLabelTranslation();
  const { t } = useI18n();
  const translatedLabel = getLabel(element as any);

  const renderFormControl = () => {
    const baseInputClasses = themeStyles.input;
    
    // Special handling for glassmorphism theme to force transparency
    const isGlassmorphism = themeStyles.input.includes('glassmorphism-input');
    
    const forceTransparentStyle: React.CSSProperties = isGlassmorphism ? {
      background: 'transparent',
      backgroundColor: 'transparent',
      backgroundImage: 'none',
      opacity: '1',
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      appearance: 'none'
    } : {};
    
    switch (element.type) {
      case 'text-input':
        return (
          <Input
            type="text"
            placeholder={element.placeholder}
            required={element.required}
            disabled={element.disabled}
            readOnly={element.readonly}
            name={element.name}
            minLength={element.validation?.minLength}
            maxLength={element.validation?.maxLength}
            className={baseInputClasses}
            style={forceTransparentStyle}
            onChange={(e) => onChange?.(element.name, e.target.value)}
          />
        );

      case 'email-input':
        return (
          <Input
            type="email"
            placeholder={element.placeholder}
            required={element.required}
            disabled={element.disabled}
            readOnly={element.readonly}
            name={element.name}
            className={baseInputClasses}
            style={forceTransparentStyle}
            onChange={(e) => onChange?.(element.name, e.target.value)}
          />
        );

      case 'number-input':
        return (
          <NumberInput
            variant={element.numberVariant || "number"}
            placeholder={element.placeholder}
            required={element.required}
            disabled={element.disabled}
            readOnly={element.readonly}
            name={element.name}
            min={element.validation?.min}
            max={element.validation?.max}
            className={baseInputClasses}
            onChange={(value) => onChange?.(element.name, value)}
          />
        );

      case 'textarea':
        return (
          <Textarea
            placeholder={element.placeholder}
            required={element.required}
            disabled={element.disabled}
            readOnly={element.readonly}
            name={element.name}
            rows={4}
            minLength={element.validation?.minLength}
            maxLength={element.validation?.maxLength}
            className={baseInputClasses}
            style={forceTransparentStyle}
            onChange={(e) => onChange?.(element.name, e.target.value)}
          />
        );

      case 'select':
        return (
          <HeadlessUISelect
            name={element.name}
            options={element.options || []}
            placeholder={element.placeholder || 'Select an option...'}
            required={element.required}
            disabled={element.disabled}
            themeStyles={themeStyles}
            onChange={(value) => onChange?.(element.name, value)}
          />
        );

      case 'checkbox':
        return (
          <div className="space-y-3">
            {element.options?.map((option, index) => (
              <HeadlessUICheckbox
                key={index}
                name={element.name}
                value={option}
                label={option}
                themeStyles={themeStyles}
                onChange={(checked, value) => onChange?.(element.name + '_' + value, checked)}
              />
            ))}
          </div>
        );

      case 'radio':
        return (
          <HeadlessUIRadioGroup
            name={element.name}
            options={element.options || []}
            themeStyles={themeStyles}
            onChange={(value) => onChange?.(element.name, value)}
          />
        );

      case 'image':
        return (
          <div className="w-full aspect-square bg-gray-100 border border-gray-200 rounded flex items-center justify-center overflow-hidden">
            {element.src ? (
              <img
                src={element.src}
                alt={(element as any).alt || translatedLabel || 'Form image'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement!.innerHTML = `
                    <div class="text-center text-gray-500">
                      <svg class="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                      </svg>
                      <div class="text-sm">Image failed to load</div>
                    </div>
                  `;
                }}
              />
            ) : (
              <div className="text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                </svg>
                <div className="text-sm">No image source</div>
              </div>
            )}
          </div>
        );

      case 'spacer':
        return (
          <div className="h-[35px]" />
        );

      case 'submit-button':
        return (
          <button
            type="submit"
            className={`${themeStyles.button}`}
          >
            {translatedLabel}
          </button>
        );

      case 'reset-button':
        return (
          <button
            type="reset"
            onClick={(e) => {
              e.preventDefault();
              onReset?.();
            }}
            className={`${themeStyles.button.replace('bg-blue-600', 'bg-gray-600').replace('hover:bg-blue-700', 'hover:bg-gray-700')}`}
          >
            {element.label}
          </button>
        );

      case 'rate-scale':
        return (
          <RateScale
            name={element.name}
            required={element.required}
            disabled={(element as FormElement).disabled}
            min={(element as FormElement).validation?.min || 1}
            max={(element as FormElement).validation?.max || 10}
            variant={(element as FormElement).rateVariant || "numbers"}
            showNumbers={(element as FormElement).rateVariant === "numbers" || !(element as FormElement).rateVariant}
            className="justify-center"
            onValueChange={(value) => onChange?.(element.name, value)}
          />
        );

      case 'boolean-switch':
        return (
          <HeadlessUIBooleanSwitch
            name={element.name}
            required={element.required}
            disabled={(element as FormElement).disabled}
            variant={(element as FormElement).booleanVariant || "yes-no"}
            showLabels={true}
            className="justify-center"
            themeStyles={themeStyles}
            onValueChange={(value) => onChange?.(element.name, value)}
          />
        );

      case 'datetime-picker':
        return (
          <HeadlessUIDateTimePicker
            label=""
            name={element.name}
            required={element.required}
            disabled={(element as FormElement).disabled}
            variant={(element as FormElement).dateTimeVariant || "date-only"}
            themeStyles={themeStyles}
            placeholder={element.placeholder}
            onChange={(value) => onChange?.(element.name, value)}
          />
        );

      case 'full-name':
        return (
          <ThemedFullName
            name={element.name}
            required={element.required}
            disabled={(element as FormElement).disabled}
            readonly={(element as FormElement).readonly}
            firstNamePlaceholder={t('auth.firstName', 'First Name')}
            lastNamePlaceholder={t('auth.lastName', 'Last Name')}
            themeStyles={themeStyles}
            onChange={(firstName, lastName) => {
              onChange?.(element.name + '_first', firstName);
              onChange?.(element.name + '_last', lastName);
            }}
          />
        );

      default:
        return <div className="text-red-500">Unknown element type: {(element as any).type}</div>;
    }
  };

  // Handle special types separately since they don't need labels
  if (element.type === 'submit-button' || element.type === 'reset-button' || element.type === 'spacer') {
    return renderFormControl();
  }

  // Wrap the entire field in a div to keep label and input together
  return (
    <div className={themeStyles.field}>
      {element.type !== 'image' && (
        <label className={themeStyles.label}>
          {translatedLabel}
          {element.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      {renderFormControl()}
      
      {(element as FormElement).helpText && (
        <p className="text-sm text-gray-500 mt-1">{(element as FormElement).helpText}</p>
      )}
    </div>
  );
}