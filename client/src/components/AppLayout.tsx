import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
import { AppFooter } from "@/components/AppFooter";
import { useLanguage } from "@/hooks/useLanguage";
import { PageTitleProvider, usePageTitle } from "@/contexts/PageTitleContext";
import { Button } from "@/components/ui/button";
import { ShopSelector } from "@/components/ShopSelector";
import { AddContactDialog } from "@/components/AddContactDialog";
import { apiRequest } from "@/lib/queryClient";
import { useAppDispatch, useAppSelector } from "@/store";
import { setSelectedShop } from "@/store/shopSlice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Bell,
  ChevronRight,
  Moon,
  Store,
  Sun,
  UserPlus,
  X,
} from "lucide-react";
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
import { useTheme } from "@/contexts/ThemeContext";

// Theme toggle button for the header
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const handleToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    toggleTheme();
    // Save preference to user profile silently (no toast, no cache invalidation)
    fetch('/api/users/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ theme: newTheme }),
    }).catch(() => {});
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      data-testid="button-theme-toggle"
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5 text-muted-foreground" />
      ) : (
        <Sun className="h-5 w-5 text-muted-foreground" />
      )}
    </Button>
  );
}

// Header component that displays breadcrumbs or page title
function AppHeader() {
  const { title, subtitle, breadcrumbs } = usePageTitle();
  const { t } = useLanguage();
  const [location, setLocation] = useLocation();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [shopPickerOpen, setShopPickerOpen] = useState(false);
  const [shopPickerSelection, setShopPickerSelection] = useState<string | null>(null);
  const dispatch = useAppDispatch();
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);

  const { data: shopsData } = useQuery({
    queryKey: ["/api/shops", { limit: 100 }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shops?limit=100");
      return response.json();
    },
    staleTime: Infinity,
  });
  const allShops: { id: string; name: string; status: string }[] =
    shopsData?.shops || [];
  const needsShopSelection = selectedShopId === null && allShops.length > 1;

  const handleAddContactClick = useCallback(() => {
    if (needsShopSelection) {
      setShopPickerSelection(null);
      setShopPickerOpen(true);
    } else {
      setAddContactOpen(true);
    }
  }, [needsShopSelection]);

  const handleShopPickerConfirm = useCallback(() => {
    if (shopPickerSelection) {
      dispatch(setSelectedShop(shopPickerSelection));
      setShopPickerOpen(false);
      setAddContactOpen(true);
    }
  }, [shopPickerSelection, dispatch]);

  // Check if we're on newsletter create/edit pages or forms edit pages
  const hideHeader = location === '/newsletter/create' ||
    location.startsWith('/newsletter/create/') ||
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
    <>
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

      {/* Shop Selector */}
      <Separator orientation="vertical" className="h-6 mx-2" />
      <ShopSelector />

      <div className="flex-1" />

      {/* Action Icons */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        <Button
          variant="ghost"
          size="icon"
          title={t("emailContacts.addContact", "Add Contact")}
          onClick={handleAddContactClick}
          data-testid="button-add-contact"
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

      <AddContactDialog open={addContactOpen} onOpenChange={setAddContactOpen} />

      <Dialog open={shopPickerOpen} onOpenChange={setShopPickerOpen}>
        <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-xl font-bold">
              {t("newsletter.shopPicker.title", "Select a Shop")}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t(
                "newsletter.shopPicker.description",
                "Choose which shop this item belongs to before continuing.",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-2 max-h-[360px] overflow-y-auto">
            {allShops
              .filter((s) => s.status === "active")
              .map((shop) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => setShopPickerSelection(shop.id)}
                  className={`relative w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                    shopPickerSelection === shop.id
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-md ring-1 ring-blue-500/20"
                      : "border-border bg-background hover:border-muted-foreground/30 hover:bg-muted/50"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      shopPickerSelection === shop.id
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Store className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-sm flex-1">{shop.name}</span>
                  {shopPickerSelection === shop.id && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
          </div>

          <div className="px-6 pb-6 pt-2 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShopPickerOpen(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleShopPickerConfirm}
              disabled={!shopPickerSelection}
              className="gap-2"
            >
              {t("common.next", "Next")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
  const { setUserTheme } = useTheme();

  // Sync theme from user profile only once per browser session
  useEffect(() => {
    if (isInitialized && user?.theme && !sessionStorage.getItem('theme-synced')) {
      sessionStorage.setItem('theme-synced', '1');
      setUserTheme(user.theme as 'light' | 'dark');
    }
  }, [isInitialized, user?.theme]);

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
    location.startsWith('/newsletter/create/') ||
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
          {!hideSidebar && <AppFooter />}
        </SidebarInset>
      </SidebarProvider>
    </PageTitleProvider>
  );
}
