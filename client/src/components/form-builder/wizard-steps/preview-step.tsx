import { FormElement, FormTheme, CustomColors } from '@/types/form-builder';
import { ThemedFormRenderer } from '@/components/form-builder/themed-form-renderer';
import { CustomThemedForm } from '@/components/form-builder/custom-themed-form';
import { ColorCustomizer } from '@/components/form-builder/color-customizer';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Save, Download, Code, Mail, Clock, User, Loader2 } from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { lightenColor } from '@/utils/theme-color-utils';

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

// Function to get theme-specific description styles
const getDescriptionStyles = (themeId: string): string => {
  switch (themeId) {
    case 'minimal':
      return 'text-gray-600 tracking-wide'; // left-aligned like header
    case 'modern':
      return 'text-gray-700 font-medium'; // matches header style  
    case 'professional':
      return 'text-gray-600'; // left-aligned like header
    case 'playful':
      return 'text-purple-600 text-center font-medium'; // centered like header
    case 'elegant':
      return 'text-gray-700 tracking-wide'; // matches elegant style
    case 'neon':
      return 'text-green-300 text-center tracking-wider font-medium drop-shadow-lg'; // centered like header
    case 'nature':
      return 'text-emerald-700 text-center tracking-wide'; // centered like header
    case 'luxury':
      return 'text-yellow-300 text-center tracking-widest font-serif font-light'; // centered like header
    case 'retro':
      return 'text-orange-700 text-center tracking-wider font-bold transform skew-x-3'; // centered like header
    default:
      return 'text-gray-600';
  }
};

interface PreviewStepProps {
  formTitle: string;
  elements: FormElement[];
  selectedTheme: FormTheme | null;
  formSettings?: {
    description?: string;
    showProgressBar?: boolean;
    allowSaveProgress?: boolean;
    showFormTitle?: boolean;
    compactMode?: boolean;
  };
  onSave: () => void;
  onExport: () => void;
  onCustomizeColors: (colors: CustomColors) => void;
  onResetColors: () => void;
  isSaving?: boolean;
}

export function PreviewStep({ 
  formTitle, 
  elements, 
  selectedTheme, 
  formSettings = {},
  onSave, 
  onExport,
  onCustomizeColors,
  onResetColors,
  isSaving = false
}: PreviewStepProps) {
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [actualFormData, setActualFormData] = useState<Record<string, any>>({});
  const [liveFormData, setLiveFormData] = useState<Record<string, any>>({});

  // Generate sample form data based on form elements
  const generateSampleFormData = () => {
    const sampleData: Record<string, any> = {};
    
    elements.forEach((element) => {
      switch (element.type) {
        case 'text-input':
          sampleData[element.name] = element.placeholder || 'Sample text input';
          break;
        case 'email-input':
          sampleData[element.name] = 'user@example.com';
          break;
        case 'number-input':
          sampleData[element.name] = element.validation?.min || 42;
          break;
        case 'textarea':
          sampleData[element.name] = element.placeholder || 'Sample textarea content';
          break;
        case 'select':
          sampleData[element.name] = element.options?.[0] || 'Option 1';
          break;
        case 'checkbox':
          sampleData[element.name] = true;
          break;
        case 'radio':
          sampleData[element.name] = element.options?.[0] || 'Option 1';
          break;
        case 'rate-scale':
          const max = element.validation?.max || 10;
          sampleData[element.name] = Math.ceil(max / 2);
          break;
        case 'boolean-switch':
          sampleData[element.name] = true;
          break;

      }
    });

    return {
      formTitle,
      submittedAt: new Date().toISOString(),
      formData: sampleData
    };
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Extract actual form data from the form
    const formData = new FormData(e.target as HTMLFormElement);
    const actualFormData: Record<string, any> = {};
    
    // Convert FormData to regular object with proper type handling
    const formDataEntries = Array.from(formData.entries());
    for (const [key, value] of formDataEntries) {
      // Skip the submit and reset buttons
      if (key === 'submit' || key === 'reset') continue;
      
      // Find the corresponding element to understand the data type
      const element = elements.find(el => el.name === key);
      
      if (element) {
        switch (element.type) {
          case 'number-input':
            actualFormData[key] = value ? Number(value) : null;
            break;
          case 'checkbox':
            actualFormData[key] = value === 'on';
            break;
          case 'rate-scale':
            const numValue = Number(value);
            actualFormData[key] = numValue > 0 ? numValue : "NA";
            break;
          case 'boolean-switch':
            actualFormData[key] = value === 'true';
            break;
          case 'textarea':
          case 'text-input':
          case 'email-input':
          case 'select':
          case 'radio':
            // Explicitly handle text-based inputs as strings
            actualFormData[key] = value ? String(value) : null;
            break;
          default:
            actualFormData[key] = value ? String(value) : null;
        }
      } else {
        actualFormData[key] = value ? String(value) : null;
      }
    }
    
    // Handle elements that weren't filled out (not present in FormData)
    elements.forEach((element) => {
      if (!(element.name in actualFormData)) {
        if (element.type === 'rate-scale') {
          actualFormData[element.name] = "NA";
        } else if (element.type === 'checkbox') {
          actualFormData[element.name] = false;
        } else {
          actualFormData[element.name] = null;
        }
      }
    });
    
    // Store the actual form data in state
    setActualFormData(actualFormData);
    setShowEmailPreview(true);
  };

  // Generate actual form data based on current form input values
  const getActualFormData = () => {
    return {
      formTitle,
      submittedAt: new Date().toISOString(),
      formData: actualFormData
    };
  };

  // Generate email-style preview content
  const generateEmailContent = () => {
    const submissionTime = new Date().toLocaleString();
    const hasData = Object.keys(actualFormData).length > 0;
    
    return {
      subject: `New Form Submission: ${formTitle}`,
      from: 'noreply@yoursite.com',
      to: 'admin@yoursite.com',
      timestamp: submissionTime,
      hasData
    };
  };
  // Show error if no theme is selected
  if (!selectedTheme) {
    return (
      <div className="flex flex-col items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="text-lg font-medium text-slate-800 mb-2">No theme selected</div>
          <div className="text-sm text-slate-600">Please go back to Step 2 and select a theme</div>
        </div>
      </div>
    );
  }

  // Create enhanced elements list with automatic buttons
  const baseTimestamp = Date.now();
  const elementsWithButtons: PreviewFormElement[] = [
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

  const themeStyles = selectedTheme.styles;

  // Track form changes in real-time
  const handleFormChange = useCallback((fieldName: string, value: any) => {
    console.log('Form change detected:', fieldName, value);
    setLiveFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  }, []);

  // Handle form reset
  const handleFormReset = useCallback(() => {
    console.log('Form reset triggered');
    setLiveFormData({});
    setActualFormData({});
    setShowEmailPreview(false);
    
    // Also reset all form inputs by clearing their values
    const form = document.querySelector('form');
    if (form) {
      form.reset();
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
            const val = (liveFormData as Record<string, any>)[key];
            return val !== null && val !== undefined && val !== '' && val !== false;
          });
          return acc + (hasAnyChecked ? 1 : 0);
        }
        case 'full-name': {
          const firstFilled = (liveFormData as Record<string, any>)[`${el.name}_first`];
          const lastFilled = (liveFormData as Record<string, any>)[`${el.name}_last`];
          const unit1 = firstFilled ? 1 : 0;
          const unit2 = lastFilled ? 1 : 0;
          return acc + unit1 + unit2;
        }
        case 'image':
        case 'spacer':
          return acc;
        case 'rate-scale': {
          const val = (liveFormData as Record<string, any>)[el.name];
          // Treat 0, null, undefined, "", false, or "NA" as not filled
          return acc + (val !== null && val !== undefined && val !== '' && val !== false && val !== 'NA' ? 1 : 0);
        }
        default: {
          const val = (liveFormData as Record<string, any>)[el.name];
          return acc + (val !== null && val !== undefined && val !== '' && val !== false ? 1 : 0);
        }
      }
    }, 0);

    return Math.min(100, Math.round((filledUnits / totalUnits) * 100));
  }, [elements, liveFormData]);

  // Progress bar component
  const ThemedProgressBar = () => {
    if (!formSettings.showProgressBar || !themeStyles.progressBar) return null;
    
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
        <div className={themeStyles.progressBar.container}>
          <div 
            className={themeStyles.progressBar.fill}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    );
  };

  // Get background styles for page and form
  const getBackgroundStyles = () => {
    if (!selectedTheme.customColors) {
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

  const { pageStyle, formStyle } = getBackgroundStyles();

  // Inject custom color CSS when theme has custom colors
  useEffect(() => {
    if (selectedTheme?.customColors) {
      const customColors = selectedTheme.customColors;
      const styleId = 'custom-theme-colors-preview';
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
        .custom-theme-wrapper {
          font-family: ${fontFamilies[customColors.font]} !important;
        }
        .custom-theme-wrapper * {
          font-family: inherit !important;
        }
        .custom-theme-wrapper h1:first-child {
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
      `;
      
      return () => {
        // Cleanup on unmount
        if (existingStyle && existingStyle.parentNode) {
          existingStyle.parentNode.removeChild(existingStyle);
        }
      };
    }
  }, [selectedTheme?.customColors]);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-slate-200/60 px-6 py-5 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Preview & Save</h2>
            <p className="text-slate-600">Review your form and save it when ready</p>
          </div>
          <div className="flex items-center space-x-3">
            {selectedTheme && (
              <div className="mr-2">
                <ColorCustomizer
                  theme={selectedTheme}
                  onColorsChange={onCustomizeColors}
                  onResetColors={onResetColors}
                />
              </div>
            )}
            <Button variant="outline" onClick={onExport} className="flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </Button>
            <Button 
              onClick={onSave} 
              disabled={isSaving}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSaving ? 'Saving...' : 'Save Form'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div 
        className={`p-6 ${!selectedTheme.customColors ? themeStyles.background : ''}`}
        style={selectedTheme.customColors ? pageStyle : {}}
      >
        <div 
          className={`${themeStyles.container} ${selectedTheme.id === 'glassmorphism' ? 'glassmorphism-override' : ''} ${selectedTheme.customColors ? 'custom-theme-wrapper' : ''}`}
          style={selectedTheme.customColors ? {
            ...formStyle,
            borderRadius: selectedTheme.customColors.borderRadius === 'none' ? '0px' :
                         selectedTheme.customColors.borderRadius === 'small' ? '0.375rem' :
                         selectedTheme.customColors.borderRadius === 'large' ? '1rem' :
                         selectedTheme.customColors.borderRadius === 'full' ? '1.5rem' : '0.75rem',
            boxShadow: selectedTheme.customColors.containerShadow === 'none' ? 'none' :
                      selectedTheme.customColors.containerShadow === 'small' ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' :
                      selectedTheme.customColors.containerShadow === 'large' ? '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' :
                      '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
          } : {}}
        >
          {formSettings.showFormTitle !== false && (
            <>
              <h1 className={themeStyles.header}>{formTitle}</h1>
              {formSettings.description && (
                <p className={`mb-6 -mt-4 leading-relaxed ${getDescriptionStyles(selectedTheme.id)}`}>
                  {formSettings.description}
                </p>
              )}
            </>
          )}
          
          <ThemedProgressBar />
          
          <form className="space-y-4" onSubmit={handleFormSubmit}>
            {formSettings.compactMode ? (
              // Compact mode: Group elements into rows of 2, excluding components that already have 2 items
              (() => {
                const shouldExcludeFromCompact = (element: PreviewFormElement) => {
                  return element.type === 'full-name' || 
                         element.type === 'submit-button' || 
                         element.type === 'reset-button' || 
                         element.type === 'spacer' ||
                         element.type === 'rate-scale' ||
                         element.type === 'image';
                };

                const rows: PreviewFormElement[][] = [];
                let currentRow: PreviewFormElement[] = [];

                elementsWithButtons.forEach((element) => {
                  if (shouldExcludeFromCompact(element)) {
                    // Add current row if it has elements
                    if (currentRow.length > 0) {
                      rows.push([...currentRow]);
                      currentRow = [];
                    }
                    // Add the excluded element as its own row
                    rows.push([element]);
                  } else {
                    currentRow.push(element);
                    // When row has 2 elements, add to rows and start new row
                    if (currentRow.length === 2) {
                      rows.push([...currentRow]);
                      currentRow = [];
                    }
                  }
                });

                // Add remaining elements in currentRow
                if (currentRow.length > 0) {
                  rows.push(currentRow);
                }

                return rows.map((row, rowIndex) => (
                  <div key={`row-${rowIndex}`} className={row.length > 1 ? "grid grid-cols-1 md:grid-cols-2 gap-4 items-start" : ""}>
                    {row.map((element) => (
                      <CustomThemedForm
                        key={element.id}
                        theme={selectedTheme}
                        element={element as FormElement}
                        onChange={handleFormChange}
                        onReset={handleFormReset}
                      />
                    ))}
                  </div>
                ));
              })()
            ) : (
              // Normal mode: Single column layout
              elementsWithButtons.map((element) => (
                <CustomThemedForm
                  key={element.id}
                  theme={selectedTheme}
                  element={element as FormElement}
                  onChange={handleFormChange}
                  onReset={handleFormReset}
                />
              ))
            )}
            
            {elements.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <div className="text-lg font-medium mb-2">No form elements</div>
                <div className="text-sm">Go back to the build step to add form elements</div>
              </div>
            )}


          </form>
        </div>
      </div>

      {/* Theme info */}
      {selectedTheme && (
        <div className="bg-white border-t border-slate-200 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-4 h-4 rounded ${selectedTheme.preview}`}></div>
              <span className="text-sm text-slate-600">
                Using <strong>{selectedTheme.name}</strong> theme
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      <Dialog open={showEmailPreview} onOpenChange={setShowEmailPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Mail className="w-5 h-5" />
              <span>Form Submission Email Preview</span>
            </DialogTitle>
            <DialogDescription>
              Preview how form submissions will appear in email notifications sent to administrators
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {/* Email Header */}
            <div className="bg-slate-50 border border-slate-200 rounded-t-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">New Form Submission</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>{generateEmailContent().timestamp}</span>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="font-medium text-slate-600 w-16 flex-shrink-0">From:</span>
                  <span className="text-slate-800">{generateEmailContent().from}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-slate-600 w-16 flex-shrink-0">To:</span>
                  <span className="text-slate-800">{generateEmailContent().to}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-slate-600 w-16 flex-shrink-0">Subject:</span>
                  <span className="text-slate-800 font-medium">{generateEmailContent().subject}</span>
                </div>
              </div>
            </div>

            {/* Email Body */}
            <div className="bg-white border border-t-0 border-slate-200 rounded-b-lg p-6">
              <div className="prose prose-sm max-w-none">
                <p className="text-slate-700 mb-4">
                  You have received a new form submission from your website.
                </p>
                
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Form Details
                </h3>
                
                <div className="bg-slate-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-600">Form Name:</span>
                      <span className="ml-2 text-slate-800">{formTitle}</span>
                    </div>
                    <div>
                      <span className="font-medium text-slate-600">Submitted:</span>
                      <span className="ml-2 text-slate-800">{generateEmailContent().timestamp}</span>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                {Object.keys(actualFormData).length > 0 ? (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-slate-800 border-b border-slate-200 pb-2">
                      Submitted Information
                    </h4>
                    
                    <div className="space-y-3">
                      {elements.map((element) => {
                        const value = actualFormData[element.name];
                        const hasValue = value !== null && value !== undefined && value !== '';
                        
                        return (
                          <div key={element.name} className="bg-slate-50 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium text-slate-700 mb-1">
                                  {element.label}
                                  {element.required && <span className="text-red-500 ml-1">*</span>}
                                </div>
                                <div className="text-slate-800">
                                  {hasValue ? (
                                    <span className="font-mono bg-white px-2 py-1 rounded border">
                                      {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Not provided</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-slate-500 capitalize">
                                {element.type.replace('-', ' ')}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No form data was submitted</p>
                  </div>
                )}
                
                <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500">
                  <p>This email was automatically generated from your form submission system.</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowEmailPreview(false);
                  setShowJsonPreview(true);
                }}
                className="flex items-center space-x-2"
              >
                <Code className="w-4 h-4" />
                <span>View JSON</span>
              </Button>
              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    const emailContent = `Subject: ${generateEmailContent().subject}\n\nForm: ${formTitle}\nSubmitted: ${generateEmailContent().timestamp}\n\n${elements.map(el => `${el.label}: ${actualFormData[el.name] || 'Not provided'}`).join('\n')}`;
                    navigator.clipboard.writeText(emailContent);
                  }}
                >
                  Copy Email
                </Button>
                <Button onClick={() => setShowEmailPreview(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* JSON Preview Modal (Secondary) */}
      <Dialog open={showJsonPreview} onOpenChange={setShowJsonPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Code className="w-5 h-5" />
              <span>Technical JSON Preview</span>
            </DialogTitle>
            <DialogDescription>
              View the raw JSON data structure that will be sent to your backend for processing
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <p className="text-sm text-slate-600 mb-4">
              Raw JSON data structure for backend processing:
            </p>
            <div className="bg-slate-100 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-slate-800 whitespace-pre-wrap">
                {JSON.stringify(getActualFormData(), null, 2)}
              </pre>
            </div>
            <div className="mt-4 flex justify-end space-x-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(getActualFormData(), null, 2));
                }}
              >
                Copy JSON
              </Button>
              <Button onClick={() => setShowJsonPreview(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}