import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  User,
  LogOut,
  Activity,
  Users,
  Building2,
  Store,
  Moon,
  Sun,
  Mail,
  FileText,
  UserCheck,
  BarChart3,
  Newspaper,
  Settings,
  ClipboardList,
  X,
} from "lucide-react";
import logoUrl from "@assets/logo.png";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar as CustomAvatar } from "@/components/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  useReduxAuth,
  useReduxLogout,
} from "@/hooks/useReduxAuth";
import { useUpdateTheme } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import type { UserSubscriptionResponse } from "@shared/schema";
import { useState } from "react";

const getNavigation = (userRole?: string) => {
  const baseNavigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Newsletter", href: "/newsletter", icon: Newspaper },
    { name: "Forms", href: "/forms", icon: ClipboardList },
    { name: "Email Campaigns", href: "/email-campaigns", icon: Mail },
    { name: "Email Test", href: "/email-test", icon: Settings },
    { name: "Templates", href: "/email-templates", icon: FileText },
    { name: "Contacts", href: "/email-contacts", icon: UserCheck },
    { name: "Analytics", href: "/email-analytics", icon: BarChart3 },
    { name: "Shops", href: "/shops", icon: Store },
  ];

  // Add Users management for Owner, Admin and Manager roles
  if (userRole === "Owner" || userRole === "Administrator" || userRole === "Manager") {
    baseNavigation.push({ name: "Users", href: "/users", icon: Users });
  }

  return baseNavigation;
};

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useReduxAuth();
  const { logout } = useReduxLogout();
  const { theme, toggleTheme } = useTheme();
  const navigation = getNavigation(user?.role);
  const updateThemeMutation = useUpdateTheme();
  const [isThemeChanging, setIsThemeChanging] = useState(false);
  const { state, isMobile, setOpenMobile } = useSidebar();

  // Fetch subscription data for the user's plan
  const { data: subscriptionData } = useQuery<UserSubscriptionResponse>({
    queryKey: ["/api/my-subscription"],
    enabled: !!user && user.role === "Owner",
  });

  const handleLogout = async () => {
    await logout();
    setLocation("/auth");
  };

  const handleThemeToggle = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setIsThemeChanging(true);
    toggleTheme();
    
    // Sync with backend using dedicated theme endpoint
    if (user) {
      updateThemeMutation.mutate({ theme: newTheme }, {
        onSettled: () => {
          // Allow theme sync again after mutation completes
          setTimeout(() => setIsThemeChanging(false), 1000);
        }
      });
    } else {
      setIsThemeChanging(false);
    }
  };

  const handleMobileNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  if (!user) {
    return null;
  }

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader>
        {/* Mobile Header with Close Button */}
        {isMobile && (
          <div className="flex items-center justify-between p-4 border-b md:hidden">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 dark:bg-indigo-500 rounded-2xl p-2 flex items-center justify-center">
                <img 
                  src={logoUrl} 
                  alt="Company Logo" 
                  className="w-6 h-6 object-contain filter brightness-0 invert"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sidebar-foreground font-semibold text-base">
                  SaaS Platform
                </span>
                <span className="text-sidebar-foreground/60 text-sm">
                  Management Suite
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpenMobile(false)}
              className="h-8 w-8 hover:bg-sidebar-accent"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close menu</span>
            </Button>
          </div>
        )}

        {/* Desktop Header */}
        <div className={cn(
          "flex items-center transition-all duration-300",
          isMobile ? "hidden" : (isCollapsed ? "justify-center" : "justify-start")
        )}>
          <div className="bg-indigo-600 dark:bg-indigo-500 rounded-2xl p-2 flex items-center justify-center">
            <img 
              src={logoUrl} 
              alt="Company Logo" 
              className="w-8 h-8 object-contain filter brightness-0 invert"
            />
          </div>
          {!isCollapsed && (
            <div className="ml-3 flex flex-col">
              <span className="text-sidebar-foreground font-semibold text-lg">
                SaaS Platform
              </span>
              <span className="text-sidebar-foreground/60 text-sm">
                Management Suite
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className={cn(isMobile && "px-2")}>
        <SidebarGroup className={cn(isMobile ? "mt-4" : "mt-6")}>
          <SidebarGroupLabel className={cn("mb-4 text-left", isMobile ? "px-4 text-sm font-medium text-muted-foreground" : "px-3")}>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className={cn("w-full", isMobile ? "space-y-0.5" : "space-y-1")}>
              {navigation.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href === "/dashboard" && location === "/");
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.name} className="w-full flex justify-center group-data-[collapsible=icon]:justify-center">
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive} 
                      className={cn(
                        "w-full justify-start group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!px-0 hover:!bg-[#e1fce9] data-[active=true]:!bg-[#e1fce9] hover:!text-gray-800 data-[active=true]:!text-gray-800",
                        isMobile ? "px-4 py-3 mx-2 rounded-lg" : "px-3 py-2.5"
                      )}
                      tooltip={item.name}
                    >
                      <Link href={item.href} className="flex items-center gap-3 w-full group-data-[collapsible=icon]:justify-center" onClick={handleMobileNavClick}>
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-center group-data-[collapsible=icon]:justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:!bg-[#e1fce9] data-[state=open]:!text-gray-800 hover:!bg-[#e1fce9] hover:!text-gray-800 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!px-0"
                  tooltip="User Menu"
                >
                  <CustomAvatar 
                    user={user}
                    size="sm"
                    className="w-8 h-8 flex-shrink-0"
                  />
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="truncate text-xs">
                      {user.email}
                    </span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                side="right" 
                align="end" 
                className="w-64 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg rounded-2xl p-0"
                sideOffset={8}
              >
                {/* User Profile Header */}
                <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
                  <CustomAvatar 
                    user={user}
                    size="sm"
                    className="w-10 h-10 ring-2 ring-gray-100 dark:ring-gray-700"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      {user.firstName} {user.lastName}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {subscriptionData?.subscription?.plan?.displayName || 'Basic Plan'}
                    </p>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <DropdownMenuItem 
                    onClick={() => {
                      setLocation('/profile');
                      handleMobileNavClick();
                    }} 
                    className="cursor-pointer flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-gray-50 dark:focus:bg-gray-700 rounded-none"
                  >
                    <User className="h-4 w-4" style={{color: "#3396D3"}} />
                    <span className="text-sm">Profile</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={() => {
                      setLocation('/company');
                      handleMobileNavClick();
                    }} 
                    className="cursor-pointer flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-gray-50 dark:focus:bg-gray-700 rounded-none"
                  >
                    <Building2 className="h-4 w-4" style={{color: "#3396D3"}} />
                    <span className="text-sm">Company</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={() => {
                      setLocation('/sessions');
                      handleMobileNavClick();
                    }} 
                    className="cursor-pointer flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-gray-50 dark:focus:bg-gray-700 rounded-none"
                  >
                    <Activity className="h-4 w-4" style={{color: "#3396D3"}} />
                    <span className="text-sm">Sessions</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-700" />

                  <div
                    onClick={handleThemeToggle}
                    className="relative flex cursor-pointer select-none items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-gray-50 dark:focus:bg-gray-700 rounded-none"
                    role="menuitem"
                  >
                    {theme === 'light' ? (
                      <>
                        <Moon className="h-4 w-4" style={{color: "#3396D3"}} />
                        <span className="text-sm">Dark mode</span>
                      </>
                    ) : (
                      <>
                        <Sun className="h-4 w-4" style={{color: "#3396D3"}} />
                        <span className="text-sm">Light mode</span>
                      </>
                    )}
                  </div>
                </div>

                <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-700" />

                {/* Plan Section */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        {subscriptionData?.subscription?.plan?.displayName || 'Basic Plan'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        12,000 views
                      </p>
                    </div>
                    <div className="relative">
                      <Button 
                        onClick={() => setLocation('/subscribe')}
                        size="sm" 
                        className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 hover:from-violet-500 hover:via-purple-500 hover:to-blue-500 text-white px-3 py-1.5 text-xs font-semibold rounded-md shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 group"
                      >
                        <span className="relative z-10 flex items-center gap-1">
                          <span className="text-white">
                            ✦ Upgrade
                          </span>
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </Button>
                      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full animate-pulse" />
                    </div>
                  </div>
                </div>

                <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-700" />

                {/* Logout */}
                <div className="py-2">
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-gray-50 dark:focus:bg-gray-700 rounded-none"
                  >
                    <LogOut className="h-4 w-4" style={{color: "#3396D3"}} />
                    <span className="text-sm">Logout</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
