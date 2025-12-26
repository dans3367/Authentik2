export interface FormElement {
  id: string;
  type: FormElementType;
  label: string;
  labelTranslations?: Record<string, string>; // language code -> translated label
  placeholder?: string;
  helpText?: string;
  name: string;
  required: boolean;
  validation?: ValidationRules;
  styling?: ElementStyling;
  options?: string[]; // for select, radio, checkbox
  disabled?: boolean;
  readonly?: boolean;
  src?: string; // for image components
  alt?: string; // for image components
  rateVariant?: 'numbers' | 'faces' | 'stars'; // for rate-scale components
  booleanVariant?: 'yes-no' | 'true-false' | 'on-off'; // for boolean-switch components
  dateTimeVariant?: 'date-only' | 'time-only' | 'datetime'; // for datetime-picker components
  numberVariant?: 'number' | 'phone' | 'country-phone' | 'currency'; // for number-input components
}

export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
}

export interface ElementStyling {
  width: 'full' | 'half' | 'third';
  size: 'small' | 'medium' | 'large';
}

export interface FormSettings {
  actionUrl: string;
  method: 'GET' | 'POST';
  enctype?: string;
  compactMode?: boolean;
}

export type FormElementType = 
  | 'text-input' 
  | 'email-input' 
  | 'number-input' 
  | 'textarea' 
  | 'select' 
  | 'checkbox' 
  | 'radio' 
  | 'image'
  | 'rate-scale'
  | 'boolean-switch'
  | 'datetime-picker'
  | 'full-name';

export interface ComponentPaletteItem {
  type: FormElementType;
  label: string;
  description: string;
  icon: string;
  color: string;
  category: 'basic' | 'selection';
}

export interface DragItem {
  type: FormElementType;
  isNew: boolean;
  elementId?: string;
}

export interface FormBuilderState {
  formTitle: string;
  elements: FormElement[];
  selectedElementId: string | null;
  settings: FormSettings;
  previewMode: boolean;
}

export type WizardStep = 'build' | 'style' | 'preview';

export interface CustomColors {
  text: string;
  textGradient?: string;
  font: 'sans' | 'serif' | 'mono';
  background: string;
  backgroundGradient?: string;
  button: string;
  buttonGradient?: string;
  header: string;
  headerGradient?: string;
  // New appearance options
  label?: string;
  labelGradient?: string;
  inputBackground?: string;
  inputBorder?: string;
  inputText?: string;
  borderRadius?: 'none' | 'small' | 'medium' | 'large' | 'full';
  containerShadow?: 'none' | 'small' | 'medium' | 'large';
  progressBar?: string;
  progressBarGradient?: string;
}

export interface FormTheme {
  id: string;
  name: string;
  description: string;
  preview: string;
  customColors?: CustomColors;
  styles: {
    container: string;
    header: string;
    field: string;
    label: string;
    input: string;
    button: string;
    background: string;
    booleanSwitch?: {
      track: string;
      thumb: string;
      activeLabel: string;
      inactiveLabel: string;
    };
    progressBar?: {
      container: string;
      fill: string;
    };
  };
}

export interface WizardState {
  currentStep: WizardStep;
  formData: {
    title: string;
    elements: FormElement[];
    settings?: {
      description?: string;
      submitButtonText?: string;
      resetButtonText?: string;
      showProgressBar?: boolean;
      allowSaveProgress?: boolean;
      showFormTitle?: boolean;
      compactMode?: boolean;
    };
  };
  selectedTheme: FormTheme | null;
  isComplete: boolean;
}
