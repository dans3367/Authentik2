import { Switch, Route, useLocation } from "wouter";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { store, persistor } from "@/store";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { AppLayout } from "@/components/AppLayout";
import { setGlobalNavigate } from "@/lib/authErrorHandler";
import { lazy, Suspense, useEffect, useState, Component, ReactNode } from "react";
import { useAuthErrorHandler, setGlobalAuthErrorHandler } from "@/hooks/useAuthErrorHandler";
import { ThemeProvider } from "@/contexts/ThemeContext";

// Initialize Convex client for real-time newsletter tracking
const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

// Lazy load components for code splitting
const AuthPage = lazy(() => import("@/pages/auth"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const NewsletterPage = lazy(() => import("@/pages/newsletter"));
const NewsletterCreatePage = lazy(() => import("@/pages/newsletter/create"));
const NewsletterViewPage = lazy(() => import("@/pages/newsletter/view"));
const AdvertisePage = lazy(() => import("@/pages/advertise"));
const AdvertiseCreatePage = lazy(() => import("@/pages/advertise/create"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const SessionsPage = lazy(() => import("@/pages/sessions"));
const UsersPage = lazy(() => import("@/pages/users"));
const TableExamplePage = lazy(() => import("@/pages/table-example"));
const CompanyPage = lazy(() => import("@/pages/company"));
const ShopsPage = lazy(() => import("@/pages/shops"));
const NewShopPage = lazy(() => import("@/pages/shops/new"));
const ShopDetailsPage = lazy(() => import("@/pages/shops/$id"));
const EditShopPage = lazy(() => import("@/pages/shops/$id.edit"));
const ShopTagsPage = lazy(() => import("@/pages/management-tags"));
const FormsPage = lazy(() => import("@/pages/forms"));
const FormsAddPage = lazy(() => import("@/pages/forms/add"));
const FormsEditPage = lazy(() => import("@/pages/forms/edit"));
const Subscribe = lazy(() => import("@/pages/subscribe"));
const VerifyEmailPage = lazy(() => import("@/pages/verify-email"));
const PendingVerificationPage = lazy(() => import("@/pages/pending-verification"));
const NotFound = lazy(() => import("@/pages/not-found"));

const EmailApprovalsPage = lazy(() => import("@/pages/email-approvals"));
const EmailContactsPage = lazy(() => import("@/pages/email-contacts"));

const ViewEmailContactPage = lazy(() => import("@/pages/email-contacts/view"));
const ScheduleEmailContactPage = lazy(() => import("@/pages/email-contacts/schedule"));
const ScheduledTimelineContactPage = lazy(() => import("@/pages/email-contacts/scheduled"));
const EditEmailContactPage = lazy(() => import("@/pages/email-contacts/edit"));
const CustomerViewPage = lazy(() => import("@/pages/email-contacts/customer"));
const EmailAnalyticsPage = lazy(() => import("@/pages/email-analytics"));
const BirthdaysPage = lazy(() => import("@/pages/birthdays"));
const ECardsPage = lazy(() => import("@/pages/e-cards"));
const CardsPage = lazy(() => import("@/pages/cards"));
const RemindersPage = lazy(() => import("@/pages/reminders"));
const ConfirmAppointmentPage = lazy(() => import("@/pages/confirm-appointment"));
const PromotionsPage = lazy(() => import("@/pages/promotions"));
const EmailComposePage = lazy(() => import("@/pages/email-compose"));
const CreatePromotionPage = lazy(() => import("@/pages/promotions/create"));
const EditPromotionPage = lazy(() => import("@/pages/promotions/edit"));
const TemplatesPage = lazy(() => import("@/pages/templates"));
const CreateTemplatePage = lazy(() => import("@/pages/templates/create"));

const UpdateProfilePage = lazy(() => import("@/pages/update-profile"));
const SegmentationPage = lazy(() => import("@/pages/segmentation"));
const AnalyticsPage = lazy(() => import("@/pages/analytics"));
const ManagementPage = lazy(() => import("@/pages/management"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const SelectPlanPage = lazy(() => import("@/pages/select-plan"));
const PrivacySecurityPage = lazy(() => import("@/pages/privacy-security"));
const TermsOfServicePage = lazy(() => import("@/pages/terms-of-service"));
const AcceptableUsePage = lazy(() => import("@/pages/acceptable-use"));
const DataProcessingPage = lazy(() => import("@/pages/data-processing"));
const CookiePolicyPage = lazy(() => import("@/pages/cookie-policy"));
const LegalAgreementsPage = lazy(() => import("@/pages/legal-agreements"));
const CommunicationsServiceAgreementPage = lazy(() => import("@/pages/communications-service-agreement"));
const PublicFormPage = lazy(() => import("@/pages/public-form"));
const PublicNewsletterHub = lazy(() => import("@/pages/public-newsletter"));
const PublicNewsletterView = lazy(() => import("@/pages/public-newsletter-view"));
const PublicPromotionTerms = lazy(() => import("@/pages/public-promotion-terms"));

// Redirect components for legacy routes
function BirthdaysRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation('/cards?type=birthday');
  }, [setLocation]);
  return null;
}

function ECardsRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation('/cards?type=ecard');
  }, [setLocation]);
  return null;
}

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

// Content loader for pages within AppLayout
const ContentLoader = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
  </div>
);

// Error Boundary to catch React errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error; errorInfo?: any }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-4">
              Something went wrong
            </h2>
            <p className="text-red-700 mb-4">
              A React error occurred. Please check the console for details.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


// Component to handle route protection and redirection
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isInitialized } = useReduxAuth();
  const [location, setLocation] = useLocation();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const isEmailVerified = user ? user.emailVerified : undefined;

  // Pages that are part of the signup flow and should not be redirected away from
  const signupFlowPages = ['/auth', '/verify-email', '/update-profile', '/pending-verification', '/onboarding', '/select-plan'];

  // Handle redirects in useEffect to prevent React warnings about updating during render
  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (!isAuthenticated) {
      if (!['/auth', '/verify-email', '/update-profile'].includes(location)) {
        setLocation('/auth');
      }
    } else if (isAuthenticated && isEmailVerified === false) {
      if (!['/pending-verification', '/verify-email'].includes(location)) {
        setLocation('/pending-verification');
      }
    } else if (isAuthenticated && isEmailVerified === true) {
      if (['/auth', '/pending-verification'].includes(location)) {
        setLocation('/dashboard');
      }
    }
  }, [isAuthenticated, isEmailVerified, location, setLocation, isInitialized, user?.email]);

  // Reset gating state on user transitions
  const userId = user?.id;
  useEffect(() => {
    setOnboardingChecked(false);
    setSubscriptionChecked(false);
    setNeedsOnboarding(false);
  }, [userId]);

  // Check onboarding status once per authenticated user
  // New flow: if user has no company (pre-payment), skip onboarding and go to /select-plan
  // Onboarding happens AFTER payment creates the tenant+company
  useEffect(() => {
    if (!isAuthenticated || !isInitialized || !userId || isEmailVerified !== true) {
      return;
    }

    // Check localStorage cache first — skip API call entirely if already completed
    const cacheKey = `onboardingCompleted:${userId}`;
    if (localStorage.getItem(cacheKey) === 'true') {
      setOnboardingChecked(true);
      // If user somehow landed on /onboarding but already completed, redirect away
      if (location === '/onboarding') {
        setLocation('/select-plan');
      }
      return;
    }

    // Only fetch once
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/company', { credentials: 'include' });
        if (cancelled) return;

        if (response.status === 404) {
          // No company exists yet — user hasn't paid. Skip onboarding, go to plan selection.
          setNeedsOnboarding(false);
          if (location !== '/select-plan' && !signupFlowPages.includes(location)) {
            console.log('🔒 [ProtectedRoute] No company found (pre-payment), redirecting to /select-plan');
            setLocation('/select-plan');
          }
        } else if (response.ok) {
          const company = await response.json();
          if (company && !company.setupCompleted) {
            // Company exists but onboarding not done — redirect to onboarding
            if (location !== '/onboarding' && location !== '/select-plan') {
              setNeedsOnboarding(true);
              setLocation('/onboarding');
            }
          } else {
            localStorage.setItem(cacheKey, 'true');
            setNeedsOnboarding(false);
            if (location === '/onboarding') {
              setLocation('/select-plan');
            }
          }
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
      } finally {
        if (!cancelled) setOnboardingChecked(true);
      }
    };

    checkStatus();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isInitialized, userId, isEmailVerified]);

  // Check subscription status — only after onboarding is confirmed complete
  useEffect(() => {
    if (!isAuthenticated || !isInitialized || !userId || isEmailVerified !== true) {
      return;
    }

    // Wait until onboarding check is done
    if (!onboardingChecked) {
      return;
    }

    // If user still needs onboarding, don't check subscription yet
    if (needsOnboarding) {
      return;
    }

    // Check localStorage cache first — skip API call if subscription already confirmed
    const subCacheKey = `subscriptionActive:${userId}`;
    if (localStorage.getItem(subCacheKey) === 'true') {
      setSubscriptionChecked(true);
      return;
    }

    let cancelled = false;
    const checkSubscription = async () => {
      try {
        const response = await fetch('/api/subscription/check-subscription', { credentials: 'include' });
        if (cancelled) return;
        if (response.ok) {
          const data = await response.json();
          if (data.hasSubscription && data.status === 'active') {
            // Subscription is active — cache it and allow through
            localStorage.setItem(subCacheKey, 'true');
          } else if (!signupFlowPages.includes(location)) {
            // No active subscription — redirect to plan selection (skip redirect on signup flow pages)
            console.log('🔒 [ProtectedRoute] No active subscription, redirecting to /select-plan');
            setLocation('/select-plan');
          }
        }
      } catch (error) {
        console.error('Failed to check subscription status:', error);
        // On error, don't block the user — let them through
      } finally {
        if (!cancelled) setSubscriptionChecked(true);
      }
    };

    checkSubscription();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isInitialized, userId, isEmailVerified, onboardingChecked, needsOnboarding, location]);

  // Determine if we need to gate rendering behind signup checks
  const isOnSignupFlowPage = signupFlowPages.includes(location);
  const isFullyAuthenticated = isAuthenticated && isEmailVerified === true && isInitialized;

  // Block dashboard/protected pages from rendering until both checks pass
  // Don't block signup flow pages — they manage their own state
  if (isFullyAuthenticated && !isOnSignupFlowPage) {
    // If onboarding check hasn't completed yet, show a loading spinner
    if (!onboardingChecked) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-muted-foreground">Verifying account setup...</p>
          </div>
        </div>
      );
    }

    // If subscription check hasn't completed yet (and onboarding passed), show loading
    if (!needsOnboarding && !subscriptionChecked) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-muted-foreground">Checking subscription status...</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}

function Router() {
  const { isAuthenticated, isLoading, user, isInitialized } = useReduxAuth();
  const { handleAuthError } = useAuthErrorHandler();
  const [currentLocation] = useLocation();

  // Set up global auth error handler
  useEffect(() => {
    setGlobalAuthErrorHandler(handleAuthError);
  }, [handleAuthError]);

  // Render public pages outside of ProtectedRoute — no auth required
  if (currentLocation.startsWith('/form/')) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/form/:id" component={PublicFormPage} />
        </Switch>
      </Suspense>
    );
  }

  if (currentLocation.startsWith('/n/')) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/n/preview/:tenantSlug/:newsletterId" component={PublicNewsletterView} />
          <Route path="/n/:tenantSlug/:newsletterSlug" component={PublicNewsletterView} />
          <Route path="/n/:tenantSlug" component={PublicNewsletterHub} />
        </Switch>
      </Suspense>
    );
  }

  if (currentLocation.startsWith('/p/')) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/p/:tenantSlug/:promotionId/terms" component={PublicPromotionTerms} />
        </Switch>
      </Suspense>
    );
  }

  if (isLoading && !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isEmailVerified = user ? user.emailVerified : undefined;

  return (
    <ProtectedRoute>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          {/* Routes that should NOT be wrapped in AppLayout */}
          <Route path="/auth" component={AuthPage} />
          <Route path="/pending-verification" component={PendingVerificationPage} />
          <Route path="/verify-email" component={VerifyEmailPage} />
          <Route path="/update-profile" component={UpdateProfilePage} />
          <Route path="/onboarding" component={OnboardingPage} />
          <Route path="/select-plan" component={SelectPlanPage} />
          <Route path="/communications-service-agreement" component={CommunicationsServiceAgreementPage} />
          <Route path="/confirm-appointment/:id" component={ConfirmAppointmentPage} />
          <Route path="/newsletter/create/:id" component={NewsletterCreatePage} />
          <Route path="/newsletter/create" component={NewsletterCreatePage} />
          <Route path="/advertise/create/:id" component={AdvertiseCreatePage} />
          <Route path="/advertise/create" component={AdvertiseCreatePage} />

          {/* Routes that should be wrapped in AppLayout */}
          {isAuthenticated && isEmailVerified === true ? (
            <AppLayout>
              <Suspense fallback={<ContentLoader />}>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/dashboard" component={Dashboard} />
                  <Route path="/newsletter" component={NewsletterPage} />
                  <Route path="/newsletters" component={NewsletterPage} />
                  <Route path="/newsletters/:id" component={NewsletterViewPage} />
                  <Route path="/advertise" component={AdvertisePage} />
                  <Route path="/promotions" component={PromotionsPage} />
                  <Route path="/promotions/create" component={CreatePromotionPage} />
                  <Route path="/promotions/:id/edit" component={EditPromotionPage} />
                  <Route path="/templates/create" component={CreateTemplatePage} />
                  <Route path="/templates" component={TemplatesPage} />
                  <Route path="/company" component={CompanyPage} />

                  <Route path="/email-approvals" component={EmailApprovalsPage} />
                  <Route path="/email-compose" component={EmailComposePage} />
                  <Route path="/email-contacts" component={EmailContactsPage} />

                  <Route path="/email-contacts/view/:id" component={ViewEmailContactPage} />
                  <Route path="/email-contacts/view/:id/schedule" component={ScheduleEmailContactPage} />
                  <Route path="/email-contacts/view/:id/scheduled" component={ScheduledTimelineContactPage} />
                  <Route path="/email-contacts/edit/:id" component={EditEmailContactPage} />
                  <Route path="/email-contacts/customer/:id" component={CustomerViewPage} />
                  <Route path="/email-analytics" component={EmailAnalyticsPage} />
                  <Route path="/segmentation" component={SegmentationPage} />
                  <Route path="/analytics" component={AnalyticsPage} />
                  <Route path="/cards" component={CardsPage} />
                  <Route path="/birthdays" component={BirthdaysRedirect} />
                  <Route path="/e-cards" component={ECardsRedirect} />
                  <Route path="/reminders" component={RemindersPage} />
                  <Route path="/shops" component={ShopsPage} />
                  <Route path="/shops/new" component={NewShopPage} />
                  <Route path="/shops/tags" component={ShopTagsPage} />
                  <Route path="/shops/:id" component={ShopDetailsPage} />
                  <Route path="/shops/:id/edit" component={EditShopPage} />
                  <Route path="/management" component={ManagementPage} />
                  <Route path="/forms" component={FormsPage} />
                  <Route path="/forms/add" component={FormsAddPage} />
                  <Route path="/forms/:id/edit" component={FormsEditPage} />
                  <Route path="/profile" component={ProfilePage} />
                  <Route path="/sessions" component={SessionsPage} />
                  <Route path="/users" component={UsersPage} />
                  <Route path="/table-example" component={TableExamplePage} />
                  <Route path="/subscribe" component={Subscribe} />
                  <Route path="/privacy-security" component={PrivacySecurityPage} />
                  <Route path="/terms-of-service" component={TermsOfServicePage} />
                  <Route path="/acceptable-use" component={AcceptableUsePage} />
                  <Route path="/data-processing" component={DataProcessingPage} />
                  <Route path="/cookie-policy" component={CookiePolicyPage} />
                  <Route path="/legal-agreements" component={LegalAgreementsPage} />
                  <Route path="/communications-service-agreement" component={CommunicationsServiceAgreementPage} />

                  <Route component={NotFound} />
                </Switch>
              </Suspense>
            </AppLayout>
          ) : (
            /* Default route for unauthenticated users */
            <Route path="/" component={isAuthenticated ? PendingVerificationPage : AuthPage} />
          )}
        </Switch>
      </Suspense>
    </ProtectedRoute>
  );
}

function AppWithProviders({ children }: { children: ReactNode }) {
  if (convex) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
  }
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Provider store={store}>
          <PersistGate
            loading={
              <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }
            persistor={persistor}
          >
            <QueryClientProvider client={queryClient}>
              <AppWithProviders>
                <TooltipProvider>
                  <Toaster />
                  <Router />
                </TooltipProvider>
              </AppWithProviders>
            </QueryClientProvider>
          </PersistGate>
        </Provider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
