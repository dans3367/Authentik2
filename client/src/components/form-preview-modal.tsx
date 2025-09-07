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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};