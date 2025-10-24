import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

interface OnboardingData {
  geographicalLocation: string;
  language: string;
  businessDescription: string;
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español (Spanish)' },
  { value: 'fr', label: 'Français (French)' },
  { value: 'de', label: 'Deutsch (German)' },
  { value: 'it', label: 'Italiano (Italian)' },
  { value: 'pt', label: 'Português (Portuguese)' },
  { value: 'zh', label: '中文 (Chinese)' },
  { value: 'ja', label: '日本語 (Japanese)' },
  { value: 'ko', label: '한국어 (Korean)' },
  { value: 'ar', label: 'العربية (Arabic)' },
];

const REGIONS = [
  { value: 'north-america', label: 'North America' },
  { value: 'south-america', label: 'South America' },
  { value: 'europe', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'africa', label: 'Africa' },
  { value: 'oceania', label: 'Oceania' },
  { value: 'middle-east', label: 'Middle East' },
];

export function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { i18n } = useTranslation();
  
  const [formData, setFormData] = useState<OnboardingData>({
    geographicalLocation: '',
    language: 'en',
    businessDescription: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof OnboardingData, string>>>({});

  // Apply language change immediately when selected
  useEffect(() => {
    if (step === 2 && formData.language) {
      i18n.changeLanguage(formData.language);
    }
  }, [formData.language, step, i18n]);

  const validateStep1 = () => {
    const newErrors: Partial<Record<keyof OnboardingData, string>> = {};
    
    if (!formData.geographicalLocation) {
      newErrors.geographicalLocation = 'Please select your geographical location';
    }
    
    if (!formData.language) {
      newErrors.language = 'Please select a language';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Partial<Record<keyof OnboardingData, string>> = {};
    
    if (!formData.businessDescription || formData.businessDescription.trim().length < 10) {
      newErrors.businessDescription = 'Please provide at least 10 characters describing your business';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) {
        setStep(2);
      }
    }
  };

  const handleSubmit = async () => {
    if (!validateStep2()) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/company/complete-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to complete onboarding');
      }

      toast({
        title: 'Success!',
        description: 'Your account setup is complete. Welcome aboard!',
      });

      onComplete();
    } catch (error) {
      console.error('Onboarding error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to complete onboarding',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {step === 1 ? 'Welcome! Let\'s Get Started' : 'Tell Us About Your Business'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? 'Help us personalize your experience by sharing some basic information.' 
              : 'This information helps us tailor communications and AI features to better serve you.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-gray-200'}`} />
            <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-gray-200'}`} />
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location">
                  Geographical Location <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.geographicalLocation}
                  onValueChange={(value) => {
                    setFormData({ ...formData, geographicalLocation: value });
                    setErrors({ ...errors, geographicalLocation: undefined });
                  }}
                >
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select your region" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((region) => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.geographicalLocation && (
                  <p className="text-sm text-red-500">{errors.geographicalLocation}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">
                  Preferred Language <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.language}
                  onValueChange={(value) => {
                    setFormData({ ...formData, language: value });
                    setErrors({ ...errors, language: undefined });
                  }}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.language && (
                  <p className="text-sm text-red-500">{errors.language}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  This will be used for all outgoing communications like emails and notifications.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">
                  Business Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Tell us about your business, industry, services, or products..."
                  value={formData.businessDescription}
                  onChange={(e) => {
                    setFormData({ ...formData, businessDescription: e.target.value });
                    setErrors({ ...errors, businessDescription: undefined });
                  }}
                  rows={6}
                  className="resize-none"
                />
                {errors.businessDescription && (
                  <p className="text-sm text-red-500">{errors.businessDescription}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  This helps our AI understand your business context and provide better assistance throughout the platform.
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Note:</strong> Your platform experience will now be in{' '}
                  <strong>{LANGUAGES.find(l => l.value === formData.language)?.label}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4">
            {step === 2 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Back
              </Button>
            )}
            <div className={step === 1 ? 'ml-auto' : ''}>
              {step === 1 ? (
                <Button onClick={handleNext} disabled={loading}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Completing...' : 'Complete Setup'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
