import { useFormWizard } from '@/hooks/use-form-wizard';
import { BuildStep } from './wizard-steps/build-step';
import { StyleStep } from './wizard-steps/style-step';
import { PreviewStep } from './wizard-steps/preview-step';
import { FormQRCode } from './form-qr-code';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useReduxAuth } from '@/hooks/useReduxAuth';
import { useAuth } from '@/hooks/useAuth';
import { useAppSelector } from '@/store';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface FormWizardProps {
  editMode?: boolean;
  formData?: {
    id: string;
    title: string;
    description: string;
    category?: string;
    formData: string;
    theme: string;
    isActive: boolean;
    responseCount: number;
    createdAt: string;
    updatedAt: string;
  };
}

export function FormWizard({ editMode = false, formData: existingFormData }: FormWizardProps) {
  const { isAuthenticated, isLoading: authLoading } = useReduxAuth();
  const { hasInitialized } = useAuth();
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);
const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [createdFormData, setCreatedFormData] = useState<{ id: string; title: string } | null>(null);
  const scrollPositions = useRef<Record<string, number>>({});

  // Redirect unauthenticated users immediately
  if (hasInitialized && !isAuthenticated) {
    setLocation('/auth');
    return null;
  }

  // Show loading while authentication is being determined
  if (!hasInitialized || authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-4">Authenticating...</span>
        </div>
      </div>
    );
  }
  const {
    wizardState,
    themes,
    nextStep,
    previousStep,
    updateFormData,
    selectTheme,
    customizeThemeColors,
    resetThemeColors,
    completeWizard,
    resetWizard,
    checkStorageState
  } = useFormWizard(editMode ? existingFormData : undefined);

  const canProceedToStyle = wizardState.formData.elements.some(element => element.type === 'email-input');
  const canProceedToPreview = wizardState.selectedTheme !== null;

  const handleNextStep = () => {
    scrollPositions.current[wizardState.currentStep] = window.scrollY;
    nextStep();
  };

  const handlePreviousStep = () => {
    scrollPositions.current[wizardState.currentStep] = window.scrollY;
    previousStep();
  };

  useEffect(() => {
    const saved = scrollPositions.current[wizardState.currentStep];
    if (saved !== undefined) {
      requestAnimationFrame(() => window.scrollTo(0, saved));
    }
  }, [wizardState.currentStep]);

  const handleSave = async () => {
    if (!wizardState.selectedTheme) {
      toast({
        title: "Error",
        description: "No theme selected. Please go back to step 2 and select a theme.",
        variant: "destructive",
      });
      return;
    }

    if (wizardState.formData.elements.length === 0) {
      toast({
        title: "Error",
        description: "Cannot save an empty form. Please add some form elements.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    // Check storage state before saving
    console.log('📝 Before saving form:');
    checkStorageState();
    
    try {
      // Prepare form data for saving
      const formDataToSave = {
        title: wizardState.formData.title,
        description: wizardState.formData.settings?.description || '',
        category: wizardState.formData.category || 'intake',
        formData: JSON.stringify({
          elements: wizardState.formData.elements,
          settings: wizardState.formData.settings || {}
        }),
        theme: JSON.stringify({
          id: wizardState.selectedTheme.id,
          name: wizardState.selectedTheme.name,
          customColors: wizardState.selectedTheme.customColors || null
        }),
        tags: wizardState.formData.tags || []
      };

      console.log(`${editMode ? 'Updating' : 'Creating'} form:`, formDataToSave);

      // Make authenticated API call to create or update the form
      const url = editMode && existingFormData ? `/api/forms/${existingFormData.id}` : '/api/forms';
      const method = editMode && existingFormData ? 'PUT' : 'POST';
      const response = await apiRequest(method, url, formDataToSave);
      const result = await response.json();
      
      console.log(`Form ${editMode ? 'updated' : 'created'} successfully:`, result);
      
      // Invalidate the forms cache to refresh the forms list
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/forms', selectedShopId] });
      if (editMode && existingFormData) {
        queryClient.invalidateQueries({ queryKey: ['/api/forms', existingFormData.id] });
      }
      
      // Extract form ID from response
      const formId = editMode && existingFormData ? existingFormData.id : result?.id;
      
      if (!formId) {
        throw new Error('Failed to get form ID from server response');
      }
      
      // Set created form data and show success dialog
      setCreatedFormData({
        id: formId,
        title: wizardState.formData.title
      });
      
      // Clear the form data from storage and reset wizard state (only for new forms)
      if (!editMode) {
        console.log('🧹 Clearing form wizard data from storage...');
        resetWizard();
        console.log('✅ Form wizard data cleared from storage');
        
        // Verify storage is cleared
        console.log('🔍 After clearing storage:');
        checkStorageState();
      }
      
      // Complete the wizard and show success dialog
      completeWizard();
    } catch (error: any) {
      console.error('Error saving form:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Development helper to test storage functionality
  const handleTestStorage = () => {
    console.log('🧪 Testing storage functionality...');
    checkStorageState();
  };

  const getStepTitle = () => {
    switch (wizardState.currentStep) {
      case 'build':
        return t('formBuilder.wizard.build', 'Build');
      case 'style':
        return t('formBuilder.wizard.style', 'Style');
      case 'preview':
        return t('formBuilder.wizard.preview', 'Preview');
      default:
        return 'Form Builder';
    }
  };

  const getStepNumber = () => {
    switch (wizardState.currentStep) {
      case 'build':
        return 1;
      case 'style':
        return 2;
      case 'preview':
        return 3;
      default:
        return 1;
    }
  };

  if (wizardState.isComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-12 bg-stone-50 dark:bg-neutral-950 overflow-y-auto">
        <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 p-10 rounded-2xl shadow-lg border border-stone-200 dark:border-neutral-800">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20">
              <Check className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-stone-900 dark:text-stone-100 mb-3 tracking-tight">
              {editMode ? 'Form Updated' : 'Form Created'}
            </h2>
            <p className="text-base text-stone-500 dark:text-stone-400">
              {editMode
                ? `Your form is updated and ready to receive responses.`
                : `Your form has been saved and is ready to go.`
              }
            </p>
          </div>

          {createdFormData && (
            <div className="border-t border-stone-200 dark:border-neutral-800 pt-8 mb-8">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-200">Share Your Form</h3>
                <p className="text-stone-500 dark:text-stone-400 mt-1 text-sm">
                  Use the QR code below or share the direct URL to collect responses
                </p>
              </div>
              <FormQRCode formId={createdFormData.id} formTitle={createdFormData.title} />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-8 border-t border-stone-200 dark:border-neutral-800">
            <Button
              variant="outline"
              onClick={() => setLocation('/forms')}
              className="px-8 py-5 text-base border-stone-300 dark:border-neutral-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-neutral-800 rounded-xl"
            >
              Return to Forms
            </Button>
            <Button
              onClick={resetWizard}
              className="px-8 py-5 text-base bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl shadow-md shadow-amber-500/20"
            >
              Create Another Form
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-neutral-950">
      {/* Header with Progress */}
      <header className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-b border-stone-200/80 dark:border-neutral-800/80 flex items-center justify-between px-6 py-4 sticky top-0 z-40">
        <div className="flex items-center space-x-6">
          {/* Progress Steps */}
          <div className="hidden lg:flex items-center space-x-1">
            {[
              { step: 1, title: t('formBuilder.wizard.build', 'Build'), key: 'build' },
              { step: 2, title: t('formBuilder.wizard.style', 'Style'), key: 'style' },
              { step: 3, title: t('formBuilder.wizard.preview', 'Preview'), key: 'preview' }
            ].map((item, index) => {
              const isActive = wizardState.currentStep === item.key;
              const isCompleted = getStepNumber() > item.step;
              return (
              <div key={item.key} className="flex items-center">
                {index > 0 && (
                  <div className="w-12 h-px bg-stone-200 dark:bg-neutral-700 mx-1 relative overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 bg-amber-500 transition-all duration-500 ease-out ${
                        isCompleted || isActive ? 'w-full' : 'w-0'
                      }`}
                    />
                  </div>
                )}
                <button
                  className={`flex items-center space-x-2.5 px-3.5 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-amber-50 dark:bg-amber-500/10'
                      : 'hover:bg-stone-50 dark:hover:bg-neutral-800'
                  }`}
                  onClick={() => {
                    // Only allow going back to completed steps
                    if (isCompleted) {
                      if (item.key === 'build') { previousStep(); if (getStepNumber() > 2) previousStep(); }
                      if (item.key === 'style' && getStepNumber() > 2) previousStep();
                    }
                  }}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/30'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-stone-200 dark:bg-neutral-700 text-stone-500 dark:text-neutral-400'
                  }`}>
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      item.step
                    )}
                  </div>
                  <span className={`text-sm font-medium tracking-tight ${
                    isActive
                      ? 'text-amber-700 dark:text-amber-400'
                      : isCompleted
                      ? 'text-stone-700 dark:text-stone-300'
                      : 'text-stone-400 dark:text-neutral-500'
                  }`}>
                    {item.title}
                  </span>
                </button>
              </div>
            )})}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-xs font-medium text-stone-400 dark:text-neutral-500 tracking-wide uppercase">
            {t('formBuilder.wizard.stepOf', { current: getStepNumber(), total: 3, defaultValue: `Step ${getStepNumber()} of 3` })}
          </div>
        </div>
      </header>
      {/* Step Content */}
      <div className="flex flex-col">
        {wizardState.currentStep === 'build' && (
          <BuildStep 
            onDataChange={updateFormData}
            initialTitle={wizardState.formData.title}
            initialElements={wizardState.formData.elements}
            initialSettings={wizardState.formData.settings}
            initialTags={wizardState.formData.tags}
            initialCategory={wizardState.formData.category}
            isEditMode={editMode}
          />
        )}
        
        {wizardState.currentStep === 'style' && (
          <StyleStep
            themes={themes}
            selectedTheme={wizardState.selectedTheme}
            onSelectTheme={selectTheme}
            onCustomizeColors={customizeThemeColors}
            onResetColors={resetThemeColors}
          />
        )}
        
        {wizardState.currentStep === 'preview' && (
          <PreviewStep 
            formTitle={wizardState.formData.title}
            elements={wizardState.formData.elements}
            selectedTheme={wizardState.selectedTheme}
            formSettings={wizardState.formData.settings}
            formCategory={wizardState.formData.category}
            onSave={handleSave}
            onCustomizeColors={customizeThemeColors}
            onResetColors={resetThemeColors}
            isSaving={isSaving}
          />
        )}
      </div>
      {/* Spacer for fixed footer */}
      <div className="h-[72px]" />
      {/* Navigation Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-t border-stone-200/80 dark:border-neutral-800/80 px-6 py-3.5">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div>
            {wizardState.currentStep !== 'build' && (
              <Button variant="outline" onClick={handlePreviousStep} className="flex items-center space-x-2 border-stone-300 dark:border-neutral-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-neutral-800 rounded-lg">
                <ArrowLeft className="w-4 h-4" />
                <span>{t('formBuilder.wizard.previous', 'Previous')}</span>
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {wizardState.currentStep === 'build' && (
              <div className="text-sm text-stone-500 dark:text-neutral-400">
                {canProceedToStyle ?
                  `${wizardState.formData.elements.length} element${wizardState.formData.elements.length !== 1 ? 's' : ''} ${t('formBuilder.wizard.added','added')}` :
                  t('formBuilder.wizard.buildHint', 'Add at least one Email component to continue')
                }
              </div>
            )}

            {wizardState.currentStep === 'style' && (
              <div className="text-sm text-stone-500 dark:text-neutral-400">
                {canProceedToPreview ?
                `${wizardState.selectedTheme?.name} ${t('formBuilder.wizard.themeSelected','theme selected')}` :
                t('formBuilder.wizard.styleHint', 'Select a theme to continue')
                }
              </div>
            )}

            {wizardState.currentStep !== 'preview' && (
              <Button
                onClick={handleNextStep}
                disabled={
                  (wizardState.currentStep === 'build' && !canProceedToStyle) ||
                  (wizardState.currentStep === 'style' && !canProceedToPreview)
                }
                className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-stone-300 disabled:to-stone-300 dark:disabled:from-neutral-700 dark:disabled:to-neutral-700 text-white disabled:text-stone-500 dark:disabled:text-neutral-500 rounded-lg px-5 py-2.5 shadow-sm shadow-amber-500/20 disabled:shadow-none transition-all duration-200"
              >
                <span>{t('formBuilder.wizard.next', 'Next')}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}