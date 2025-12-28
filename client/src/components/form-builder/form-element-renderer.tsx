import { FormElement } from "@/types/form-builder";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RateScale } from "@/components/ui/rate-scale";
import { BooleanSwitch } from "@/components/ui/boolean-switch";
import { NumberInput } from "@/components/ui/number-input";
import { FullName } from "@/components/ui/full-name";
import { DropInsertionIndicator } from './drop-insertion-indicator';
import { useTranslation as useLabelTranslation } from '@/hooks/use-translation';
import { useTranslation as useI18n } from 'react-i18next';

interface FormElementRendererProps {
  element: FormElement;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<FormElement>) => void;
  previewMode: boolean;
  onMobileEdit?: (id: string) => void;
  isDragging?: boolean;
  showDropIndicators?: boolean;
  elementIndex?: number;
}

export function FormElementRenderer({
  element,
  isSelected,
  onSelect,
  onRemove,
  previewMode,
  onMobileEdit,
  isDragging = false,
  showDropIndicators = false,
  elementIndex = 0,
}: FormElementRendererProps) {
  const { getLabel } = useLabelTranslation();
  const { t } = useI18n();
  const translatedLabel = getLabel({ label: element.label, labelTranslations: element.labelTranslations || {} });

  const handleClick = (e: React.MouseEvent) => {
    if (previewMode) return;
    e.stopPropagation();
    onSelect(element.id);
  };

  const renderFormControl = () => {
    switch (element.type) {
      case "text-input":
        return (
          <Input
            type="text"
            placeholder={element.placeholder}
            required={element.required}
            disabled={element.disabled || isDragging}
            readOnly={element.readonly}
            name={element.name}
            className="focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            tabIndex={isDragging ? -1 : undefined}
          />
        );

      case "email-input":
        return (
          <Input
            type="email"
            placeholder={element.placeholder}
            required={element.required}
            disabled={element.disabled || isDragging}
            readOnly={element.readonly}
            name={element.name}
            className="focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            tabIndex={isDragging ? -1 : undefined}
          />
        );

      case "number-input":
        return (
          <NumberInput
            variant={element.numberVariant || "number"}
            placeholder={element.placeholder}
            required={element.required}
            disabled={element.disabled || isDragging}
            readOnly={element.readonly}
            name={element.name}
            min={element.validation?.min}
            max={element.validation?.max}
            className="focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            tabIndex={isDragging ? -1 : undefined}
          />
        );

      case "textarea":
        return (
          <Textarea
            placeholder={element.placeholder}
            required={element.required}
            disabled={element.disabled || isDragging}
            readOnly={element.readonly}
            name={element.name}
            className="focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
            tabIndex={isDragging ? -1 : undefined}
          />
        );

      case "select":
        return (
          <Select
            name={element.name}
            required={element.required}
            disabled={element.disabled || isDragging}
          >
            <SelectTrigger
              className="focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              tabIndex={isDragging ? -1 : undefined}
            >
              <SelectValue
                placeholder={element.placeholder || "Choose an option"}
              />
            </SelectTrigger>
            <SelectContent>
              {element.options?.map((option, index) => (
                <SelectItem
                  key={index}
                  value={option.toLowerCase().replace(/\s+/g, "-")}
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "checkbox":
        return (
          <div className="space-y-2">
            {element.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  id={`${element.id}-${index}`}
                  name={element.name}
                  value={option.toLowerCase().replace(/\s+/g, "-")}
                  disabled={element.disabled || isDragging}
                  tabIndex={isDragging ? -1 : undefined}
                />
                <Label htmlFor={`${element.id}-${index}`} className="text-sm">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        );

      case "radio":
        return (
          <RadioGroup name={element.name} disabled={element.disabled}>
            {element.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={option.toLowerCase().replace(/\s+/g, "-")}
                  id={`${element.id}-${index}`}
                />
                <Label htmlFor={`${element.id}-${index}`} className="text-sm">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );



      case "image":
        return (
          <div className="w-full">
            <div className="relative w-full aspect-square bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg overflow-hidden">
              {element.src ? (
                <img
                  src={element.src}
                  alt={element.alt || element.label}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center text-slate-500 ${element.src ? "hidden" : ""}`}
              >
                <svg
                  className="w-16 h-16 mb-3 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-4.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                  />
                </svg>
                <p className="text-sm font-medium">Image Placeholder</p>
                <p className="text-xs text-slate-400 mt-1">
                  Click to configure image source
                </p>
              </div>
            </div>
          </div>
        );

      case "rate-scale":
        return (
          <RateScale
            min={element.validation?.min || 1}
            max={element.validation?.max || 10}
            disabled={element.disabled || isDragging}
            className="justify-center"
            variant={element.rateVariant || 'numbers'}
          />
        );

      case "boolean-switch":
        return (
          <BooleanSwitch
            disabled={element.disabled || isDragging}
            className="justify-center"
          />
        );

      case "datetime-picker":
        return (
          <Input
            type={(!element.dateTimeVariant || element.dateTimeVariant === 'date-only') ? 'date' : element.dateTimeVariant === 'time-only' ? 'time' : 'datetime-local'}
            placeholder={element.placeholder}
            required={element.required}
            disabled={element.disabled || isDragging}
            name={element.name}
            className="focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            tabIndex={isDragging ? -1 : undefined}
          />
        );

      case "full-name":
        return (
          <FullName
            name={element.name}
            required={element.required}
            disabled={element.disabled || isDragging}
            readonly={element.readonly}
            firstNamePlaceholder={t('auth.firstName', 'First Name')}
            lastNamePlaceholder={t('auth.lastName', 'Last Name')}
            size={element.styling?.size || 'medium'}
          />
        );

      case "label":
        const labelSizeClasses = {
          'h1': 'text-3xl font-bold',
          'h2': 'text-2xl font-bold',
          'h3': 'text-xl font-semibold',
          'h4': 'text-lg font-semibold',
          'body': 'text-base',
          'small': 'text-sm',
        };
        const sizeClass = labelSizeClasses[element.labelSize || 'body'];
        const textColor = element.labelTextColor || 'inherit';
        const subtextColor = element.labelSubtextColor || 'inherit';
        
        return (
          <div className="w-full">
            <div 
              className={sizeClass}
              style={{ color: textColor }}
            >
              {translatedLabel}
            </div>
            {element.labelSubtext && (
              <div 
                className="mt-1 text-sm"
                style={{ color: subtextColor }}
              >
                {element.labelSubtext}
              </div>
            )}
          </div>
        );

      default:
        return <div>Unknown element type</div>;
    }
  };

  const containerClasses = previewMode
    ? "space-y-3"
    : `form-element group relative border-2 transition-all duration-300 p-3 md:p-5 rounded-lg md:rounded-xl cursor-pointer hover:shadow-lg hover:shadow-blue-100/20 select-none ${
        isSelected
          ? "border-blue-400 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 shadow-md shadow-blue-200/25"
          : "border-transparent hover:border-blue-200 bg-white"
      }`;

  return (
    <>
      {/* Top drop insertion indicator - Desktop only */}
      {showDropIndicators && !previewMode && (
        <DropInsertionIndicator
          id={`insert-top-${element.id}`}
          position="top"
          elementId={element.id}
          isVisible={true}
        />
      )}
      
      <div className={containerClasses} onClick={handleClick}>
        {!previewMode && (
        <>
          {/* Selection indicator */}
          {isSelected && (
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-r-full"></div>
          )}

          {/* Delete button - Desktop (top-center) */}
          <div className="hidden lg:block absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <Button
              size="sm"
              variant="destructive"
              className="w-8 h-8 p-0 rounded-full shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(element.id);
              }}
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </Button>
          </div>



          {/* Removed mobile edit indicator - now in vertical control panel */}

          {/* Mobile delete button - top-center */}
          {isSelected && (
            <div className="lg:hidden absolute -top-3 left-1/2 -translate-x-1/2 transition-opacity duration-200 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(element.id);
                }}
                className="w-5 h-5 rounded-full shadow-lg flex items-center justify-center transition-all bg-red-500 hover:bg-red-600 text-white shadow-red-200"
                title="Delete"
              >
                <svg
                  className="w-2.5 h-2.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Mobile settings button only */}
          {isSelected && (
            <div className="lg:hidden absolute -right-4 top-1/2 -translate-y-1/2 transition-opacity duration-200 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMobileEdit?.(element.id);
                }}
                className="w-8 h-8 rounded-full shadow-lg flex items-center justify-center transition-all bg-slate-500 hover:bg-slate-600 text-white shadow-slate-200"
                title="Edit properties"
              >
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          )}
        </>
      )}

        {/* Content - no margin needed since buttons are outside */}
        <div>
          {element.type !== 'label' && (
            <Label className="block text-sm font-medium text-neutral-700 mb-2">
              {translatedLabel}
              {element.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
          )}

          {renderFormControl()}

          {element.type !== 'label' && element.helpText && (
            <div className="text-xs text-neutral-500 mt-1">
              {element.helpText}
            </div>
          )}
        </div>
      </div>
      
      {/* Bottom drop insertion indicator - Desktop only */}
      {showDropIndicators && !previewMode && (
        <DropInsertionIndicator
          id={`insert-bottom-${element.id}`}
          position="bottom"
          elementId={element.id}
          isVisible={true}
        />
      )}
    </>
  );
}
