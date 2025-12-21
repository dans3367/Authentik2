import { useState, useEffect } from "react";
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
import { Zap, UserPlus, Bell, ChevronRight } from "lucide-react";
import { Link } from "wouter";

// Header component that displays breadcrumbs or page title
function AppHeader() {
  const { title, subtitle, breadcrumbs } = usePageTitle();
  
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
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  {item.href && !isLast ? (
                    <Link 
                      href={item.href}
                      className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-1.5 text-gray-900 dark:text-white">
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
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-tight">
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
          className="h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Quick Actions"
        >
          <Zap className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Invite Users"
        >
          <UserPlus className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
          title="Notifications"
        >
          <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          {/* Optional notification badge */}
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900" />
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
  const [companyData, setCompanyData] = useState<any>(null);
  
  // Initialize sidebar open state
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Only use localStorage as initial state if auth is not initialized yet
    if (!isInitialized) {
      const localPref = localStorage.getItem("menuExpanded");
      if (localPref !== null) {
        return JSON.parse(localPref);
      }
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

  // Only update sidebar state after auth is initialized
  if (isInitialized && user) {
      // Use backend preference as source of truth
      const backendOpen = user.menuExpanded !== false;
      setSidebarOpen(backendOpen);
      // Sync localStorage with backend preference
      localStorage.setItem("menuExpanded", JSON.stringify(user.menuExpanded ?? true));
    }
  }, [isInitialized, user, user?.menuExpanded, currentLanguage]);


  // Check if company needs onboarding
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        console.log('🏢 [Onboarding] No user, skipping onboarding check');
        return;
      }

      console.log('🏢 [Onboarding] Checking onboarding status for user:', user.email);

      try {
        const response = await fetch('/api/company', {
          credentials: 'include',
        });

        console.log('🏢 [Onboarding] Company API response:', {
          status: response.status,
          ok: response.ok,
        });

        if (response.ok) {
          const company = await response.json();
          console.log('🏢 [Onboarding] Company data:', {
            name: company?.name,
            setupCompleted: company?.setupCompleted,
          });
          
          setCompanyData(company);
          
          // Show onboarding wizard if setup is not completed
          if (company && !company.setupCompleted) {
            console.log('🎯 [Onboarding] Showing onboarding modal (setupCompleted: false)');
            setShowOnboarding(true);
          } else {
            console.log('✅ [Onboarding] Onboarding already completed');
          }
        } else {
          console.warn('⚠️ [Onboarding] Company not found (status:', response.status, ')');
          console.warn('   This might mean the user has no company record');
          console.warn('   Onboarding modal will NOT show');
        }
      } catch (error) {
        console.error('❌ [Onboarding] Failed to check onboarding status:', error);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  // Handle onboarding completion
  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    
    // Refresh company data
    try {
      const response = await fetch('/api/company', {
        credentials: 'include',
      });

      if (response.ok) {
        const company = await response.json();
        setCompanyData(company);
      }
    } catch (error) {
      console.error('Failed to refresh company data:', error);
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

  return (
    <PageTitleProvider>
      <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarOpenChange}>
        <AppSidebar />
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
