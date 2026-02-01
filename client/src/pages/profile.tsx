import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, useUpdateTheme, useUpdateMenuPreference, useUpdateProfile, useChangePassword, useDeleteAccount, useSetup2FA, useEnable2FA, useDisable2FA } from "@/hooks/useAuth";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { use2FA } from "@/hooks/use2FA";
import { useLanguage } from "@/hooks/useLanguage";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { updateProfileSchema, changePasswordSchema } from "@shared/schema";
import type { UpdateProfileData, ChangePasswordData, SubscriptionPlan, UserSubscriptionResponse } from "@shared/schema";
import { calculatePasswordStrength, getPasswordStrengthText, getPasswordStrengthColor } from "@/lib/authUtils";
import { AvatarUpload } from "@/components/AvatarUpload";
import {
  User,
  Lock,
  Mail,
  Shield,
  ArrowLeft,
  Save,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  Smartphone,
  Settings,
  Menu,
  Camera,
  QrCode,
  CreditCard,
  Check,
  Star,
  Languages,
  LayoutDashboard
} from "lucide-react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Badge } from "@/components/ui/badge";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface CheckoutFormProps {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
}

const CheckoutForm = ({ planId, billingCycle }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const { t } = useLanguage();
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
          title: t('profile.subscription.paymentFailed'),
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: t('profile.subscription.paymentSuccessful'),
          description: t('profile.subscription.welcomeMessage'),
        });
      }
    } catch (error) {
      toast({
        title: t('profile.subscription.paymentError'),
        description: t('profile.subscription.paymentErrorDescription'),
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
            {t('profile.subscription.processing')}
          </>
        ) : (
          t(billingCycle === 'yearly' ? 'profile.subscription.subscribeYearly' : 'profile.subscription.subscribeMonthly')
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
  const { t } = useLanguage();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(
    subscription?.isYearly ? 'yearly' : 'monthly'
  );

  if (!subscription) return null;

  const currentPlan = subscription.plan;
  const isTrialing = subscription.status === 'trialing';
  const trialEndsAt = subscription.trialEnd ? new Date(subscription.trialEnd) : null;
  const currentPeriodEnd = new Date(subscription.currentPeriodEnd);
  const daysLeft = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  if (!currentPlan) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold mb-4">{t('profile.subscription.loading')}</h2>
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
    <div className="space-y-8">
      {/* Current Subscription Status */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">{currentPlan.displayName}</h3>
            <p className="text-blue-700 dark:text-blue-300">{currentPlan.description}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              ${subscription.isYearly ? currentPlan.yearlyPrice : currentPlan.price}
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              {t(subscription.isYearly ? 'profile.subscription.perYear' : 'profile.subscription.perMonth')}
            </div>
          </div>
        </div>

        {isTrialing && daysLeft && (
          <div className="bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700 rounded-md p-3 mb-4">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              <strong>{t('profile.subscription.trialActive')}:</strong> {daysLeft} {t('profile.subscription.daysRemaining')} {formatDate(trialEndsAt!)}
            </p>
          </div>
        )}

        <div className="text-sm text-blue-600 dark:text-blue-400">
          {isTrialing ? t('profile.subscription.trialEnds') : t('profile.subscription.nextBilling')}: {formatDate(isTrialing && trialEndsAt ? trialEndsAt : currentPeriodEnd)}
        </div>
      </div>

      {/* Upgrade Options */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">{t('profile.subscription.availablePlans')}</h3>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('profile.subscription.billingCycle')}:</span>
            <Tabs value={billingCycle} onValueChange={(value) => setBillingCycle(value as 'monthly' | 'yearly')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="monthly">{t('profile.subscription.monthly')}</TabsTrigger>
                <TabsTrigger value="yearly">
                  {t('profile.subscription.yearly')}
                  <Badge variant="secondary" className="ml-2">{t('profile.subscription.save20')}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans?.map((plan) => {
            const isCurrent = plan.id === currentPlan.id;
            const isUpgrade = parseFloat(plan.price) > parseFloat(currentPlan.price);
            const isDowngrade = parseFloat(plan.price) < parseFloat(currentPlan.price);

            return (
              <Card key={plan.id} className={`relative ${plan.isPopular ? 'border-primary shadow-lg' : ''} ${isCurrent ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600' : ''}`}>
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3 py-1">
                      <Star className="w-3 h-3 mr-1" />
                      {t('profile.subscription.mostPopular')}
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
                      {t(billingCycle === 'yearly' ? 'profile.subscription.perYear' : 'profile.subscription.perMonth')}
                    </div>
                    {billingCycle === 'yearly' && plan.yearlyPrice && (
                      <div className="text-xs text-green-600 mt-1">
                        {t('profile.subscription.savePerYear', { amount: ((parseFloat(plan.price) * 12) - parseFloat(plan.yearlyPrice)).toFixed(2) })}
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Button
                    variant={isCurrent ? "outline" : "default"}
                    className="w-full"
                    disabled={isCurrent || isUpgrading}
                    onClick={() => onUpgrade(plan.id, billingCycle)}
                  >
                    {isUpgrading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('profile.subscription.processing')}
                      </>
                    ) : isCurrent ? (
                      t('profile.subscription.currentPlanButton')
                    ) : isUpgrade ? (
                      t('profile.subscription.upgrade')
                    ) : (
                      t('profile.subscription.downgrade')
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
                      {plan.maxUsers && <div>{t('profile.subscription.maxUsers', { count: plan.maxUsers })}</div>}
                      {plan.maxShops && <div>{t('profile.subscription.maxShops', { count: plan.maxShops })}</div>}
                      {plan.maxProjects && <div>{t('profile.subscription.maxProjects', { count: plan.maxProjects })}</div>}
                      {plan.storageLimit && <div>{t('profile.subscription.storageLimit', { size: plan.storageLimit })}</div>}
                      <div className="capitalize">{t('profile.subscription.supportLevel', { level: plan.supportLevel })}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>{t('profile.subscription.needHelp')} <a href="mailto:support@example.com" className="text-primary hover:underline">{t('profile.subscription.contactSupport')}</a></p>
      </div>
    </div>
  );
};

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated, isInitialized, refetch } = useReduxAuth();
  const { toast } = useToast();

  // Debug logging
  console.log("🔍 [ProfilePage] User data:", {
    user,
    isLoading: authLoading,
    isAuthenticated,
    isInitialized,
    hasUser: !!user,
    userEmail: user?.email,
    userName: user?.name,
    userFirstName: user?.firstName,
    userLastName: user?.lastName
  });

  // All hooks must be called before any conditional returns
  const updateProfileMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();
  const deleteAccountMutation = useDeleteAccount();
  const setup2FAMutation = useSetup2FA();
  const enable2FAMutation = useEnable2FA();
  const disable2FAMutation = useDisable2FA();
  const updateMenuPreferenceMutation = useUpdateMenuPreference();

  // Language management
  const { currentLanguage, supportedLanguages, changeLanguage, isChanging, t } = useLanguage();

  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: t('profile.title'), icon: User }
  ]);

  // Get current 2FA status from the database
  const { twoFactorEnabled, loading: twoFALoading, check2FARequirement } = use2FA();

  // Debug: Log 2FA status changes
  useEffect(() => {
    console.log('🔍 [Profile] 2FA status changed:', {
      twoFactorEnabled,
      twoFALoading,
      userEmail: user?.email
    });
  }, [twoFactorEnabled, twoFALoading, user?.email]);

  // Local timezone state for immediate UI update
  const [selectedTimezone, setSelectedTimezone] = useState<string>(user?.timezone || 'America/Chicago');

  // Update local timezone when user data changes
  useEffect(() => {
    if (user?.timezone) {
      setSelectedTimezone(user.timezone);
    }
  }, [user?.timezone]);

  // Subscription-related state and queries
  const [clientSecret, setClientSecret] = useState("");
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [currentPlan, setCurrentPlan] = useState<string>('');

  // Check if user already has a subscription
  const { data: userSubscription, isLoading: subscriptionLoading } = useQuery<UserSubscriptionResponse>({
    queryKey: ['/api/subscription/my-subscription'],
    enabled: isInitialized && !!user && !authLoading && user?.role === 'Owner',
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 1 minute
  });

  // Fetch subscription plans
  const { data: plans, isLoading: plansLoading, error: plansError, refetch: refetchPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/subscription/plans'],
    queryFn: async () => {
      // Use direct fetch for subscription plans since it doesn't require auth
      try {
        const response = await fetch('/api/subscription/plans');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching subscription plans:', error);
        throw error;
      }
    },
    enabled: user?.role === 'Owner',
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Only retry on network errors, not on 4xx errors
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500) return false;
      }
      return failureCount < 3;
    }
  });

  // Create subscription mutation
  const createSubscriptionMutation = useMutation({
    mutationFn: async ({ planId, billingCycle }: { planId: string; billingCycle: 'monthly' | 'yearly' }) => {
      return await apiRequest('POST', '/api/create-subscription', { planId, billingCycle });
    },
    onSuccess: (data: any) => {
      setClientSecret(data.clientSecret);
      setCurrentPlan(data.planId);
    },
    onError: (error: any) => {
      toast({
        title: t('profile.subscription.subscriptionError'),
        description: error.message || t('profile.subscription.subscriptionErrorDescription'),
        variant: "destructive",
      });
    }
  }, queryClient);

  // Upgrade subscription mutation
  const upgradeSubscriptionMutation = useMutation({
    mutationFn: async ({ planId, billingCycle }: { planId: string; billingCycle: 'monthly' | 'yearly' }) => {
      return await apiRequest('POST', '/api/upgrade-subscription', { planId, billingCycle });
    },
    onSuccess: () => {
      toast({
        title: t('profile.subscription.subscriptionUpdated'),
        description: t('profile.subscription.subscriptionUpdatedDescription'),
      });
      // Refetch subscription data
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/my-subscription'] });
    },
    onError: (error: any) => {
      toast({
        title: t('profile.subscription.updateError'),
        description: error.message || t('profile.subscription.updateErrorDescription'),
        variant: "destructive",
      });
    }
  }, queryClient);

  // Subscription handler functions
  const handleSelectPlan = (planId: string, billingCycle: 'monthly' | 'yearly') => {
    createSubscriptionMutation.mutate({ planId, billingCycle });
  };

  const handleUpgrade = (planId: string, billingCycle: 'monthly' | 'yearly') => {
    upgradeSubscriptionMutation.mutate({ planId, billingCycle });
  };

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  } | null>(null);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [disableTwoFactorToken, setDisableTwoFactorToken] = useState("");

  // Security tips dialog
  const [isSecurityTipsOpen, setIsSecurityTipsOpen] = useState(false);

  const profileForm = useForm<UpdateProfileData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: user?.firstName || (user?.name ? user.name.split(' ')[0] : "") || "",
      lastName: user?.lastName || (user?.name ? user.name.split(' ').slice(1).join(' ') : "") || "",
      email: user?.email || "",
    },
  });

  const passwordForm = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const watchNewPassword = passwordForm.watch("newPassword");

  // Update password strength when new password changes
  useEffect(() => {
    if (watchNewPassword) {
      setPasswordStrength(calculatePasswordStrength(watchNewPassword));
    }
  }, [watchNewPassword]);

  // Update form when user data changes
  useEffect(() => {
    if (user) {
      const firstName = user.firstName || (user.name ? user.name.split(' ')[0] : "");
      const lastName = user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : "");

      profileForm.reset({
        firstName,
        lastName,
        email: user.email || "",
      });
    }
  }, [user, profileForm]);

  // Redirect unauthenticated users immediately
  if (isInitialized && !isAuthenticated) {
    setLocation('/auth');
    return null;
  }

  // Show loading while authentication is being determined
  if (!isInitialized || authLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-4">{t('profile.loading')}</span>
        </div>
      </div>
    );
  }

  const onUpdateProfile = async (data: UpdateProfileData) => {
    await updateProfileMutation.mutateAsync(data);
  };

  const onChangePassword = async (data: ChangePasswordData) => {
    await changePasswordMutation.mutateAsync(data);
    passwordForm.reset();
  };

  const onDeleteAccount = async () => {
    await deleteAccountMutation.mutateAsync();
    setShowDeleteDialog(false);
  };

  const onSetup2FA = async () => {
    try {
      const result = await setup2FAMutation.mutateAsync();
      setTwoFactorSetup({
        secret: result.secret,
        qrCode: result.qrCode,
        backupCodes: result.backupCodes || []
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const onEnable2FA = async () => {
    if (!twoFactorToken.trim() || !twoFactorSetup?.secret) return;

    try {
      await enable2FAMutation.mutateAsync(twoFactorToken, twoFactorSetup.secret);
      setTwoFactorSetup(null);
      setTwoFactorToken("");
      // Refresh 2FA status to update the UI immediately
      await check2FARequirement();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const onDisable2FA = async () => {
    if (!disableTwoFactorToken.trim()) return;

    try {
      await disable2FAMutation.mutateAsync(disableTwoFactorToken);
      setDisableTwoFactorToken("");
      // Refresh 2FA status to update the UI immediately
      await check2FARequirement();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const renderPasswordStrength = () => {
    const strengthBars = Array.from({ length: 4 }, (_, index) => (
      <div
        key={index}
        className={`h-1 w-1/4 rounded ${index < passwordStrength
          ? passwordStrength <= 1
            ? "bg-red-400"
            : passwordStrength <= 2
              ? "bg-orange-400"
              : passwordStrength <= 3
                ? "bg-yellow-400"
                : "bg-green-400"
          : "bg-gray-200"
          }`}
      />
    ));

    return (
      <div className="mt-2">
        <div className="flex space-x-1">{strengthBars}</div>
        <p className={`text-xs mt-1 ${getPasswordStrengthColor(passwordStrength)}`}>
          {t('profile.security.passwordStrength')}: {getPasswordStrengthText(passwordStrength)}
        </p>
      </div>
    );
  };



  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Page Header */}
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
              {t('profile.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {t('profile.subtitle')}
            </p>
          </div>
        </div>

        {/* Security Tips Modal */}
        <Dialog open={isSecurityTipsOpen} onOpenChange={setIsSecurityTipsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                {t('profile.securityTips.title')}
              </DialogTitle>
              <DialogDescription>
                {t('profile.securityTips.description')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-medium">{t('profile.securityTips.strongPasswords')}</p>
                  <p className="text-sm text-muted-foreground">{t('profile.securityTips.strongPasswordsDescription')}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-medium">{t('profile.securityTips.enable2FA')}</p>
                  <p className="text-sm text-muted-foreground">{t('profile.securityTips.enable2FADescription')}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Eye className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium">{t('profile.securityTips.bewarePhishing')}</p>
                  <p className="text-sm text-muted-foreground">{t('profile.securityTips.bewarePhishingDescription')}</p>
                </div>
              </div>


              <div className="flex items-start gap-3">
                <QrCode className="w-5 h-5 text-teal-600 mt-0.5" />
                <div>
                  <p className="font-medium">{t('profile.securityTips.useAuthenticator')}</p>
                  <p className="text-sm text-muted-foreground">{t('profile.securityTips.useAuthenticatorDescription')}</p>
                </div>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsSecurityTipsOpen(false)}>{t('profile.securityTips.close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="profile" className="space-y-8">
          <TabsList className="grid w-full grid-cols-6 h-auto">
            <TabsTrigger value="profile">{t('profile.tabs.profile')}</TabsTrigger>
            <TabsTrigger value="preferences">{t('profile.tabs.preferences')}</TabsTrigger>
            <TabsTrigger value="security">{t('profile.tabs.security')}</TabsTrigger>
            <TabsTrigger value="2fa">
              <span className="hidden sm:inline">{t('profile.tabs.twoFactor')}</span>
              <span className="sm:hidden">2FA</span>
            </TabsTrigger>
            {user?.role === 'Owner' && (
              <TabsTrigger value="subscription">{t('profile.tabs.subscription')}</TabsTrigger>
            )}
            <TabsTrigger value="danger" className="text-red-600">{t('profile.tabs.danger')}</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                  {t('profile.profileTab.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Avatar Section */}
                  <div className="flex flex-col items-center space-y-4 pb-8 border-b border-blue-200/50 dark:border-blue-700/30">
                    <div className="relative">
                      <AvatarUpload
                        currentAvatarUrl={user?.avatarUrl}
                        userEmail={user?.email}
                        size="lg"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('profile.profileTab.avatarHint')}</p>
                    </div>
                  </div>

                  {/* Profile Form */}
                  <form onSubmit={profileForm.handleSubmit(onUpdateProfile)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                          <User className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" />
                          {t('profile.profileTab.firstName')}
                        </Label>
                        <Input
                          id="firstName"
                          placeholder="John"
                          className="bg-white/50 dark:bg-gray-700/50 border-blue-200 dark:border-blue-700/50 focus:border-blue-500 dark:focus:border-blue-400 h-11"
                          {...profileForm.register("firstName")}
                        />
                        {profileForm.formState.errors.firstName && (
                          <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                            {profileForm.formState.errors.firstName.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                          <User className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" />
                          {t('profile.profileTab.lastName')}
                        </Label>
                        <Input
                          id="lastName"
                          placeholder="Doe"
                          className="bg-white/50 dark:bg-gray-700/50 border-blue-200 dark:border-blue-700/50 focus:border-blue-500 dark:focus:border-blue-400 h-11"
                          {...profileForm.register("lastName")}
                        />
                        {profileForm.formState.errors.lastName && (
                          <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                            {profileForm.formState.errors.lastName.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                        <Mail className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" />
                        {t('profile.profileTab.email')}
                      </Label>
                      <div className="relative">
                        <Input
                          id="email"
                          type="email"
                          placeholder="john@company.com"
                          className="pl-11 bg-white/50 dark:bg-gray-700/50 border-blue-200 dark:border-blue-700/50 focus:border-blue-500 dark:focus:border-blue-400 h-11"
                          {...profileForm.register("email")}
                        />
                        <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-400 dark:text-blue-300 w-4 h-4" />
                      </div>
                      {profileForm.formState.errors.email && (
                        <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                          {profileForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end pt-6">
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending}
                        className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-500 dark:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 text-white shadow-lg px-6 h-11"
                      >
                        {updateProfileMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{t('profile.profileTab.updating')}</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>{t('profile.profileTab.saveChanges')}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                  {t('profile.preferences.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Menu Display Preference */}
                  <div className="bg-green-50/50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-700/30 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                          <Menu className="w-5 h-5 text-green-600 dark:text-green-400" />
                          <Label className="text-base font-medium text-gray-800 dark:text-gray-200">{t('profile.preferences.expandedMenu.title')}</Label>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
                          {t('profile.preferences.expandedMenu.description')}
                        </p>
                      </div>
                      <Switch
                        checked={user?.menuExpanded || false}
                        onCheckedChange={(checked) => {
                          // Update localStorage immediately for instant UI feedback
                          localStorage.setItem('menuExpanded', JSON.stringify(checked));

                          // Dispatch custom event for immediate UI update in same tab
                          window.dispatchEvent(new CustomEvent('menuPreferenceChanged', {
                            detail: { menuExpanded: checked }
                          }));

                          // Update backend preference
                          updateMenuPreferenceMutation.mutateAsync({ menuExpanded: checked });
                        }}
                        disabled={false}
                        className="data-[state=checked]:bg-green-600"
                      />
                    </div>
                  </div>

                  {/* Language Preference */}
                  <div className="bg-green-50/50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-700/30 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                          <Languages className="w-5 h-5 text-green-600 dark:text-green-400" />
                          <Label className="text-base font-medium text-gray-800 dark:text-gray-200">{t('profile.preferences.language.title')}</Label>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
                          {t('profile.preferences.language.description')}
                        </p>
                      </div>
                      <div className="min-w-[140px]">
                        <Select
                          value={currentLanguage}
                          onValueChange={changeLanguage}
                          disabled={isChanging}
                        >
                          <SelectTrigger className="bg-white/70 dark:bg-gray-700/50 border-green-200 dark:border-green-700/50 focus:border-green-500 dark:focus:border-green-400">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(supportedLanguages).map(([code, name]) => (
                              <SelectItem key={code} value={code}>
                                <div className="flex items-center space-x-2">
                                  <span className="text-lg">
                                    {code === 'en' ? '🇺🇸' : '🇪🇸'}
                                  </span>
                                  <span>{name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Timezone Setting */}
                  <div className="bg-green-50/50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-700/30 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                          </svg>
                          <Label className="text-base font-medium text-gray-800 dark:text-gray-200">{t('profile.preferences.timezone.title')}</Label>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
                          {t('profile.preferences.timezone.description')}
                        </p>
                      </div>
                      <div className="min-w-[200px]">
                        <Select
                          value={selectedTimezone}
                          onValueChange={async (value) => {
                            const previousTimezone = selectedTimezone;
                            setSelectedTimezone(value);
                            try {
                              await updateProfileMutation.mutateAsync({ timezone: value } as any);
                              refetch?.();
                            } catch {
                              setSelectedTimezone(previousTimezone);
                            }
                          }}
                          disabled={updateProfileMutation.isPending}
                        >
                          <SelectTrigger className="bg-white/70 dark:bg-gray-700/50 border-green-200 dark:border-green-700/50 focus:border-green-500 dark:focus:border-green-400">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="America/New_York">🇺🇸 Eastern Time (ET)</SelectItem>
                            <SelectItem value="America/Chicago">🇺🇸 Central Time (CT)</SelectItem>
                            <SelectItem value="America/Denver">🇺🇸 Mountain Time (MT)</SelectItem>
                            <SelectItem value="America/Los_Angeles">🇺🇸 Pacific Time (PT)</SelectItem>
                            <SelectItem value="America/Anchorage">🇺🇸 Alaska Time (AKT)</SelectItem>
                            <SelectItem value="Pacific/Honolulu">🇺🇸 Hawaii Time (HT)</SelectItem>
                            <SelectItem value="America/Phoenix">🇺🇸 Arizona (MST)</SelectItem>
                            <SelectItem value="America/Toronto">🇨🇦 Toronto (ET)</SelectItem>
                            <SelectItem value="America/Vancouver">🇨🇦 Vancouver (PT)</SelectItem>
                            <SelectItem value="America/Mexico_City">🇲🇽 Mexico City (CST)</SelectItem>
                            <SelectItem value="Europe/London">🇬🇧 London (GMT/BST)</SelectItem>
                            <SelectItem value="Europe/Paris">🇫🇷 Paris (CET)</SelectItem>
                            <SelectItem value="Europe/Berlin">🇩🇪 Berlin (CET)</SelectItem>
                            <SelectItem value="Europe/Madrid">🇪🇸 Madrid (CET)</SelectItem>
                            <SelectItem value="Asia/Tokyo">🇯🇵 Tokyo (JST)</SelectItem>
                            <SelectItem value="Asia/Shanghai">🇨🇳 Shanghai (CST)</SelectItem>
                            <SelectItem value="Asia/Singapore">🇸🇬 Singapore (SGT)</SelectItem>
                            <SelectItem value="Asia/Dubai">🇦🇪 Dubai (GST)</SelectItem>
                            <SelectItem value="Australia/Sydney">🇦🇺 Sydney (AEST)</SelectItem>
                            <SelectItem value="Australia/Perth">🇦🇺 Perth (AWST)</SelectItem>
                            <SelectItem value="Pacific/Auckland">🇳🇿 Auckland (NZST)</SelectItem>
                            <SelectItem value="UTC">🌐 UTC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            {/* Security Tips Widget */}
            <Card className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 mb-6 shadow-sm">
              {/* Mobile Header with Illustration */}
              <div className="flex justify-center p-4 pb-0 sm:hidden">
                <div className="w-32 h-24 bg-gray-50 dark:bg-gray-700/50 rounded-2xl flex items-center justify-center relative overflow-hidden">
                  <div className="relative z-10 flex items-center justify-center">
                    <div className="w-16 h-12 bg-white dark:bg-gray-600 rounded-lg flex items-center justify-center relative">
                      <Lock className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-2 right-3 w-2.5 h-2.5 bg-gray-300 dark:bg-gray-500 rounded-full"></div>
                  <div className="absolute bottom-3 left-3 w-1.5 h-1.5 bg-gray-300 dark:bg-gray-500 rounded-full"></div>
                  <div className="absolute top-1/2 left-1.5 w-3 h-3 bg-blue-200 dark:bg-blue-800 rounded-full opacity-60"></div>
                </div>
              </div>

              <CardContent className="p-4 sm:p-8">
                <div className="sm:flex sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                      {t('profile.security.tipsTitle')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                      {t('profile.security.tipsDescription')}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.security.tip1')}</span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 bg-green-500 rounded-full opacity-60"></div>
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.security.tip2')}</span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.security.tip3')}</span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.security.tip4')}</span>
                      </div>
                    </div>

                    <Button
                      variant="link"
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-0 h-auto font-semibold underline"
                      onClick={() => setIsSecurityTipsOpen(true)}
                    >
                      {t('profile.security.reviewTips')}
                    </Button>
                  </div>

                  {/* Desktop Illustration (hidden on mobile) */}
                  <div className="hidden sm:flex sm:flex-shrink-0 sm:ml-8">
                    <div className="w-40 h-32 bg-gray-50 dark:bg-gray-700/50 rounded-2xl flex items-center justify-center relative overflow-hidden">
                      <div className="relative z-10 flex items-center justify-center">
                        <div className="w-20 h-16 bg-white dark:bg-gray-600 rounded-lg flex items-center justify-center relative">
                          <Lock className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-3 right-4 w-3 h-3 bg-gray-300 dark:bg-gray-500 rounded-full"></div>
                      <div className="absolute bottom-4 left-4 w-2 h-2 bg-gray-300 dark:bg-gray-500 rounded-full"></div>
                      <div className="absolute top-1/2 left-2 w-4 h-4 bg-blue-200 dark:bg-blue-800 rounded-full opacity-60"></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                  {t('profile.security.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                      <Lock className="w-4 h-4 mr-2 text-purple-500 dark:text-purple-400" />
                      {t('profile.security.currentPassword')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder="Enter current password"
                        className="pl-11 pr-11 bg-white/50 dark:bg-gray-700/50 border-purple-200 dark:border-purple-700/50 focus:border-purple-500 dark:focus:border-purple-400 h-11"
                        {...passwordForm.register("currentPassword")}
                      />
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400 dark:text-purple-300 w-4 h-4" />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-purple-400 dark:text-purple-300 hover:text-purple-600 dark:hover:text-purple-200 transition-colors"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                        {passwordForm.formState.errors.currentPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                      <Lock className="w-4 h-4 mr-2 text-purple-500 dark:text-purple-400" />
                      {t('profile.security.newPassword')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        className="pl-11 pr-11 bg-white/50 dark:bg-gray-700/50 border-purple-200 dark:border-purple-700/50 focus:border-purple-500 dark:focus:border-purple-400 h-11"
                        {...passwordForm.register("newPassword")}
                      />
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400 dark:text-purple-300 w-4 h-4" />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-purple-400 dark:text-purple-300 hover:text-purple-600 dark:hover:text-purple-200 transition-colors"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}
                    {renderPasswordStrength()}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                      <Lock className="w-4 h-4 mr-2 text-purple-500 dark:text-purple-400" />
                      {t('profile.security.confirmPassword')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        className="pl-11 pr-11 bg-white/50 dark:bg-gray-700/50 border-purple-200 dark:border-purple-700/50 focus:border-purple-500 dark:focus:border-purple-400 h-11"
                        {...passwordForm.register("confirmPassword")}
                      />
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400 dark:text-purple-300 w-4 h-4" />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-purple-400 dark:text-purple-300 hover:text-purple-600 dark:hover:text-purple-200 transition-colors"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end pt-6">
                    <Button
                      type="submit"
                      disabled={changePasswordMutation.isPending}
                      className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 dark:from-purple-500 dark:to-purple-600 dark:hover:from-purple-600 dark:hover:to-purple-700 text-white shadow-lg px-6 h-11"
                    >
                      {changePasswordMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{t('profile.security.changing')}</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>{t('profile.security.changePassword')}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Two-Factor Authentication Tab */}
          <TabsContent value="2fa">
            <Card className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-xl font-semibold text-gray-900 dark:text-gray-50">
                  <span>{t('profile.twoFactor.title')}</span>
                  {twoFactorEnabled && (
                    <div className="ml-auto flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">{t('profile.twoFactor.enabled')}</span>
                    </div>
                  )}
                </CardTitle>
                <CardDescription>
                  {twoFactorEnabled
                    ? t('profile.twoFactor.enabledDescription')
                    : t('profile.twoFactor.disabledDescription')
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {twoFactorEnabled ? (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/50 dark:border-green-700/30 rounded-xl p-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                          <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">{t('profile.twoFactor.isEnabled')}</h3>
                          <p className="text-sm text-green-700 dark:text-green-400">{t('profile.twoFactor.isEnabledDescription')}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-orange-50/50 dark:bg-orange-900/20 border border-orange-200/50 dark:border-orange-700/30 rounded-lg p-6 space-y-4">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                        <Lock className="w-4 h-4 mr-2 text-orange-500 dark:text-orange-400" />
                        {t('profile.twoFactor.disable')}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('profile.twoFactor.disableDescription')}
                      </p>
                      <div className="flex items-center space-x-3">
                        <Input
                          type="text"
                          placeholder="000000"
                          maxLength={6}
                          value={disableTwoFactorToken}
                          onChange={(e) => setDisableTwoFactorToken(e.target.value)}
                          className="w-32 text-center font-mono bg-white/70 dark:bg-gray-700/50 border-orange-200 dark:border-orange-700/50 focus:border-orange-500 dark:focus:border-orange-400 h-11"
                        />
                        <Button
                          onClick={onDisable2FA}
                          disabled={disable2FAMutation.isPending || !disableTwoFactorToken.trim()}
                          variant="destructive"
                          className="flex items-center space-x-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg px-4 h-11"
                        >
                          {disable2FAMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{t('profile.twoFactor.disabling')}</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4" />
                              <span>{t('profile.twoFactor.disableButton')}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200/50 dark:border-yellow-700/30 rounded-xl p-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                          <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">{t('profile.twoFactor.isDisabled')}</h3>
                          <p className="text-sm text-yellow-700 dark:text-yellow-400">{t('profile.twoFactor.disabledDescription')}</p>
                        </div>
                      </div>
                    </div>

                    {!twoFactorSetup ? (
                      <div className="bg-orange-50/50 dark:bg-orange-900/20 border border-orange-200/50 dark:border-orange-700/30 rounded-lg p-6 space-y-4">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                          <Shield className="w-4 h-4 mr-2 text-orange-500 dark:text-orange-400" />
                          {t('profile.twoFactor.setup')}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {t('profile.twoFactor.setupDescription')}
                        </p>
                        <Button
                          onClick={onSetup2FA}
                          disabled={setup2FAMutation.isPending}
                          className="flex items-center space-x-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 dark:from-orange-500 dark:to-orange-600 dark:hover:from-orange-600 dark:hover:to-orange-700 text-white shadow-lg px-6 h-11"
                        >
                          {setup2FAMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{t('profile.twoFactor.enabling')}</span>
                            </>
                          ) : (
                            <>
                              <Shield className="w-4 h-4" />
                              <span>{t('profile.twoFactor.setupButton')}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="bg-orange-50/50 dark:bg-orange-900/20 border border-orange-200/50 dark:border-orange-700/30 rounded-lg p-6">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                            <QrCode className="w-4 h-4 mr-2 text-orange-500 dark:text-orange-400" />
                            {t('profile.twoFactor.scanQR')}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            {t('profile.twoFactor.setupDescription')}
                          </p>

                          {/* QR Code Display */}
                          <div className="flex justify-center mb-4">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
                              <img
                                src={twoFactorSetup.qrCode}
                                alt="2FA QR Code"
                                className="w-48 h-48 rounded-lg"
                              />
                            </div>
                          </div>

                          {/* Manual Entry Option */}
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {t('profile.twoFactor.manualEntry')}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                              {t('profile.twoFactor.manualEntry')}:
                            </p>
                            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-3 py-2 font-mono text-sm break-all">
                              {twoFactorSetup.secret}
                            </div>
                          </div>
                        </div>

                        <div className="bg-orange-50/50 dark:bg-orange-900/20 border border-orange-200/50 dark:border-orange-700/30 rounded-lg p-6">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                            <Lock className="w-4 h-4 mr-2 text-orange-500 dark:text-orange-400" />
                            {t('profile.twoFactor.verificationCode')}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            {t('profile.twoFactor.setupDescription')}
                          </p>
                          <div className="flex items-center space-x-3">
                            <Input
                              type="text"
                              placeholder="000000"
                              maxLength={6}
                              value={twoFactorToken}
                              onChange={(e) => setTwoFactorToken(e.target.value)}
                              className="w-32 text-center font-mono bg-white/70 dark:bg-gray-700/50 border-orange-200 dark:border-orange-700/50 focus:border-orange-500 dark:focus:border-orange-400 h-11"
                            />
                            <Button
                              onClick={onEnable2FA}
                              disabled={enable2FAMutation.isPending || !twoFactorToken.trim()}
                              className="flex items-center space-x-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 dark:from-orange-500 dark:to-orange-600 dark:hover:from-orange-600 dark:hover:to-orange-700 text-white shadow-lg px-6 h-11"
                            >
                              {enable2FAMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>{t('profile.twoFactor.enabling')}</span>
                                </>
                              ) : (
                                <>
                                  <Shield className="w-4 h-4" />
                                  <span>{t('profile.twoFactor.enableButton')}</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setTwoFactorSetup(null);
                              setTwoFactorToken("");
                            }}
                            className="bg-white/50 dark:bg-gray-700/50 border-orange-200 dark:border-orange-700/50 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-6 h-11"
                          >
                            {t('profile.danger.cancel')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Tab - Only for Owner */}
          {user?.role === 'Owner' && (
            <TabsContent value="subscription">
              <Card className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                    {t('profile.subscription.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Show loading state */}
                  {subscriptionLoading || plansLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="ml-4">{t('profile.subscription.loading')}</span>
                    </div>
                  ) : plansError ? (
                    <div className="text-center py-8">
                      <p className="text-red-600 dark:text-red-400 mb-4">
                        {t('profile.subscription.loadError')}
                      </p>
                      <Button onClick={() => refetchPlans()} variant="outline">
                        {t('profile.subscription.retry')}
                      </Button>
                    </div>
                  ) : clientSecret && currentPlan ? (
                    /* Show checkout form if payment is in progress */
                    <div>
                      <h3 className="text-lg font-semibold mb-4">{t('profile.subscription.completeSubscription')}</h3>
                      <Elements stripe={stripePromise} options={{ clientSecret }}>
                        <CheckoutForm
                          planId={currentPlan}
                          billingCycle={billingCycle}
                        />
                      </Elements>
                    </div>
                  ) : userSubscription?.subscription ? (
                    /* Show subscription management for existing subscribers */
                    <SubscriptionManagement
                      subscription={userSubscription.subscription}
                      plans={plans || []}
                      onUpgrade={handleUpgrade}
                      isUpgrading={upgradeSubscriptionMutation.isPending}
                    />
                  ) : (
                    /* Show plan selection for new users */
                    <div className="space-y-8">
                      <div className="text-center">
                        <h3 className="text-2xl font-bold mb-4">{t('profile.subscription.chooseYourPlan')}</h3>
                        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                          {t('profile.subscription.trialDescription')}
                        </p>
                      </div>

                      <div className="flex justify-center">
                        <Tabs value={billingCycle} onValueChange={(value) => setBillingCycle(value as 'monthly' | 'yearly')}>
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="monthly">{t('profile.subscription.monthly')}</TabsTrigger>
                            <TabsTrigger value="yearly">
                              {t('profile.subscription.yearly')}
                              <Badge variant="secondary" className="ml-2">{t('profile.subscription.save20')}</Badge>
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {plans?.map((plan) => (
                          <Card key={plan.id} className={`relative ${plan.isPopular ? 'border-primary shadow-lg' : ''}`}>
                            {plan.isPopular && (
                              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                <Badge className="bg-primary text-primary-foreground px-3 py-1">
                                  <Star className="w-3 h-3 mr-1" />
                                  {t('profile.subscription.mostPopular')}
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
                                  {t(billingCycle === 'yearly' ? 'profile.subscription.perYear' : 'profile.subscription.perMonth')}
                                </div>
                                {billingCycle === 'yearly' && plan.yearlyPrice && (
                                  <div className="text-xs text-green-600 mt-1">
                                    {t('profile.subscription.saveAmount', { amount: ((parseFloat(plan.price) * 12) - parseFloat(plan.yearlyPrice)).toFixed(2) })}
                                  </div>
                                )}
                              </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                              <Button
                                className="w-full"
                                disabled={createSubscriptionMutation.isPending}
                                onClick={() => handleSelectPlan(plan.id, billingCycle)}
                              >
                                {createSubscriptionMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('profile.subscription.settingUp')}
                                  </>
                                ) : (
                                  t(billingCycle === 'yearly' ? 'profile.subscription.startYearlyPlan' : 'profile.subscription.startMonthlyPlan')
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
                                  {plan.maxUsers && <div>{t('profile.subscription.maxUsers', { count: plan.maxUsers })}</div>}
                                  {plan.maxShops && <div>{t('profile.subscription.maxShops', { count: plan.maxShops })}</div>}
                                  {plan.maxProjects && <div>{t('profile.subscription.maxProjects', { count: plan.maxProjects })}</div>}
                                  {plan.storageLimit && <div>{t('profile.subscription.storageLimit', { size: plan.storageLimit })}</div>}
                                  <div className="capitalize">{t('profile.subscription.supportLevel', { level: plan.supportLevel })}</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <div className="text-center text-sm text-muted-foreground">
                        <p>{t('profile.subscription.needHelpChoosing')} <a href="mailto:support@example.com" className="text-primary hover:underline">{t('profile.subscription.contactSupportTeam')}</a></p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Danger Zone Tab */}
          <TabsContent value="danger">
            <Card className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                  {t('profile.danger.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200/50 dark:border-red-700/30 rounded-xl p-8">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-500 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                      <Trash2 className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="text-xl font-semibold text-red-800 dark:text-red-300 mb-2">{t('profile.danger.deleteAccount')}</h3>
                        <p className="text-red-700 dark:text-red-400 leading-relaxed">
                          {t('profile.danger.deleteDescription')}
                        </p>
                      </div>
                      <div className="pt-2">
                        <Button
                          variant="destructive"
                          onClick={() => setShowDeleteDialog(true)}
                          disabled={deleteAccountMutation.isPending}
                          className="flex items-center space-x-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 dark:from-red-500 dark:to-red-600 dark:hover:from-red-600 dark:hover:to-red-700 text-white shadow-lg px-6 h-11"
                        >
                          {deleteAccountMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{t('profile.danger.deleting')}</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              <span>{t('profile.danger.deleteButton')}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Account Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <span>{t('profile.danger.deleteAccount')}</span>
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('profile.danger.confirmDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('profile.danger.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDeleteAccount}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {t('profile.danger.confirmDelete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}