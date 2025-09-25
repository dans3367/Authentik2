"use client"

import { useState, useEffect, useCallback } from "react";
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

interface BirthdaySettings {
  id: string;
  enabled: boolean;
  emailTemplate: string;
  segmentFilter: string;
  customMessage: string;
  customThemeData?: string | null;
  senderName: string;
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
  const [, setLocation] = useLocation();
  const { t, currentLanguage } = useLanguage();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"themes" | "settings" | "customers" | "test">("themes");
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
  const [themePreviewData, setThemePreviewData] = useState<{[key: string]: CustomThemeData}>({});
  
  // Local state for sender name to avoid API calls on every keystroke
  const [localSenderName, setLocalSenderName] = useState<string>('');

  // Handler to navigate to add customer page
  const handleAddCustomer = () => {
    setLocation('/email-contacts/new');
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
        return data || {
          id: '',
          enabled: false,
          emailTemplate: 'default',
          segmentFilter: 'all',
          customMessage: '',
          senderName: '',
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
          senderName: '',
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
      const response = await fetch('/api/birthday-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Birthday settings updated successfully",
      });
      refetchSettings();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update birthday settings",
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

  // Initialize local sender name when birthday settings are loaded
  useEffect(() => {
    if (birthdaySettings?.senderName !== undefined) {
      setLocalSenderName(birthdaySettings.senderName);
    }
  }, [birthdaySettings?.senderName]);

  // Save handler for sender name
  const handleSaveSenderName = () => {
    if (birthdaySettings) {
      updateSettingsMutation.mutate({
        ...birthdaySettings,
        senderName: localSenderName,
      });
    }
  };

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

      // Call the workflow-based API
      const response = await fetch('http://localhost:3502/api/birthday-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`, // Assuming token is stored here
        },
        body: JSON.stringify({
          contactId: contact.id,
          contactEmail: contact.email,
          contactFirstName: contact.firstName,
          contactLastName: contact.lastName,
          tenantId: currentUser?.tenantId || 'unknown-tenant',
          tenantName: currentUser?.name || 'Your Company',
          userId: currentUser?.id || 'unknown-user',
          fromEmail: 'admin@zendwise.work'
        }),
      });

      if (!response.ok) {
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
      // Find the user to get additional details
      const user = users.find(u => u.id === userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Call the workflow-based API for test birthday cards
      const response = await fetch('http://localhost:3502/api/birthday-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          userFirstName: user.firstName,
          userLastName: user.lastName,
          tenantId: currentUser?.tenantId || 'unknown-tenant',
          tenantName: currentUser?.name || 'Your Company',
          fromEmail: 'admin@zendwise.work', // Test emails go to the selected user's email
          isTest: true,
          // Include theme and custom content information
          emailTemplate: birthdaySettings?.emailTemplate || 'default',
          customMessage: birthdaySettings?.customMessage || '',
          customThemeData: birthdaySettings?.customThemeData || null,
          senderName: birthdaySettings?.senderName || ''
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send test birthday card');
      }

      return response.json();
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
      setBirthdayDraft(new Date(contact.birthday));
    } else {
      setBirthdayDraft(undefined);
    }
    
    setBirthdayModalOpen(true);
  };

  const saveBirthday = () => {
    if (!birthdayContactId || !birthdayDraft) return;
    const y = birthdayDraft.getFullYear();
    const m = `${birthdayDraft.getMonth() + 1}`.padStart(2, '0');
    const d = `${birthdayDraft.getDate()}`.padStart(2, '0');
    updateContactBirthdayMutation.mutate({ contactId: birthdayContactId, birthday: `${y}-${m}-${d}` });
  };

  const handleSendBirthdayInvitation = (contactId: string) => {
    sendInvitationMutation.mutate(contactId);
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
    const birthday = new Date(contact.birthday);
    const today = new Date();
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
                  const isSelected = (birthdaySettings?.emailTemplate || 'default') === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        setDesignerThemeId(tpl.id);
                        
                        // Clear localStorage draft when switching themes to prevent cross-contamination
                        try {
                          localStorage.removeItem('birthdayCardDesignerDraft');
                        } catch {}
                        
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
        initialData={(() => {
          // Load persistent draft first
          try {
            const raw = localStorage.getItem('birthdayCardDesignerDraft');
            if (raw) return JSON.parse(raw);
          } catch {}
          
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
        })()}
        onSave={(data) => {
          try {
            localStorage.setItem('birthdayCardDesignerDraft', JSON.stringify({ title: data.title, message: data.message, signature: data.signature, imageUrl: data.imageUrl, themeId: data.themeId, customImage: (data as any).customImage }));
          } catch {}
          
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
            
            updateSettingsMutation.mutate({
              ...birthdaySettings,
              emailTemplate: 'custom',
              customMessage: data.message,
              customThemeData: JSON.stringify(updatedThemeData),
            });
          } else if (isDefaultTheme && (hasTextCustomizations || data.message !== (birthdaySettings?.customMessage || ''))) {
            // For default themes with customizations, save theme-specific data but keep original theme template
            console.log('🎨 [Birthday Cards] Making default theme with customizations active:', currentThemeId);
            updateSettingsMutation.mutate({
              ...birthdaySettings,
              emailTemplate: themeId || 'default', // Keep the default theme selection
              customMessage: data.message,
              customThemeData: JSON.stringify(updatedThemeData), // Save theme-specific data
            });
          } else {
            // For default themes with no customizations, just set the template
            console.log('🎨 [Birthday Cards] Making default theme active');
            updateSettingsMutation.mutate({
              ...birthdaySettings,
              emailTemplate: themeId || 'default',
              customMessage: data.message,
            });
          }
          
          // Close the designer after making active
          setDesignerOpen(false);
        }}
        isCurrentlyActive={(() => {
          const currentTemplate = birthdaySettings?.emailTemplate || 'default';
          const selectedTheme = designerThemeId || 'default';
          
          // For custom theme, check if current template is 'custom' and we're viewing custom
          if (selectedTheme === 'custom') {
            return currentTemplate === 'custom';
          }
          
          // For default themes, check exact match
          return currentTemplate === selectedTheme;
        })()}
        senderName={birthdaySettings?.senderName}
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



                {/* Email Template Settings */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Email Template</Label>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm">Sender Name</Label>
                      <div className="flex gap-2">
                        <Input
                          value={localSenderName}
                          onChange={(e) => setLocalSenderName(e.target.value)}
                          placeholder="Your Company Name"
                          disabled={updateSettingsMutation.isPending}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleSaveSenderName}
                          disabled={updateSettingsMutation.isPending || localSenderName === (birthdaySettings?.senderName || '')}
                          size="sm"
                          variant="outline"
                          className="px-3"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    
                  </div>
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
                            {contact.birthday && new Date(contact.birthday).toLocaleDateString()}
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

                      <TableHead>{t('birthdays.table.activity')}</TableHead>
                      <TableHead>{t('birthdays.table.campaigns')}</TableHead>
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
                            <p className="font-medium">{getContactName(contact)}</p>
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
                              <span className="text-sm">{new Date(contact.birthday).toLocaleDateString()}</span>
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
                          <div className="text-sm">
                            <p>{t('birthdays.table.sent')}: {contact.emailsSent}</p>
                            <p>{t('birthdays.table.opened')}: {contact.emailsOpened}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact.birthday ? (
                            <Switch
                              checked={contact.birthdayEmailEnabled || false}
                              onCheckedChange={() => handleToggleBirthdayEmail(contact.id, contact.birthdayEmailEnabled || false)}
                              disabled={toggleBirthdayEmailMutation.isPending}
                            />
                          ) : (
                            <span className="text-gray-400 text-sm">{t('birthdays.table.na')}</span>
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
                    disabled={sendTestBirthdayMutation.isPending}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Test Cards to Selected
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
                            <p className="text-sm text-gray-500">ID: {user.id}</p>
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
                            disabled={sendTestBirthdayMutation.isPending}
                            className="flex items-center gap-2"
                          >
                            <Mail className="h-4 w-4" />
                            Send Test Card
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
                value={birthdayDraft ? birthdayDraft.toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : undefined;
                  setBirthdayDraft(date);
                }}
                max={new Date().toISOString().split('T')[0]}
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
