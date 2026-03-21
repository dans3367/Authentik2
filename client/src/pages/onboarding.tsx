import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import {
    Globe,
    Languages,
    Building2,
    Sparkles,
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    Loader2,
    Shield
} from 'lucide-react';

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
    { value: 'north-america', label: 'North America', emoji: '🌎' },
    { value: 'south-america', label: 'South America', emoji: '🌎' },
    { value: 'europe', label: 'Europe', emoji: '🌍' },
    { value: 'asia', label: 'Asia', emoji: '🌏' },
    { value: 'africa', label: 'Africa', emoji: '🌍' },
    { value: 'oceania', label: 'Oceania', emoji: '🌏' },
    { value: 'middle-east', label: 'Middle East', emoji: '🌍' },
];

const STEPS = [
    { id: 1, title: 'Location & Language', icon: Globe, description: 'Where are you based?' },
    { id: 2, title: 'Your Business', icon: Building2, description: 'Tell us about your business' },
    { id: 3, title: 'All Set!', icon: Sparkles, description: 'Review & complete' },
];

export default function OnboardingPage() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [animateIn, setAnimateIn] = useState(true);
    const { toast } = useToast();
    const { i18n } = useTranslation();
    const [, setLocation] = useLocation();

    const [formData, setFormData] = useState<OnboardingData>({
        geographicalLocation: '',
        language: '',
        businessDescription: '',
    });

    const [errors, setErrors] = useState<Partial<Record<keyof OnboardingData, string>>>({});

    const cacheOnboardingCompleted = () => {
        const userDataStr = localStorage.getItem('persist:auth');
        if (!userDataStr) return;

        try {
            const parsed = JSON.parse(userDataStr);
            const user = JSON.parse(parsed.user || '{}');
            if (user.id) {
                localStorage.setItem(`onboardingCompleted:${user.id}`, 'true');
            }
        } catch {
            // ignore cache parse issues
        }
    };

    const redirectToPlanSelection = (delayMs = 0) => {
        const go = () => {
            window.location.href = '/select-plan';
        };

        if (delayMs > 0) {
            setTimeout(go, delayMs);
            return;
        }

        go();
    };

    // Check if onboarding is already completed — if so, redirect to dashboard
    useEffect(() => {
        const checkOnboardingStatus = async () => {
            try {
                const response = await fetch('/api/company', { credentials: 'include' });
                if (response.ok) {
                    const company = await response.json();
                    if (company && company.setupCompleted) {
                        cacheOnboardingCompleted();
                        redirectToPlanSelection();
                        return;
                    }
                }
            } catch (error) {
                console.error('Failed to check onboarding status:', error);
            } finally {
                setCheckingStatus(false);
            }
        };
        checkOnboardingStatus();
    }, [setLocation]);

    // Apply language change immediately when selected
    useEffect(() => {
        if (formData.language) {
            i18n.changeLanguage(formData.language);
        }
    }, [formData.language, i18n]);

    // Animate step transitions
    useEffect(() => {
        setAnimateIn(false);
        const timer = setTimeout(() => setAnimateIn(true), 50);
        return () => clearTimeout(timer);
    }, [step]);

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
        if (step === 1 && validateStep1()) {
            setStep(2);
        } else if (step === 2 && validateStep2()) {
            setStep(3);
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/company/complete-onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const error = await response.json();
                const errorMessage = error?.message || 'Failed to complete onboarding';
                if (errorMessage.toLowerCase().includes('onboarding already completed')) {
                    cacheOnboardingCompleted();
                    toast({
                        title: 'Already Completed',
                        description: 'Onboarding is already completed. Redirecting to dashboard...',
                    });
                    redirectToPlanSelection(600);
                    return;
                }
                throw new Error(errorMessage);
            }

            // Cache in localStorage
            cacheOnboardingCompleted();

            toast({
                title: '🎉 Welcome aboard!',
                description: 'Your account setup is complete. Let\'s get started!',
            });

            // Small delay for the toast, then redirect to dashboard
            setTimeout(() => { window.location.href = '/dashboard'; }, 800);
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

    if (checkingStatus) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                    <p className="text-blue-200 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"
                    style={{ animationDuration: '4s' }} />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"
                    style={{ animationDuration: '6s', animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl animate-pulse"
                    style={{ animationDuration: '8s', animationDelay: '2s' }} />
                {/* Grid pattern overlay */}
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                        backgroundSize: '60px 60px'
                    }} />
            </div>

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between px-8 py-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white text-lg font-semibold tracking-tight">SecureAuth</span>
                </div>
                <div className="text-blue-300/60 text-sm">
                    Step {step} of {STEPS.length}
                </div>
            </header>

            {/* Main content */}
            <main className="relative z-10 flex flex-col items-center justify-center px-4 pb-12" style={{ minHeight: 'calc(100vh - 88px)' }}>
                {/* Step indicators */}
                <div className="flex items-center gap-0 mb-12">
                    {STEPS.map((s, index) => {
                        const Icon = s.icon;
                        const isCompleted = step > s.id;
                        const isCurrent = step === s.id;

                        return (
                            <div key={s.id} className="flex items-center">
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${isCompleted
                                                ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30 scale-95'
                                                : isCurrent
                                                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 scale-110'
                                                    : 'bg-white/10 backdrop-blur-sm border border-white/10'
                                            }`}
                                    >
                                        {isCompleted ? (
                                            <CheckCircle2 className="w-5 h-5 text-white" />
                                        ) : (
                                            <Icon className={`w-5 h-5 ${isCurrent ? 'text-white' : 'text-white/40'}`} />
                                        )}
                                    </div>
                                    <span className={`mt-2 text-xs font-medium transition-colors duration-300 ${isCurrent ? 'text-blue-300' : isCompleted ? 'text-emerald-400' : 'text-white/30'
                                        }`}>
                                        {s.title}
                                    </span>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div className={`w-16 h-0.5 mx-3 mt-[-18px] rounded-full transition-colors duration-500 ${step > s.id ? 'bg-emerald-500' : 'bg-white/10'
                                        }`} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Content card */}
                <div
                    className={`w-full max-w-lg transition-all duration-500 ease-out ${animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                        }`}
                >
                    <div className="bg-white/[0.07] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl shadow-black/20">
                        {/* Step 1: Location & Language */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <div className="text-center mb-8">
                                    <h1 className="text-3xl font-bold text-white mb-2">
                                        Welcome! Let's Get Started
                                    </h1>
                                    <p className="text-blue-200/70 text-base">
                                        Help us personalize your experience by sharing some basic information.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="location" className="text-white/90 flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-blue-400" />
                                        Geographical Location <span className="text-red-400">*</span>
                                    </Label>
                                    <Select
                                        value={formData.geographicalLocation}
                                        onValueChange={(value) => {
                                            setFormData({ ...formData, geographicalLocation: value });
                                            setErrors({ ...errors, geographicalLocation: undefined });
                                        }}
                                    >
                                        <SelectTrigger
                                            id="location"
                                            className="bg-white/[0.08] border-white/15 text-white hover:bg-white/[0.12] transition-colors h-12 rounded-xl"
                                        >
                                            <SelectValue placeholder="Select your region" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {REGIONS.map((region) => (
                                                <SelectItem key={region.value} value={region.value}>
                                                    <span className="flex items-center gap-2">
                                                        <span>{region.emoji}</span>
                                                        <span>{region.label}</span>
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.geographicalLocation && (
                                        <p className="text-sm text-red-400 flex items-center gap-1">
                                            {errors.geographicalLocation}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="language" className="text-white/90 flex items-center gap-2">
                                        <Languages className="w-4 h-4 text-blue-400" />
                                        Preferred Language <span className="text-red-400">*</span>
                                    </Label>
                                    <Select
                                        value={formData.language}
                                        onValueChange={(value) => {
                                            setFormData({ ...formData, language: value });
                                            setErrors({ ...errors, language: undefined });
                                        }}
                                    >
                                        <SelectTrigger
                                            id="language"
                                            className="bg-white/[0.08] border-white/15 text-white hover:bg-white/[0.12] transition-colors h-12 rounded-xl"
                                        >
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
                                        <p className="text-sm text-red-400">{errors.language}</p>
                                    )}
                                    <p className="text-sm text-white/40 mt-1">
                                        This will be used for all outgoing communications like emails and notifications.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Business Description */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <div className="text-center mb-8">
                                    <h1 className="text-3xl font-bold text-white mb-2">
                                        Tell Us About Your Business
                                    </h1>
                                    <p className="text-blue-200/70 text-base">
                                        This helps us tailor communications and AI features to better serve you.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description" className="text-white/90 flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-blue-400" />
                                        Business Description <span className="text-red-400">*</span>
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
                                        className="bg-white/[0.08] border-white/15 text-white placeholder:text-white/30 hover:bg-white/[0.12] transition-colors resize-none rounded-xl"
                                    />
                                    {errors.businessDescription && (
                                        <p className="text-sm text-red-400">{errors.businessDescription}</p>
                                    )}
                                    <p className="text-sm text-white/40">
                                        This helps our AI understand your business context and provide better assistance.
                                    </p>
                                </div>

                                <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-4">
                                    <p className="text-sm text-blue-200">
                                        <strong className="text-blue-300">Note:</strong> Your platform experience will now be in{' '}
                                        <strong className="text-white">{LANGUAGES.find(l => l.value === formData.language)?.label}</strong>.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Review & Complete */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <div className="text-center mb-8">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl mb-4 shadow-lg shadow-emerald-500/25">
                                        <Sparkles className="w-8 h-8 text-white" />
                                    </div>
                                    <h1 className="text-3xl font-bold text-white mb-2">
                                        You're All Set!
                                    </h1>
                                    <p className="text-blue-200/70 text-base">
                                        Review your information below and complete your setup.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white/[0.05] rounded-xl p-4 border border-white/10">
                                        <div className="flex items-center gap-3 mb-1">
                                            <Globe className="w-4 h-4 text-blue-400" />
                                            <span className="text-sm text-white/50">Location</span>
                                        </div>
                                        <p className="text-white font-medium ml-7">
                                            {REGIONS.find(r => r.value === formData.geographicalLocation)?.emoji}{' '}
                                            {REGIONS.find(r => r.value === formData.geographicalLocation)?.label}
                                        </p>
                                    </div>

                                    <div className="bg-white/[0.05] rounded-xl p-4 border border-white/10">
                                        <div className="flex items-center gap-3 mb-1">
                                            <Languages className="w-4 h-4 text-blue-400" />
                                            <span className="text-sm text-white/50">Language</span>
                                        </div>
                                        <p className="text-white font-medium ml-7">
                                            {LANGUAGES.find(l => l.value === formData.language)?.label}
                                        </p>
                                    </div>

                                    <div className="bg-white/[0.05] rounded-xl p-4 border border-white/10">
                                        <div className="flex items-center gap-3 mb-1">
                                            <Building2 className="w-4 h-4 text-blue-400" />
                                            <span className="text-sm text-white/50">Business Description</span>
                                        </div>
                                        <p className="text-white/80 text-sm ml-7 leading-relaxed">
                                            {formData.businessDescription}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/10">
                            {step > 1 ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleBack}
                                    disabled={loading}
                                    className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Button>
                            ) : (
                                <div />
                            )}

                            {step < 3 ? (
                                <Button
                                    onClick={handleNext}
                                    disabled={loading}
                                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-xl px-6 h-11"
                                >
                                    Continue
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 rounded-xl px-6 h-11"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Completing...
                                        </>
                                    ) : (
                                        <>
                                            Complete Setup
                                            <Sparkles className="w-4 h-4 ml-2" />
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Bottom hint */}
                    <p className="text-center text-white/20 text-xs mt-6">
                        This information helps us personalize your experience and improve AI-powered features.
                    </p>
                </div>
            </main>
        </div>
    );
}
