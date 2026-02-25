import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Star, Loader2, CreditCard, Sparkles, Shield, Zap, Crown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useReduxAuth } from "@/hooks/useReduxAuth";

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

const PLAN_ICONS: Record<string, typeof Zap> = {
  Free: Shield,
  Plus: Zap,
  Pro: Crown,
};

const PLAN_COLORS: Record<string, string> = {
  Free: "from-slate-500 to-slate-600",
  Plus: "from-blue-500 to-indigo-600",
  Pro: "from-purple-500 to-pink-600",
};

export default function SelectPlanPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { user, isAuthenticated, isInitialized } = useReduxAuth();

  // Parse search params
  const searchParams = new URLSearchParams(searchString);
  const isSuccess = searchParams.get("success") === "true";
  const sessionId = searchParams.get("session_id");
  const isCanceled = searchParams.get("canceled") === "true";

  // Fetch plans
  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription/plans"],
    staleTime: 5 * 60 * 1000,
  });

  // Check if already subscribed
  const { data: subCheck, isLoading: subCheckLoading } = useQuery<{ hasSubscription: boolean; status: string | null }>({
    queryKey: ["/api/subscription/check-subscription"],
    enabled: isAuthenticated && isInitialized,
    staleTime: 10 * 1000,
  });

  // Setup checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (data: { planId: string; billingCycle: "monthly" | "yearly" }) => {
      const response = await apiRequest("POST", "/api/subscription/setup-checkout", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    },
  });

  // Confirm checkout mutation (called after Stripe redirects back)
  const confirmMutation = useMutation({
    mutationFn: async (data: { sessionId: string }) => {
      const response = await apiRequest("POST", "/api/subscription/confirm-checkout", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        // Cache subscription status so ProtectedRoute won't re-check
        if (user?.id) {
          localStorage.setItem(`subscriptionActive:${user.id}`, 'true');
        }
        toast({
          title: "Welcome!",
          description: "Your subscription is active. Redirecting to dashboard...",
        });
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1000);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to confirm subscription",
        variant: "destructive",
      });
    },
  });

  // Handle return from Stripe checkout
  useEffect(() => {
    if (isSuccess && sessionId && !confirmMutation.isPending && !confirmMutation.isSuccess) {
      confirmMutation.mutate({ sessionId });
    }
  }, [isSuccess, sessionId]);

  // Show canceled toast
  useEffect(() => {
    if (isCanceled) {
      toast({
        title: "Checkout Canceled",
        description: "You can select a plan whenever you're ready.",
      });
      // Clean the URL
      setLocation("/select-plan", { replace: true });
    }
  }, [isCanceled]);

  // If already subscribed, cache and redirect to dashboard
  useEffect(() => {
    if (subCheck?.hasSubscription && subCheck?.status === "active") {
      if (user?.id) {
        localStorage.setItem(`subscriptionActive:${user.id}`, 'true');
      }
      window.location.href = "/dashboard";
    }
  }, [subCheck]);

  // Redirect unauthenticated
  if (isInitialized && !isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    checkoutMutation.mutate({ planId, billingCycle });
  };

  // Show confirming state
  if (isSuccess && sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-green-400 animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Activating your subscription...</h2>
          <p className="text-blue-200/70">Please wait while we set everything up.</p>
          <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto mt-4" />
        </div>
      </div>
    );
  }

  if (plansLoading || subCheckLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="text-blue-200 text-sm">Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "6s", animationDelay: "1s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "8s", animationDelay: "2s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-lg font-semibold tracking-tight">Zendwise</span>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-col items-center px-4 pb-16">
        <div className="text-center mb-10 max-w-2xl">
          <h1 className="text-4xl font-bold text-white mb-3">Choose Your Plan</h1>
          <p className="text-blue-200/70 text-lg">
            Select the plan that best fits your needs. All plans require a valid credit card on file.
            {" "}You can upgrade or downgrade anytime.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="mb-10">
          <Tabs
            value={billingCycle}
            onValueChange={(v) => setBillingCycle(v as "monthly" | "yearly")}
          >
            <TabsList className="bg-white/10 border border-white/10">
              <TabsTrigger
                value="monthly"
                className="data-[state=active]:bg-white data-[state=active]:text-slate-900 text-white/70"
              >
                Monthly
              </TabsTrigger>
              <TabsTrigger
                value="yearly"
                className="data-[state=active]:bg-white data-[state=active]:text-slate-900 text-white/70"
              >
                Yearly
                <Badge className="ml-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-1.5">
                  Save 20%
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
          {plans?.map((plan) => {
            const Icon = PLAN_ICONS[plan.name] || Shield;
            const gradientColor = PLAN_COLORS[plan.name] || "from-slate-500 to-slate-600";
            const isFree = parseFloat(plan.price) === 0;
            const price = billingCycle === "yearly" && plan.yearlyPrice
              ? parseFloat(plan.yearlyPrice)
              : parseFloat(plan.price);
            const monthlyEquivalent = billingCycle === "yearly" && plan.yearlyPrice
              ? (parseFloat(plan.yearlyPrice) / 12).toFixed(2)
              : null;
            const isProcessing = checkoutMutation.isPending && selectedPlanId === plan.id;

            return (
              <Card
                key={plan.id}
                className={`relative bg-white/5 backdrop-blur-sm border transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${plan.isPopular
                    ? "border-blue-400/50 shadow-lg shadow-blue-500/10"
                    : "border-white/10 hover:border-white/20"
                  }`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 px-4 py-1 shadow-lg">
                      <Star className="w-3 h-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2 pt-8">
                  <div className="mx-auto mb-4">
                    <div
                      className={`w-14 h-14 bg-gradient-to-br ${gradientColor} rounded-2xl flex items-center justify-center shadow-lg`}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                  </div>

                  <CardTitle className="text-xl text-white">{plan.displayName}</CardTitle>
                  <CardDescription className="text-blue-200/50 text-sm">
                    {plan.description}
                  </CardDescription>

                  <div className="pt-4 pb-2">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-white">
                        ${billingCycle === "yearly" && monthlyEquivalent ? monthlyEquivalent : plan.price}
                      </span>
                      <span className="text-blue-200/50 text-sm">/mo</span>
                    </div>
                    {billingCycle === "yearly" && plan.yearlyPrice && !isFree && (
                      <p className="text-emerald-400 text-xs mt-1">
                        ${plan.yearlyPrice} billed annually
                      </p>
                    )}
                    {isFree && (
                      <p className="text-blue-200/40 text-xs mt-1">
                        Credit card required for verification
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-0 pb-8 px-6">
                  <Button
                    className={`w-full mb-6 h-11 font-semibold ${plan.isPopular
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25"
                        : isFree
                          ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                          : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                      }`}
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={checkoutMutation.isPending}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Redirecting to checkout...
                      </>
                    ) : isFree ? (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Get Started Free
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Subscribe Now
                      </>
                    )}
                  </Button>

                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start text-sm text-blue-100/80">
                        <Check className="h-4 w-4 text-emerald-400 mr-3 mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 pt-4 border-t border-white/5 text-xs text-blue-200/40 space-y-1">
                    {plan.maxUsers !== null && <div>{plan.maxUsers} user{plan.maxUsers !== 1 ? "s" : ""}</div>}
                    {plan.maxShops !== null && plan.maxShops > 0 && <div>Up to {plan.maxShops} shops</div>}
                    {plan.monthlyEmailLimit !== null && (
                      <div>{plan.monthlyEmailLimit.toLocaleString()} emails/month</div>
                    )}
                    {plan.storageLimit !== null && <div>{plan.storageLimit}GB storage</div>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-10 text-center text-sm text-blue-200/40">
          <p>All plans include SSL encryption and secure data handling.</p>
          <p className="mt-1">
            Questions?{" "}
            <a href="mailto:support@zendwise.com" className="text-blue-400 hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
