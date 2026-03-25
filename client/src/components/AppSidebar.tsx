import { Link, useLocation } from "wouter";
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Gift,
  User,
  LogOut,
  Activity,
  Users,
  Building2,
  Store,
  Mail,
  UserCheck,
  BarChart3,
  Newspaper,
  Settings,
  ClipboardList,
  X,
  Megaphone,
  Bell,
  FileText,
  FileQuestion,
  Target,
  Sparkles,
  Zap,
  Crown,
  ChevronRight,
  Tv2,
  HelpCircle,
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  useReduxAuth,
  useReduxLogout,
} from "@/hooks/useReduxAuth";
import { useTenantPlan } from "@/hooks/useTenantPlan";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Extended user type to include custom fields
interface ExtendedUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  theme?: string;
  menuExpanded?: boolean;
  tenantId?: string;
  avatarUrl?: string | null;
}

const getNavigation = (userRole?: string, t?: any, canManageUsers?: boolean, maxShops?: number | null) => {
  const baseNavigation: any[] = [
    { name: t?.('navigation.dashboard') || "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: t?.('navigation.newsletter') || "Newsletter", href: "/newsletter", icon: Newspaper },
    { name: t?.('navigation.advertise') || "Advertise", href: "/advertise", icon: Tv2 },
    { name: t?.('navigation.promotions') || "Promotions", href: "/promotions", icon: Megaphone },
    {
      name: t?.('navigation.forms') || "Forms", href: "/forms", icon: ClipboardList, children: [
        { name: t?.('navigation.intakeForms') || "Intake Forms", href: "/forms", icon: ClipboardList },
        { name: t?.('navigation.surveyForms') || "Survey Forms", href: "/forms", icon: FileQuestion },
      ]
    },
    { name: t?.('navigation.templates') || "Templates", href: "/templates", icon: FileText },

    { name: t?.('navigation.cards') || "e-Cards", href: "/cards", icon: Gift },
    { name: t?.('navigation.reminders') || "Appointments", href: "/reminders", icon: Bell },
    { name: t?.('navigation.contacts') || "Contacts", href: "/email-contacts", icon: UserCheck },
    { name: t?.('navigation.segmentation') || "Segmentation", href: "/segmentation", icon: Target },
    { name: t?.('navigation.analytics') || "Analytics", href: "/analytics", icon: BarChart3 },
  ];

  const managementChildren: any[] = [];

  // Add Shops under Management only if plan allows shops (maxShops > 0)
  // maxShops is null while loading — show nav item by default until plan data confirms otherwise
  if (maxShops === undefined || maxShops === null || maxShops > 0) {
    managementChildren.push({ name: t?.('navigation.shops') || "Shops", href: "/shops", icon: Store });
  }

  // Add Users under Management only if plan allows user management AND role permits it
  if (canManageUsers && (userRole === "Owner" || userRole === "Administrator" || userRole === "Manager")) {
    managementChildren.push({ name: t?.('navigation.users') || "Users", href: "/users", icon: Users });
  }

  baseNavigation.push({ name: t?.('navigation.management') || "Management", href: "/management", icon: Settings, children: managementChildren });

  return baseNavigation;
};

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useReduxAuth();
  const { logout } = useReduxLogout();
  const { t } = useTranslation();

  // Cast user to extended type to access custom fields
  const extendedUser = user as ExtendedUser | null;

  // Fetch tenant plan data for all users
  const { planName, canManageUsers, maxShops } = useTenantPlan();

  const navigation = getNavigation(extendedUser?.role, t, canManageUsers, maxShops);
  const { state, isMobile, setOpenMobile, setOpen } = useSidebar();

  const handleLogout = async () => {
    await logout();
    // Hard redirect to fully reset all React state — prevents stale user data in components
    window.location.href = "/auth";
  };


  const handleMobileNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  if (!extendedUser) {
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
              <span className="text-sidebar-foreground/60 text-sm font-bold">
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
              {navigation.map((item: any) => {
                const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                const isActive = hasChildren
                  ? item.children.some((c: any) => location === c.href) || location === item.href
                  : location === item.href || (item.href === "/dashboard" && location === "/");
                const Icon = item.icon;

                if (hasChildren) {
                  // When collapsed, navigate to parent href; when expanded, toggle submenu
                  if (isCollapsed) {
                    return (
                      <SidebarMenuItem key={item.name} className="w-full flex justify-center group-data-[collapsible=icon]:justify-center">
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            "w-full justify-start group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!px-0",
                            isMobile ? "px-4 py-3 mx-2 rounded-lg" : "px-3 py-2.5"
                          )}
                          tooltip={item.name}
                        >
                          <Link href={item.href} className="flex items-center gap-3 w-full group-data-[collapsible=icon]:justify-center" onClick={handleMobileNavClick}>
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            <span className="group-data-[collapsible=icon]:hidden font-medium">{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <Collapsible key={item.name} asChild defaultOpen={isActive} className="group/collapsible">
                      <SidebarMenuItem className="w-full flex flex-col">
                        <div className="flex items-center">
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={cn(
                              "flex-1 justify-start",
                              isMobile ? "px-4 py-3 mx-2 rounded-lg" : "px-3 py-2.5"
                            )}
                            tooltip={item.name}
                          >
                            <Link href={item.href} className="flex items-center gap-3" onClick={handleMobileNavClick}>
                              <Icon className="h-5 w-5 flex-shrink-0" />
                              <span className="font-medium">{item.name}</span>
                            </Link>
                          </SidebarMenuButton>
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "p-1.5 rounded-md hover:bg-sidebar-accent transition-colors",
                                isMobile ? "mr-2" : "mr-1"
                              )}
                              aria-label={`Toggle ${item.name} submenu`}
                            >
                              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </button>
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.children.map((child: any) => {
                              const ChildIcon = child.icon;
                              const childActive = location === child.href;
                              return (
                                <SidebarMenuSubItem key={child.name}>
                                  <SidebarMenuSubButton asChild isActive={childActive}>
                                    <Link href={child.href} className="flex items-center gap-2" onClick={handleMobileNavClick}>
                                      {ChildIcon && <ChildIcon className="h-4 w-4" />}
                                      <span>{child.name}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={item.name} className="w-full flex justify-center group-data-[collapsible=icon]:justify-center">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "w-full justify-start group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!px-0",
                        isMobile ? "px-4 py-3 mx-2 rounded-lg" : "px-3 py-2.5"
                      )}
                      tooltip={item.name}
                    >
                      <Link href={item.href} className="flex items-center gap-3 w-full group-data-[collapsible=icon]:justify-center" onClick={handleMobileNavClick}>
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden font-medium">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User menu - Bottom of navigation */}
        <SidebarGroup className="mt-auto pt-2 border-t border-sidebar-border">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="flex justify-center group-data-[collapsible=icon]:justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!px-0"
                      tooltip={t('userMenu.tooltip') || "User Menu"}
                    >
                      <CustomAvatar
                        user={extendedUser}
                        size="sm"
                        className="w-8 h-8 flex-shrink-0"
                      />
                      <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                        <span className="truncate font-semibold">
                          {extendedUser.firstName || extendedUser.name} {extendedUser.lastName || ''}
                        </span>
                        <span className="truncate text-xs">
                          {extendedUser.email}
                        </span>
                      </div>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="end"
                className="w-64 rounded-2xl p-1"
                sideOffset={8}
              >
                {/* User Profile Header */}
                <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
                  <CustomAvatar
                    user={extendedUser}
                    size="sm"
                    className="w-10 h-10 ring-2 ring-gray-100 dark:ring-gray-700"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      {extendedUser.firstName || extendedUser.name} {extendedUser.lastName || ''}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {planName}
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
                    className="cursor-pointer flex items-center gap-3 px-4 py-2.5"
                  >
                    <User className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                    <span className="text-sm">{t('userMenu.profile') || "Profile"}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setLocation('/company');
                      handleMobileNavClick();
                    }}
                    className="cursor-pointer flex items-center gap-3 px-4 py-2.5"
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                    <span className="text-sm">{t('userMenu.company') || "Company"}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setLocation('/sessions');
                      handleMobileNavClick();
                    }}
                    className="cursor-pointer flex items-center gap-3 px-4 py-2.5"
                  >
                    <Activity className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                    <span className="text-sm">{t('userMenu.sessions') || "Sessions"}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link href="/legal-agreements" className="flex items-center gap-3 px-4 py-2.5 cursor-pointer w-full" onClick={handleMobileNavClick}>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('navigation.help') || "Help"}</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-700" />

                </div>

                {planName?.toLowerCase().includes('free') && (
                  <>
                    <DropdownMenuSeparator />

                    {/* Plan Section - Enhanced Upgrade */}
                    <div className="mx-3 my-2 rounded-xl overflow-hidden relative group/upgrade">
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 opacity-95" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
                      <div className="absolute top-1 right-2 opacity-10 group-hover/upgrade:opacity-20 transition-opacity duration-500">
                        <Crown className="h-12 w-12 text-yellow-300" />
                      </div>

                      <div className="relative px-4 py-3.5 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/15 backdrop-blur-sm">
                            <Zap className="h-3.5 w-3.5 text-yellow-300" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white/90 tracking-wide uppercase">
                              {planName}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] text-white/70">
                              12,000 / 50,000 views
                            </p>
                            <p className="text-[11px] text-white/50">24%</p>
                          </div>
                          <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 rounded-full transition-all duration-1000 ease-out"
                              style={{ width: '24%' }}
                            />
                          </div>
                        </div>

                        <Button
                          onClick={() => setLocation('/profile?tab=subscription')}
                          size="sm"
                          data-testid="button-upgrade-plan"
                          className="w-full relative overflow-hidden bg-white hover:bg-gray-50 text-indigo-700 font-bold text-xs py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] group/btn"
                        >
                          <span className="relative z-10 flex items-center justify-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-600 group-hover/btn:animate-spin" />
                            <span>{t('userMenu.upgradeToPro') || "Upgrade to Pro"}</span>
                          </span>
                        </Button>

                        <p className="text-[10px] text-center text-white/50">
                          {t('userMenu.unlockPremium') || "Unlock unlimited views & premium features"}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <DropdownMenuSeparator />

                {/* Logout */}
                <div className="py-2">
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer flex items-center gap-3 px-4 py-2.5"
                  >
                    <LogOut className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                    <span className="text-sm">{t('userMenu.logout') || "Logout"}</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

    </Sidebar>
  );
}
