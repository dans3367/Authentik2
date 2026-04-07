import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Check, Loader2, ArrowRight, LogOut, Sparkles, Users, Store, Mail, HardDrive } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useReduxAuth, useReduxLogout } from "@/hooks/useReduxAuth";

interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: string;
  yearlyPrice: string | null;
  stripePriceId: string;
  stripeYearlyPriceId: string | null;
  features: string[];
  maxUsers: number | null;
  maxShops: number | null;
  monthlyEmailLimit: number | null;
  storageLimit: number | null;
  supportLevel: string;
  isPopular: boolean;
  isActive: boolean;
}

export default function SelectPlanPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { user, isAuthenticated, isInitialized } = useReduxAuth();
  const { logout } = useReduxLogout();
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Parse search params
  const searchParams = new URLSearchParams(searchString);
  const isSuccess = searchParams.get("success") === "true";
  const sessionId = searchParams.get("session_id");
  const isCanceled = searchParams.get("canceled") === "true";

  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription/plans"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: subCheck, isLoading: subCheckLoading } = useQuery<{ hasSubscription: boolean; status: string | null }>({
    queryKey: ["/api/subscription/check-subscription"],
    enabled: isAuthenticated && isInitialized,
    staleTime: 10 * 1000,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (data: { planId: string; billingCycle: "monthly" | "yearly" }) => {
      const response = await apiRequest("POST", "/api/subscription/setup-checkout", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start checkout", variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (data: { sessionId: string }) => {
      const response = await apiRequest("POST", "/api/subscription/confirm-checkout", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        if (user?.id) {
          localStorage.setItem(`subscriptionActive:${user.id}`, 'true');
          localStorage.removeItem(`onboardingCompleted:${user.id}`);
        }
        toast({ title: "Welcome!", description: "Your subscription is active. Let's set up your account..." });
        setTimeout(() => { window.location.href = "/onboarding"; }, 1000);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to confirm subscription", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (isSuccess && sessionId && !confirmMutation.isPending && !confirmMutation.isSuccess) {
      confirmMutation.mutate({ sessionId });
    }
  }, [isSuccess, sessionId]);

  useEffect(() => {
    if (isCanceled) {
      toast({ title: "Checkout Canceled", description: "You can select a plan whenever you're ready." });
      setLocation("/select-plan", { replace: true });
    }
  }, [isCanceled]);

  useEffect(() => {
    if (subCheck?.hasSubscription && subCheck?.status === "active") {
      if (user?.id) localStorage.setItem(`subscriptionActive:${user.id}`, 'true');
      window.location.href = "/dashboard";
    }
  }, [subCheck]);

  if (isInitialized && !isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    checkoutMutation.mutate({ planId, billingCycle });
  };

  // Shell for loading / confirming states
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <>
      <style>{fontImport}</style>
      <style>{keyframes}</style>
      <div style={{ minHeight: '100vh', background: '#09090B', fontFamily: "var(--sp-sans)", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </>
  );

  if (isSuccess && sessionId) {
    return (
      <Shell>
        <div className="text-center" style={{ animation: 'sp-fadeUp 0.6s ease-out' }}>
          <div className="mx-auto mb-8 w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <Sparkles className="w-9 h-9" style={{ color: '#34D399', animation: 'sp-pulse 2s ease-in-out infinite' }} />
          </div>
          <h2 className="text-2xl font-medium mb-2" style={{ color: '#FAFAFA', fontFamily: 'var(--sp-display)' }}>
            Activating your subscription...
          </h2>
          <p className="text-sm" style={{ color: '#71717A' }}>Please wait while we set everything up.</p>
          <Loader2 className="w-5 h-5 mx-auto mt-6 animate-spin" style={{ color: '#A78BFA' }} />
        </div>
      </Shell>
    );
  }

  if (plansLoading || subCheckLoading || !isInitialized) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#A78BFA' }} />
          <p className="text-sm" style={{ color: '#71717A' }}>Loading plans...</p>
        </div>
      </Shell>
    );
  }

  return (
    <>
      <style>{fontImport}</style>
      <style>{keyframes}</style>
      <div
        className="min-h-screen relative overflow-hidden"
        style={{
          background: '#09090B',
          fontFamily: 'var(--sp-sans)',
        }}
      >
        {/* Ambient gradient orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div style={{
            position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
            width: '800px', height: '600px',
            background: 'radial-gradient(ellipse, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.06) 40%, transparent 70%)',
            filter: 'blur(40px)',
          }} />
          <div style={{
            position: 'absolute', bottom: '-10%', left: '-5%',
            width: '500px', height: '500px',
            background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }} />
          <div style={{
            position: 'absolute', bottom: '10%', right: '-5%',
            width: '400px', height: '400px',
            background: 'radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }} />
        </div>

        {/* Fine noise overlay */}
        <div className="fixed inset-0 pointer-events-none" style={{ opacity: 0.4, mixBlendMode: 'soft-light', backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")` }} />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight" style={{ color: '#FAFAFA' }}>
              Zendwise
            </span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
            style={{ color: '#52525B', border: '1px solid transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#A1A1AA'; e.currentTarget.style.borderColor = '#27272A'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#52525B'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            <LogOut className="w-3 h-3" />
            Log out
          </button>
        </header>

        {/* Main */}
        <main className="relative z-10 flex flex-col items-center px-4 sm:px-6 pb-24 pt-4 sm:pt-8">
          {/* Hero text */}
          <div className="text-center mb-10 max-w-lg" style={{ animation: 'sp-fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div
              className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.15em] px-3 py-1.5 rounded-full mb-6"
              style={{ color: '#A78BFA', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.15)' }}
            >
              <Sparkles className="w-3 h-3" />
              Select a plan
            </div>
            <h1
              className="text-[2.5rem] sm:text-5xl font-medium mb-4 leading-[1.08]"
              style={{ fontFamily: 'var(--sp-display)', color: '#FAFAFA', letterSpacing: '-0.035em' }}
            >
              Simple pricing,{' '}
              <span style={{
                background: 'linear-gradient(135deg, #C4B5FD, #818CF8, #6366F1)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                powerful tools
              </span>
            </h1>
            <p className="text-sm leading-relaxed mx-auto" style={{ color: '#71717A', maxWidth: '340px' }}>
              Start free or unlock more. Upgrade, downgrade, or cancel anytime. All plans require a card on file.
            </p>
          </div>

          {/* Billing toggle */}
          <div className="mb-12" style={{ animation: 'sp-fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.08s both' }}>
            <div
              className="relative inline-flex items-center p-1 rounded-full"
              style={{ background: '#18181B', border: '1px solid #27272A' }}
            >
              <button
                onClick={() => setBillingCycle("monthly")}
                className="relative z-10 px-5 py-2 text-xs font-medium rounded-full transition-all duration-300"
                style={{
                  color: billingCycle === 'monthly' ? '#FAFAFA' : '#52525B',
                  background: billingCycle === 'monthly' ? '#27272A' : 'transparent',
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className="relative z-10 px-5 py-2 text-xs font-medium rounded-full transition-all duration-300 flex items-center gap-2"
                style={{
                  color: billingCycle === 'yearly' ? '#FAFAFA' : '#52525B',
                  background: billingCycle === 'yearly' ? '#27272A' : 'transparent',
                }}
              >
                Yearly
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}
                >
                  -20%
                </span>
              </button>
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[1040px] w-full items-stretch">
            {plans?.map((plan, index) => {
              const isFree = parseFloat(plan.price) === 0;
              const monthlyEquivalent = billingCycle === "yearly" && plan.yearlyPrice
                ? (parseFloat(plan.yearlyPrice) / 12).toFixed(0) : null;
              const isProcessing = checkoutMutation.isPending && selectedPlanId === plan.id;
              const displayPrice = billingCycle === "yearly" && monthlyEquivalent ? monthlyEquivalent : plan.price;
              const isPopular = plan.isPopular;
              const isHovered = hoveredPlan === plan.id;

              return (
                <div
                  key={plan.id}
                  className="relative group"
                  style={{ animation: `sp-fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) ${0.12 + index * 0.08}s both` }}
                  onMouseEnter={() => setHoveredPlan(plan.id)}
                  onMouseLeave={() => setHoveredPlan(null)}
                >
                  {/* Animated gradient border for popular */}
                  {isPopular && (
                    <div
                      className="absolute -inset-[1px] rounded-2xl overflow-hidden"
                      style={{ zIndex: 0 }}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          background: 'conic-gradient(from var(--sp-angle, 0deg), #6366F1, #8B5CF6, #A78BFA, #C4B5FD, #8B5CF6, #6366F1)',
                          animation: 'sp-rotate 4s linear infinite',
                          opacity: isHovered ? 0.9 : 0.5,
                          transition: 'opacity 0.4s ease',
                        }}
                      />
                    </div>
                  )}

                  {/* Card body */}
                  <div
                    className="relative rounded-2xl overflow-hidden h-full flex flex-col transition-all duration-500"
                    style={{
                      background: isPopular ? '#0F0F12' : '#111113',
                      border: isPopular ? 'none' : `1px solid ${isHovered ? '#2D2D33' : '#1E1E22'}`,
                      boxShadow: isHovered
                        ? isPopular
                          ? '0 0 40px rgba(139,92,246,0.12), 0 20px 60px rgba(0,0,0,0.4)'
                          : '0 20px 50px rgba(0,0,0,0.3)'
                        : '0 2px 8px rgba(0,0,0,0.2)',
                      transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                      zIndex: isPopular ? 2 : 1,
                    }}
                  >
                    {/* Popular ribbon */}
                    {isPopular && (
                      <div className="flex justify-center pt-4 pb-0">
                        <span
                          className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] px-3 py-1 rounded-full"
                          style={{ background: 'rgba(139,92,246,0.15)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.2)' }}
                        >
                          <Sparkles className="w-3 h-3" />
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="p-6 sm:p-7 flex flex-col flex-1" style={{ paddingTop: isPopular ? '1rem' : undefined }}>
                      {/* Plan header */}
                      <div className="mb-5">
                        <h3 className="text-base font-semibold mb-1" style={{ color: '#FAFAFA' }}>
                          {plan.displayName}
                        </h3>
                        <p className="text-xs leading-relaxed" style={{ color: '#52525B' }}>
                          {plan.description}
                        </p>
                      </div>

                      {/* Price block */}
                      <div className="mb-6">
                        <div className="flex items-baseline gap-1.5">
                          <span style={{
                            fontSize: '2.75rem',
                            fontFamily: 'var(--sp-display)',
                            fontWeight: 500,
                            color: '#FAFAFA',
                            letterSpacing: '-0.04em',
                            lineHeight: 1,
                          }}>
                            ${displayPrice}
                          </span>
                          <span className="text-xs font-medium" style={{ color: '#52525B' }}>
                            / month
                          </span>
                        </div>
                        {billingCycle === "yearly" && plan.yearlyPrice && !isFree ? (
                          <p className="text-xs mt-2 font-medium" style={{ color: '#34D399' }}>
                            ${plan.yearlyPrice}/yr — save 20%
                          </p>
                        ) : isFree ? (
                          <p className="text-xs mt-2" style={{ color: '#3F3F46' }}>
                            Card required for verification
                          </p>
                        ) : (
                          <p className="text-xs mt-2" style={{ color: '#3F3F46' }}>
                            Billed monthly, cancel anytime
                          </p>
                        )}
                      </div>

                      {/* CTA */}
                      <button
                        className="relative w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 overflow-hidden"
                        style={{
                          background: isPopular
                            ? 'linear-gradient(135deg, #7C3AED, #6366F1)'
                            : 'transparent',
                          color: '#FAFAFA',
                          border: isPopular ? 'none' : '1px solid #27272A',
                          boxShadow: isPopular
                            ? '0 0 24px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.1)'
                            : 'none',
                          opacity: checkoutMutation.isPending && selectedPlanId !== plan.id ? 0.4 : 1,
                          cursor: checkoutMutation.isPending ? 'wait' : 'pointer',
                        }}
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={checkoutMutation.isPending}
                        onMouseEnter={(e) => {
                          if (checkoutMutation.isPending) return;
                          if (isPopular) {
                            e.currentTarget.style.boxShadow = '0 0 32px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.1)';
                          } else {
                            e.currentTarget.style.borderColor = '#3F3F46';
                            e.currentTarget.style.background = '#18181B';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (isPopular) {
                            e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.1)';
                          } else {
                            e.currentTarget.style.borderColor = '#27272A';
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        {/* Shimmer effect on popular button */}
                        {isPopular && (
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.08) 55%, transparent 60%)',
                              animation: 'sp-shimmer 3s ease-in-out infinite',
                            }}
                          />
                        )}
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Redirecting...
                          </>
                        ) : isFree ? (
                          <>
                            Get Started Free
                            <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            Get {plan.displayName}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>

                      {/* Divider */}
                      <div className="my-5" style={{ height: 1, background: '#1E1E22' }} />

                      {/* Features */}
                      <ul className="space-y-2.5 flex-1">
                        {plan.features.map((feature, fi) => (
                          <li key={fi} className="flex items-start text-[13px] leading-snug" style={{ color: '#A1A1AA' }}>
                            <div
                              className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mr-2.5 mt-px"
                              style={{
                                background: isPopular ? 'rgba(139,92,246,0.12)' : 'rgba(63,63,70,0.4)',
                              }}
                            >
                              <Check
                                className="w-3 h-3"
                                style={{ color: isPopular ? '#A78BFA' : '#71717A' }}
                                strokeWidth={3}
                              />
                            </div>
                            {feature}
                          </li>
                        ))}
                      </ul>

                      {/* Limits as pill badges */}
                      <div className="mt-6 pt-4 flex flex-wrap gap-2" style={{ borderTop: '1px solid #1E1E22' }}>
                        {plan.maxUsers !== null && (
                          <LimitBadge icon={<Users className="w-3 h-3" />} label={`${plan.maxUsers} user${plan.maxUsers !== 1 ? 's' : ''}`} />
                        )}
                        {plan.maxShops !== null && plan.maxShops > 0 && (
                          <LimitBadge icon={<Store className="w-3 h-3" />} label={`${plan.maxShops} shop${plan.maxShops !== 1 ? 's' : ''}`} />
                        )}
                        {plan.monthlyEmailLimit !== null && (
                          <LimitBadge icon={<Mail className="w-3 h-3" />} label={`${plan.monthlyEmailLimit.toLocaleString()}/mo`} />
                        )}
                        {plan.storageLimit !== null && (
                          <LimitBadge icon={<HardDrive className="w-3 h-3" />} label={`${plan.storageLimit}GB`} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-16 text-center" style={{ animation: 'sp-fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.4s both' }}>
            <p className="text-xs" style={{ color: '#3F3F46' }}>
              All plans include SSL encryption and secure data handling.
            </p>
            <p className="text-xs mt-1" style={{ color: '#3F3F46' }}>
              Questions?{' '}
              <a
                href="mailto:support@zendwise.com"
                className="transition-colors duration-200"
                style={{ color: '#71717A' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#A78BFA'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#71717A'; }}
              >
                Contact support
              </a>
            </p>
          </div>
        </main>
      </div>
    </>
  );
}

function LimitBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full"
      style={{ color: '#52525B', background: '#18181B', border: '1px solid #1E1E22' }}
    >
      {icon}
      {label}
    </span>
  );
}

const fontImport = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap');
  :root {
    --sp-sans: 'DM Sans', -apple-system, sans-serif;
    --sp-display: 'Instrument Serif', Georgia, serif;
  }
`;

const keyframes = `
  @property --sp-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }
  @keyframes sp-fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sp-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes sp-rotate {
    to { --sp-angle: 360deg; }
  }
  @keyframes sp-shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`;
