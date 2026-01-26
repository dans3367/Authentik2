import { Switch, Route, useLocation } from "wouter";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { store, persistor } from "@/store";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import { AppLayout } from "@/components/AppLayout";
import { setGlobalNavigate } from "@/lib/authErrorHandler";
import { lazy, Suspense, useEffect, useState, Component, ReactNode } from "react";
import { useAuthErrorHandler, setGlobalAuthErrorHandler } from "@/hooks/useAuthErrorHandler";

// Lazy load components for code splitting
const AuthPage = lazy(() => import("@/pages/auth"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const NewsletterPage = lazy(() => import("@/pages/newsletter"));
const NewsletterCreatePage = lazy(() => import("@/pages/newsletter/create"));
const NewsletterEditPage = lazy(() => import("@/pages/newsletter/edit"));
const NewsletterViewPage = lazy(() => import("@/pages/newsletter/view"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const SessionsPage = lazy(() => import("@/pages/sessions"));
const UsersPage = lazy(() => import("@/pages/users"));
const TableExamplePage = lazy(() => import("@/pages/table-example"));
const CompanyPage = lazy(() => import("@/pages/company"));
const ShopsPage = lazy(() => import("@/pages/shops"));
const NewShopPage = lazy(() => import("@/pages/shops/new"));
const ShopDetailsPage = lazy(() => import("@/pages/shops/$id"));
const EditShopPage = lazy(() => import("@/pages/shops/$id.edit"));
const FormsPage = lazy(() => import("@/pages/forms"));
const FormsAddPage = lazy(() => import("@/pages/forms/add"));
const FormsEditPage = lazy(() => import("@/pages/forms/edit"));
const Subscribe = lazy(() => import("@/pages/subscribe"));
const VerifyEmailPage = lazy(() => import("@/pages/verify-email"));
const PendingVerificationPage = lazy(() => import("@/pages/pending-verification"));
const NotFound = lazy(() => import("@/pages/not-found"));
const CreateCampaignPage = lazy(() => import("@/pages/campaigns/create"));
const EmailCampaignsPage = lazy(() => import("@/pages/email-campaigns"));
const EmailApprovalsPage = lazy(() => import("@/pages/email-approvals"));
const EmailContactsPage = lazy(() => import("@/pages/email-contacts"));
const NewEmailContactPage = lazy(() => import("@/pages/email-contacts/new"));
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
const EditEmailCampaignPage = lazy(() => import("@/pages/email-campaigns/edit"));
const UpdateProfilePage = lazy(() => import("@/pages/update-profile"));
const SegmentationPage = lazy(() => import("@/pages/segmentation"));
const ManagementPage = lazy(() => import("@/pages/management"));

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
  
  const isEmailVerified = user ? user.emailVerified : undefined;
  
  // Handle redirects in useEffect to prevent React warnings about updating during render
  useEffect(() => {
    // Don't redirect until auth is initialized
    if (!isInitialized) {
      console.log("🔒 [ProtectedRoute] Waiting for auth initialization...");
      return;
    }

    console.log("🔒 [ProtectedRoute] Auth state:", {
      isAuthenticated,
      isEmailVerified,
      location,
      userEmail: user?.email,
    });

    if (!isAuthenticated) {
      // Allow certain routes for unauthenticated users
      if (!['/auth', '/verify-email', '/update-profile'].includes(location)) {
        console.log("🔒 [ProtectedRoute] Redirecting unauthenticated user to /auth");
        setLocation('/auth');
      }
    } else if (isAuthenticated && isEmailVerified === false) {
      // Allow certain routes for unverified users (strict false check only)
      if (!['/pending-verification', '/verify-email'].includes(location)) {
        console.log("🔒 [ProtectedRoute] Redirecting unverified user to /pending-verification");
        setLocation('/pending-verification');
      }
    } else if (isAuthenticated && isEmailVerified === true) {
      // Redirect auth page to dashboard for verified users
      // 2FA handling is now done in the login flow itself
      if (['/auth', '/pending-verification'].includes(location)) {
        console.log("🔒 [ProtectedRoute] Redirecting verified user to /dashboard");
        setLocation('/dashboard');
      }
    }
    // If isEmailVerified is undefined/null (loading state), don't redirect
    // This prevents premature redirects during authentication initialization
  }, [isAuthenticated, isEmailVerified, location, setLocation, isInitialized, user?.email]);
  
  return <>{children}</>;
}

function Router() {
  const { isAuthenticated, isLoading, user, isInitialized } = useReduxAuth();
  const { handleAuthError } = useAuthErrorHandler();

  // Set up global auth error handler
  useEffect(() => {
    setGlobalAuthErrorHandler(handleAuthError);
  }, [handleAuthError]);

  console.log("🔍 [Redux] Router state:", {
    isAuthenticated,
    isLoading,
    hasUser: !!user,
    isInitialized,
    userEmail: user?.email,
    userEmailVerified: user?.emailVerified
  });

  // Show loading state while authentication is being determined
  if (isLoading && !isInitialized) {
    console.log(
      "📱 [Redux] Showing loading screen - authentication in progress",
    );
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  console.log("🚀 [Redux] Authentication check complete, determining route");

  const isEmailVerified = user ? user.emailVerified : undefined;

  console.log("🔍 [Router] Route determination:", {
    isAuthenticated,
    isEmailVerified,
    currentPath: window.location.pathname,
    currentSearch: window.location.search
  });
  
  // Debug: Log when routes are being rendered
  console.log("🚀 [Router] Rendering routes for authenticated:", isAuthenticated, "emailVerified:", isEmailVerified);

  return (
    <ProtectedRoute>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          {/* Routes that should NOT be wrapped in AppLayout */}
          <Route path="/auth" component={AuthPage} />
          <Route path="/pending-verification" component={PendingVerificationPage} />
          <Route path="/verify-email" component={VerifyEmailPage} />
          <Route path="/update-profile" component={UpdateProfilePage} />
          <Route path="/confirm-appointment/:id" component={ConfirmAppointmentPage} />

          {/* Routes that should be wrapped in AppLayout */}
          {isAuthenticated && isEmailVerified === true ? (
            <AppLayout>
              <Suspense fallback={<ContentLoader />}>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/dashboard" component={Dashboard} />
                  <Route path="/newsletter" component={NewsletterPage} />
                  <Route path="/newsletters" component={NewsletterPage} />
                  <Route path="/newsletter/create" component={NewsletterCreatePage} />
                  <Route path="/newsletter/edit/:id" component={NewsletterEditPage} />
                  <Route path="/newsletters/:id" component={NewsletterViewPage} />
                  <Route path="/promotions" component={PromotionsPage} />
                  <Route path="/promotions/create" component={CreatePromotionPage} />
                  <Route path="/promotions/:id/edit" component={EditPromotionPage} />
                  <Route path="/templates/create" component={CreateTemplatePage} />
                  <Route path="/templates" component={TemplatesPage} />
                  <Route path="/company" component={CompanyPage} />
                  <Route path="/campaigns/create" component={CreateCampaignPage} />
                  <Route path="/email-campaigns" component={EmailCampaignsPage} />
                  <Route path="/email-campaigns/edit/:id" component={EditEmailCampaignPage} />
                  <Route path="/email-approvals" component={EmailApprovalsPage} />
                  <Route path="/email-compose" component={EmailComposePage} />
                  <Route path="/email-contacts" component={EmailContactsPage} />
                  <Route path="/email-contacts/new" component={NewEmailContactPage} />
                  <Route path="/email-contacts/view/:id" component={ViewEmailContactPage} />
                  <Route path="/email-contacts/view/:id/schedule" component={ScheduleEmailContactPage} />
                  <Route path="/email-contacts/view/:id/scheduled" component={ScheduledTimelineContactPage} />
                  <Route path="/email-contacts/edit/:id" component={EditEmailContactPage} />
                  <Route path="/email-contacts/customer/:id" component={CustomerViewPage} />
                  <Route path="/email-analytics" component={EmailAnalyticsPage} />
                  <Route path="/segmentation" component={SegmentationPage} />
                  <Route path="/cards" component={CardsPage} />
                  <Route path="/birthdays" component={BirthdaysRedirect} />
                  <Route path="/e-cards" component={ECardsRedirect} />
                  <Route path="/reminders" component={RemindersPage} />
                  <Route path="/shops" component={ShopsPage} />
                  <Route path="/shops/new" component={NewShopPage} />
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

function App() {
  return (
    <ErrorBoundary>
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
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </QueryClientProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
