import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
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
    LogOut,
    Check
} from 'lucide-react';
import { clearAllAuthState, setIntentionalLogout } from '@/lib/clearAuthState';
import { writeCachedFlag, onboardingCacheKey } from '@/lib/protectedFlagCache';

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
    { id: 1, title: 'Location', icon: Globe },
    { id: 2, title: 'Business', icon: Building2 },
    { id: 3, title: 'Review', icon: Sparkles },
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
            // Use the shared TTL-wrapped writer so ProtectedRoute's cache
            // read accepts this entry without forcing a redundant network
            // check on the next navigation.
            if (user.id) writeCachedFlag(onboardingCacheKey(user.id));
        } catch { /* ignore */ }
    };

    const redirectToPlanSelection = (delayMs = 0) => {
        const go = () => { window.location.href = '/select-plan'; };
        if (delayMs > 0) { setTimeout(go, delayMs); return; }
        go();
    };

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

    useEffect(() => {
        if (formData.language) i18n.changeLanguage(formData.language);
    }, [formData.language, i18n]);

    useEffect(() => {
        setAnimateIn(false);
        const timer = setTimeout(() => setAnimateIn(true), 50);
        return () => clearTimeout(timer);
    }, [step]);

    const validateStep1 = () => {
        const newErrors: Partial<Record<keyof OnboardingData, string>> = {};
        if (!formData.geographicalLocation) newErrors.geographicalLocation = 'Please select your region';
        if (!formData.language) newErrors.language = 'Please select a language';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        const newErrors: Partial<Record<keyof OnboardingData, string>> = {};
        if (!formData.businessDescription || formData.businessDescription.trim().length < 10) {
            newErrors.businessDescription = 'Please provide at least 10 characters';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (step === 1 && validateStep1()) setStep(2);
        else if (step === 2 && validateStep2()) setStep(3);
    };

    const handleBack = () => { if (step > 1) setStep(step - 1); };

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
                    toast({ title: 'Already Completed', description: 'Redirecting to dashboard...' });
                    redirectToPlanSelection(600);
                    return;
                }
                throw new Error(errorMessage);
            }

            cacheOnboardingCompleted();
            toast({ title: 'Welcome aboard!', description: 'Your account setup is complete.' });
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

    // Shared shell
    const Shell = ({ children }: { children: React.ReactNode }) => (
        <>
            <style>{fontImport}</style>
            <style>{keyframes}</style>
            <div style={{ minHeight: '100vh', background: '#09090B', fontFamily: "var(--ob-sans)", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {children}
            </div>
        </>
    );

    if (checkingStatus) {
        return (
            <Shell>
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#A78BFA' }} />
                    <p className="text-sm" style={{ color: '#71717A' }}>Loading...</p>
                </div>
            </Shell>
        );
    }

    return (
        <>
            <style>{fontImport}</style>
            <style>{keyframes}</style>
            <div className="min-h-screen relative overflow-hidden" style={{ background: '#09090B', fontFamily: 'var(--ob-sans)' }}>
                {/* Ambient orbs */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden">
                    <div style={{
                        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
                        width: '800px', height: '600px',
                        background: 'radial-gradient(ellipse, rgba(139,92,246,0.1) 0%, rgba(99,102,241,0.05) 40%, transparent 70%)',
                        filter: 'blur(40px)',
                    }} />
                    <div style={{
                        position: 'absolute', bottom: '-10%', right: '10%',
                        width: '400px', height: '400px',
                        background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
                        filter: 'blur(60px)',
                    }} />
                </div>

                {/* Noise overlay */}
                <div className="fixed inset-0 pointer-events-none" style={{ opacity: 0.4, mixBlendMode: 'soft-light', backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")` }} />

                {/* Header */}
                <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                        </div>
                        <span className="text-sm font-semibold tracking-tight" style={{ color: '#FAFAFA' }}>Zendwise</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs" style={{ color: '#3F3F46' }}>
                            Step {step}/{STEPS.length}
                        </span>
                        <button
                            onClick={async () => {
                                setIntentionalLogout(true);
                                await clearAllAuthState();
                                window.location.href = '/auth';
                            }}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
                            style={{ color: '#52525B', border: '1px solid transparent' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#A1A1AA'; e.currentTarget.style.borderColor = '#27272A'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#52525B'; e.currentTarget.style.borderColor = 'transparent'; }}
                        >
                            <LogOut className="w-3 h-3" />
                            Log out
                        </button>
                    </div>
                </header>

                {/* Main */}
                <main className="relative z-10 flex flex-col items-center justify-center px-4 pb-16" style={{ minHeight: 'calc(100vh - 72px)' }}>

                    {/* Step indicator */}
                    <div className="flex items-center gap-0 mb-10" style={{ animation: 'ob-fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
                        {STEPS.map((s, index) => {
                            const Icon = s.icon;
                            const isCompleted = step > s.id;
                            const isCurrent = step === s.id;

                            return (
                                <div key={s.id} className="flex items-center">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500"
                                            style={{
                                                background: isCompleted
                                                    ? 'rgba(52,211,153,0.15)'
                                                    : isCurrent
                                                        ? '#18181B'
                                                        : '#111113',
                                                border: `1px solid ${isCompleted ? 'rgba(52,211,153,0.25)' : isCurrent ? '#27272A' : '#1E1E22'}`,
                                                boxShadow: isCurrent ? '0 0 20px rgba(139,92,246,0.1)' : 'none',
                                            }}
                                        >
                                            {isCompleted ? (
                                                <Check className="w-4 h-4" style={{ color: '#34D399' }} strokeWidth={3} />
                                            ) : (
                                                <Icon className="w-4 h-4" style={{ color: isCurrent ? '#A78BFA' : '#3F3F46' }} />
                                            )}
                                        </div>
                                        <span
                                            className="mt-2 text-[11px] font-medium transition-colors duration-300"
                                            style={{ color: isCompleted ? '#34D399' : isCurrent ? '#A1A1AA' : '#3F3F46' }}
                                        >
                                            {s.title}
                                        </span>
                                    </div>
                                    {index < STEPS.length - 1 && (
                                        <div
                                            className="w-12 h-px mx-3 mt-[-18px] rounded-full transition-colors duration-500"
                                            style={{ background: step > s.id ? 'rgba(52,211,153,0.3)' : '#1E1E22' }}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Content card */}
                    <div
                        className="w-full max-w-lg"
                        style={{
                            opacity: animateIn ? 1 : 0,
                            transform: animateIn ? 'translateY(0)' : 'translateY(12px)',
                            transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
                        }}
                    >
                        <div
                            className="rounded-2xl overflow-hidden"
                            style={{
                                background: '#111113',
                                border: '1px solid #1E1E22',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.02)',
                            }}
                        >
                            <div className="p-7 sm:p-9">
                                {/* Step 1 */}
                                {step === 1 && (
                                    <div className="space-y-6">
                                        <div className="mb-8">
                                            <h1
                                                className="text-2xl sm:text-3xl font-medium mb-2"
                                                style={{ fontFamily: 'var(--ob-display)', color: '#FAFAFA', letterSpacing: '-0.03em' }}
                                            >
                                                Where are you{' '}
                                                <span style={{
                                                    background: 'linear-gradient(135deg, #C4B5FD, #818CF8)',
                                                    WebkitBackgroundClip: 'text',
                                                    WebkitTextFillColor: 'transparent',
                                                }}>based?</span>
                                            </h1>
                                            <p className="text-sm" style={{ color: '#52525B' }}>
                                                Help us personalize your experience.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="location" className="text-xs font-medium flex items-center gap-1.5" style={{ color: '#71717A' }}>
                                                <Globe className="w-3.5 h-3.5" style={{ color: '#A78BFA' }} />
                                                Region
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
                                                    className="h-11 rounded-xl text-sm"
                                                    style={{
                                                        background: '#18181B',
                                                        border: '1px solid #27272A',
                                                        color: formData.geographicalLocation ? '#FAFAFA' : '#52525B',
                                                    }}
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
                                                <p className="text-xs" style={{ color: '#F87171' }}>{errors.geographicalLocation}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="language" className="text-xs font-medium flex items-center gap-1.5" style={{ color: '#71717A' }}>
                                                <Languages className="w-3.5 h-3.5" style={{ color: '#A78BFA' }} />
                                                Preferred Language
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
                                                    className="h-11 rounded-xl text-sm"
                                                    style={{
                                                        background: '#18181B',
                                                        border: '1px solid #27272A',
                                                        color: formData.language ? '#FAFAFA' : '#52525B',
                                                    }}
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
                                                <p className="text-xs" style={{ color: '#F87171' }}>{errors.language}</p>
                                            )}
                                            <p className="text-xs" style={{ color: '#3F3F46' }}>
                                                Used for all outgoing emails and notifications.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2 */}
                                {step === 2 && (
                                    <div className="space-y-6">
                                        <div className="mb-8">
                                            <h1
                                                className="text-2xl sm:text-3xl font-medium mb-2"
                                                style={{ fontFamily: 'var(--ob-display)', color: '#FAFAFA', letterSpacing: '-0.03em' }}
                                            >
                                                Tell us about your{' '}
                                                <span style={{
                                                    background: 'linear-gradient(135deg, #C4B5FD, #818CF8)',
                                                    WebkitBackgroundClip: 'text',
                                                    WebkitTextFillColor: 'transparent',
                                                }}>business</span>
                                            </h1>
                                            <p className="text-sm" style={{ color: '#52525B' }}>
                                                Helps us tailor communications and AI features for you.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="description" className="text-xs font-medium flex items-center gap-1.5" style={{ color: '#71717A' }}>
                                                <Building2 className="w-3.5 h-3.5" style={{ color: '#A78BFA' }} />
                                                Business Description
                                            </Label>
                                            <Textarea
                                                id="description"
                                                placeholder="Describe your industry, services, products, or what you do..."
                                                value={formData.businessDescription}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, businessDescription: e.target.value });
                                                    setErrors({ ...errors, businessDescription: undefined });
                                                }}
                                                rows={5}
                                                className="resize-none rounded-xl text-sm"
                                                style={{
                                                    background: '#18181B',
                                                    border: '1px solid #27272A',
                                                    color: '#FAFAFA',
                                                }}
                                            />
                                            {errors.businessDescription && (
                                                <p className="text-xs" style={{ color: '#F87171' }}>{errors.businessDescription}</p>
                                            )}
                                            <p className="text-xs" style={{ color: '#3F3F46' }}>
                                                This helps our AI provide better context-aware assistance.
                                            </p>
                                        </div>

                                        {formData.language && (
                                            <div
                                                className="rounded-xl p-3.5 flex items-start gap-3"
                                                style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}
                                            >
                                                <Languages className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#A78BFA' }} />
                                                <p className="text-xs" style={{ color: '#71717A' }}>
                                                    Your platform will be in{' '}
                                                    <span style={{ color: '#A1A1AA', fontWeight: 600 }}>
                                                        {LANGUAGES.find(l => l.value === formData.language)?.label}
                                                    </span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Step 3 */}
                                {step === 3 && (
                                    <div className="space-y-6">
                                        <div className="text-center mb-8">
                                            <div
                                                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
                                                style={{
                                                    background: 'rgba(52,211,153,0.1)',
                                                    border: '1px solid rgba(52,211,153,0.2)',
                                                    boxShadow: '0 0 30px rgba(52,211,153,0.08)',
                                                }}
                                            >
                                                <Sparkles className="w-6 h-6" style={{ color: '#34D399' }} />
                                            </div>
                                            <h1
                                                className="text-2xl sm:text-3xl font-medium mb-2"
                                                style={{ fontFamily: 'var(--ob-display)', color: '#FAFAFA', letterSpacing: '-0.03em' }}
                                            >
                                                You're all set
                                            </h1>
                                            <p className="text-sm" style={{ color: '#52525B' }}>
                                                Review your details and complete setup.
                                            </p>
                                        </div>

                                        <div className="space-y-3">
                                            <ReviewItem
                                                icon={<Globe className="w-3.5 h-3.5" />}
                                                label="Location"
                                                value={
                                                    <>
                                                        {REGIONS.find(r => r.value === formData.geographicalLocation)?.emoji}{' '}
                                                        {REGIONS.find(r => r.value === formData.geographicalLocation)?.label}
                                                    </>
                                                }
                                            />
                                            <ReviewItem
                                                icon={<Languages className="w-3.5 h-3.5" />}
                                                label="Language"
                                                value={LANGUAGES.find(l => l.value === formData.language)?.label || ''}
                                            />
                                            <ReviewItem
                                                icon={<Building2 className="w-3.5 h-3.5" />}
                                                label="Business"
                                                value={formData.businessDescription}
                                                multiline
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex justify-between items-center mt-8 pt-6" style={{ borderTop: '1px solid #1E1E22' }}>
                                    {step > 1 ? (
                                        <button
                                            onClick={handleBack}
                                            disabled={loading}
                                            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-all duration-200"
                                            style={{ color: '#71717A' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.color = '#A1A1AA'; e.currentTarget.style.background = '#18181B'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.color = '#71717A'; e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" />
                                            Back
                                        </button>
                                    ) : (
                                        <div />
                                    )}

                                    {step < 3 ? (
                                        <button
                                            onClick={handleNext}
                                            disabled={loading}
                                            className="relative flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 overflow-hidden"
                                            style={{
                                                background: 'linear-gradient(135deg, #7C3AED, #6366F1)',
                                                color: '#FAFAFA',
                                                boxShadow: '0 0 24px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 32px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                        >
                                            Continue
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleSubmit}
                                            disabled={loading}
                                            className="relative flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 overflow-hidden"
                                            style={{
                                                background: 'linear-gradient(135deg, #059669, #10B981)',
                                                color: '#FAFAFA',
                                                boxShadow: '0 0 24px rgba(16,185,129,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 32px rgba(16,185,129,0.35), inset 0 1px 0 rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 24px rgba(16,185,129,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Completing...
                                                </>
                                            ) : (
                                                <>
                                                    Complete Setup
                                                    <Sparkles className="w-3.5 h-3.5" />
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <p className="text-center text-xs mt-6" style={{ color: '#27272A' }}>
                            This information helps personalize your experience and AI features.
                        </p>
                    </div>
                </main>
            </div>
        </>
    );
}

function ReviewItem({ icon, label, value, multiline }: { icon: React.ReactNode; label: string; value: React.ReactNode; multiline?: boolean }) {
    return (
        <div
            className="rounded-xl p-4"
            style={{ background: '#18181B', border: '1px solid #1E1E22' }}
        >
            <div className="flex items-center gap-2 mb-1.5">
                <span style={{ color: '#A78BFA' }}>{icon}</span>
                <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#52525B' }}>{label}</span>
            </div>
            <p
                className={`text-sm font-medium leading-relaxed ${multiline ? '' : ''}`}
                style={{ color: '#FAFAFA', paddingLeft: '1.375rem' }}
            >
                {value}
            </p>
        </div>
    );
}

const fontImport = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap');
  :root {
    --ob-sans: 'DM Sans', -apple-system, sans-serif;
    --ob-display: 'Instrument Serif', Georgia, serif;
  }
`;

const keyframes = `
  @keyframes ob-fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;
