import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Calendar, 
  Settings, 
  Filter, 
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
  Upload
  ,
  Palette
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as DateCalendar } from "@/components/ui/calendar";

interface BirthdaySettings {
  id: string;
  enabled: boolean;
  sendDaysBefore: number;
  emailTemplate: string;
  segmentFilter: string;
  customMessage: string;
  senderName: string;
  senderEmail: string;
  created_at: string;
  updated_at: string;
}

interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  filterCriteria: Record<string, any>;
  customerCount: number;
  enabled: boolean;
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

export default function BirthdaysPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"themes" | "settings" | "segments" | "customers">("themes");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [birthdayModalOpen, setBirthdayModalOpen] = useState(false);
  const [birthdayDraft, setBirthdayDraft] = useState<Date | undefined>(undefined);
  const [birthdayContactId, setBirthdayContactId] = useState<string | null>(null);
  const [birthdayInput, setBirthdayInput] = useState<string>("");

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
          sendDaysBefore: 0,
          emailTemplate: 'default',
          segmentFilter: 'all',
          customMessage: '',
          senderName: '',
          senderEmail: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      } catch (error) {
        // Return default values if API is not available yet
        return {
          id: '',
          enabled: false,
          sendDaysBefore: 0,
          emailTemplate: 'default',
          segmentFilter: 'all',
          customMessage: '',
          senderName: '',
          senderEmail: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
    },
  });

  // Fetch customer segments
  const { 
    data: segments = [], 
    isLoading: segmentsLoading,
    refetch: refetchSegments 
  } = useQuery<CustomerSegment[]>({
    queryKey: ['/api/customer-segments'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/customer-segments');
        if (!response.ok) throw new Error('Failed to fetch segments');
        return await response.json() || [];
      } catch (error) {
        return [];
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
        title: "No Action Needed",
        description: "Selected customers don't have birthday dates set.",
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
        title: "No Action Needed",
        description: "Selected customers don't have birthday dates set.",
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
      toast({ title: "Birthday updated" });
      setBirthdayModalOpen(false);
      setBirthdayDraft(undefined);
      setBirthdayContactId(null);
      refetchContacts();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to update birthday", variant: "destructive" });
    },
  });

  const openBirthdayModal = (contactId: string) => {
    setBirthdayContactId(contactId);
    setBirthdayDraft(undefined);
    setBirthdayInput("");
    setBirthdayModalOpen(true);
  };

  const saveBirthday = () => {
    if (!birthdayContactId || !birthdayDraft) return;
    const y = birthdayDraft.getFullYear();
    const m = `${birthdayDraft.getMonth() + 1}`.padStart(2, '0');
    const d = `${birthdayDraft.getDate()}`.padStart(2, '0');
    updateContactBirthdayMutation.mutate({ contactId: birthdayContactId, birthday: `${y}-${m}-${d}` });
  };

  const onCalendarSelect = (date?: Date) => {
    setBirthdayDraft(date);
    if (date) {
      const y = date.getFullYear();
      const m = `${date.getMonth() + 1}`.padStart(2, '0');
      const d = `${date.getDate()}`.padStart(2, '0');
      setBirthdayInput(`${y}-${m}-${d}`);
    } else {
      setBirthdayInput("");
    }
  };

  const onBirthdayInputChange = (val: string) => {
    setBirthdayInput(val);
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (re.test(val)) {
      const [yy, mm, dd] = val.split('-').map(Number);
      const candidate = new Date(yy, mm - 1, dd);
      if (!isNaN(candidate.getTime())) {
        // Prevent future dates
        const today = new Date();
        today.setHours(0,0,0,0);
        if (candidate.getTime() <= today.getTime()) {
          setBirthdayDraft(candidate);
          return;
        }
      }
    }
    setBirthdayDraft(undefined);
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
    <div className="min-h-screen">
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      {/* Greeting Header Card */}
      <Card className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="space-y-8 pr-6 xl:pr-12 lg:col-span-8">
              <div className="space-y-3">
                <div className="flex items-baseline gap-4">
                  <span className="text-4xl md:text-5xl">🎉</span>
                  <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
                    Celebrate Their Special
                  </h1>
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
                  Day With a Thoughtful
                </h1>
                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
                  Birthday e-Card!
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed max-w-3xl md:max-w-4xl">
                Choose your contacts and we will send them a personalized birthday
                greeting straight to their inbox. It only takes a few clicks to brighten
                someone's day!
              </p>
            </div>
            <div className="justify-self-center lg:justify-self-end lg:col-span-4">
              <img
                src="/guy_present.svg"
                alt="Person with birthday present illustration"
                className="w-[360px] xl:w-[420px] max-w-full h-auto"
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
          variant={activeTab === "segments" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("segments")}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Segments
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                {[
                  { id: 'default', name: 'Default' },
                  { id: 'confetti', name: 'Confetti' },
                  { id: 'balloons', name: 'Balloons' },
                ].map((tpl) => {
                  const isSelected = (birthdaySettings?.emailTemplate || 'default') === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSettingsUpdate('emailTemplate', tpl.id)}
                      disabled={updateSettingsMutation.isPending}
                      className={`relative rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${isSelected ? 'ring-2 ring-blue-600 border-blue-600' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="relative h-40 rounded-lg overflow-hidden">
                        {tpl.id === 'default' && (
                          <div className="absolute inset-0 bg-white" />
                        )}
                        {tpl.id === 'confetti' && (
                          <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50" />
                        )}
                        {tpl.id === 'balloons' && (
                          <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-cyan-50 to-indigo-50" />
                        )}

                        {tpl.id !== 'default' && (
                          <>
                            <span className="absolute left-3 top-3 text-2xl opacity-70">{tpl.id === 'confetti' ? '🎉' : '🎈'}</span>
                            <span className="absolute right-4 top-6 text-xl opacity-60">{tpl.id === 'confetti' ? '🎁' : '🎈'}</span>
                            <span className="absolute left-8 bottom-6 text-xl opacity-60">{tpl.id === 'confetti' ? '🎂' : '🎈'}</span>
                          </>
                        )}

                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="font-bold text-gray-900">Happy Birthday!</div>
                            <div className="text-xs text-gray-500">{tpl.name} preview</div>
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

                <Separator />

                {/* Timing Settings */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Timing Settings</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Send Days Before Birthday</Label>
                      <Input
                        type="number"
                        min="0"
                        max="30"
                        value={birthdaySettings?.sendDaysBefore || 0}
                        onChange={(e) => handleSettingsUpdate('sendDaysBefore', parseInt(e.target.value))}
                        disabled={updateSettingsMutation.isPending}
                      />
                      <p className="text-xs text-gray-500 mt-1">0 = on birthday, 1 = day before, etc.</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Email Template Settings */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Email Template</Label>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm">Sender Name</Label>
                      <Input
                        value={birthdaySettings?.senderName || ''}
                        onChange={(e) => handleSettingsUpdate('senderName', e.target.value)}
                        placeholder="Your Company Name"
                        disabled={updateSettingsMutation.isPending}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Sender Email</Label>
                      <Input
                        type="email"
                        value={birthdaySettings?.senderEmail || ''}
                        onChange={(e) => handleSettingsUpdate('senderEmail', e.target.value)}
                        placeholder="birthday@yourcompany.com"
                        disabled={updateSettingsMutation.isPending}
                      />
                    </div>
                    
                  </div>
                </div>

                <Separator />

                {/* Segment Filter */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Customer Segmentation</Label>
                  <div>
                    <Label className="text-sm">Default Segment Filter</Label>
                    <Select
                      value={birthdaySettings?.segmentFilter || 'all'}
                      onValueChange={(value) => handleSettingsUpdate('segmentFilter', value)}
                      disabled={updateSettingsMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        <SelectItem value="active">Active Customers Only</SelectItem>
                        <SelectItem value="premium">Premium Customers</SelectItem>
                        <SelectItem value="custom">Custom Segment</SelectItem>
                      </SelectContent>
                    </Select>
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
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Segments</span>
                  <Badge variant="outline">{segments.length}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Birthdays */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
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

      {/* Segments Tab */}
      {activeTab === "segments" && (
        <Card className="w-11/12">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Customer Segments
              </CardTitle>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Segment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {segmentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300"></div>
              </div>
            ) : segments.length === 0 ? (
              <div className="text-center py-12">
                <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">No segments created yet</p>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Segment
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {segments.map((segment) => (
                  <div key={segment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{segment.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{segment.description}</p>
                      <Badge variant="outline" className="mt-2">
                        {segment.customerCount} customers
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={segment.enabled} />
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Customers Tab */}
      {activeTab === "customers" && (
        <Card className="w-11/12">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Customer Birthday Management
              </CardTitle>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Search and Filter Controls */}
            <div className="flex items-center gap-4 p-6 border-b">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search customers..."
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
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
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
                <Button>
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
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Birthday</TableHead>
                      <TableHead>Lists</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Birthday Email</TableHead>
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
                            <div className="flex items-center gap-2">
                              <CakeIcon className="h-4 w-4 text-pink-500" />
                              <span className="text-sm">{new Date(contact.birthday).toLocaleDateString()}</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openBirthdayModal(contact.id)}
                              className="text-gray-400 text-sm underline underline-offset-2 hover:text-gray-600"
                            >
                              Not set
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {contact.lists.map((list) => (
                              <Badge key={list.id} variant="outline" className="text-xs">
                                {list.name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>Sent: {contact.emailsSent}</p>
                            <p>Opened: {contact.emailsOpened}</p>
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
                            <span className="text-gray-400 text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
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
            <DialogTitle>Add Birthday</DialogTitle>
            <DialogDescription>Select a date to save as the contact's birthday.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Birthday (YYYY-MM-DD)</Label>
              <Input
                placeholder="e.g. 1990-07-15"
                value={birthdayInput}
                onChange={(e) => onBirthdayInputChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Dates in the future are not allowed.</p>
            </div>
            <DateCalendar
              mode="single"
              selected={birthdayDraft}
              onSelect={onCalendarSelect}
              captionLayout="dropdown-buttons"
              fromYear={1900}
              toYear={new Date().getFullYear()}
              disabled={{ after: new Date() }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBirthdayModalOpen(false)}>Cancel</Button>
              <Button onClick={saveBirthday} disabled={!birthdayDraft || !birthdayContactId || updateContactBirthdayMutation.isPending}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}
