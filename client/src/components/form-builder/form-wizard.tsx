import { useFormWizard } from '@/hooks/use-form-wizard';
import { BuildStep } from './wizard-steps/build-step';
import { StyleStep } from './wizard-steps/style-step';
import { PreviewStep } from './wizard-steps/preview-step';
import { FormSuccessDialog } from './form-success-dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useReduxAuth } from '@/hooks/useReduxAuth';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface FormWizardProps {
  editMode?: boolean;
  formData?: {
    id: string;
    title: string;
    description: string;
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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdFormData, setCreatedFormData] = useState<{ id: string; title: string } | null>(null);

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
        formData: JSON.stringify({
          elements: wizardState.formData.elements,
          settings: wizardState.formData.settings || {}
        }),
        theme: JSON.stringify({
          id: wizardState.selectedTheme.id,
          name: wizardState.selectedTheme.name,
          customColors: wizardState.selectedTheme.customColors || null
        })
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
      if (editMode && existingFormData) {
        queryClient.invalidateQueries({ queryKey: ['/api/forms', existingFormData.id] });
      }
      
      // Extract form ID from response
      const formId = editMode && existingFormData ? existingFormData.id : result.form?.id;
      
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
      setShowSuccessDialog(true);
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

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Exporting form:', wizardState);
  };

  // Development helper to test storage functionality
  const handleTestStorage = () => {
    console.log('🧪 Testing storage functionality...');
    checkStorageState();
  };

  // Handle success dialog close
  const handleSuccessDialogClose = () => {
    setShowSuccessDialog(false);
    setCreatedFormData(null);
    setLocation('/forms'); // Redirect to forms list
  };



  const getStepTitle = () => {
    switch (wizardState.currentStep) {
      case 'build':
        return 'Build Your Form';
      case 'style':
        return 'Choose Style';
      case 'preview':
        return 'Preview & Save';
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
      <div className="h-screen flex flex-col items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Form Saved Successfully!</h2>
          <p className="text-slate-600 mb-6">Your form has been created and saved.</p>
          <Button onClick={resetWizard}>Create Another Form</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      {/* Header with Progress */}
      <header className="bg-white/95 backdrop-blur-lg border-b border-slate-200/60 h-16 flex items-center justify-between px-6 shadow-sm pt-[40px] pb-[40px]">
        <div className="flex items-center space-x-6">
          {/* Progress Steps */}
          <div className="hidden lg:flex items-center space-x-4">
            {[
              { step: 1, title: 'Build', key: 'build' },
              { step: 2, title: 'Style', key: 'style' },
              { step: 3, title: 'Preview', key: 'preview' }
            ].map((item, index) => (
              <div key={item.key} className="flex items-center">
                {index > 0 && (
                  <div className="w-8 h-0.5 bg-slate-200 mr-4">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        getStepNumber() > item.step ? 'bg-blue-500 w-full' : 'bg-transparent w-0'
                      }`}
                    />
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    wizardState.currentStep === item.key
                      ? 'bg-blue-500 text-white'
                      : getStepNumber() > item.step
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {getStepNumber() > item.step ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      item.step
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    wizardState.currentStep === item.key
                      ? 'text-slate-800'
                      : 'text-slate-500'
                  }`}>
                    {item.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-sm text-slate-600">
            Step {getStepNumber()} of 3
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
            isEditMode={editMode}
          />
        )}
        
        {wizardState.currentStep === 'style' && (
          <StyleStep 
            themes={themes} 
            selectedTheme={wizardState.selectedTheme}
            onSelectTheme={selectTheme}
          />
        )}
        
        {wizardState.currentStep === 'preview' && (
          <PreviewStep 
            formTitle={wizardState.formData.title}
            elements={wizardState.formData.elements}
            selectedTheme={wizardState.selectedTheme}
            formSettings={wizardState.formData.settings}
            onSave={handleSave}
            onExport={handleExport}
            onCustomizeColors={customizeThemeColors}
            onResetColors={resetThemeColors}
            isSaving={isSaving}
          />
        )}
      </div>
      {/* Navigation Footer */}
      <footer className="bg-white dark:bg-gray-950 border-t border-slate-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            {wizardState.currentStep !== 'build' && (
              <Button variant="outline" onClick={previousStep} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {wizardState.currentStep === 'build' && (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {canProceedToStyle ? 
                  `${wizardState.formData.elements.length} element${wizardState.formData.elements.length !== 1 ? 's' : ''} added` :
                  'Add at least one Email component to continue'
                }
              </div>
            )}
            
            {wizardState.currentStep === 'style' && (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {canProceedToPreview ? 
                  `${wizardState.selectedTheme?.name} theme selected` :
                  'Select a theme to continue'
                }
              </div>
            )}

            {wizardState.currentStep !== 'preview' && (
              <Button 
                onClick={nextStep}
                disabled={
                  (wizardState.currentStep === 'build' && !canProceedToStyle) ||
                  (wizardState.currentStep === 'style' && !canProceedToPreview)
                }
                className="flex items-center space-x-2"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </footer>

      {/* Success Dialog with QR Code */}
      {showSuccessDialog && createdFormData && (
        <FormSuccessDialog
          isOpen={showSuccessDialog}
          onClose={handleSuccessDialogClose}
          formId={createdFormData.id}
          formTitle={createdFormData.title}
          isEditMode={editMode}
        />
      )}
    </div>
  );
}