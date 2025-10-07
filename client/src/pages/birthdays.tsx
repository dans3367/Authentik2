"use client"

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSession } from "@/lib/betterAuthClient";
import {
  Gift,
  Users,
  Mail,
  Settings,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  BarChart3,
  Search,
  UserPlus,
  CakeIcon,
  MoreVertical,
  Download,
  Upload,
  Palette,
  Save
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CardDesignerDialog } from "@/components/CardDesignerDialog";
import { PromotionSelector } from "@/components/PromotionSelector";

interface BirthdaySettings {
  id: string;
  enabled: boolean;
  emailTemplate: string;
  segmentFilter: string;
  customMessage: string;
  customThemeData?: string | null;
  senderName: string;
  promotionId?: string | null;
  splitPromotionalEmail?: boolean;
  promotion?: {
    id: string;
    title: string;
    description: string;
    content: string;
    type: string;
  } | null;
  created_at: string;
  updated_at: string;
}

interface CustomThemeData {
  title: string;
  message: string;
  signature: string;
  imageUrl?: string | null;
  customImage: boolean;
  imagePosition: { x: number; y: number };
  imageScale: number;
}



interface ContactTag {
  id: string;
  name: string;
  color: string;
}

interface EmailList {
  id: string;
  name: string;
  description?: string | null;
}

interface Contact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: "active" | "unsubscribed" | "bounced" | "pending";
  tags: ContactTag[];
  lists: EmailList[];
  addedDate: Date;
  lastActivity?: Date | null;
  emailsSent: number;
  emailsOpened: number;
  birthday?: string | null; // Optional birthday field
  birthdayEmailEnabled?: boolean; // Optional birthday email preference
  birthdayUnsubscribedAt?: Date | null; // Timestamp when unsubscribed from birthday emails
  birthdayUnsubscribeReason?: string | null; // Reason for unsubscribing from birthday emails
}

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: "Owner" | "Administrator" | "Manager" | "Employee";
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  tenantId: string;
  createdAt: string;
  lastLogin?: string | null;
}

export default function BirthdaysPage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { t, currentLanguage } = useLanguage();
  const { user: currentUser } = useAuth();

  // Use Better Auth session to get external token
  const { data: session } = useSession();

  // Query to get external service token when authenticated
  const { data: tokenData, isLoading: tokenLoading, error: tokenError, refetch: refetchToken } = useQuery({
    queryKey: ['/api/external-token', session?.user?.id],
    queryFn: async () => {
      console.log('🔑 [Token] Requesting external token for user:', session?.user?.email);
      const response = await apiRequest('POST', '/api/external-token');
      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }
      const data = await response.json();
      console.log('✅ [Token] External token received, length:', data.token?.length);
      return data;
    },
    enabled: !!session?.user,
    staleTime: 10 * 60 * 1000, // Token cached for 10 minutes (5 min buffer before 15 min expiry)
    gcTime: 15 * 60 * 1000, // Garbage collect after 15 minutes
    retry: 3,
    refetchOnWindowFocus: true, // Refetch on window focus to refresh expired tokens
    refetchOnReconnect: true, // Refetch when reconnecting
  });

  const accessToken = tokenData?.token;

  // Initialize activeTab based on URL parameter or default to "themes"
  const [activeTab, setActiveTab] = useState<"themes" | "settings" | "customers" | "test" | "promotions">(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab && ['themes', 'settings', 'customers', 'test', 'promotions'].includes(tab)) {
      return tab as "themes" | "settings" | "customers" | "test" | "promotions";
    }
    return "themes";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [birthdayModalOpen, setBirthdayModalOpen] = useState(false);
  const [birthdayDraft, setBirthdayDraft] = useState<Date | undefined>(undefined);
  const [birthdayContactId, setBirthdayContactId] = useState<string | null>(null);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [designerThemeId, setDesignerThemeId] = useState<string | null>(null);

  // State for real-time custom theme preview
  const [customThemePreview, setCustomThemePreview] = useState<CustomThemeData | null>(null);

  // State for real-time preview of all themes (including default themes with customizations)
  const [themePreviewData, setThemePreviewData] = useState<{ [key: string]: CustomThemeData }>({});

  // State for promotion selection
  const [selectedPromotions, setSelectedPromotions] = useState<string[]>([]);
  const [splitPromotionalEmail, setSplitPromotionalEmail] = useState<boolean>(false);

  // Customer modal state
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Contact | null>(null);

  // Reset modal state when location changes (prevents frozen modal on navigation back)
  useEffect(() => {
    setCustomerModalOpen(false);
    setSelectedCustomer(null);
  }, [location]);

  // Handle browser back/forward button navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      if (tab && ['themes', 'settings', 'customers', 'test', 'promotions'].includes(tab)) {
        setActiveTab(tab as "themes" | "settings" | "customers" | "test" | "promotions");
      } else {
        setActiveTab("themes");
      }
      // Reset modal state on browser navigation
      setCustomerModalOpen(false);
      setSelectedCustomer(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update URL when tab changes (for proper browser history)
  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const currentTab = currentUrl.searchParams.get('tab');

    if (currentTab !== activeTab) {
      currentUrl.searchParams.set('tab', activeTab);
      window.history.replaceState(null, '', currentUrl.toString());
    }
  }, [activeTab]);

  // Handler to navigate to add customer page
  const handleAddCustomer = () => {
    setLocation('/email-contacts/new');
  };

  // Handler to open customer modal
  const handleCustomerClick = (customer: Contact) => {
    setSelectedCustomer(customer);
    setCustomerModalOpen(true);
  };

  // Fetch birthday settings
  const {
    data: birthdaySettings,
    isLoading: settingsLoading,
    refetch: refetchSettings
  } = useQuery<BirthdaySettings>({
    queryKey: ['/api/birthday-settings'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/birthday-settings');
        if (!response.ok) throw new Error('Failed to fetch settings');
        const data = await response.json();
        console.log('📥 [Birthday Settings] Fetched settings:', data);
        return data || {
          id: '',
          enabled: false,
          emailTemplate: 'default',
          segmentFilter: 'all',
          customMessage: '',
          senderName: 'Birthday Team',
          promotionId: null,
          promotion: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      } catch (error) {
        // Return default values if API is not available yet
        return {
          id: '',
          enabled: false,
          emailTemplate: 'default',
          segmentFilter: 'all',
          customMessage: '',
          senderName: 'Birthday Team',
          promotionId: null,
          promotion: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
    },
  });



  // Fetch contacts from the existing email-contacts endpoint
  const {
    data: contactsData,
    isLoading: contactsLoading,
    refetch: refetchContacts
  } = useQuery({
    queryKey: ['/api/email-contacts', searchQuery, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await apiRequest('GET', `/api/email-contacts?${params.toString()}`);
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    refetchOnWindowFocus: false,
  });

  // Extract contacts array from response data
  const contacts: Contact[] = contactsData?.contacts || [];

  // Filter contacts who have birthdays for birthday-specific features
  const customersWithBirthdays = contacts.filter(contact => contact.birthday);

  // Fetch users from the tenant
  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers
  } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users');
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    refetchOnWindowFocus: false,
  });

  // Extract users array from response data
  const users: User[] = usersData?.users || [];

  // Update birthday settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<BirthdaySettings>) => {
      console.log('📤 [Birthday Settings] Sending update:', settings);
      const response = await fetch('/api/birthday-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const result = await response.json();
      console.log('📥 [Birthday Settings] Server returned:', result);
      return result;
    },
    onSuccess: (updatedSettings) => {
      console.log('✅ [Birthday Settings] Update success, updating cache with:', updatedSettings);
      console.log('📌 [Birthday Settings] New emailTemplate should be:', updatedSettings?.emailTemplate);
      
      toast({
        title: "Success",
        description: "Birthday settings updated successfully",
      });
      
      // Update the query cache immediately with the server response (now returns settings directly)
      queryClient.setQueryData(['/api/birthday-settings'], updatedSettings);
      console.log('💾 [Birthday Settings] Cache updated');
      
      // Force a re-render by invalidating the query
      queryClient.invalidateQueries({ queryKey: ['/api/birthday-settings'] });
      console.log('🔄 [Birthday Settings] Query invalidated, will refetch');
    },
    onError: (error: any) => {
      console.error('🎨 [Birthday Cards] Update settings error:', error);

      // Try to extract error message from response
      let errorMessage = "Failed to update birthday settings";
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Toggle customer birthday email enabled status
  const toggleBirthdayEmailMutation = useMutation({
    mutationFn: async ({ contactId, enabled }: { contactId: string; enabled: boolean }) => {
      return apiRequest('PATCH', `/api/email-contacts/${contactId}/birthday-email`, {
        enabled,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Birthday email preference updated",
      });
      refetchContacts();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update preference",
        variant: "destructive",
      });
    },
  });

  // Bulk update birthday email preferences
  // Send birthday card mutation
  const sendBirthdayCardMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const response = await apiRequest('POST', '/api/email-contacts/send-birthday-card', { contactIds });
      return response.json();
    },
    onSuccess: (data, contactIds) => {
      setSelectedContacts([]);
      const summary = data.summary || { successful: 0, failed: 0, total: contactIds.length };
      toast({
        title: t('birthdays.cardsSent') || "Birthday Cards Sent",
        description: `Successfully sent ${summary.successful} of ${summary.total} birthday cards${summary.failed > 0 ? ` (${summary.failed} failed)` : ''}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error') || "Error",
        description: error.message || "Failed to send birthday cards",
        variant: "destructive",
      });
    },
  });

  // Handle send birthday card
  const handleSendBirthdayCard = () => {
    if (selectedContacts.length === 0) return;

    const confirmMessage = selectedContacts.length === 1
      ? 'Are you sure you want to send a birthday card to this customer?'
      : `Are you sure you want to send birthday cards to ${selectedContacts.length} customers?`;

    if (window.confirm(confirmMessage)) {
      sendBirthdayCardMutation.mutate(selectedContacts);
    }
  };

  const bulkUpdateBirthdayEmailMutation = useMutation({
    mutationFn: async ({ contactIds, enabled }: { contactIds: string[]; enabled: boolean }) => {
      return apiRequest('PATCH', `/api/email-contacts/birthday-email/bulk`, {
        contactIds,
        enabled,
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: `Birthday email preferences updated for ${variables.contactIds.length} customer(s)`,
      });
      refetchContacts();
      setSelectedContacts([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update preferences",
        variant: "destructive",
      });
    },
  });

  // Initialize selected promotions when birthday settings are loaded
  useEffect(() => {
    if (birthdaySettings?.promotion) {
      setSelectedPromotions([birthdaySettings.promotion.id]);
    } else {
      setSelectedPromotions([]);
    }
    setSplitPromotionalEmail(birthdaySettings?.splitPromotionalEmail || false);
  }, [birthdaySettings?.promotion, birthdaySettings?.splitPromotionalEmail]);

  // Memoized initial data for CardDesignerDialog to prevent re-render loops
  const cardDesignerInitialData = useMemo(() => {
    // Load persistent draft first
    try {
      const raw = localStorage.getItem('birthdayCardDesignerDraft');
      if (raw) return JSON.parse(raw);
    } catch { }

    // Parse existing customThemeData and load theme-specific data
    if (birthdaySettings?.customThemeData) {
      try {
        const parsed = JSON.parse(birthdaySettings.customThemeData);
        const currentThemeId = designerThemeId || 'default';

        let themeSpecificData = null;

        // Check if it's the new structure (has themes property)
        if (parsed.themes && parsed.themes[currentThemeId]) {
          themeSpecificData = parsed.themes[currentThemeId];
        } else if (!parsed.themes) {
          // Old structure - assume it's for custom theme if we're loading custom
          if (currentThemeId === 'custom') {
            themeSpecificData = parsed;
          }
        }

        if (themeSpecificData) {
          return {
            title: themeSpecificData.title || '',
            message: themeSpecificData.message || birthdaySettings?.customMessage || '',
            signature: themeSpecificData.signature || '',
            imageUrl: themeSpecificData.imageUrl || null,
            customImage: Boolean(themeSpecificData.customImage && themeSpecificData.imageUrl),
            imagePosition: themeSpecificData.imagePosition || { x: 0, y: 0 },
            imageScale: themeSpecificData.imageScale || 1,
          };
        }
      } catch {
        // Fall through to default if parsing fails
      }
    }

    // Default data if no theme-specific customizations found
    return {
      title: '',
      message: birthdaySettings?.customMessage || '',
      signature: '',
      imageUrl: null, // Let CardDesignerDialog load the default theme image
      customImage: false, // This is key - tells the dialog it's NOT a custom image
      imagePosition: { x: 0, y: 0 },
      imageScale: 1,
    };
  }, [birthdaySettings?.customThemeData, birthdaySettings?.customMessage, designerThemeId]);

  const handleSettingsUpdate = (field: keyof BirthdaySettings, value: any) => {
    if (birthdaySettings) {
      updateSettingsMutation.mutate({
        ...birthdaySettings,
        [field]: value,
      });
    }
  };

  const handleToggleGlobalEnabled = () => {
    if (birthdaySettings) {
      handleSettingsUpdate('enabled', !birthdaySettings.enabled);
    }
  };

  // Handler for promotion selection changes
  const handlePromotionsChange = (promotionIds: string[]) => {
    setSelectedPromotions(promotionIds);
    if (birthdaySettings) {
      const promotionId = promotionIds.length > 0 ? promotionIds[0] : null;
      updateSettingsMutation.mutate({
        id: birthdaySettings.id,
        enabled: birthdaySettings.enabled,
        emailTemplate: birthdaySettings.emailTemplate || 'default',
        segmentFilter: birthdaySettings.segmentFilter || 'all',
        customMessage: birthdaySettings.customMessage || '',
        senderName: birthdaySettings.senderName || '',
        customThemeData: birthdaySettings.customThemeData,
        promotionId: promotionId,
        splitPromotionalEmail: splitPromotionalEmail,
      });
    }
  };

  const handleToggleBirthdayEmail = (contactId: string, currentEnabled: boolean) => {
    toggleBirthdayEmailMutation.mutate({
      contactId,
      enabled: !currentEnabled,
    });
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedContacts(contacts.map(contact => contact.id));
    } else {
      setSelectedContacts([]);
    }
  };

  const handleSelectContact = (contactId: string, checked: boolean) => {
    if (checked) {
      setSelectedContacts(prev => [...prev, contactId]);
    } else {
      setSelectedContacts(prev => prev.filter(id => id !== contactId));
    }
  };

  const handleBulkEnableBirthdayEmail = () => {
    const contactsWithBirthdays = selectedContacts.filter(contactId => {
      const contact = contacts.find(c => c.id === contactId);
      return contact && contact.birthday;
    });

    if (contactsWithBirthdays.length === 0) {
      toast({
        title: t('birthdays.toasts.noActionNeeded'),
        description: t('birthdays.toasts.noBirthdaysSelected'),
        variant: "default",
      });
      return;
    }

    bulkUpdateBirthdayEmailMutation.mutate({
      contactIds: contactsWithBirthdays,
      enabled: true,
    });
  };

  const handleBulkDisableBirthdayEmail = () => {
    const contactsWithBirthdays = selectedContacts.filter(contactId => {
      const contact = contacts.find(c => c.id === contactId);
      return contact && contact.birthday;
    });

    if (contactsWithBirthdays.length === 0) {
      toast({
        title: t('birthdays.toasts.noActionNeeded'),
        description: t('birthdays.toasts.noBirthdaysSelected'),
        variant: "default",
      });
      return;
    }

    bulkUpdateBirthdayEmailMutation.mutate({
      contactIds: contactsWithBirthdays,
      enabled: false,
    });
  };

  // Mutation: update a contact's birthday
  const updateContactBirthdayMutation = useMutation({
    mutationFn: async ({ contactId, birthday }: { contactId: string; birthday: string }) => {
      return apiRequest('PUT', `/api/email-contacts/${contactId}`, { birthday });
    },
    onSuccess: () => {
      toast({ title: t('birthdays.toasts.birthdayUpdated') });
      setBirthdayModalOpen(false);
      setBirthdayDraft(undefined);
      setBirthdayContactId(null);
      refetchContacts();
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error?.message || t('birthdays.toasts.birthdayUpdateError'), variant: "destructive" });
    },
  });

  // Mutation: send birthday invitation email via workflow
  const sendInvitationMutation = useMutation({
    mutationFn: async (contactId: string) => {
      // Find the contact to get additional details
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) {
        throw new Error('Contact not found');
      }

      // Check if we have a valid token, if not try to refresh it
      let currentToken = accessToken;

      if (!currentToken) {
        console.log('🔄 [Birthday Invitation] No token available, attempting to refresh...');
        try {
          const refreshedTokenData = await refetchToken();
          currentToken = refreshedTokenData.data?.token;

          if (!currentToken) {
            if (tokenLoading) {
              throw new Error('Authentication token is still loading. Please wait a moment and try again.');
            }
            if (tokenError) {
              throw new Error(`Authentication failed: ${tokenError.message}`);
            }
            throw new Error('No authentication token available. Please make sure you are logged in.');
          }

          console.log('✅ [Birthday Invitation] Token refreshed successfully');
        } catch (refreshError) {
          console.error('❌ [Birthday Invitation] Token refresh failed:', refreshError);
          throw new Error('Failed to refresh authentication token. Please try again.');
        }
      }

      // Call the direct API endpoint (no longer requires temporal server)
      const response = await apiRequest('POST', `/api/birthday-invitation/${contactId}`);

      if (!response.ok) {
        // If it's an authentication error, try to refresh the token and retry once
        if (response.status === 401) {
          console.log('🔄 [Birthday Invitation] Token appears to be expired, attempting refresh and retry...');

          try {
            const refreshedTokenData = await refetchToken();
            const newToken = refreshedTokenData.data?.token;

            if (newToken && newToken !== currentToken) {
              console.log('✅ [Birthday Invitation] Token refreshed, retrying request...');

              const retryResponse = await apiRequest('POST', `/api/birthday-invitation/${contactId}`);

              if (retryResponse.ok) {
                const retryResponseData = await retryResponse.json();
                console.log('✅ [Birthday Invitation] Retry successful:', retryResponseData);
                return retryResponseData;
              }
            }
          } catch (retryError) {
            console.error('❌ [Birthday Invitation] Token refresh retry failed:', retryError);
          }
        }

        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send birthday invitation');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('birthdays.toasts.invitationSent') });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error?.message || t('birthdays.toasts.invitationError'), variant: "destructive" });
    },
  });

  // Mutation: send test birthday card to users
  const sendTestBirthdayMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Check if we have a valid token, if not try to refresh it
      let currentToken = accessToken;

      if (!currentToken) {
        console.log('🔄 [Birthday Test] No token available, attempting to refresh...');
        try {
          const refreshedTokenData = await refetchToken();
          currentToken = refreshedTokenData.data?.token;

          if (!currentToken) {
            if (tokenLoading) {
              throw new Error('Authentication token is still loading. Please wait a moment and try again.');
            }
            if (tokenError) {
              throw new Error(`Authentication failed: ${tokenError.message}`);
            }
            throw new Error('No authentication token available. Please make sure you are logged in.');
          }

          console.log('✅ [Birthday Test] Token refreshed successfully');
        } catch (refreshError) {
          console.error('❌ [Birthday Test] Token refresh failed:', refreshError);
          throw new Error('Failed to refresh authentication token. Please try again.');
        }
      }

      // Find the user to get additional details
      const user = users.find(u => u.id === userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Call the cardprocessor API directly for test birthday cards
      const cardprocessorUrl = import.meta.env.VITE_CARDPROCESSOR_URL || 'http://localhost:5004';

      // Prepare request payload
      const requestPayload = {
        userEmail: user.email,
        userFirstName: user.firstName,
        userLastName: user.lastName,
        emailTemplate: birthdaySettings?.emailTemplate || 'default',
        customMessage: birthdaySettings?.customMessage || '',
        customThemeData: birthdaySettings?.customThemeData || null,
        senderName: birthdaySettings?.senderName || '',
        promotionId: birthdaySettings?.promotionId || null,
        splitPromotionalEmail: splitPromotionalEmail
      };

      console.log('🎂 [Birthday Test] Starting test birthday card request:', {
        url: `${cardprocessorUrl}/api/birthday-test`,
        userId: userId,
        userEmail: user.email,
        userFirstName: user.firstName,
        userLastName: user.lastName,
        accessTokenLength: currentToken?.length,
        accessTokenPreview: currentToken ? `${currentToken.substring(0, 20)}...` : 'null',
        birthdaySettings: {
          emailTemplate: birthdaySettings?.emailTemplate,
          customMessage: birthdaySettings?.customMessage,
          customThemeData: birthdaySettings?.customThemeData,
          senderName: birthdaySettings?.senderName
        },
        requestPayload: requestPayload
      });

      const response = await fetch(`${cardprocessorUrl}/api/birthday-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
        body: JSON.stringify(requestPayload),
      });

      console.log('🎂 [Birthday Test] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('🎂 [Birthday Test] Failed to parse error response:', parseError);
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }

        // If it's an authentication error, try to refresh the token and retry once
        if (response.status === 401 && errorData.error?.includes('Invalid token')) {
          console.log('🔄 [Birthday Test] Token appears to be expired, attempting refresh and retry...');

          try {
            const refreshedTokenData = await refetchToken();
            const newToken = refreshedTokenData.data?.token;

            if (newToken && newToken !== currentToken) {
              console.log('✅ [Birthday Test] Token refreshed, retrying request...');

              const retryResponse = await fetch(`${cardprocessorUrl}/api/birthday-test`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${newToken}`,
                },
                body: JSON.stringify(requestPayload),
              });

              if (retryResponse.ok) {
                const retryResponseData = await retryResponse.json();
                console.log('✅ [Birthday Test] Retry successful:', retryResponseData);
                return retryResponseData;
              }
            }
          } catch (retryError) {
            console.error('❌ [Birthday Test] Token refresh retry failed:', retryError);
          }
        }

        console.error('🎂 [Birthday Test] Request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          requestPayload: requestPayload,
          url: `${cardprocessorUrl}/api/birthday-test`
        });

        throw new Error(errorData.error || `Failed to send test birthday card (${response.status})`);
      }

      const responseData = await response.json();
      console.log('🎂 [Birthday Test] Success response:', {
        responseData: responseData,
        requestPayload: requestPayload
      });

      return responseData;
    },
    onSuccess: () => {
      toast({ title: "Test Birthday Card Sent", description: "Test birthday card has been sent successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to send test birthday card", variant: "destructive" });
    },
  });

  // Initialize custom theme preview from birthday settings
  useEffect(() => {
    if (birthdaySettings?.customThemeData) {
      try {
        const parsedData = JSON.parse(birthdaySettings.customThemeData);

        // Extract the custom theme data from the themes structure
        const customThemeData = parsedData.themes?.custom;

        console.log('🎨 [Birthday Cards] Initializing custom theme preview:', {
          hasParsedData: !!parsedData,
          hasThemes: !!parsedData.themes,
          hasCustomTheme: !!customThemeData,
          customImageUrl: customThemeData?.imageUrl,
          customImage: customThemeData?.customImage
        });

        if (customThemeData) {
          setCustomThemePreview(customThemeData);

          // Also initialize themePreviewData['custom'] so the preview shows immediately on load
          setThemePreviewData(prev => ({
            ...prev,
            custom: customThemeData
          }));

          // Initialize themePreviewData for all themes in the saved data
          const allThemes = parsedData.themes || {};
          setThemePreviewData(prev => ({
            ...prev,
            ...allThemes
          }));

          console.log('✅ [Birthday Cards] Custom theme preview initialized with imageUrl:', customThemeData.imageUrl);
        } else {
          setCustomThemePreview(null);
          setThemePreviewData(prev => {
            const newData = { ...prev };
            delete newData.custom;
            return newData;
          });
        }
      } catch (error) {
        console.warn('Failed to parse custom theme data:', error);
        setCustomThemePreview(null);
      }
    } else {
      setCustomThemePreview(null);
      // Clear themePreviewData['custom'] if no saved data
      setThemePreviewData(prev => {
        const newData = { ...prev };
        delete newData.custom;
        return newData;
      });
    }
  }, [birthdaySettings?.customThemeData]);

  // Callback for real-time preview updates
  const handlePreviewChange = useCallback((previewData: {
    title?: string;
    message?: string;
    signature?: string;
    imageUrl?: string | null;
    customImage?: boolean;
    imagePosition?: { x: number; y: number };
    imageScale?: number;
  }) => {
    // Update real-time preview as user makes changes
    try {
      if (!previewData || !designerThemeId) return;

      const previewThemeData: CustomThemeData = {
        title: previewData.title || '',
        message: previewData.message || '',
        signature: previewData.signature || '',
        imageUrl: previewData.imageUrl || null,
        customImage: previewData.customImage || false,
        imagePosition: previewData.imagePosition || { x: 0, y: 0 },
        imageScale: previewData.imageScale || 1,
      };

      // Update preview data for the current theme being edited
      setThemePreviewData(prev => ({
        ...prev,
        [designerThemeId]: previewThemeData
      }));

      // Also update customThemePreview for backward compatibility
      if (designerThemeId === 'custom') {
        setCustomThemePreview(previewThemeData);
      }
    } catch (error) {
      console.warn('Error in onPreviewChange:', error);
    }
  }, [designerThemeId]);

  const openBirthdayModal = (contactId: string) => {
    setBirthdayContactId(contactId);

    // Pre-populate the calendar with existing birthday if available
    const contact = contacts.find(c => c.id === contactId);
    if (contact && contact.birthday) {
      // Parse the date string as a local date (not UTC) to avoid timezone shifts
      // Format: YYYY-MM-DD
      const [year, month, day] = contact.birthday.split('-').map(Number);
      setBirthdayDraft(new Date(year, month - 1, day));
    } else {
      setBirthdayDraft(undefined);
    }

    setBirthdayModalOpen(true);
  };

  const saveBirthday = () => {
    if (!birthdayContactId || !birthdayDraft) return;
    // Format the date in local timezone to avoid timezone shifts
    const y = birthdayDraft.getFullYear();
    const m = `${birthdayDraft.getMonth() + 1}`.padStart(2, '0');
    const d = `${birthdayDraft.getDate()}`.padStart(2, '0');
    updateContactBirthdayMutation.mutate({ contactId: birthdayContactId, birthday: `${y}-${m}-${d}` });
  };

  const handleSendBirthdayInvitation = (contactId: string) => {
    sendInvitationMutation.mutate(contactId);
  };

  const handleBulkRequestBirthdays = () => {
    if (selectedContacts.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select customers without birthdays first",
        variant: "destructive",
      });
      return;
    }

    // Filter to only send invites to contacts without birthdays
    const contactsWithoutBirthdays = selectedContacts.filter(id => {
      const contact = contacts.find(c => c.id === id);
      return contact && !contact.birthday;
    });

    if (contactsWithoutBirthdays.length === 0) {
      toast({
        title: "No Eligible Customers",
        description: "All selected customers already have birthdays set",
        variant: "destructive",
      });
      return;
    }

    const confirmMessage = contactsWithoutBirthdays.length === 1
      ? 'Are you sure you want to send a birthday request email to 1 customer?'
      : `Are you sure you want to send birthday request emails to ${contactsWithoutBirthdays.length} customers?`;

    if (window.confirm(confirmMessage)) {
      // Send invitations sequentially
      contactsWithoutBirthdays.forEach(contactId => {
        handleSendBirthdayInvitation(contactId);
      });
      setSelectedContacts([]);
    }
  };

  const handleSendTestBirthdayCard = (userId: string) => {
    sendTestBirthdayMutation.mutate(userId);
  };

  // User selection handlers
  const handleSelectAllUsers = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(users.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };


  const upcomingBirthdays = customersWithBirthdays.filter(contact => {
    if (!contact.birthday) return false;
    // Parse date as local to avoid timezone shifts
    const [year, month, day] = contact.birthday.split('-').map(Number);
    const birthday = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    const daysUntilBirthday = Math.ceil((birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilBirthday >= 0 && daysUntilBirthday <= 30;
  }).slice(0, 5);

  const getContactName = (contact: Contact) => {
    if (contact.firstName && contact.lastName) {
      return `${contact.firstName} ${contact.lastName}`;
    } else if (contact.firstName) {
      return contact.firstName;
    } else if (contact.lastName) {
      return contact.lastName;
    }
    return contact.email;
  };

  const getUserName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user.firstName) {
      return user.firstName;
    } else if (user.lastName) {
      return user.lastName;
    }
    return user.email;
  };

  const getStatusColor = (status: Contact['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'unsubscribed': return 'bg-gray-100 text-gray-800';
      case 'bounced': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Check if all contacts are selected
  const isAllSelected = contacts.length > 0 && selectedContacts.length === contacts.length;

  // Check if some contacts are selected (for indeterminate state)
  const isSomeSelected = selectedContacts.length > 0 && selectedContacts.length < contacts.length;

  // Check if all users are selected
  const isAllUsersSelected = users.length > 0 && selectedUsers.length === users.length;

  // Check if some users are selected (for indeterminate state)
  const isSomeUsersSelected = selectedUsers.length > 0 && selectedUsers.length < users.length;

  if (settingsLoading) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div key={currentLanguage} className="min-h-screen overflow-x-hidden">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Greeting Header Card */}
        <Card className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
              <div className="space-y-4 sm:space-y-6 lg:space-y-8 pr-0 sm:pr-4 lg:pr-6 xl:pr-12 lg:col-span-8">
                <div className="birthday-header space-y-2 sm:space-y-3">
                  <div className="flex items-baseline gap-2 sm:gap-4 flex-wrap">
                    <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl">🎉</span>
                    <h1
                      tabIndex={-1}
                      className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight break-words"
                    >
                      {t('birthdays.hero.celebration')}
                    </h1>
                  </div>
                  <h1
                    tabIndex={-1}
                    className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight break-words"
                  >
                    {t('birthdays.hero.dayWith')}
                  </h1>
                  <h1
                    tabIndex={-1}
                    className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight break-words"
                  >
                    {t('birthdays.hero.ecard')}
                  </h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg leading-relaxed max-w-full">
                  {t('birthdays.hero.description')}
                </p>
              </div>
              <div className="justify-self-center lg:justify-self-end lg:col-span-4 mt-4 lg:mt-0">
                <img
                  src="/guy_present.svg"
                  alt="Person with birthday present illustration"
                  className="w-[280px] sm:w-[320px] md:w-[360px] xl:w-[420px] max-w-full h-auto"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
          <Button
            variant={activeTab === "themes" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("themes")}
            className="flex items-center gap-2"
          >
            <Palette className="h-4 w-4" />
            Themes
          </Button>
          <Button
            variant={activeTab === "settings" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("settings")}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>

          <Button
            variant={activeTab === "customers" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("customers")}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Customers
            {contacts.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {contacts.length}
              </Badge>
            )}
          </Button>
          <Button
            variant={activeTab === "promotions" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("promotions")}
            className="flex items-center gap-2"
          >
            <Gift className="h-4 w-4" />
            Promotions
          </Button>
          <Button
            variant={activeTab === "test" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("test")}
            className="flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Test
          </Button>
        </div>

        {/* Themes Tab */}
        {activeTab === "themes" && (
          <Card className="w-11/12">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Themes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label className="text-sm">Choose a Template</Label>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-2">
                  {[
                    { id: 'default', name: 'Default' },
                    { id: 'confetti', name: 'Confetti' },
                    { id: 'balloons', name: 'Balloons' },
                    { id: 'custom', name: 'Custom' },
                  ].map((tpl) => {
                    // Use the same logic as isCurrentlyActive in CardDesignerDialog
                    const currentTemplate = birthdaySettings?.emailTemplate || 'default';
                    const isSelected = currentTemplate === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          setDesignerThemeId(tpl.id);

                          // Clear localStorage draft when switching themes to prevent cross-contamination
                          try {
                            localStorage.removeItem('birthdayCardDesignerDraft');
                          } catch { }

                          // Don't clear preview data - preserve it so users can see their changes
                          // Only clear if we're switching from one theme to another different theme
                          // This preserves the preview state when reopening the same theme

                          setDesignerOpen(true);
                        }}
                        disabled={updateSettingsMutation.isPending}
                        className={`relative rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${isSelected ? 'ring-2 ring-blue-600 border-blue-600' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <div className="relative h-40 rounded-lg overflow-hidden">
                          {/* Default theme with header image */}
                          {tpl.id === 'default' && (
                            <>
                              <img
                                src="https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                                alt="Default birthday theme"
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/30" />
                            </>
                          )}

                          {/* Confetti theme with header image */}
                          {tpl.id === 'confetti' && (
                            <>
                              <img
                                src="https://images.unsplash.com/photo-1530103862676-de8c9debad1d?q=80&w=600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                                alt="Confetti birthday theme"
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/20" />
                              <span className="absolute left-3 top-3 text-2xl opacity-90">🎉</span>
                              <span className="absolute right-4 top-6 text-xl opacity-80">🎁</span>
                            </>
                          )}

                          {/* Balloons theme with header image */}
                          {tpl.id === 'balloons' && (
                            <>
                              <img
                                src="https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?q=80&w=600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                                alt="Balloons birthday theme"
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/20" />
                              <span className="absolute left-3 top-3 text-2xl opacity-90">🎈</span>
                              <span className="absolute right-4 top-6 text-xl opacity-80">🎈</span>
                            </>
                          )}

                          {/* Custom theme */}
                          {tpl.id === 'custom' && (() => {
                            // Use real-time preview state for immediate updates
                            const customData = themePreviewData['custom'] || customThemePreview;

                            console.log('🎨 [Custom Theme Preview] Rendering with data:', {
                              hasThemePreviewData: !!themePreviewData['custom'],
                              hasCustomThemePreview: !!customThemePreview,
                              customDataImageUrl: customData?.imageUrl,
                              customDataCustomImage: customData?.customImage
                            });

                            if (customData?.imageUrl) {
                              return (
                                <>
                                  <img
                                    src={customData.imageUrl}
                                    alt="Custom theme"
                                    className="absolute inset-0 h-full w-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/30" />
                                </>
                              );
                            } else {
                              return (
                                <>
                                  <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50" />
                                  <span className="absolute left-3 top-3 text-2xl opacity-70">✨</span>
                                </>
                              );
                            }
                          })()}

                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <div className="font-bold text-white drop-shadow-lg text-shadow">
                                {(() => {
                                  // Get preview data for the current theme
                                  const previewData = themePreviewData[tpl.id];

                                  // Check for saved custom theme data first
                                  let savedTitle = null;
                                  if (birthdaySettings?.customThemeData) {
                                    try {
                                      const parsed = JSON.parse(birthdaySettings.customThemeData);
                                      const themeSpecificData = parsed.themes?.[tpl.id];
                                      if (themeSpecificData?.title !== undefined) {
                                        savedTitle = themeSpecificData.title;
                                      }
                                    } catch (error) {
                                      console.warn('Failed to parse saved theme data:', error);
                                    }
                                  }

                                  if (tpl.id === 'custom') {
                                    const customData = previewData || customThemePreview;
                                    return customData?.title || savedTitle || 'Happy Birthday!';
                                  } else if (previewData?.title !== undefined) {
                                    // Show preview title (including empty strings) for default themes
                                    return previewData.title || 'Happy Birthday!';
                                  } else if (savedTitle !== null) {
                                    // Show saved custom title for default themes
                                    return savedTitle || 'Happy Birthday!';
                                  } else {
                                    return 'Happy Birthday!';
                                  }
                                })()}
                              </div>
                              <div className="text-xs text-white/90 drop-shadow">{tpl.name} preview</div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{tpl.name}</span>
                          {isSelected && (
                            <span className="text-xs font-semibold text-blue-600">Selected</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card Designer */}
        <CardDesignerDialog
          open={designerOpen}
          onOpenChange={(open) => {
            setDesignerOpen(open);
            // When closing, preserve preview data so users can see their changes
            // Only clear preview data if the user explicitly cancels without saving
            // The preview data will be useful for showing real-time updates
            if (!open && designerThemeId) {
              // We'll keep the preview data to maintain the visual state
              // This allows users to see their changes even after closing the designer
              console.log('🎨 [Birthday Cards] Designer closed, preserving preview data for theme:', designerThemeId);
            }
          }}
          initialThemeId={designerThemeId || undefined}
          onPreviewChange={handlePreviewChange}
          initialData={cardDesignerInitialData}
          onSave={(data) => {
            try {
              localStorage.setItem('birthdayCardDesignerDraft', JSON.stringify({ title: data.title, message: data.message, signature: data.signature, imageUrl: data.imageUrl, themeId: data.themeId, customImage: (data as any).customImage }));
            } catch { }

            // Create theme data for preview updates
            const themeData: CustomThemeData = {
              title: data.title,
              message: data.message,
              signature: data.signature || '',
              imageUrl: data.imageUrl || null,
              customImage: (data as any).customImage || false,
              imagePosition: (data as any).imagePosition || { x: 0, y: 0 },
              imageScale: (data as any).imageScale || 1,
            };

            // Update preview state immediately for instant visual feedback
            setThemePreviewData(prev => ({
              ...prev,
              [designerThemeId || 'default']: themeData
            }));

            // Parse existing customThemeData or create new structure
            let existingThemeData: Record<string, any> = {};
            if (birthdaySettings?.customThemeData) {
              try {
                const parsed = JSON.parse(birthdaySettings.customThemeData);
                // Check if it's the new structure (has themes property) or old structure
                if (parsed.themes) {
                  existingThemeData = parsed;
                } else {
                  // Migrate old structure to new structure
                  existingThemeData = {
                    themes: {
                      custom: parsed // Assume old data was for custom theme
                    }
                  };
                }
              } catch {
                existingThemeData = { themes: {} };
              }
            } else {
              existingThemeData = { themes: {} };
            }

            // Update the specific theme's data
            const currentThemeId = designerThemeId || 'default';
            const updatedThemeData = {
              ...existingThemeData,
              themes: {
                ...existingThemeData.themes,
                [currentThemeId]: themeData
              }
            };

            // Check if user has made any text customizations (title or signature)
            const hasTextCustomizations = data.title !== '' || data.signature !== '';

            // Save button should preserve current theme selection and only save theme-specific data
            if (designerThemeId === 'custom') {
              console.log('🎨 [Birthday Cards] Saving custom theme data');

              // Update real-time preview immediately for instant visual feedback
              setCustomThemePreview(themeData);

              // Update both the custom theme data and keep the email template as custom
              updateSettingsMutation.mutate({
                ...birthdaySettings,
                emailTemplate: 'custom',
                customMessage: data.message,
                customThemeData: JSON.stringify(updatedThemeData),
              });
            } else if (hasTextCustomizations || data.message !== (birthdaySettings?.customMessage || '')) {
              // For default themes with any customizations, save the theme-specific data
              console.log('🎨 [Birthday Cards] Saving theme-specific customizations for', currentThemeId);
              const currentTemplate = birthdaySettings?.emailTemplate || 'default';
              updateSettingsMutation.mutate({
                ...birthdaySettings,
                emailTemplate: currentTemplate, // Preserve current theme selection
                customMessage: data.message,
                customThemeData: JSON.stringify(updatedThemeData), // Save theme-specific data
              });
            } else {
              // For default themes with no customizations, just save the message
              const currentTemplate = birthdaySettings?.emailTemplate || 'default';
              updateSettingsMutation.mutate({
                ...birthdaySettings,
                emailTemplate: currentTemplate, // Preserve current theme selection
                customMessage: data.message,
              });
            }
          }}
          onMakeActive={(themeId, data) => {
            // Handle making the card active - this will set it as the current email template
            const isDefaultTheme = ['default', 'confetti', 'balloons'].includes(themeId || '');

            // Check if user has uploaded custom image (makes it truly custom)
            const hasCustomImage = (data as any).customImage === true;

            // Check if user has made text customizations (title or signature)
            const hasTextCustomizations = data.title !== '' || data.signature !== '';

            // Create theme data for preview updates
            const themeData: CustomThemeData = {
              title: data.title,
              message: data.message,
              signature: data.signature || '',
              imageUrl: data.imageUrl || null,
              customImage: (data as any).customImage || false,
              imagePosition: (data as any).imagePosition || { x: 0, y: 0 },
              imageScale: (data as any).imageScale || 1,
            };

            // Update preview state immediately
            setThemePreviewData(prev => ({
              ...prev,
              [themeId || 'default']: themeData
            }));

            // Parse existing customThemeData or create new structure
            let existingThemeData: Record<string, any> = {};
            if (birthdaySettings?.customThemeData) {
              try {
                const parsed = JSON.parse(birthdaySettings.customThemeData);
                // Check if it's the new structure (has themes property) or old structure
                if (parsed.themes) {
                  existingThemeData = parsed;
                } else {
                  // Migrate old structure to new structure
                  existingThemeData = {
                    themes: {
                      custom: parsed // Assume old data was for custom theme
                    }
                  };
                }
              } catch {
                existingThemeData = { themes: {} };
              }
            } else {
              existingThemeData = { themes: {} };
            }

            // Update the specific theme's data
            const currentThemeId = themeId || 'default';
            const updatedThemeData = {
              ...existingThemeData,
              themes: {
                ...existingThemeData.themes,
                [currentThemeId]: themeData
              }
            };

            if (themeId === 'custom') {
              // Save as custom theme only if explicitly custom
              console.log('🎨 [Birthday Cards] Making custom theme active');
              setCustomThemePreview(themeData);

              const payload = {
                ...birthdaySettings,
                enabled: birthdaySettings?.enabled || false,
                emailTemplate: 'custom',
                segmentFilter: birthdaySettings?.segmentFilter || 'all',
                customMessage: data.message,
                customThemeData: JSON.stringify(updatedThemeData),
                senderName: birthdaySettings?.senderName || 'Birthday Team',
              };
              
              console.log('🎨 [Birthday Cards] Custom theme payload:', payload);
              updateSettingsMutation.mutate(payload);
            } else if (isDefaultTheme && (hasTextCustomizations || data.message !== (birthdaySettings?.customMessage || ''))) {
              // For default themes with customizations, save theme-specific data but keep original theme template
              console.log('🎨 [Birthday Cards] Making default theme with customizations active:', currentThemeId);
              const payload = {
                ...birthdaySettings,
                enabled: birthdaySettings?.enabled || false,
                emailTemplate: themeId || 'default', // Keep the default theme selection
                segmentFilter: birthdaySettings?.segmentFilter || 'all',
                customMessage: data.message,
                customThemeData: JSON.stringify(updatedThemeData), // Save theme-specific data
                senderName: birthdaySettings?.senderName || 'Birthday Team',
              };
              
              console.log('🎨 [Birthday Cards] Default theme with customizations payload:', payload);
              updateSettingsMutation.mutate(payload);
            } else {
              // For default themes with no customizations, just set the template
              console.log('🎨 [Birthday Cards] Making default theme active');
              const payload = {
                ...birthdaySettings,
                enabled: birthdaySettings?.enabled || false,
                emailTemplate: themeId || 'default',
                segmentFilter: birthdaySettings?.segmentFilter || 'all',
                customMessage: data.message,
                senderName: birthdaySettings?.senderName || 'Birthday Team',
              };
              
              console.log('🎨 [Birthday Cards] Default theme payload:', payload);
              updateSettingsMutation.mutate(payload);
            }

            // Close the designer after making active
            setDesignerOpen(false);
          }}
          isCurrentlyActive={(() => {
            const currentTemplate = birthdaySettings?.emailTemplate || 'default';
            const selectedTheme = designerThemeId || 'default';
            
            console.log('🎯 [Theme Active Check]', {
              currentTemplate,
              selectedTheme,
              birthdaySettings,
              match: currentTemplate === selectedTheme
            });

            // For custom theme, check if current template is 'custom' and we're viewing custom
            if (selectedTheme === 'custom') {
              return currentTemplate === 'custom';
            }

            // For default themes, check exact match
            return currentTemplate === selectedTheme;
          })()}
          senderName={birthdaySettings?.senderName}
          businessName={currentUser?.name}
        />

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Settings */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Birthday Email Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Global Enable/Disable */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Enable Birthday Emails</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Automatically send birthday emails to customers
                      </p>
                    </div>
                    <Switch
                      checked={birthdaySettings?.enabled || false}
                      onCheckedChange={handleToggleGlobalEnabled}
                      disabled={updateSettingsMutation.isPending}
                    />
                  </div>





                </CardContent>
              </Card>
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-6">
              {/* Overview Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Customers</span>
                    <Badge variant="outline">{contacts.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">With Birthdays</span>
                    <Badge variant="outline">{customersWithBirthdays.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Birthday Emails Enabled</span>
                    <Badge variant="outline">
                      {customersWithBirthdays.filter(c => c.birthdayEmailEnabled).length}
                    </Badge>
                  </div>

                </CardContent>
              </Card>

              {/* Upcoming Birthdays */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CakeIcon className="h-5 w-5" />
                    Upcoming Birthdays
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {upcomingBirthdays.length === 0 ? (
                    <div className="text-center py-4">
                      <CakeIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        No birthdays in the next 30 days
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingBirthdays.map((contact) => (
                        <div key={contact.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{getContactName(contact)}</p>
                            <p className="text-xs text-gray-500">
                              {contact.birthday && (() => {
                                // Parse date as local to avoid timezone shifts
                                const [year, month, day] = contact.birthday.split('-').map(Number);
                                const localDate = new Date(year, month - 1, day);
                                return localDate.toLocaleDateString();
                              })()}
                            </p>
                          </div>
                          {contact.birthdayEmailEnabled ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}



        {/* Customers Tab */}
        {activeTab === "customers" && (
          <Card className="w-11/12">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('birthdays.title')}
                </CardTitle>
                <Button onClick={handleAddCustomer}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('common.add')} Customer
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Search and Filter Controls */}
              <div className="flex items-center gap-4 p-6 border-b">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder={t('birthdays.filters.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('birthdays.filters.allStatuses')}</SelectItem>
                    <SelectItem value="active">{t('birthdays.filters.active')}</SelectItem>
                    <SelectItem value="unsubscribed">{t('birthdays.filters.unsubscribed')}</SelectItem>
                    <SelectItem value="bounced">Bounced</SelectItem>
                    <SelectItem value="pending">{t('birthdays.filters.pending')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bulk Actions */}
              {selectedContacts.length > 0 && (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 border-b">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{selectedContacts.length} selected</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedContacts([])}
                    >
                      Clear Selection
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkEnableBirthdayEmail}
                      disabled={bulkUpdateBirthdayEmailMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Enable Birthday Emails
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDisableBirthdayEmail}
                      disabled={bulkUpdateBirthdayEmailMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Disable Birthday Emails
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleSendBirthdayCard} disabled={sendBirthdayCardMutation.isPending}>
                          <CakeIcon className="h-4 w-4 mr-2" />
                          {sendBirthdayCardMutation.isPending ? 'Sending...' : 'Send Birthday Card'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleBulkRequestBirthdays} disabled={sendInvitationMutation.isPending}>
                          <Mail className="h-4 w-4 mr-2" />
                          {sendInvitationMutation.isPending ? 'Sending...' : 'Request Birthdays'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Export Selected
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove Selected
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}

              {contactsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">No customers found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">Start by adding your first customer to begin managing birthday emails</p>
                  <Button onClick={handleAddCustomer}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Your First Customer
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all customers"
                          />
                        </TableHead>
                        <TableHead>{t('birthdays.table.name')}</TableHead>
                        <TableHead>{t('birthdays.table.status')}</TableHead>
                        <TableHead>{t('birthdays.table.birthday')}</TableHead>

                        <TableHead>{t('birthdays.table.campaigns')}</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedContacts.includes(contact.id)}
                              onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                              aria-label={`Select ${getContactName(contact)}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <button
                                type="button"
                                onClick={() => handleCustomerClick(contact)}
                                className="font-medium text-left hover:text-blue-600 hover:underline transition-colors cursor-pointer"
                              >
                                {getContactName(contact)}
                              </button>
                              <p className="text-sm text-gray-500">{contact.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(contact.status)}>
                              {contact.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {contact.birthday ? (
                              <button
                                type="button"
                                onClick={() => openBirthdayModal(contact.id)}
                                className="flex items-center gap-2 text-left hover:bg-gray-50 p-1 rounded transition-colors"
                              >
                                <CakeIcon className="h-4 w-4 text-pink-500" />
                                <span className="text-sm">{(() => {
                                  // Parse date as local to avoid timezone shifts
                                  const [year, month, day] = contact.birthday.split('-').map(Number);
                                  const localDate = new Date(year, month - 1, day);
                                  return localDate.toLocaleDateString();
                                })()}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openBirthdayModal(contact.id)}
                                className="text-gray-400 text-sm underline underline-offset-2 hover:text-gray-600"
                              >
                                {t('birthdays.table.notSet')}
                              </button>
                            )}
                          </TableCell>


                          <TableCell>
                            {contact.birthday ? (
                              contact.birthdayUnsubscribedAt ? (
                                <Badge className="bg-orange-100 text-orange-800">
                                  unsubscribed
                                </Badge>
                              ) : (
                                <Switch
                                  checked={contact.birthdayEmailEnabled || false}
                                  onCheckedChange={() => handleToggleBirthdayEmail(contact.id, contact.birthdayEmailEnabled || false)}
                                  disabled={toggleBirthdayEmailMutation.isPending}
                                />
                              )
                            ) : (
                              <span className="text-gray-400 text-sm">{t('birthdays.table.na')}</span>
                            )}
                          </TableCell>

                        
                          <TableCell>
                            {!contact.birthday && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendBirthdayInvitation(contact.id)}
                                disabled={sendInvitationMutation.isPending || tokenLoading}
                                className="flex items-center gap-2"
                              >
                                <Mail className="h-4 w-4" />
                                {tokenLoading ? "Refreshing..." : sendInvitationMutation.isPending ? "Sending..." : "Request Birthday"}
                              </Button>
                            )}
                          </TableCell>
</TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Test Tab */}
        {activeTab === "test" && (
          <Card className="w-11/12">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Test Birthday Cards
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    Test Mode
                  </Badge>
                  <Badge variant="secondary">
                    {users.length} Users
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Send test birthday cards to users individually or select multiple users for bulk sending. Test emails will be sent to the selected user's actual email address.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {/* Bulk Actions for Users */}
              {selectedUsers.length > 0 && (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 border-b">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{selectedUsers.length} user(s) selected</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedUsers([])}
                    >
                      Clear Selection
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        selectedUsers.forEach(userId => {
                          handleSendTestBirthdayCard(userId);
                        });
                        setSelectedUsers([]);
                      }}
                      disabled={sendTestBirthdayMutation.isPending || tokenLoading}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {tokenLoading ? "Refreshing..." : sendTestBirthdayMutation.isPending ? "Sending..." : "Send Test Cards to Selected"}
                    </Button>
                  </div>
                </div>
              )}

              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">No users found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">No users available in your tenant for testing</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={isAllUsersSelected}
                            onCheckedChange={handleSelectAllUsers}
                            aria-label="Select all users"
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Email Verified</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedUsers.includes(user.id)}
                              onCheckedChange={(checked) => handleSelectUser(user.id, checked as boolean)}
                              aria-label={`Select ${getUserName(user)}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{getUserName(user)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{user.email}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm capitalize">{user.role}</span>
                          </TableCell>
                          <TableCell>
                            {user.emailVerified ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendTestBirthdayCard(user.id)}
                              disabled={sendTestBirthdayMutation.isPending || tokenLoading}
                              className="flex items-center gap-2"
                            >
                              <Mail className="h-4 w-4" />
                              {tokenLoading ? "Refreshing..." : sendTestBirthdayMutation.isPending ? "Sending..." : "Send Test Card"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Promotions Tab */}
        {activeTab === "promotions" && (
          <Card className="w-11/12">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Promotions
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select promotions to include in birthday emails
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Promotion Selection */}
                <div>
                  <Label className="text-sm font-medium">Promotion (Optional)</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Select a promotion to include in birthday emails. This will add promotional content to your birthday cards.
                  </p>
                  <PromotionSelector
                    selectedPromotions={selectedPromotions}
                    onPromotionsChange={handlePromotionsChange}
                    campaignType="birthday"
                    singleSelection={true}
                    onPromotionContentInsert={() => { }} // Not needed for birthday emails
                  />
                </div>

                {/* Split Email Option */}
                {selectedPromotions.length > 0 && (
                  <div className="mt-4 p-4 border rounded-lg bg-white dark:bg-gray-900">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="splitPromotionalEmail"
                        checked={splitPromotionalEmail}
                        onCheckedChange={(checked) => {
                          setSplitPromotionalEmail(checked as boolean);
                          if (birthdaySettings) {
                            const promotionId = selectedPromotions.length > 0 ? selectedPromotions[0] : null;
                            updateSettingsMutation.mutate({
                              id: birthdaySettings.id,
                              enabled: birthdaySettings.enabled,
                              emailTemplate: birthdaySettings.emailTemplate || 'default',
                              segmentFilter: birthdaySettings.segmentFilter || 'all',
                              customMessage: birthdaySettings.customMessage || '',
                              senderName: birthdaySettings.senderName || '',
                              customThemeData: birthdaySettings.customThemeData,
                              promotionId: promotionId,
                              splitPromotionalEmail: checked as boolean,
                            });
                          }
                        }}
                      />
                      <div className="flex-1">
                        <label
                          htmlFor="splitPromotionalEmail"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          Send promotion as separate email (Better Deliverability)
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          When enabled, the birthday card and promotion will be sent as two separate emails to improve deliverability rates and avoid spam filters. The birthday card will be sent first, followed by the promotional email shortly after.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Promotion Preview */}
                {selectedPromotions.length > 0 && birthdaySettings?.promotion && (
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="text-sm font-medium mb-2">Selected Promotion Preview</h4>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{birthdaySettings.promotion.title}</p>
                      {birthdaySettings.promotion.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">{birthdaySettings.promotion.description}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Help Text */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">How Promotions Work</h4>
                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Promotions are automatically included in birthday email templates</li>
                    <li>• Only one promotion can be active at a time</li>
                    <li>• Promotions will appear alongside your birthday message</li>
                    <li>• You can change or remove promotions at any time</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Customer Details Modal */}
        <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Customer Details
              </DialogTitle>
              <DialogDescription>
                View customer information and activity
              </DialogDescription>
            </DialogHeader>
            {selectedCustomer && (
              <div className="space-y-4">
                {/* Customer Basic Info */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Name</Label>
                    <p className="text-sm font-medium">{selectedCustomer.firstName || selectedCustomer.lastName ? `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim() : 'No name provided'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Email</Label>
                    <p className="text-sm">{selectedCustomer.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Status</Label>
                    <Badge className={`${selectedCustomer.status === 'active' ? 'bg-green-100 text-green-800' :
                      selectedCustomer.status === 'unsubscribed' ? 'bg-red-100 text-red-800' :
                        selectedCustomer.status === 'bounced' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'}`}>
                      {selectedCustomer.status}
                    </Badge>
                  </div>
                  {selectedCustomer.birthday && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Birthday</Label>
                      <div className="flex items-center gap-2">
                        <CakeIcon className="h-4 w-4 text-pink-500" />
                        <span className="text-sm">{(() => {
                          // Parse date as local to avoid timezone shifts
                          const [year, month, day] = selectedCustomer.birthday.split('-').map(Number);
                          const localDate = new Date(year, month - 1, day);
                          return localDate.toLocaleDateString();
                        })()}</span>
                      </div>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Birthday Email Status</Label>
                    {selectedCustomer.birthdayUnsubscribedAt ? (
                      <div className="space-y-1">
                        <Badge className="bg-orange-100 text-orange-800">
                          Unsubscribed from Birthday Emails
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          Unsubscribed on {new Date(selectedCustomer.birthdayUnsubscribedAt).toLocaleString()}
                        </p>
                      </div>
                    ) : selectedCustomer.birthday ? (
                      <Badge className="bg-green-100 text-green-800">
                        Subscribed to Birthday Emails
                      </Badge>
                    ) : (
                      <span className="text-sm text-gray-500">No birthday set</span>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Activity Stats */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">Email Activity</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{selectedCustomer.emailsSent}</p>
                      <p className="text-xs text-blue-600">Emails Sent</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{selectedCustomer.emailsOpened}</p>
                      <p className="text-xs text-green-600">Emails Opened</p>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {selectedCustomer.tags && selectedCustomer.tags.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Tags</Label>
                    <div className="flex flex-wrap gap-1">
                      {selectedCustomer.tags.map((tag) => (
                        <Badge key={tag.id} variant="outline" style={{ backgroundColor: tag.color + '20', borderColor: tag.color, color: tag.color }}>
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Added Date</Label>
                    <p className="text-sm text-gray-600">{new Date(selectedCustomer.addedDate).toLocaleDateString()}</p>
                  </div>
                  {selectedCustomer.lastActivity && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Last Activity</Label>
                      <p className="text-sm text-gray-600">{new Date(selectedCustomer.lastActivity).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => {
                      const customerId = selectedCustomer.id;
                      // Immediately close modal and reset state
                      setCustomerModalOpen(false);
                      setSelectedCustomer(null);
                      // Navigate after a brief delay to ensure smooth transition
                      setTimeout(() => {
                        setLocation(`/email-contacts/view/${customerId}?return=/birthdays?tab=customers`);
                      }, 100);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Full Profile
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Birthday Modal */}
        <Dialog open={birthdayModalOpen} onOpenChange={setBirthdayModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {birthdayContactId && contacts.find(c => c.id === birthdayContactId)?.birthday
                  ? t('birthdays.modal.editTitle')
                  : t('birthdays.modal.addTitle')}
              </DialogTitle>
              <DialogDescription>
                {birthdayContactId && contacts.find(c => c.id === birthdayContactId)?.birthday
                  ? t('birthdays.modal.editDescription')
                  : t('birthdays.modal.addDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="birthday-date">Birthday Date</Label>
                <Input
                  id="birthday-date"
                  type="date"
                  value={birthdayDraft ? (() => {
                    // Format date in local timezone to avoid timezone shifts
                    const y = birthdayDraft.getFullYear();
                    const m = `${birthdayDraft.getMonth() + 1}`.padStart(2, '0');
                    const d = `${birthdayDraft.getDate()}`.padStart(2, '0');
                    return `${y}-${m}-${d}`;
                  })() : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      // Parse the date string as a local date to avoid timezone shifts
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      setBirthdayDraft(new Date(year, month - 1, day));
                    } else {
                      setBirthdayDraft(undefined);
                    }
                  }}
                  max={(() => {
                    // Format today's date in local timezone
                    const today = new Date();
                    const y = today.getFullYear();
                    const m = `${today.getMonth() + 1}`.padStart(2, '0');
                    const d = `${today.getDate()}`.padStart(2, '0');
                    return `${y}-${m}-${d}`;
                  })()}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBirthdayModalOpen(false)}>{t('birthdays.modal.cancel')}</Button>
                <Button onClick={saveBirthday} disabled={!birthdayDraft || !birthdayContactId || updateContactBirthdayMutation.isPending}>{t('birthdays.modal.save')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}



