import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useReduxAuth,
  useReduxUpdateProfile,
} from "@/hooks/useReduxAuth";
import { useUpdateTheme, useUpdateMenuPreference } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TwoFactorCheck } from "@/components/TwoFactorCheck";



interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, isInitialized } = useReduxAuth();
  const { setUserTheme } = useTheme();
  const { updateProfile } = useReduxUpdateProfile();
  const updateMenuPreferenceMutation = useUpdateMenuPreference();
  const [isThemeChanging, setIsThemeChanging] = useState(false);
  
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
    // Only update sidebar state after auth is initialized
    if (isInitialized && user) {
      // Use backend preference as source of truth
      const backendOpen = user.menuExpanded !== false;
      setSidebarOpen(backendOpen);
      // Sync localStorage with backend preference
      localStorage.setItem("menuExpanded", JSON.stringify(user.menuExpanded ?? true));
    }
  }, [isInitialized, user, user?.menuExpanded]);

  // Sync theme from backend only on initial load
  const [hasInitializedTheme, setHasInitializedTheme] = useState(false);
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  
  useEffect(() => {
    // Reset initialization flag when user changes (logout/login) or when user ID changes
    if (!user) {
      setHasInitializedTheme(false);
      setLastUserId(null);
    } else if (user && (!hasInitializedTheme || user.id !== lastUserId) && !isThemeChanging) {
      // Always set theme from backend when user logs in or changes, even if undefined
      const backendTheme = user.theme || 'light';
      
      console.log(`🎨 [Theme] Syncing theme from backend: ${backendTheme} for user ${user.email}`);
      setUserTheme(backendTheme);
      setHasInitializedTheme(true);
      setLastUserId(user.id);
    }
  }, [user, setUserTheme, hasInitializedTheme, isThemeChanging, lastUserId]);

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
      updateMenuPreferenceMutation.mutate({ menuExpanded: open });
      
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
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarOpenChange}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
        </header>
        <div className="flex flex-1 flex-col">
          <TwoFactorCheck>
            {children}
          </TwoFactorCheck>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
