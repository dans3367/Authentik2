import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  useReduxAuth,
  useReduxUpdateProfile,
} from "@/hooks/useReduxAuth";
import { useUpdateMenuPreference } from "@/hooks/useAuth";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/AppSidebar";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { useLanguage } from "@/hooks/useLanguage";
import { PageTitleProvider, usePageTitle } from "@/contexts/PageTitleContext";
import { Button } from "@/components/ui/button";
import { Zap, UserPlus, Bell, ChevronRight, X } from "lucide-react";
import { Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Header component that displays breadcrumbs or page title
function AppHeader() {
  const { title, subtitle, breadcrumbs } = usePageTitle();
  const [location, setLocation] = useLocation();
  const [showExitDialog, setShowExitDialog] = useState(false);
  
  // Check if we're on newsletter create/edit pages or forms edit pages
  const hideHeader = location === '/newsletter/create' || 
                    location.startsWith('/newsletter/edit/') || 
                    location.startsWith('/forms/');
  
  // Return null to completely hide header on newsletter create/edit pages
  if (hideHeader) {
    return (
      <>
        {/* Minimal header with exit button */}
        <header className="flex h-16 shrink-0 items-center justify-end gap-2 border-b px-4 bg-background">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowExitDialog(true)}
            title={location.startsWith('/forms/') ? "Exit to Forms" : "Exit to Newsletters"}
            data-testid="button-exit-editor"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </Button>
        </header>
        
        {/* Exit Confirmation Dialog */}
        <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Exit Editor?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to exit? Any unsaved changes will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowExitDialog(false);
                  setLocation(location.startsWith('/forms/') ? '/forms' : '/newsletter');
                }}
              >
                Exit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
  
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      {breadcrumbs.length > 0 ? (
        <>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <nav className="flex items-center gap-1">
            {breadcrumbs.map((item, index) => {
              const Icon = item.icon;
              const isLast = index === breadcrumbs.length - 1;
              
              return (
                <div key={index} className="flex items-center gap-1">
                  {index > 0 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  {item.href && !isLast ? (
                    <Link 
                      href={item.href}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-1.5 text-foreground">
                      {Icon && <Icon className="h-4 w-4" />}
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </>
      ) : title ? (
        <>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <div className="flex flex-col justify-center">
            <h1 className="text-lg font-semibold text-foreground leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        </>
      ) : null}
      <div className="flex-1" />
      
      {/* Action Icons */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          title="Quick Actions"
          data-testid="button-quick-actions"
        >
          <Zap className="h-5 w-5 text-muted-foreground" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          title="Invite Users"
          data-testid="button-invite-users"
        >
          <UserPlus className="h-5 w-5 text-muted-foreground" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title="Notifications"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {/* Optional notification badge */}
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
        </Button>
      </div>
    </header>
  );
}



interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, isInitialized } = useReduxAuth();
  // Initialize language from user preferences or localStorage across the app
  const { currentLanguage } = useLanguage();
  const { updateProfile } = useReduxUpdateProfile();
  const updateMenuPreferenceMutation = useUpdateMenuPreference();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const onboardingCheckedRef = useRef(false);
  const onboardingUserKeyRef = useRef<string | null>(null);
  const onboardingCacheKey = user?.id ? `onboardingCompleted:${user.id}` : null;
  
  // Initialize sidebar open state from localStorage
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const stored = localStorage.getItem("menuExpanded");
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn("Failed to read sidebar state from localStorage:", error);
    }
    // Default to expanded
    return true;
  });

// Sync sidebar state when user data loads or changes
useEffect(() => {
  // Update document language attribute for accessibility and consistency
  if (currentLanguage) {
    document.documentElement.lang = currentLanguage;
  }

  if (!isInitialized || !user || user.menuExpanded === undefined) {
    return;
  }

  const storedValue = localStorage.getItem("menuExpanded");
  if (storedValue === null) {
    const backendOpen = user.menuExpanded !== false;
    if (sidebarOpen !== backendOpen) {
      setSidebarOpen(backendOpen);
    }
    localStorage.setItem("menuExpanded", JSON.stringify(backendOpen));
    return;
  }

  let localOpen = sidebarOpen;
  try {
    localOpen = JSON.parse(storedValue);
  } catch (error) {
    console.warn("Failed to parse sidebar state from localStorage:", error);
  }

  const backendOpen = user.menuExpanded !== false;

  if (localOpen !== sidebarOpen) {
    setSidebarOpen(localOpen);
  }

  if (localOpen !== backendOpen) {
    updateMenuPreferenceMutation.mutateAsync({ menuExpanded: localOpen });
  }
}, [isInitialized, user?.menuExpanded, currentLanguage, sidebarOpen, updateMenuPreferenceMutation]);

  useEffect(() => {
    const currentUserKey = user?.id ?? null;

    if (onboardingUserKeyRef.current !== currentUserKey) {
      onboardingUserKeyRef.current = currentUserKey;
      onboardingCheckedRef.current = false;
      setShowOnboarding(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user || onboardingCheckedRef.current) {
      return;
    }

    // Skip the network call entirely if onboarding was already completed for this user
    const onboardingDone = onboardingCacheKey ? localStorage.getItem(onboardingCacheKey) : null;
    if (onboardingDone === 'true') {
      onboardingCheckedRef.current = true;
      return;
    }

    const checkOnboardingStatus = async () => {
      try {
        const response = await fetch('/api/company', {
          credentials: 'include',
        });

        if (response.ok) {
          const company = await response.json();
          
          if (company && !company.setupCompleted) {
            setShowOnboarding(true);
          } else {
            // Cache the completed state for this user
            if (onboardingCacheKey) {
              localStorage.setItem(onboardingCacheKey, 'true');
            }
          }
          
          // Only set to true after successful response
          onboardingCheckedRef.current = true;
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
        // Reset to false so the check can be retried
        onboardingCheckedRef.current = false;
      }
    };

    checkOnboardingStatus();
  }, [user, onboardingCacheKey]);

  // Handle onboarding completion
  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    if (onboardingCacheKey) {
      localStorage.setItem(onboardingCacheKey, 'true');
    }
  };

  // Listen for localStorage changes from other tabs and immediate changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "menuExpanded" && e.newValue) {
        setSidebarOpen(JSON.parse(e.newValue));
      }
    };

    const handleMenuPreferenceChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setSidebarOpen(customEvent.detail.menuExpanded);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      "menuPreferenceChanged",
      handleMenuPreferenceChange,
    );

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "menuPreferenceChanged",
        handleMenuPreferenceChange,
      );
    };
  }, []);

  // Handle sidebar state changes to sync with backend
  const handleSidebarOpenChange = (open: boolean) => {
    setSidebarOpen(open);
    localStorage.setItem("menuExpanded", JSON.stringify(open));
    
    // Sync with backend
    if (user) {
      updateMenuPreferenceMutation.mutateAsync({ menuExpanded: open });
      
      // Dispatch custom event for other components/tabs
      window.dispatchEvent(
        new CustomEvent("menuPreferenceChanged", {
          detail: { menuExpanded: open },
        }),
      );
    }
  };



  if (!user) {
    return <>{children}</>;
  }

  const hideSidebar = location === '/newsletter/create' || 
                     location.startsWith('/newsletter/edit/') || 
                     location.startsWith('/forms/');

  return (
    <PageTitleProvider>
      <SidebarProvider open={hideSidebar ? false : sidebarOpen} onOpenChange={handleSidebarOpenChange}>
        {!hideSidebar && <AppSidebar />}
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 flex-col">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
      
      {/* Onboarding wizard */}
      <OnboardingWizard 
        open={showOnboarding} 
        onComplete={handleOnboardingComplete}
      />
    </PageTitleProvider>
  );
}
