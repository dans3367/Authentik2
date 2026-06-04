import { Switch, Route, useLocation } from "wouter";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { LazyConvexProvider } from "@/components/LazyConvexProvider";
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
import {
  readCachedFlag,
  writeCachedFlag,
  onboardingCacheKey as onboardingCacheKeyFor,
  subscriptionCacheKey as subscriptionCacheKeyFor,
} from "@/lib/protectedFlagCache";
import { FullPageSkeleton, ContentSkeleton } from "@/components/PageSkeletons";

// Convex client is dynamic-imported by `LazyConvexProvider` so the
// ~50-80 KB `convex/react` runtime no longer ships with the entry chunk.
// See client/src/components/LazyConvexProvider.tsx.

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
const AppointmentsPage = lazy(() => import("@/pages/appointments"));
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
const PublicBookingPage = lazy(() => import("@/pages/public-booking"));

// Cache helpers + key builders live in @/lib/protectedFlagCache so other
// pages (subscribe / select-plan / onboarding) that write these flags
// agree on shape + TTL.

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

// Suspense fallbacks now render layout-shaped skeletons instead of a
// centered spinner — see @/components/PageSkeletons. Eliminates the CLS
// jump when chunks finish loading and makes the app feel instant during
// route transitions.
const PageLoader = FullPageSkeleton;
const ContentLoader = ContentSkeleton;

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

  // Check onboarding + subscription status in PARALLEL on first authenticated
  // load. Previously these two `/api/company` and `/api/subscription/check-
  // subscription` calls ran sequentially in two separate effects, which added
  // a full round-trip to every cold load. They have no data dependency on
  // each other — the subscription check doesn't read the company response —
  // so `Promise.all` shaves one RTT.
  //
  // Both results are cached in localStorage with a short TTL (see
  // readCachedFlag below) so a subsequent navigation in the same hour skips
  // the network entirely, while a lapsed subscription / setup change is
  // re-checked at most an hour later. Previously the cache had no expiry,
  // which let a canceled subscription stay accessible for the entire tab
  // lifetime — addressed here together with the parallelisation.
  useEffect(() => {
    if (!isAuthenticated || !isInitialized || !userId || isEmailVerified !== true) {
      return;
    }

    const onboardingCacheKey = onboardingCacheKeyFor(userId);
    const subscriptionCacheKey = subscriptionCacheKeyFor(userId);

    const onboardingCached = readCachedFlag(onboardingCacheKey);
    const subscriptionCached = readCachedFlag(subscriptionCacheKey);

    // Fast path: both cached and still fresh → no network at all.
    if (onboardingCached && subscriptionCached) {
      setOnboardingChecked(true);
      setNeedsOnboarding(false);
      setSubscriptionChecked(true);
      if (location === '/onboarding') {
        setLocation('/select-plan');
      }
      return;
    }

    let cancelled = false;

    const fetchCompany = onboardingCached
      ? Promise.resolve<'cached'>('cached')
      : fetch('/api/company', { credentials: 'include' }).catch((err) => {
          console.error('Failed to fetch /api/company:', err);
          return null;
        });

    const fetchSubscription = subscriptionCached
      ? Promise.resolve<'cached'>('cached')
      : fetch('/api/subscription/check-subscription', { credentials: 'include' }).catch((err) => {
          console.error('Failed to fetch /api/subscription/check-subscription:', err);
          return null;
        });

    (async () => {
      const [companyRes, subRes] = await Promise.all([fetchCompany, fetchSubscription]);
      if (cancelled) return;

      // ---------- Onboarding / company resolution ----------
      let resolvedNeedsOnboarding = false;
      if (companyRes === 'cached') {
        // Already known good — nothing to do.
      } else if (companyRes && companyRes.status === 404) {
        // No company yet — user hasn't paid. Skip onboarding, go to plan selection.
        if (location !== '/select-plan' && !signupFlowPages.includes(location)) {
          console.log('🔒 [ProtectedRoute] No company found (pre-payment), redirecting to /select-plan');
          setLocation('/select-plan');
        }
      } else if (companyRes && companyRes.ok) {
        try {
          const company = await companyRes.json();
          if (company && !company.setupCompleted) {
            resolvedNeedsOnboarding = true;
            if (location !== '/onboarding' && location !== '/select-plan') {
              setLocation('/onboarding');
            }
          } else {
            writeCachedFlag(onboardingCacheKey);
            if (location === '/onboarding') {
              setLocation('/select-plan');
            }
          }
        } catch (jsonErr) {
          console.error('Failed to parse /api/company response:', jsonErr);
        }
      }
      if (cancelled) return;
      setNeedsOnboarding(resolvedNeedsOnboarding);
      setOnboardingChecked(true);

      // ---------- Subscription resolution ----------
      // We always SEND the request in parallel (no waterfall) but only ACT on
      // it when onboarding is actually complete — otherwise the user belongs
      // on /onboarding regardless of subscription state.
      if (!resolvedNeedsOnboarding) {
        if (subRes === 'cached') {
          // Cached as active — nothing to do.
        } else if (subRes && subRes.ok) {
          try {
            const data = await subRes.json();
            if (data.hasSubscription && data.status === 'active') {
              writeCachedFlag(subscriptionCacheKey);
            } else if (!signupFlowPages.includes(location)) {
              console.log('🔒 [ProtectedRoute] No active subscription, redirecting to /select-plan');
              setLocation('/select-plan');
            }
          } catch (jsonErr) {
            console.error('Failed to parse /api/subscription/check-subscription response:', jsonErr);
          }
        }
        // On network error we deliberately do NOT block the user; the next
        // navigation will retry.
      }
      if (cancelled) return;
      setSubscriptionChecked(true);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isInitialized, userId, isEmailVerified]);

  // Determine if we need to gate rendering behind signup checks
  const isOnSignupFlowPage = signupFlowPages.includes(location);
  const isFullyAuthenticated = isAuthenticated && isEmailVerified === true && isInitialized;

  // Block dashboard/protected pages from rendering until both checks pass.
  // Don't block signup flow pages — they manage their own state.
  //
  // Use the layout-shaped skeleton instead of a centered spinner so the
  // user immediately sees the page structure they're about to interact
  // with. With the parallelised onboarding+subscription check this branch
  // is usually <300 ms on cold loads.
  if (isFullyAuthenticated && !isOnSignupFlowPage) {
    if (!onboardingChecked || (!needsOnboarding && !subscriptionChecked)) {
      return <FullPageSkeleton />;
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

  if (currentLocation.startsWith('/book/')) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/book/:slug" component={PublicBookingPage} />
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
                  <Route path="/contacts" component={EmailContactsPage} />

                  <Route path="/contacts/view/:id" component={ViewEmailContactPage} />
                  <Route path="/contacts/view/:id/schedule" component={ScheduleEmailContactPage} />
                  <Route path="/contacts/view/:id/scheduled" component={ScheduledTimelineContactPage} />
                  <Route path="/contacts/edit/:id" component={EditEmailContactPage} />
                  <Route path="/contacts/customer/:id" component={CustomerViewPage} />
                  <Route path="/email-analytics" component={EmailAnalyticsPage} />
                  <Route path="/segmentation" component={SegmentationPage} />
                  <Route path="/analytics" component={AnalyticsPage} />
                  <Route path="/cards" component={CardsPage} />
                  <Route path="/birthdays" component={BirthdaysRedirect} />
                  <Route path="/e-cards" component={ECardsRedirect} />
                  <Route path="/appointments" component={AppointmentsPage} />
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
  // Convex provider mounts asynchronously — see LazyConvexProvider.
  // Children render immediately; once Convex resolves it rewraps the tree.
  return <LazyConvexProvider>{children}</LazyConvexProvider>;
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
