import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Star, Loader2, CreditCard, Calendar, Users, Settings, TrendingUp, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import type { SubscriptionPlan, UserSubscriptionResponse } from "@shared/schema";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface CheckoutFormProps {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
}

const CheckoutForm = ({ planId, billingCycle }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Successful",
          description: "Welcome to your new subscription!",
        });
      }
    } catch (error) {
      toast({
        title: "Payment Error",
        description: "An unexpected error occurred during payment.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || isProcessing} className="w-full">
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Subscribe ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}`
        )}
      </Button>
    </form>
  );
};

interface SubscriptionManagementProps {
  subscription: UserSubscriptionResponse['subscription'];
  plans: SubscriptionPlan[];
  onUpgrade: (planId: string, billingCycle: 'monthly' | 'yearly') => void;
  isUpgrading: boolean;
}

const SubscriptionManagement = ({ subscription, plans, onUpgrade, isUpgrading }: SubscriptionManagementProps) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(
    subscription?.isYearly ? 'yearly' : 'monthly'
  );

  if (!subscription) return null;

  const currentPlan = subscription.plan;
  const isTrialing = subscription.status === 'trialing';
  const trialEndsAt = subscription.trialEnd ? new Date(subscription.trialEnd) : null;
  const currentPeriodEnd = new Date(subscription.currentPeriodEnd);
  const daysLeft = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  // Handle case where plan might not be loaded
  if (!currentPlan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading subscription details...</h1>
        </div>
      </div>
    );
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Current Subscription Overview */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Subscription Management</h1>
          <p className="text-muted-foreground">Manage your subscription and billing settings</p>
        </div>

        {/* Current Plan Card */}
        <Card className="mb-8 border-primary shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{currentPlan.displayName}</CardTitle>
                <CardDescription>{currentPlan.description}</CardDescription>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">
                  ${subscription.isYearly ? currentPlan.yearlyPrice : currentPlan.price}
                </div>
                <div className="text-sm text-muted-foreground">
                  per {subscription.isYearly ? 'year' : 'month'}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Status</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    <Badge variant={isTrialing ? "secondary" : subscription.status === 'active' ? "default" : "destructive"}>
                      {isTrialing ? `Trial (${daysLeft} days left)` : subscription.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">
                    {isTrialing ? 'Trial Ends' : 'Next Billing'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(isTrialing && trialEndsAt ? trialEndsAt : currentPeriodEnd)}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Plan Features</div>
                  <div className="text-sm text-muted-foreground">
                    {currentPlan.maxUsers ? `${currentPlan.maxUsers} users` : 'Unlimited users'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {currentPlan.features.slice(0, 4).map((feature, index) => (
                <div key={index} className="flex items-center text-sm">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>

            {isTrialing && (
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Settings className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-800 dark:text-orange-200">Free Trial Active</h4>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                      Your free trial ends on {formatDate(trialEndsAt!)}.
                      Your subscription will automatically start after the trial period.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upgrade Options */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <TrendingUp className="h-6 w-6 mr-2" />
            Upgrade Your Plan
          </h2>
          <p className="text-muted-foreground mb-6">
            Unlock more features and capabilities with a higher-tier plan
          </p>

          <Tabs value={billingCycle} onValueChange={(value) => setBillingCycle(value as 'monthly' | 'yearly')}>
            <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">
                Yearly
                <Badge variant="secondary" className="ml-2">Save 20%</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan.id;
              const isUpgrade = parseFloat(plan.price) > parseFloat(currentPlan.price);

              return (
                <Card key={plan.id} className={`relative ${plan.isPopular ? 'border-primary shadow-lg' : ''} ${isCurrent ? 'bg-primary/10 border-primary border-2' : ''}`}>
                  {plan.isPopular && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-3 py-1">
                        <Star className="w-3 h-3 mr-1" />
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                      <Badge className="bg-green-600 text-white px-4 py-1">
                        <Check className="w-3 h-3 mr-1" />
                        Current Plan
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-4">
                    <CardTitle className="text-xl">{plan.displayName}</CardTitle>
                    <CardDescription className="text-sm">{plan.description}</CardDescription>

                    <div className="py-4">
                      <div className="text-3xl font-bold">
                        ${billingCycle === 'yearly' ? plan.yearlyPrice : plan.price}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        per {billingCycle === 'yearly' ? 'year' : 'month'}
                      </div>
                      {billingCycle === 'yearly' && plan.yearlyPrice && (
                        <div className="text-xs text-green-600 mt-1">
                          Save ${((parseFloat(plan.price) * 12) - parseFloat(plan.yearlyPrice)).toFixed(2)}/year
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <Button
                      className="w-full mb-4"
                      variant={isCurrent ? "outline" : isUpgrade ? "default" : "ghost"}
                      onClick={() => !isCurrent && onUpgrade(plan.id, billingCycle)}
                      disabled={isCurrent || isUpgrading}
                    >
                      {isCurrent ? (
                        "Current Plan"
                      ) : isUpgrading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : isUpgrade ? (
                        "Upgrade to This Plan"
                      ) : (
                        "Downgrade to This Plan"
                      )}
                    </Button>

                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center text-sm">
                          <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                      <div className="space-y-1">
                        {plan.maxUsers && <div>Up to {plan.maxUsers} users</div>}
                        {plan.maxShops && <div>Up to {plan.maxShops} shops</div>}
                        {plan.maxProjects && <div>Up to {plan.maxProjects} projects</div>}
                        {plan.storageLimit && <div>{plan.storageLimit}GB storage</div>}
                        {plan.monthlyEmailLimit && <div>{plan.monthlyEmailLimit} emails/month</div>}
                        <div className="capitalize">{plan.supportLevel} support</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Need help choosing? <a href="mailto:support@example.com" className="text-primary hover:underline">Contact our support team</a></p>
        </div>
      </div>
    </div>
  );
};

export default function Subscribe() {
  const [clientSecret, setClientSecret] = useState("");
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [currentPlan, setCurrentPlan] = useState<string>('');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated, isInitialized } = useReduxAuth();

  // Check if user already has a subscription - moved before conditional returns
  const { data: userSubscription, isLoading: subscriptionLoading } = useQuery<UserSubscriptionResponse>({
    queryKey: ['/api/subscription/my-subscription'],
    enabled: isInitialized && !!user && !authLoading && user?.role === 'Owner',
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 1 minute
  });

  // Don't redirect subscribed users anymore - show subscription management instead

  // Fetch subscription plans
  const { data: plans, isLoading: plansLoading, error: plansError, refetch: refetchPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/subscription/plans'],
    queryFn: async () => {
      // Use direct fetch for subscription plans since it doesn't require auth
      try {
        const response = await fetch('/api/subscription/plans');
        if (!response.ok) {
          throw new Error(`Failed to fetch subscription plans: ${response.statusText}`);
        }
        const data = await response.json();

        // If we get an empty array on first load, it might be initialization race condition
        // Retry once after a short delay
        if (Array.isArray(data) && data.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryResponse = await fetch('/api/subscription/plans');
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            return retryData;
          }
        }

        return data;
      } catch (error) {
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Create subscription mutation (for new users)
  const createSubscriptionMutation = useMutation({
    mutationFn: async (data: { planId: string; billingCycle: 'monthly' | 'yearly' }) => {
      const response = await apiRequest("POST", "/api/create-subscription", data);
      return response.json();
    },
    onSuccess: (data) => {
      // If this is a trial subscription with no immediate payment required
      if (!data.requiresPayment && data.status === 'trialing') {
        toast({
          title: "Free Trial Started!",
          description: "Your 14-day free trial has begun. Welcome!",
        });

        // Redirect to dashboard for trial users
        setLocation('/dashboard');
        return;
      }

      // If payment is required, set client secret for Stripe checkout
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Subscription Error",
        description: error.message || "Failed to create subscription",
        variant: "destructive",
      });
    },
  });

  // Upgrade subscription mutation (for existing users)
  const upgradeSubscriptionMutation = useMutation({
    mutationFn: async (data: { planId: string; billingCycle: 'monthly' | 'yearly' }) => {
      const response = await apiRequest("POST", "/api/upgrade-subscription", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Plan Updated!",
        description: "Your subscription has been successfully updated.",
      });

      // Refresh subscription data
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update subscription",
        variant: "destructive",
      });
    },
  });

  const handlePlanSelection = (planId: string) => {
    setCurrentPlan(planId);
    createSubscriptionMutation.mutate({ planId, billingCycle });
  };

  const handleStartFreeTrial = (planId: string) => {
    // Start free trial for current user
    setCurrentPlan(planId);
    createSubscriptionMutation.mutate({
      planId,
      billingCycle
    });
  };

  const handleUpgrade = (planId: string, billingCycle: 'monthly' | 'yearly') => {
    upgradeSubscriptionMutation.mutate({ planId, billingCycle });
  };

  // Redirect unauthenticated users immediately
  if (isInitialized && !isAuthenticated) {
    setLocation('/auth');
    return null;
  }

  // Show loading while authentication is being determined
  if (!isInitialized || authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-4">Authenticating...</span>
        </div>
      </div>
    );
  }

  // Check if user has Owner role - only Owners can access subscription management
  if (user && user.role !== "Owner") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <Shield className="mx-auto h-16 w-16 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Access Restricted</h1>
          <p className="text-muted-foreground mb-6">
            Only organization owners can access subscription management.
            Please contact your organization owner to manage subscription plans.
          </p>
          <Button
            onClick={() => setLocation('/dashboard')}
            variant="outline"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state while data is loading
  if (plansLoading || subscriptionLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-4">Loading subscription plans...</span>
        </div>
      </div>
    );
  }

  // Handle plans error state
  if (plansError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Unable to Load Plans</h1>
          <p className="text-muted-foreground mb-4">
            We're having trouble loading subscription plans. Please try again.
          </p>
          <Button onClick={() => refetchPlans()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!plansLoading && (!plans || plans.length === 0)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">No Plans Available</h1>
          <p className="text-muted-foreground mb-4">
            Subscription plans are currently not available. Please check back later.
          </p>
          <Button onClick={() => refetchPlans()} variant="outline">
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  // If we have a client secret, show the payment form  
  if (clientSecret && currentPlan) {
    const selectedPlanData = plans?.find(p => p.id === currentPlan);

    return (
      <div className="container mx-auto px-4 py-8 max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Complete Your Subscription</h1>
          <p className="text-muted-foreground">
            {selectedPlanData?.displayName} - {billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm planId={currentPlan} billingCycle={billingCycle} />
            </Elements>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If user has an existing subscription, show subscription management
  if (userSubscription?.subscription && plans) {
    return (
      <SubscriptionManagement
        subscription={userSubscription.subscription}
        plans={plans}
        onUpgrade={handleUpgrade}
        isUpgrading={upgradeSubscriptionMutation.isPending}
      />
    );
  }

  // Show plan selection for new users
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Start with a 14-day free trial. No credit card required. Cancel anytime.
        </p>
      </div>

      <div className="flex justify-center mb-8">
        <Tabs value={billingCycle} onValueChange={(value) => setBillingCycle(value as 'monthly' | 'yearly')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">
              Yearly
              <Badge variant="secondary" className="ml-2">Save 20%</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {plans?.map((plan) => (
          <Card key={plan.id} className={`relative ${plan.isPopular ? 'border-primary shadow-lg' : ''}`}>
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-3 py-1">
                  <Star className="w-3 h-3 mr-1" />
                  Most Popular
                </Badge>
              </div>
            )}

            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl">{plan.displayName}</CardTitle>
              <CardDescription className="text-sm">{plan.description}</CardDescription>

              <div className="py-4">
                <div className="text-4xl font-bold">
                  ${billingCycle === 'yearly' ? plan.yearlyPrice : plan.price}
                </div>
                <div className="text-sm text-muted-foreground">
                  per {billingCycle === 'yearly' ? 'year' : 'month'}
                </div>
                {billingCycle === 'yearly' && plan.yearlyPrice && (
                  <div className="text-xs text-green-600 mt-1">
                    Save ${((parseFloat(plan.price) * 12) - parseFloat(plan.yearlyPrice)).toFixed(2)}/year
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <Button
                className="w-full mb-6"
                variant={plan.isPopular ? "default" : "outline"}
                onClick={() => handleStartFreeTrial(plan.id)}
                disabled={createSubscriptionMutation.isPending}
              >
                {createSubscriptionMutation.isPending && currentPlan === plan.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Start Free Trial`
                )}
              </Button>

              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-sm">
                    <Check className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
                <div className="space-y-1">
                  {plan.maxUsers && <div>Up to {plan.maxUsers} users</div>}
                  {plan.maxShops && <div>Up to {plan.maxShops} shops</div>}
                  {plan.maxProjects && <div>Up to {plan.maxProjects} projects</div>}
                  {plan.storageLimit && <div>{plan.storageLimit}GB storage</div>}
                  {plan.monthlyEmailLimit && <div>{plan.monthlyEmailLimit} emails/month</div>}
                  <div className="capitalize">{plan.supportLevel} support</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center mt-12 text-sm text-muted-foreground">
        <p>All plans include a 14-day free trial • No setup fees • Cancel anytime</p>
        <p className="mt-2">
          Questions? <a href="mailto:support@example.com" className="text-primary hover:underline">Contact our sales team</a>
        </p>
      </div>
    </div>
  );
}