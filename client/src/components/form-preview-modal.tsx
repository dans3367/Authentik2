import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormElement, FormTheme, CustomColors } from '@/types/form-builder';
import { ThemedFormRenderer } from '@/components/form-builder/themed-form-renderer';
import { lightenColor } from '@/utils/theme-color-utils';
import { Eye, RotateCcw } from 'lucide-react';

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

interface FormPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: {
    id: string;
    title: string;
    description?: string;
    formData: string;
    theme: string;
  };
  formSettings?: {
    description?: string;
    showProgressBar?: boolean;
    allowSaveProgress?: boolean;
    showFormTitle?: boolean;
    compactMode?: boolean;
  };
}

// Function to get theme-specific description styles
const getDescriptionStyles = (themeId: string): string => {
  switch (themeId) {
    case 'minimal':
      return 'text-gray-600 tracking-wide';
    case 'modern':
      return 'text-gray-700 font-medium';
    case 'professional':
      return 'text-gray-600';
    case 'playful':
      return 'text-purple-600 text-center font-medium';
    case 'elegant':
      return 'text-gray-700 tracking-wide';
    case 'neon':
      return 'text-green-300 text-center tracking-wider font-medium drop-shadow-lg';
    case 'nature':
      return 'text-emerald-700 text-center tracking-wide';
    case 'luxury':
      return 'text-yellow-300 text-center tracking-widest font-serif font-light';
    case 'retro':
      return 'text-orange-700 text-center tracking-wider font-bold transform skew-x-3';
    default:
      return 'text-gray-600';
  }
};

// Default themes configuration - reuse builder's themes for consistency
import { defaultThemes as builderDefaultThemes } from '@/hooks/use-form-wizard';

// Fallback themes if hook themes aren't available (should match builder)
const fallbackThemes: FormTheme[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and simple design with modern spacing and subtle shadows',
    preview: 'bg-white border border-gray-200 shadow-sm',
    styles: {
      container: 'max-w-2xl mx-auto p-8 bg-white border border-gray-200 rounded-xl shadow-lg backdrop-blur-sm',
      header: 'text-3xl font-light text-gray-900 mb-8 tracking-wide',
      field: 'mb-6',
      label: 'block text-sm font-medium text-gray-700 mb-2 tracking-wide',
      input: 'w-full px-4 py-3 h-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white',
      button: 'w-full bg-gray-900 text-white py-3 px-6 rounded-lg hover:bg-gray-800 transition-all duration-200 font-medium tracking-wide shadow-md hover:shadow-lg',
      background: 'bg-gray-50',
      booleanSwitch: {
        track: 'border-2 data-[state=unchecked]:bg-gray-200 data-[state=unchecked]:border-gray-400 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500',
        thumb: 'data-[state=unchecked]:bg-gray-500 data-[state=checked]:bg-green-500 shadow-md',
        activeLabel: 'text-gray-900 font-medium',
        inactiveLabel: 'text-gray-500'
      },
      progressBar: {
        container: 'w-full bg-gray-200 rounded-lg h-2 mb-6',
        fill: 'bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-lg transition-all duration-500 ease-out'
      }
    }
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Bold gradients with glass morphism and modern typography',
    preview: 'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500',
    styles: {
      container: 'max-w-2xl mx-auto p-8 bg-white/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl',
      header: 'text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-8 tracking-tight',
      field: 'mb-6',
      label: 'block text-sm font-semibold text-gray-800 mb-3 tracking-wide',
      input: 'w-full px-4 py-3 h-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 bg-white/80 backdrop-blur-sm',
      button: 'w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white py-4 px-6 rounded-xl hover:scale-105 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl',
      background: 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50',
      booleanSwitch: {
        track: 'border-2 data-[state=unchecked]:bg-gray-300 data-[state=unchecked]:border-purple-400 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-pink-500 data-[state=checked]:border-purple-500',
        thumb: 'data-[state=unchecked]:bg-gray-500 data-[state=checked]:bg-green-500 shadow-lg',
        activeLabel: 'text-gray-800 font-semibold',
        inactiveLabel: 'text-gray-500'
      },
      progressBar: {
        container: 'w-full bg-gray-200/60 rounded-xl h-3 mb-8 backdrop-blur-sm',
        fill: 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 h-3 rounded-xl transition-all duration-700 ease-out shadow-lg'
      }
    }
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Corporate design with precise spacing and structured layout',
    preview: 'bg-gray-50 border-l-4 border-blue-600 shadow-sm',
    styles: {
      container: 'max-w-3xl mx-auto p-10 bg-white border border-gray-200 shadow-sm rounded-lg',
      header: 'text-2xl font-semibold text-gray-900 mb-6 pb-4 border-b border-gray-200',
      field: 'mb-6',
      label: 'block text-sm font-medium text-gray-700 mb-2',
      input: 'w-full px-4 py-3 h-12 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white',
      button: 'w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition-colors duration-200 font-medium shadow-sm hover:shadow-md',
      background: 'bg-gray-50',
      booleanSwitch: {
        track: 'border data-[state=unchecked]:bg-gray-200 data-[state=unchecked]:border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600',
        thumb: 'data-[state=unchecked]:bg-white data-[state=checked]:bg-white shadow-sm',
        activeLabel: 'text-gray-900 font-medium',
        inactiveLabel: 'text-gray-600 font-normal'
      },
      progressBar: {
        container: 'w-full bg-gray-200 rounded-full h-1.5 mb-6',
        fill: 'bg-blue-600 h-1.5 rounded-full transition-all duration-500 ease-out'
      }
    }
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Cyberpunk inspired with glowing neon effects and dark backgrounds',
    preview: 'bg-black border-2 border-cyan-400 shadow-cyan-400/50 shadow-lg',
    styles: {
      container: 'max-w-2xl mx-auto p-8 bg-black border-2 border-cyan-400 rounded-xl shadow-2xl shadow-cyan-400/30',
      header: 'text-4xl font-bold text-cyan-400 mb-8 text-center tracking-wider drop-shadow-lg shadow-cyan-400/50',
      field: 'mb-6',
      label: 'block text-sm font-bold text-green-400 mb-3 tracking-wider uppercase',
      input: 'w-full px-4 py-3 h-12 bg-gray-900 border-2 border-cyan-400 rounded-lg text-cyan-100 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all duration-300 placeholder-gray-500 shadow-inner',
      button: 'w-full bg-gradient-to-r from-cyan-400 to-green-400 text-black py-4 px-6 rounded-lg hover:from-cyan-500 hover:to-green-500 transition-all duration-300 font-bold uppercase tracking-wider shadow-lg shadow-cyan-400/30 hover:shadow-xl',
      background: 'bg-gray-900',
      booleanSwitch: {
        track: 'border-2 data-[state=unchecked]:bg-gray-800 data-[state=unchecked]:border-cyan-400 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-cyan-400 data-[state=checked]:to-green-400 data-[state=checked]:border-cyan-400',
        thumb: 'data-[state=unchecked]:bg-gray-500 data-[state=checked]:bg-green-500 shadow-lg shadow-cyan-400/50',
        activeLabel: 'text-cyan-400 font-bold tracking-wider uppercase',
        inactiveLabel: 'text-gray-500 font-bold tracking-wider uppercase'
      },
      progressBar: {
        container: 'w-full bg-gray-800 rounded-lg h-3 mb-8 border-2 border-cyan-400 shadow-inner',
        fill: 'bg-gradient-to-r from-cyan-400 to-green-400 h-3 rounded-lg transition-all duration-600 ease-out shadow-lg shadow-cyan-400/50'
      }
    }
  },
  // Add more themes as needed...
];

export function FormPreviewModal({ isOpen, onClose, form, formSettings = {} }: FormPreviewModalProps) {
  const [liveFormData, setLiveFormData] = useState<Record<string, any>>({});
  const [selectedTheme, setSelectedTheme] = useState<FormTheme | null>(null);
  const [elements, setElements] = useState<FormElement[]>([]);
  const [parsedFormSettings, setParsedFormSettings] = useState<any>({});

  // Parse form data and theme on mount
  useEffect(() => {
    if (!form) {
      console.log('FormPreviewModal: No form data received');
      return;
    }

    // Validate form structure
    if (!form.formData) {
      console.error('FormPreviewModal: Form is missing formData field');
      setElements([]);
      setSelectedTheme(fallbackThemes[0]);
      return;
    }

    console.log('FormPreviewModal: Received form data:', form);

    try {
      // Parse form data
      let parsedFormData;
      console.log('FormPreviewModal: Raw form.formData type:', typeof form.formData);
      console.log('FormPreviewModal: Raw form.formData value:', form.formData);
      
      try {
        // Check if formData is already an object or needs parsing
        if (typeof form.formData === 'string') {
          parsedFormData = JSON.parse(form.formData);
          console.log('FormPreviewModal: Parsed formData from string:', parsedFormData);
        } else {
          parsedFormData = form.formData;
          console.log('FormPreviewModal: Using formData as object:', parsedFormData);
        }
      } catch (parseError) {
        console.error('FormPreviewModal: Failed to parse formData:', parseError, 'Raw formData:', form.formData);
        parsedFormData = { elements: [], settings: {} };
      }

      const elements = parsedFormData.elements || [];
      console.log('FormPreviewModal: parsedFormData.elements:', parsedFormData.elements);
      console.log('FormPreviewModal: elements type:', typeof elements, 'isArray:', Array.isArray(elements));
      console.log('FormPreviewModal: elements value before setState:', elements);
      setElements(elements);
      console.log('FormPreviewModal: Extracted elements:', elements.length, 'elements');

      // Parse and store form settings from the database
      const storedSettings = parsedFormData.settings || {};
      setParsedFormSettings(storedSettings);
      console.log('FormPreviewModal: Parsed settings:', storedSettings);

      // Check if we have any elements
      if (elements.length === 0) {
        console.warn('FormPreviewModal: No form elements found in parsed data');
      }

      // Parse theme
      let themeData: { id: string; name: string; customColors?: CustomColors } = { id: 'minimal', name: 'Minimal' };
      try {
        themeData = JSON.parse(form.theme);
        console.log('FormPreviewModal: Parsed theme:', themeData);
      } catch (themeParseError) {
        console.warn('FormPreviewModal: Failed to parse theme, using fallback:', themeParseError, 'Raw theme:', form.theme);
        // If theme parsing fails, use string as theme ID
        themeData = { id: form.theme || 'minimal', name: form.theme || 'Minimal' };
      }

      // Find matching theme from shared default themes (prefer builder's list)
      const themes: FormTheme[] = (builderDefaultThemes && Array.isArray(builderDefaultThemes) ? builderDefaultThemes : fallbackThemes);
      const matchedTheme = themes.find(t => t.id === themeData.id) || themes.find(t => t.id === 'minimal') || themes[0];
      
      // Apply custom colors if they exist
      if (themeData.customColors) {
        setSelectedTheme({
          ...matchedTheme,
          customColors: themeData.customColors
        });
      } else {
        setSelectedTheme(matchedTheme);
      }
    } catch (error) {
      console.error('Error parsing form data:', error);
      // Fallback to minimal theme
      setSelectedTheme(fallbackThemes[0]);
    }
  }, [form]);

  // Debug: Monitor elements state changes
  useEffect(() => {
    console.log('FormPreviewModal: Elements state changed:', elements, 'length:', elements.length);
  }, [elements]);

  // Create enhanced elements list with automatic buttons
  const elementsWithButtons: PreviewFormElement[] = useMemo(() => {
    console.log('FormPreviewModal: Creating elementsWithButtons, elements:', elements, 'length:', elements.length);
    if (!elements.length) {
      console.log('FormPreviewModal: No elements found, returning empty array');
      return [];
    }

    const baseTimestamp = Date.now();
    return [
      ...elements,
      // Add spacer before buttons
      {
        id: `auto-spacer-${baseTimestamp}-0`,
        type: 'spacer',
        label: '',
        name: 'spacer',
        required: false,
        styling: {
          width: 'full',
          size: 'medium',
        }
      },
      // Always add submit button
      {
        id: `auto-submit-${baseTimestamp}-1`,
        type: 'submit-button',
        label: 'Submit',
        name: 'submit',
        required: false,
        styling: {
          width: 'full',
          size: 'medium',
        }
      },
      // Always add reset button
      {
        id: `auto-reset-${baseTimestamp}-2`,
        type: 'reset-button', 
        label: 'Reset',
        name: 'reset',
        required: false,
        styling: {
          width: 'full',
          size: 'medium',
        }
      }
    ];
  }, [elements]);

  // Track form changes in real-time
  const handleFormChange = useCallback((fieldName: string, value: any) => {
    setLiveFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  }, []);

  // Handle form reset
  const handleFormReset = useCallback(() => {
    setLiveFormData({});
    // Also reset all form inputs by clearing their values
    const formElement = document.querySelector('#form-preview-form');
    if (formElement) {
      (formElement as HTMLFormElement).reset();
    }
  }, []);

  // Calculate progress percentage based on filled fields with accurate field units
  // - Treat checkbox group as 1 unit (filled when any option is selected)
  // - Treat full-name as 2 units (first and last)
  // - Ignore non-input UI elements (image, spacer, auto buttons)
  const progressPercentage = useMemo(() => {
    if (!elements || elements.length === 0) return 0;

    // Total field units expected to be filled
    const totalUnits = elements.reduce((acc, el) => {
      switch (el.type) {
        case 'full-name':
          return acc + 2;
        case 'image':
        case 'spacer':
          return acc; // not input fields
        default:
          return acc + 1;
      }
    }, 0);

    if (totalUnits === 0) return 0;

    // Filled units based on current live data
    const filledUnits = elements.reduce((acc, el) => {
      switch (el.type) {
        case 'checkbox': {
          const hasAnyChecked = (el.options || []).some((opt) => {
            const key = `${el.name}_${opt}`;
            const val = liveFormData[key];
            return val !== null && val !== undefined && val !== '' && val !== false;
          });
          return acc + (hasAnyChecked ? 1 : 0);
        }
        case 'full-name': {
          const firstFilled = liveFormData[`${el.name}_first`];
          const lastFilled = liveFormData[`${el.name}_last`];
          const unit1 = firstFilled ? 1 : 0;
          const unit2 = lastFilled ? 1 : 0;
          return acc + unit1 + unit2;
        }
        case 'image':
        case 'spacer':
          return acc;
        case 'rate-scale': {
          const val = liveFormData[el.name];
          // Treat 0, null, undefined, "", false, or "NA" as not filled
          return acc + (val !== null && val !== undefined && val !== '' && val !== false && val !== 'NA' ? 1 : 0);
        }
        default: {
          const val = liveFormData[el.name];
          return acc + (val !== null && val !== undefined && val !== '' && val !== false ? 1 : 0);
        }
      }
    }, 0);

    return Math.min(100, Math.round((filledUnits / totalUnits) * 100));
  }, [elements, liveFormData]);

  // Progress bar component
  const ThemedProgressBar = () => {
    // Use parsed form settings instead of passed formSettings
    const shouldShowProgressBar = parsedFormSettings.showProgressBar !== false;
    
    if (!shouldShowProgressBar || !selectedTheme?.styles.progressBar) return null;
    
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className={`text-sm font-medium ${selectedTheme.id === 'elegant' || selectedTheme.id === 'neon' || selectedTheme.id === 'luxury' ? 'text-gray-300' : 'text-gray-700'}`}>
            Form Progress
          </span>
          <span className={`text-sm font-medium ${selectedTheme.id === 'elegant' || selectedTheme.id === 'neon' || selectedTheme.id === 'luxury' ? 'text-gray-300' : 'text-gray-700'}`}>
            {progressPercentage}%
          </span>
        </div>
        <div className={selectedTheme.styles.progressBar.container}>
          <div 
            className={selectedTheme.styles.progressBar.fill}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    );
  };

  // Get background styles for page and form
  const getBackgroundStyles = () => {
    if (!selectedTheme?.customColors) {
      return {
        pageStyle: {},
        formStyle: {}
      };
    }

    const customColors = selectedTheme.customColors;
    
    // Page gets the selected background color
    const pageStyle = customColors.backgroundGradient 
      ? { background: customColors.backgroundGradient }
      : { backgroundColor: customColors.background };
    
    // Form gets a lighter shade (or semi-transparent overlay for gradients)
    let formStyle = {};
    if (customColors.backgroundGradient) {
      // For gradients, use a semi-transparent white overlay
      formStyle = { 
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(10px)'
      };
    } else {
      // For solid colors, lighten the color
      formStyle = { 
        backgroundColor: lightenColor(customColors.background, 85) 
      };
    }
    
    return { pageStyle, formStyle };
  };

  // Inject custom color CSS when theme has custom colors
  useEffect(() => {
    if (selectedTheme?.customColors) {
      const customColors = selectedTheme.customColors;
      const styleId = 'custom-theme-colors-preview-modal';
      let existingStyle = document.getElementById(styleId);
      
      if (!existingStyle) {
        existingStyle = document.createElement('style');
        existingStyle.id = styleId;
        document.head.appendChild(existingStyle);
      }
      
      // Define font families
      const fontFamilies = {
        sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        serif: 'Georgia, "Times New Roman", Times, serif',
        mono: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace'
      };
      
      existingStyle.textContent = `
        .custom-theme-wrapper-modal {
          font-family: ${fontFamilies[customColors.font]} !important;
        }
        .custom-theme-wrapper-modal * {
          font-family: inherit !important;
        }
        .custom-theme-wrapper-modal h1:first-child {
          ${customColors.headerGradient 
            ? `background: ${customColors.headerGradient} !important; 
               -webkit-background-clip: text !important; 
               -webkit-text-fill-color: transparent !important; 
               background-clip: text !important;
               color: transparent !important;` 
            : `color: ${customColors.header} !important;
               background: none !important;
               -webkit-text-fill-color: ${customColors.header} !important;`}
        }
        .custom-theme-wrapper-modal button[type="submit"],
        .custom-theme-wrapper-modal button[type="reset"] {
          ${customColors.buttonGradient 
            ? `background: ${customColors.buttonGradient} !important;` 
            : `background-color: ${customColors.button} !important;`}
          border-color: ${customColors.button} !important;
          color: white !important;
        }
        .custom-theme-wrapper-modal button[type="submit"]:hover,
        .custom-theme-wrapper-modal button[type="reset"]:hover {
          opacity: 0.9 !important;
          transform: translateY(-1px);
        }
        .custom-theme-wrapper-modal input:focus,
        .custom-theme-wrapper-modal select:focus,
        .custom-theme-wrapper-modal textarea:focus,
        .custom-theme-wrapper-modal .headlessui-listbox-button:focus {
          border-color: ${customColors.button} !important;
          box-shadow: 0 0 0 2px ${customColors.button}30 !important;
        }
        .custom-theme-wrapper-modal label,
        .custom-theme-wrapper-modal p,
        .custom-theme-wrapper-modal span:not(.form-title) {
          ${customColors.textGradient 
            ? `background: ${customColors.textGradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;` 
            : `color: ${customColors.text} !important;`}
        }
      `;
      
      return () => {
        // Cleanup on unmount
        if (existingStyle && existingStyle.parentNode) {
          existingStyle.parentNode.removeChild(existingStyle);
        }
      };
    }
  }, [selectedTheme?.customColors]);

  if (!selectedTheme) return null;

  const { pageStyle, formStyle } = getBackgroundStyles();
  const themeStyles = selectedTheme.styles;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-blue-600" />
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Form Preview: {form.title}
                </DialogTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFormReset}
                className="flex items-center space-x-1"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Form</span>
              </Button>
            </div>
            <div>{/* Space for built-in close button */}</div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <div 
            className={`p-6 ${!selectedTheme.customColors ? themeStyles.background : ''}`}
            style={selectedTheme.customColors ? pageStyle : {}}
          >
            <form 
              id="form-preview-form"
              className={`${themeStyles.container} ${selectedTheme.id === 'glassmorphism' ? 'glassmorphism-override' : ''} ${selectedTheme.customColors ? 'custom-theme-wrapper-modal' : ''}`}
              style={selectedTheme.customColors ? formStyle : {}}
              onSubmit={(e) => e.preventDefault()}
            >
              {parsedFormSettings.showFormTitle !== false && (
                <>
                  <h1 className={themeStyles.header}>{form.title}</h1>
                  {(form.description || parsedFormSettings.description) && (
                    <p className={`mb-6 -mt-4 leading-relaxed ${getDescriptionStyles(selectedTheme.id)}`}>
                      {form.description || parsedFormSettings.description}
                    </p>
                  )}
                </>
              )}

              <ThemedProgressBar />

              {parsedFormSettings.compactMode ? (
                // Compact mode: 2 fields per row
                <div className="grid grid-cols-2 gap-4">
                  {elementsWithButtons.map((element) => {
                    // Special handling for certain elements that should span full width
                    const elementType = element.type as string;
                    const shouldSpanFullWidth = elementType === 'submit-button' || 
                                              elementType === 'reset-button' || 
                                              elementType === 'spacer' ||
                                              elementType === 'image' ||
                                              elementType === 'full-name';
                    
                    return (
                      <div 
                        key={element.id} 
                        className={`${elementType === 'spacer' ? 'h-6' : themeStyles.field} ${
                          shouldSpanFullWidth ? 'col-span-2' : ''
                        }`}
                      >
                        <ThemedFormRenderer
                          element={element}
                          themeStyles={themeStyles}
                          onChange={handleFormChange}
                          onReset={handleFormReset}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Normal mode: 1 field per row
                elementsWithButtons.map((element) => (
                  <div key={element.id} className={element.type === 'spacer' ? 'h-6' : themeStyles.field}>
                    <ThemedFormRenderer
                      element={element}
                      themeStyles={themeStyles}
                      onChange={handleFormChange}
                      onReset={handleFormReset}
                    />
                  </div>
                ))
              )}
            </form>

            {/* Privacy & Security Statement */}
            <div className="w-full max-w-2xl mx-auto mt-8 px-4">
              <div className="border-t border-gray-200 pt-6 pb-4">
                <div className="text-xs text-gray-500 leading-relaxed space-y-4">

                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                    Privacy &amp; Security Statement
                  </h3>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">1. Data Collection &amp; Purpose of Processing</h4>
                    <p>
                      By submitting this form, you acknowledge and consent to the collection, processing, and storage of the
                      personal information you provide, including but not limited to your name, email address, phone number,
                      mailing address, company name, job title, and any other data fields presented in this form. This
                      information is collected for the purpose of fulfilling the specific request made through this form, as
                      well as for ongoing business-to-business (B2B) communications between you and the organisation operating
                      this form (the "Client").
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">2. Marketing, Newsletter &amp; Promotional Communications</h4>
                    <p>
                      By providing your contact details, you expressly consent to receive marketing materials, newsletters,
                      promotional offers, product updates, event invitations, industry insights, and other commercial
                      communications from the Client. These communications may be delivered via:
                    </p>
                    <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
                      <li><strong>Email</strong> — including newsletters, drip campaigns, promotional announcements, and transactional updates.</li>
                      <li><strong>Telephone &amp; Mobile Phone</strong> — including voice calls, SMS/text messages, MMS, and automated or pre-recorded messages to any phone number you provide, including mobile numbers. <strong>Standard messaging and data rates from your carrier may apply.</strong> Message frequency may vary.</li>
                      <li><strong>Push Notifications</strong> — where applicable and where you have enabled such notifications on your device.</li>
                      <li><strong>Postal Mail</strong> — physical marketing materials, catalogues, or promotional correspondence sent to the mailing address you provide.</li>
                      <li><strong>Social Media &amp; Digital Channels</strong> — targeted advertisements and retargeting campaigns on third-party platforms based on the information you provide.</li>
                    </ul>
                    <p className="mt-1">
                      You may opt out of marketing communications at any time by following the unsubscribe instructions
                      included in each communication, by contacting the Client directly, or by replying STOP to any SMS
                      message. Opting out of marketing communications does not affect transactional or service-related messages.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">3. Phone, SMS &amp; Messaging Charges</h4>
                    <p>
                      If you provide a phone number, you consent to being contacted at that number for the purposes described
                      above. <strong>Standard call charges, SMS/text message rates, and data charges imposed by your
                      telecommunications provider may apply</strong> when you receive calls, text messages, or multimedia
                      messages from us or on behalf of the Client. These charges are determined by your carrier and are your
                      sole responsibility. Neither the Client nor Zendwise LLC is responsible for any charges incurred by your
                      carrier in connection with these communications. Contact your carrier for details about your messaging
                      and data plan. You are not required to provide consent to telephone or SMS marketing as a condition of
                      purchasing any goods or services.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">4. Service Provider &amp; Infrastructure</h4>
                    <p>
                      This form and the associated data processing infrastructure are provided by <strong>Zendwise LLC</strong>,
                      acting as a third-party service provider and data processor on behalf of the Client. Zendwise LLC
                      provides the technology platform, hosting infrastructure, form rendering, email sending, SMS delivery,
                      data storage, and related communication services that enable the Client to collect, manage, and
                      communicate with form respondents. Zendwise LLC processes your personal data strictly in accordance with
                      the Client's instructions and applicable data processing agreements. Zendwise LLC does not independently
                      use, sell, rent, or share your personal information for its own marketing purposes.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">5. Data Sharing &amp; Third-Party Processors</h4>
                    <p>
                      Your data may be shared with trusted third-party service providers engaged by Zendwise LLC or the Client
                      solely for the purpose of delivering the services described herein. These may include cloud hosting
                      providers, email service providers, SMS gateway operators, analytics platforms, customer relationship
                      management (CRM) systems, and payment processors where applicable. All third-party processors are
                      contractually obligated to maintain the confidentiality and security of your data and to process it only
                      as instructed. Your personal data will not be sold to third parties for independent marketing purposes.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">6. Data Security</h4>
                    <p>
                      We implement industry-standard technical and organisational security measures to protect your personal
                      information against unauthorised access, alteration, disclosure, or destruction. These measures include
                      but are not limited to encryption of data in transit (TLS/SSL) and at rest, access controls, regular
                      security assessments, secure data centres, network monitoring, and incident response procedures. While
                      we strive to protect your personal information, no method of electronic transmission or storage is
                      completely secure, and we cannot guarantee absolute security.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">7. Data Retention</h4>
                    <p>
                      Your personal information will be retained for as long as necessary to fulfil the purposes for which it
                      was collected, to comply with legal obligations, to resolve disputes, and to enforce agreements. When
                      your data is no longer required, it will be securely deleted or anonymised in accordance with applicable
                      data retention policies and legal requirements.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">8. Your Rights</h4>
                    <p>Depending on your jurisdiction, you may have the right to:</p>
                    <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
                      <li>Access the personal data we hold about you.</li>
                      <li>Request correction or update of inaccurate or incomplete data.</li>
                      <li>Request deletion or erasure of your personal data ("right to be forgotten").</li>
                      <li>Restrict or object to the processing of your data.</li>
                      <li>Request portability of your data in a structured, commonly used, and machine-readable format.</li>
                      <li>Withdraw consent at any time, without affecting the lawfulness of processing based on consent prior to withdrawal.</li>
                      <li>Lodge a complaint with a supervisory authority or data protection regulator in your jurisdiction.</li>
                      <li>Opt out of the sale or sharing of personal information (where applicable under laws such as the CCPA/CPRA).</li>
                      <li>Not be discriminated against for exercising any of these rights.</li>
                    </ul>
                    <p className="mt-1">
                      To exercise any of these rights, please contact the Client directly using the contact information
                      provided in their communications or privacy policy.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">9. International Data Transfers</h4>
                    <p>
                      Your personal data may be transferred to and processed in countries other than the country in which you
                      reside, including the United States of America, where Zendwise LLC operates its infrastructure. Such
                      transfers are conducted in compliance with applicable data protection laws, including the use of Standard
                      Contractual Clauses (SCCs), adequacy decisions, or other legally recognised transfer mechanisms to ensure
                      your data receives an adequate level of protection.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">10. Cookies, Tracking &amp; Analytics</h4>
                    <p>
                      This form may utilise cookies, web beacons, pixel tags, and similar tracking technologies to collect
                      information about your interaction with this form, including your IP address, browser type, device
                      information, referring URL, and form completion behaviour. This information is used to improve form
                      functionality, monitor performance, prevent fraud, and support analytics. By using this form, you consent
                      to the use of such technologies as described herein.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">11. Children's Privacy</h4>
                    <p>
                      This form and the associated services are intended for business use and are not directed at individuals
                      under the age of 16 (or the applicable age of consent in your jurisdiction). We do not knowingly collect
                      personal information from children. If you believe that a child has provided personal information through
                      this form, please contact the Client immediately so that the data can be promptly deleted.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">12. Legal Basis for Processing</h4>
                    <p>
                      The legal bases for processing your personal data include: (a) your explicit consent as provided by
                      submitting this form; (b) the legitimate business interests of the Client in conducting B2B marketing
                      and communications; (c) the performance or preparation of a contract between you (or your organisation)
                      and the Client; and (d) compliance with applicable legal obligations. Where processing is based on
                      consent, you may withdraw that consent at any time as described in Section 8 above.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">13. Regulatory Compliance</h4>
                    <p>
                      This privacy and security statement is designed to comply with applicable data protection and privacy
                      regulations, including but not limited to the General Data Protection Regulation (GDPR), the California
                      Consumer Privacy Act / California Privacy Rights Act (CCPA/CPRA), the CAN-SPAM Act, the Telephone
                      Consumer Protection Act (TCPA), the Canadian Anti-Spam Legislation (CASL), the Privacy and Electronic
                      Communications Regulations (PECR), and other applicable national and regional privacy laws. Where local
                      law provides greater protections, those protections shall apply.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">14. Changes to This Statement</h4>
                    <p>
                      This privacy and security statement may be updated from time to time to reflect changes in our practices,
                      technology, legal requirements, or other factors. Any material changes will be reflected in the updated
                      statement made available at the time of form submission. Your continued use of this form following any
                      changes constitutes your acceptance of the updated statement.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 mb-1">15. Contact Information</h4>
                    <p>
                      For questions or concerns regarding this privacy and security statement, your personal data, or to
                      exercise your data protection rights, please contact the Client using the details provided in their
                      communications or privacy policy. For infrastructure and service-related enquiries, you may contact
                      Zendwise LLC at the address provided on their website.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <p className="text-gray-500 italic">
                      By submitting this form, you confirm that you have read, understood, and agree to this Privacy &amp;
                      Security Statement. You consent to the collection, processing, and use of your personal data as described
                      above, including the receipt of marketing and newsletter communications via email, telephone, SMS, and
                      other channels. You acknowledge that standard messaging, call, and data rates may apply for
                      communications received via phone or mobile device.
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                    <p className="text-gray-400 text-[10px]">
                      Infrastructure &amp; email delivery services provided by Zendwise LLC on behalf of the Client.
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};