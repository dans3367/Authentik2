"use client"

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Gift,
  Users,
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
  Snowflake,
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
import { PromotionSelector } from "@/components/PromotionSelector";
import { ThemeCard } from "@/components/ThemeCard";

const ECardDesignerDialog = lazy(() =>
  import("@/components/ECardDesignerDialog").then((mod) => ({ default: mod.ECardDesignerDialog }))
);

interface ECardSettings {
  id: string;
  enabled: boolean;
  emailTemplate: string;
  segmentFilter: string;
  customMessage: string;
  customThemeData?: string | null;
  senderName: string;
  promotionId?: string | null;
  splitPromotionalEmail?: boolean;
  disabledHolidays?: string[] | null;
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
  description?: string | null;
  message: string;
  signature: string;
  imageUrl?: string | null;
  customImage: boolean;
  imagePosition: { x: number; y: number };
  imageScale: number;
}

interface Theme {
  id: string;
  legacyId?: string;
  name: string;
  image: string;
  overlay: string;
  decorations: React.ReactNode;
}

type CustomThemeStore = {
  themes: Record<string, CustomThemeData>;
  cardPromotions?: Record<string, string[]>;
};

// Normalize any stored JSON into a consistent store shape
const buildThemeStore = (json: string | null | undefined): CustomThemeStore => {
  const raw = safeJsonParse<any>(json, null);
  if (!raw) return { themes: {} };
  if (typeof raw === 'object' && raw && 'themes' in raw) {
    const store = raw as CustomThemeStore;
    return { themes: store.themes || {}, cardPromotions: store.cardPromotions };
  }
  // Legacy: single theme object stored directly
  return { themes: { custom: raw as CustomThemeData } };
};

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

const LEGACY_TEMPLATE_ID_MAP: Record<string, string> = {
  classic: 'default',
  'snowy-night': 'confetti',
  'cozy-fireplace': 'balloons',
};

const REVERSE_LEGACY_TEMPLATE_ID_MAP: Record<string, string> = {
  default: 'classic',
  confetti: 'snowy-night',
  balloons: 'cozy-fireplace',
};

const PRESET_THEME_IDS = new Set([
  'default',
  'confetti',
  'balloons',
  'romantic-roses',
  'sweet-hearts',
  'starlit-sky',
]);

const normalizeTemplateId = (value?: string | null): string => {
  if (!value) return 'default';
  return LEGACY_TEMPLATE_ID_MAP[value] ?? value;
};

const getLegacyTemplateId = (value: string): string | undefined => {
  return REVERSE_LEGACY_TEMPLATE_ID_MAP[value];
};

/**
 * Safely parse JSON with fallback
 */
const safeJsonParse = <T,>(json: string | null | undefined, fallback: T): T => {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

/**
 * Parse a birthday string (YYYY-MM-DD) as a local date to avoid timezone shifts
 */
const parseBirthdayAsLocalDate = (birthday: string): Date => {
  const [year, month, day] = birthday.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Format a date as YYYY-MM-DD in local timezone
 */
const formatDateAsLocalString = (date: Date): string => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function ECardsContent() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { t, currentLanguage } = useLanguage();
  const { user: currentUser } = useAuth();
  const defaultPreviewTitle = t('ecards.preview.defaultTitle');
  const christmasThemes = useMemo(() => ([
    {
      id: 'default',
      legacyId: 'classic',
      name: t('ecards.themes.christmas.classic'),
      image: 'https://images.unsplash.com/photo-1478479474071-8a3014c1c15a?q=80&w=600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      overlay: 'bg-black/30',
      decorations: (
        <>
          <span className="absolute left-4 top-4 text-2xl opacity-90">🎄</span>
          <span className="absolute right-4 bottom-4 text-xl opacity-80">🎁</span>
        </>
      )
    },
  ]), [t]);

  const stPatrickThemes = useMemo(() => ([
    {
      id: 'shamrock-charm',
      name: t('ecards.themes.stPatricksDay.shamrockCharm'),
      image: 'https://images.unsplash.com/photo-1641803216396-7d82c43e71fb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4MDQ0MjZ8MHwxfHNlYXJjaHw1OHx8Y2xvdmVyfGVufDB8fHx8MTc2MDQ4MTY2MHww&ixlib=rb-4.1.0&q=80&w=1080',
      overlay: 'bg-black/20',
      decorations: (
        <>
          <span className="absolute left-3 top-3 text-2xl opacity-90">🍀</span>
          <span className="absolute right-4 bottom-4 text-xl opacity-80">✨</span>
        </>
      )
    },
  ]), [t]);

  const mothersThemes = useMemo(() => ([
    {
      id: 'floral-delight',
      name: t('ecards.themes.mothersDay.floralDelight'),
      image: 'https://images.unsplash.com/photo-1493090922049-99b5dc69f3f1?q=80&w=600&auto=format&fit=crop&ixlib=rb-4.1.0',
      overlay: 'bg-black/20',
      decorations: (
        <>
          <span className="absolute left-3 top-3 text-2xl opacity-90">🌷</span>
          <span className="absolute right-4 bottom-4 text-xl opacity-80">💗</span>
        </>
      )
    },
  ]), [t]);

  const fathersThemes = useMemo(() => ([
    {
      id: 'classic-tools',
      name: t('ecards.themes.fathersDay.classicTools'),
      image: 'https://images.unsplash.com/photo-1468852779134-1e7d5f3a3b09?q=80&w=600&auto=format&fit=crop&ixlib=rb-4.1.0',
      overlay: 'bg-black/20',
      decorations: (
        <>
          <span className="absolute left-3 top-3 text-2xl opacity-90">🛠️</span>
          <span className="absolute right-4 bottom-4 text-xl opacity-80">🧰</span>
        </>
      )
    },
  ]), [t]);

  const independenceThemes = useMemo(() => ([
    {
      id: 'stars-and-stripes',
      name: t('ecards.themes.independenceDay.starsAndStripes'),
      image: 'https://images.unsplash.com/photo-1531718748519-a5fbb6cf972d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4MDQ0MjZ8MHwxfHNlYXJjaHwxMnx8aW5kZXBlbmRlbmNlJTIwZGF5fGVufDB8fHx8MTc2MDQ4MTI1N3ww&ixlib=rb-4.1.0&q=80&w=1080',
      overlay: 'bg-black/30',
      decorations: (
        <>
          <span className="absolute left-3 top-3 text-2xl opacity-90">⭐</span>
          <span className="absolute right-4 bottom-4 text-xl opacity-80">🎇</span>
        </>
      )
    },
  ]), [t]);

  const easterThemes = useMemo(() => ([
    {
      id: 'pastel-eggs',
      name: t('ecards.themes.easter.pastelEggs'),
      image: 'https://images.unsplash.com/photo-1618418359809-0758e4cc4f3f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4MDQ0MjZ8MHwxfHNlYXJjaHw1fHxlYXN0ZXJ8ZW58MHx8fHwxNzYwNDgwOTMxfDA&ixlib=rb-4.1.0&q=80&w=1080',
      overlay: 'bg-black/20',
      decorations: (
        <>
          <span className="absolute left-3 top-3 text-2xl opacity-90">🥚</span>
          <span className="absolute right-4 bottom-4 text-xl opacity-80">🎨</span>
        </>
      )
    },
  ]), [t]);

  const newYearThemes = useMemo(() => ([
    {
      id: 'midnight-sparkles',
      name: t('ecards.themes.newYear.midnightSparkles'),
      image: 'https://images.unsplash.com/photo-1482329833197-916d32bdae74?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4MDQ0MjZ8MHwxfHNlYXJjaHw0fHxuZXclMjB5ZWFyfGVufDB8fHx8MTc2MDQ4MDg2MXww&ixlib=rb-4.1.0&q=80&w=1080',
      overlay: 'bg-black/40',
      decorations: (
        <>
          <span className="absolute left-3 top-3 text-2xl opacity-90">🎆</span>
          <span className="absolute right-4 bottom-4 text-xl opacity-80">🎇</span>
        </>
      )
    },
  ]), [t]);

  const valentineThemes = useMemo(() => ([
    {
      id: 'romantic-roses',
      name: t('ecards.themes.valentine.roses'),
      image: 'https://images.unsplash.com/photo-1581022295087-35e593704911?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4MDQ0MjZ8MHwxfHNlYXJjaHwxfHx2YWxlbnRpbmVzJTIwZGF5fGVufDB8fHx8MTc2MDQ4MTY5NHww&ixlib=rb-4.1.0&q=80&w=1080',
      overlay: 'bg-black/30',
      decorations: (
        <>
          <span className="absolute left-3 top-3 text-2xl opacity-90">🌹</span>
          <span className="absolute right-4 bottom-4 text-xl opacity-80">💌</span>
        </>
      )
    },
  ]), [t]);

  const themeMetadataById = useMemo(() => {
    const map: Record<string, { image?: string | null }> = {};
    const registerThemes = (themes: Array<{ id: string; image?: string | null }>) => {
      themes.forEach((theme) => {
        map[theme.id] = {
          image: theme.image ?? null,
        };
      });
    };

    registerThemes(christmasThemes);
    registerThemes(stPatrickThemes);
    registerThemes(mothersThemes);
    registerThemes(fathersThemes);
    registerThemes(independenceThemes);
    registerThemes(easterThemes);
    registerThemes(newYearThemes);
    registerThemes(valentineThemes);

    return map;
  }, [
    christmasThemes,
    stPatrickThemes,
    mothersThemes,
    fathersThemes,
    independenceThemes,
    easterThemes,
    newYearThemes,
    valentineThemes,
  ]);

  // Initialize activeTab based on URL parameter or default to "themes"
  const [activeTab, setActiveTab] = useState<"themes" | "settings">(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab && ['themes', 'settings'].includes(tab)) {
      return tab as "themes" | "settings";
    }
    return "themes";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [birthdayModalOpen, setBirthdayModalOpen] = useState(false);
  const [birthdayDraft, setBirthdayDraft] = useState<Date | undefined>(undefined);
  const [birthdayContactId, setBirthdayContactId] = useState<string | null>(null);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [designerThemeId, setDesignerThemeId] = useState<string | null>(null);

  // State for real-time custom theme preview
  const [customThemePreview, setCustomThemePreview] = useState<CustomThemeData | null>(null);

  // Stable handler to open the designer with a theme id
  const handleOpenDesigner = useCallback((themeId: string) => {
    setDesignerThemeId(themeId);
    setDesignerOpen(true);
  }, []);

  // State for real-time preview of all themes (including default themes with customizations)
  const [themePreviewData, setThemePreviewData] = useState<{ [key: string]: CustomThemeData }>({});

  // State for promotion selection (legacy - kept for backward compatibility)
  const [selectedPromotions, setSelectedPromotions] = useState<string[]>([]);
  const [splitPromotionalEmail, setSplitPromotionalEmail] = useState<boolean>(false);

  // State for card-specific promotions: { themeId: [promotionId1, promotionId2, ...] }
  const [cardPromotions, setCardPromotions] = useState<Record<string, string[]>>({});

  // State for disabled holidays
  const [disabledHolidays, setDisabledHolidays] = useState<string[]>([]);

  // State for custom card toggle loading
  const [customCardToggleLoading, setCustomCardToggleLoading] = useState(false);

  // Customer modal state
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Contact | null>(null);

  // Custom cards state - stores user-created custom cards
  const [customCards, setCustomCards] = useState<Array<{
    id: string;
    active: boolean;
    name: string;
    sendDate: string; // ISO date string (YYYY-MM-DD)
    occasionType?: string; // Type of occasion/holiday
    data: CustomThemeData;
  }>>([]);

  // Card filter state for themes tab
  const [cardFilter, setCardFilter] = useState<"active" | "inactive">("active");

  // O(1) lookup for disabled holidays
  const disabledSet = useMemo(() => new Set(disabledHolidays || []), [disabledHolidays]);

  // Consolidated holiday sections for rendering
  const holidaySections = useMemo(() => (
    [
      { id: 'valentine', label: t('ecards.sectionLabels.valentinesDay'), themes: valentineThemes, defaultTitle: t('ecards.preview.valentinesDay') },
      { id: 'stpatrick', label: t('ecards.sectionLabels.stPatricksDay'), themes: stPatrickThemes, defaultTitle: t('ecards.preview.stPatricksDay') },
      { id: 'newyear', label: t('ecards.sectionLabels.newYearsDay'), themes: newYearThemes, defaultTitle: t('ecards.preview.newYearsDay') },
      { id: 'easter', label: t('ecards.sectionLabels.easter'), themes: easterThemes, defaultTitle: t('ecards.preview.easter') },
      { id: 'independence', label: t('ecards.sectionLabels.independenceDay'), themes: independenceThemes, defaultTitle: t('ecards.preview.independenceDay') },
    ]
  ), [t, valentineThemes, stPatrickThemes, newYearThemes, easterThemes, independenceThemes]);

  // Fetch custom cards from API with React Query
  const {
    data: customCardsData,
    isLoading: customCardsLoading,
    refetch: refetchCustomCards
  } = useQuery({
    queryKey: ['/api/custom-cards'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/custom-cards');
        if (!response.ok) {
          throw new Error('Failed to fetch custom cards');
        }
        return await response.json();
      } catch (error) {
        console.warn('Failed to fetch custom cards:', error);
        return [];
      }
    },
  });

  // Update local state when data is fetched
  useEffect(() => {
    if (customCardsData) {
      // Transform API data to match local state format
      const transformed = customCardsData.map((card: any) => {
        try {
          const parsedData = JSON.parse(card.cardData);
          console.log('📦 [Custom Card API] Parsed card data:', {
            id: card.id,
            name: card.name,
            hasImageUrl: !!parsedData.imageUrl,
            imageUrl: parsedData.imageUrl,
            customImage: parsedData.customImage,
            parsedData
          });
          return {
            id: card.id,
            active: card.active ?? true,
            name: card.name,
            sendDate: card.sendDate,
            occasionType: card.occasionType,
            data: parsedData,
          };
        } catch (error) {
          console.error('Error parsing card data:', error);
          // Return card with empty data if parsing fails
          return {
            id: card.id,
            active: card.active ?? true,
            name: card.name,
            sendDate: card.sendDate,
            occasionType: card.occasionType,
            data: {
              title: '',
              message: '',
              signature: '',
              imageUrl: null,
              customImage: false,
              imagePosition: { x: 0, y: 0 },
              imageScale: 1,
            },
          };
        }
      });
      setCustomCards(transformed);
    }
  }, [customCardsData]);

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
      if (tab && ['themes', 'settings'].includes(tab)) {
        setActiveTab(tab as "themes" | "settings");
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
    data: eCardSettings,
    isLoading: settingsLoading,
    refetch: refetchSettings
  } = useQuery<ECardSettings>({
    queryKey: ['/api/e-card-settings'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/e-card-settings');
        if (!response.ok) throw new Error('Failed to fetch settings');
        const data = await response.json();
        console.log('📥 [Birthday Settings] Fetched settings:', data);
        return data || {
          id: '',
          enabled: false,
          emailTemplate: 'default',
          segmentFilter: 'all',
          customMessage: '',
          senderName: company?.name || 'Your Company',
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
          senderName: company?.name || 'Your Company',
          promotionId: null,
          promotion: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
    },
  });

  // Memoized parsed customThemeData to avoid repeated JSON parsing (normalized shape)
  const parsedCustomThemeData = useMemo<CustomThemeStore>(() => {
    return buildThemeStore(eCardSettings?.customThemeData);
  }, [eCardSettings?.customThemeData]);

  // Debounced search and contacts query with derived selects
  const debouncedSearch = useDebounce(searchQuery, 300);
  const {
    data: contactsData,
    isLoading: contactsLoading,
    refetch: refetchContacts
  } = useQuery({
    queryKey: ['/api/email-contacts', debouncedSearch, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await apiRequest('GET', `/api/email-contacts?${params.toString()}`);
      return response.json();
    },
    select: (data: any) => {
      const contacts: Contact[] = data?.contacts ?? [];
      const customersWithBirthdays: Contact[] = contacts.filter(c => c.birthday);
      return { contacts, customersWithBirthdays };
    },
    placeholderData: (prev) => prev,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    refetchOnWindowFocus: false,
  });

  // Extract contacts and derived birthdays from query select
  const contacts: Contact[] = contactsData?.contacts || [];
  const customersWithBirthdays: Contact[] = contactsData?.customersWithBirthdays || [];

  // Fetch user's company for business name
  const { data: company } = useQuery({
    queryKey: ["/api/company"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/company");
      const data = await response.json();
      return data.company as { id: string; name: string; owner: any } | null;
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  // Update birthday settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<ECardSettings>) => {
      console.log('📤 [Birthday Settings] Sending update:', settings);
      const response = await fetch('/api/e-card-settings', {
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
      console.log('📌 [Birthday Settings] customThemeData value:', updatedSettings?.customThemeData);
      console.log('📌 [Birthday Settings] customThemeData type:', typeof updatedSettings?.customThemeData);
      
      toast({
        title: "Success",
        description: "E-card settings updated successfully",
      });
      
      // Update the query cache immediately with the server response (same as /birthdays)
      queryClient.setQueryData(['/api/e-card-settings'], updatedSettings);
      console.log('💾 [Birthday Settings] Cache updated');
      
      // Force a re-render by invalidating the query
      queryClient.invalidateQueries({ queryKey: ['/api/e-card-settings'] });
      console.log('🔄 [Birthday Settings] Query invalidated, will refetch');
    },
    onError: (error: any) => {
      console.error('🎨 [Birthday Cards] Update settings error:', error);

      // Try to extract error message from response
      let errorMessage = "Failed to update e-card settings";
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
        description: "E-card email preference updated",
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
        title: t('ecards.cardsSent') || "E-Cards Sent",
        description: `Successfully sent ${summary.successful} of ${summary.total} e-cards${summary.failed > 0 ? ` (${summary.failed} failed)` : ''}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error') || "Error",
        description: error.message || "Failed to send e-cards",
        variant: "destructive",
      });
    },
  });

  // Handle send e-card
  const handleSendBirthdayCard = () => {
    if (selectedContacts.length === 0) return;

    const confirmMessage = selectedContacts.length === 1
      ? 'Are you sure you want to send an e-card to this customer?'
      : `Are you sure you want to send e-cards to ${selectedContacts.length} customers?`;

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
        description: `E-card email preferences updated for ${variables.contactIds.length} customer(s)`,
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
    if (eCardSettings?.promotion) {
      setSelectedPromotions([eCardSettings.promotion.id]);
    } else {
      setSelectedPromotions([]);
    }
    setSplitPromotionalEmail(eCardSettings?.splitPromotionalEmail || false);
    setDisabledHolidays(eCardSettings?.disabledHolidays || []);

    // Load card-specific promotions from customThemeData
    if (parsedCustomThemeData.cardPromotions) {
      setCardPromotions(parsedCustomThemeData.cardPromotions);
    }
  }, [eCardSettings?.promotion, eCardSettings?.splitPromotionalEmail, eCardSettings?.disabledHolidays, parsedCustomThemeData]);

  // Memoized initial data for ECardDesignerDialog to prevent re-render loops
  const cardDesignerInitialData = useMemo(() => {
    // Check if we're editing a custom card by looking for it in customCards array
    const existingCard = designerThemeId ? customCards.find(c => c.id === designerThemeId) : null;
    
    if (existingCard) {
      // Editing an existing custom card
      const hasImage = Boolean(existingCard.data.imageUrl);
      console.log('🔍 [Edit Custom Card] Loading data for:', existingCard.id, {
        name: existingCard.name,
        hasImageUrl: hasImage,
        imageUrl: existingCard.data.imageUrl,
        originalCustomImage: existingCard.data.customImage,
        willSetCustomImage: hasImage ? true : (existingCard.data.customImage || false),
        fullData: existingCard.data
      });
      return {
        ...existingCard.data,
        customImage: hasImage ? true : (existingCard.data.customImage || false),
        cardName: existingCard.name,
        sendDate: existingCard.sendDate,
        occasionType: existingCard.occasionType || '',
      };
    }
    
    // Check if creating a new custom card (designerThemeId starts with 'custom-')
    if (designerThemeId && designerThemeId.startsWith('custom-')) {
      // New custom card - return empty data
      return {
        title: '',
        description: '',
        message: '',
        signature: '',
        imageUrl: null,
        customImage: false,
        imagePosition: { x: 0, y: 0 },
        imageScale: 1,
        cardName: '',
        sendDate: '',
        occasionType: '',
      };
    }

    // Resolve current theme id once and use it for namespaced draft keys
    const currentThemeId = designerThemeId || 'default';
    const themeMetadata = themeMetadataById[currentThemeId];

    // PRIORITY 1: Load from localStorage draft first (for most recent changes)
    try {
      const raw = localStorage.getItem(`eCardDesignerDraft:${currentThemeId}`);
      if (raw) {
        console.log('📥 [Card Designer Initial Data] Using localStorage draft for theme:', currentThemeId);
        const draftData = JSON.parse(raw);
        return draftData;
      }
    } catch (error) {
      console.warn('⚠️ [Card Designer Initial Data] Failed to parse localStorage draft:', error);
    }

    // PRIORITY 2: Load from database (customThemeData)
    console.log('🔍 [Card Designer Initial Data] eCardSettings.customThemeData:', eCardSettings?.customThemeData, 'Type:', typeof eCardSettings?.customThemeData);
    if (eCardSettings?.customThemeData) {
      const parsed = parsedCustomThemeData;
      console.log('✅ [Card Designer Initial Data] Using parsed customThemeData:', parsed);

      let themeSpecificData: CustomThemeData | null = null;

      // Normalized store always has themes; prefer exact themeId, then fall back to 'custom'
      if (parsed.themes && parsed.themes[currentThemeId]) {
        themeSpecificData = parsed.themes[currentThemeId];
        console.log('✅ [Card Designer Initial Data] Found theme-specific data from DB:', themeSpecificData);
      } else if (currentThemeId === 'custom' && parsed.themes.custom) {
        themeSpecificData = parsed.themes.custom;
      }

      if (themeSpecificData) {
        console.log('📤 [Card Designer Initial Data] Returning DB data for theme:', currentThemeId);
        return {
          title: themeSpecificData.title || '',
          description: themeSpecificData.description || '',
          message: themeSpecificData.message || eCardSettings?.customMessage || '',
          signature: themeSpecificData.signature || '',
          imageUrl: themeSpecificData.imageUrl || themeMetadata?.image || null,
          customImage: Boolean(themeSpecificData.customImage && themeSpecificData.imageUrl),
          imagePosition: themeSpecificData.imagePosition || { x: 0, y: 0 },
          imageScale: themeSpecificData.imageScale || 1,
        };
      }
    }

    // PRIORITY 3: Default empty data if no saved data found
    console.log('🆕 [Card Designer Initial Data] No saved data found, returning defaults for theme:', currentThemeId);
    
    // Map theme IDs to their default titles
    const defaultTitlesByTheme: Record<string, string> = {
      'default': t('ecards.preview.defaultTitle') || 'Merry Christmas!',
      'romantic-roses': t('ecards.preview.valentinesDay') || "Happy Valentine's Day!",
      'sweet-hearts': t('ecards.preview.valentinesDay') || "Happy Valentine's Day!",
      'shamrock-charm': t('ecards.preview.stPatricksDay') || "Happy St. Patrick's Day!",
      'floral-delight': "Happy Mother's Day!",
      'classic-tools': "Happy Father's Day!",
      'stars-and-stripes': t('ecards.preview.independenceDay') || "Happy Independence Day!",
      'pastel-eggs': t('ecards.preview.easter') || "Celebrate Easter with Joy!",
      'midnight-sparkles': t('ecards.preview.newYearsDay') || "Happy New Year!",
    };
    
    const defaultTitle = defaultTitlesByTheme[currentThemeId] || '';
    
    return {
      title: defaultTitle,
      description: '',
      message: eCardSettings?.customMessage || '',
      signature: '',
      imageUrl: themeMetadata?.image ?? null,
      customImage: false, // This is key - tells the dialog it's NOT a custom image
      imagePosition: { x: 0, y: 0 },
      imageScale: 1,
    };
  }, [
    eCardSettings?.customThemeData,
    eCardSettings?.customMessage,
    designerThemeId,
    customCards,
    themeMetadataById,
    t,
  ]);

  const handleSettingsUpdate = (field: keyof ECardSettings, value: any) => {
    if (eCardSettings) {
      updateSettingsMutation.mutate({
        ...eCardSettings,
        [field]: value,
      });
    }
  };

  const handleToggleGlobalEnabled = () => {
    if (eCardSettings) {
      handleSettingsUpdate('enabled', !eCardSettings.enabled);
    }
  };

  // Helper function to get parent holiday ID from theme variant ID
  const getParentHolidayId = (themeId: string): string | null => {
    // Check each holiday theme array to find which one contains this theme ID
    if (valentineThemes.some(t => t.id === themeId)) return 'valentine';
    if (stPatrickThemes.some(t => t.id === themeId)) return 'stpatrick';
    if (newYearThemes.some(t => t.id === themeId)) return 'newyear';
    if (easterThemes.some(t => t.id === themeId)) return 'easter';
    if (independenceThemes.some(t => t.id === themeId)) return 'independence';
    // If it's already a parent holiday ID or not found, return the original ID
    return themeId;
  };

  // Handler for toggling holiday disabled state
  const handleToggleHoliday = (holidayId: string) => {
    if (eCardSettings) {
      // Get the parent holiday ID if this is a theme variant
      const parentHolidayId = getParentHolidayId(holidayId) || holidayId;
      const currentDisabled = disabledHolidays || [];
      const newDisabled = currentDisabled.includes(parentHolidayId)
        ? currentDisabled.filter(id => id !== parentHolidayId)
        : [...currentDisabled, parentHolidayId];
      
      setDisabledHolidays(newDisabled);
      
      updateSettingsMutation.mutate({
        ...eCardSettings,
        disabledHolidays: newDisabled,
      });
    }
  };

  // Handler for toggling custom card active state
  const handleToggleCustomCardActive = async () => {
    const isCustomCard = designerThemeId && (
      designerThemeId.startsWith('custom-') || 
      customCards.some(c => c.id === designerThemeId)
    );
    
    if (isCustomCard) {
      const card = customCards.find(c => c.id === designerThemeId);
      if (!card) return;

      setCustomCardToggleLoading(true);
      try {
        const response = await fetch(`/api/custom-cards/${designerThemeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            active: !card.active,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update card status');
        }

        // Invalidate and refetch custom cards to update the list with fresh data
        await queryClient.invalidateQueries({ queryKey: ['/api/custom-cards'] });

        toast({
          title: "Card Updated",
          description: `Card is now ${!card.active ? 'active' : 'inactive'}.`,
        });
      } catch (error) {
        console.error('Error toggling custom card active state:', error);
        toast({
          title: "Update Failed",
          description: "Failed to update card status. Please try again.",
          variant: "destructive",
        });
      } finally {
        setCustomCardToggleLoading(false);
      }
    }
  };

  // Handler for promotion selection changes (legacy)
  const handlePromotionsChange = (promotionIds: string[]) => {
    setSelectedPromotions(promotionIds);
    if (eCardSettings) {
      const promotionId = promotionIds.length > 0 ? promotionIds[0] : null;
      updateSettingsMutation.mutate({
        id: eCardSettings.id,
        enabled: eCardSettings.enabled,
        emailTemplate: eCardSettings.emailTemplate || 'default',
        segmentFilter: eCardSettings.segmentFilter || 'all',
        customMessage: eCardSettings.customMessage || '',
        senderName: eCardSettings.senderName || '',
        customThemeData: eCardSettings.customThemeData,
        promotionId: promotionId,
        splitPromotionalEmail: splitPromotionalEmail,
      });
    }
  };

  // Handler for card-specific promotion changes
  const handleCardPromotionsChange = (themeId: string, promotionIds: string[]) => {
    const updatedCardPromotions = {
      ...cardPromotions,
      [themeId]: promotionIds
    };
    setCardPromotions(updatedCardPromotions);

    if (eCardSettings) {
      // Use parsed data instead of parsing again
      const existingThemeData = parsedCustomThemeData;

      // Update with card promotions
      const updatedThemeData = {
        ...existingThemeData,
        cardPromotions: updatedCardPromotions
      };

      updateSettingsMutation.mutate({
        ...eCardSettings,
        customThemeData: JSON.stringify(updatedThemeData),
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
        title: t('ecards.toasts.noActionNeeded'),
        description: t('ecards.toasts.noBirthdaysSelected'),
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
        title: t('ecards.toasts.noActionNeeded'),
        description: t('ecards.toasts.noBirthdaysSelected'),
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
      toast({ title: t('ecards.toasts.birthdayUpdated') });
      setBirthdayModalOpen(false);
      setBirthdayDraft(undefined);
      setBirthdayContactId(null);
      refetchContacts();
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error?.message || t('ecards.toasts.birthdayUpdateError'), variant: "destructive" });
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
      // Call the direct API endpoint (no longer requires temporal server)
      const response = await apiRequest('POST', `/api/birthday-invitation/${contactId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invitation');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('ecards.toasts.invitationSent') });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error?.message || t('ecards.toasts.invitationError'), variant: "destructive" });
    },
  });

  // Initialize custom theme preview from birthday settings
  useEffect(() => {
    if (eCardSettings?.customThemeData) {
      const parsedData = parsedCustomThemeData;

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
    } else {
      setCustomThemePreview(null);
      // Clear themePreviewData['custom'] if no saved data
      setThemePreviewData(prev => {
        const newData = { ...prev };
        delete newData.custom;
        return newData;
      });
    }
  }, [parsedCustomThemeData, eCardSettings?.customThemeData]);

  // Callback for real-time preview updates
  const handlePreviewChange = useCallback((previewData: {
    title?: string;
    description?: string;
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
        description: previewData.description || '',
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
        description: "Please select customers first",
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
        description: "All selected customers already have dates set",
        variant: "destructive",
      });
      return;
    }

    const confirmMessage = contactsWithoutBirthdays.length === 1
      ? 'Are you sure you want to send a date request email to 1 customer?'
      : `Are you sure you want to send date request emails to ${contactsWithoutBirthdays.length} customers?`;

    if (window.confirm(confirmMessage)) {
      // Send invitations sequentially
      contactsWithoutBirthdays.forEach(contactId => {
        handleSendBirthdayInvitation(contactId);
      });
      setSelectedContacts([]);
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
    <div key={currentLanguage} className="min-h-screen overflow-x-hidden">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
          <Button
            variant={activeTab === "themes" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("themes")}
            className="flex items-center gap-2"
          >
            <Palette className="h-4 w-4" />
            {t('ecards.tabs.themesButton') || 'General'}
          </Button>
          <Button
            variant={activeTab === "settings" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("settings")}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            {t('ecards.tabs.settings')}
          </Button>
        </div>

        {/* Themes Tab */}
        {activeTab === "themes" && (
          <Card className="w-11/12">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                {t('ecards.tabs.themes')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Card Filter Tabs */}
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit mb-6">
                <Button
                  variant={cardFilter === "active" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCardFilter("active")}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  {t('ecards.cards.active')}
                  <Badge variant="secondary" className="ml-1">
                    {5 - disabledHolidays.length + customCards.filter(c => c.active !== false).length}
                  </Badge>
                </Button>
                <Button
                  variant={cardFilter === "inactive" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCardFilter("inactive")}
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  {t('ecards.cards.inactive')}
                  <Badge variant="secondary" className="ml-1">
                    {disabledHolidays.length + customCards.filter(c => c.active === false).length}
                  </Badge>
                </Button>
              </div>

              <div>
                {holidaySections.map((section) => {
                  const isDisabled = disabledSet.has(section.id);
                  const shouldShow = (cardFilter === 'active' && !isDisabled) || (cardFilter === 'inactive' && isDisabled);
                  if (!shouldShow) return null;
                  return (
                    <div className="mt-6" key={section.id}>
                      <Label className="text-sm">{section.label}</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-2">
                        {section.themes.map((theme) => (
                          <ThemeCard
                            key={theme.id}
                            theme={theme}
                            themePreviewData={themePreviewData}
                            parsedCustomThemeData={parsedCustomThemeData}
                            defaultTitle={section.defaultTitle}
                            previewLabel={t('ecards.previewLabel')}
                            onCardClick={handleOpenDesigner}
                            disabled={updateSettingsMutation.isPending}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Custom Cards Section */}
                {cardFilter === "active" && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-lg font-semibold">{t('ecards.cards.custom')}</Label>
                    <Button
                      onClick={() => {
                        const newCardId = `custom-${Date.now()}`;
                        setDesignerThemeId(newCardId);
                        setDesignerOpen(true);
                      }}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      {t('ecards.cards.createCustom')}
                    </Button>
                  </div>
                  
                  {customCards.filter(c => c.active !== false).length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
                      <Palette className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium mb-1">{t('ecards.cards.noCustomCards')}</p>
                      <p className="text-sm text-gray-500 mb-4">{t('ecards.cards.noCustomCardsDescription')}</p>
                      <Button
                        onClick={() => {
                          const newCardId = `custom-${Date.now()}`;
                          setDesignerThemeId(newCardId);
                          setDesignerOpen(true);
                        }}
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t('ecards.cards.createFirstCard')}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      {customCards.filter(c => c.active !== false).map((card) => {
                        console.log('🖼️ Rendering custom card:', { id: card.id, name: card.name, imageUrl: card.data.imageUrl, hasImageUrl: !!card.data.imageUrl });
                        const isSelected = eCardSettings?.emailTemplate === card.id;
                        return (
                          <div
                            key={card.id}
                            className="relative rounded-xl border border-gray-200 hover:border-gray-300 p-3 transition-colors"
                          >
                            <div className="relative h-40 rounded-lg overflow-hidden bg-gray-100">
                              {card.data.imageUrl ? (
                                <>
                                  <img
                                    src={card.data.imageUrl}
                                    alt={card.name}
                                    className="absolute inset-0 h-full w-full object-cover z-0"
                                    onError={(e) => {
                                      console.error('🖼️ Image failed to load:', card.data.imageUrl, e);
                                      // Hide the failed image
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                    onLoad={() => {
                                      console.log('🖼️ Image loaded successfully:', card.data.imageUrl);
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/20 z-10" />
                                  <div className="absolute inset-0 flex items-center justify-center z-20">
                                    <div className="text-center px-2">
                                      <div className="font-bold text-white drop-shadow-lg text-shadow line-clamp-2">
                                        {card.data.title || card.name}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Palette className="h-12 w-12 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="mt-2 space-y-1">
                              <div>
                                <span className="text-sm font-medium text-gray-900 truncate">{card.name}</span>
                              </div>
                              {card.occasionType && (
                                <div className="text-xs text-gray-600 font-medium">
                                  🎉 {card.occasionType}
                                </div>
                              )}
                              <div className="text-xs text-gray-500">
                                📅 {t('ecards.cards.sendsOn')} {new Date(card.sendDate).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="mt-2 space-y-2">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => {
                                    setDesignerThemeId(card.id);
                                    setDesignerOpen(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  {t('common.edit')}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    if (confirm(`Delete "${card.name}"? This cannot be undone.`)) {
                                      try {
                                        const response = await fetch(`/api/custom-cards/${card.id}`, {
                                          method: 'DELETE',
                                        });

                                        if (!response.ok) {
                                          throw new Error('Failed to delete card');
                                        }

                                        // Refetch custom cards to update the list
                                        await refetchCustomCards();

                                        toast({
                                          title: "Card Deleted",
                                          description: `"${card.name}" has been deleted.`,
                                        });
                                      } catch (error) {
                                        console.error('Error deleting custom card:', error);
                                        toast({
                                          title: "Delete Failed",
                                          description: "Failed to delete card. Please try again.",
                                          variant: "destructive",
                                        });
                                      }
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                )}

                {/* Inactive custom cards section */}
                {cardFilter === "inactive" && (
                  <div className="mt-8">
                    <Label className="text-lg font-semibold">{t('ecards.cards.inactiveCustom')}</Label>
                    {customCards.filter(card => card.active === false).length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 mt-4">
                        <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 font-medium mb-1">{t('ecards.cards.noInactiveCards')}</p>
                        <p className="text-sm text-gray-500">{t('ecards.cards.noInactiveCardsDescription')}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
                        {customCards.filter(card => card.active === false).map((card) => (
                          <div
                            key={card.id}
                            className="relative rounded-xl border p-3 border-gray-200 hover:border-gray-300 opacity-60"
                          >
                            <div className="relative h-40 rounded-lg overflow-hidden bg-gray-100">
                              {card.data.imageUrl ? (
                                <>
                                  <img
                                    src={card.data.imageUrl}
                                    alt={card.name}
                                    className="absolute inset-0 h-full w-full object-cover z-0"
                                    onError={(e) => {
                                      console.error('🖼️ Inactive card image failed to load:', card.data.imageUrl, e);
                                      // Hide the failed image
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                    onLoad={() => {
                                      console.log('🖼️ Inactive card image loaded successfully:', card.data.imageUrl);
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/20 z-10" />
                                  <div className="absolute inset-0 flex items-center justify-center z-20">
                                    <div className="text-center px-2">
                                      <div className="font-bold text-white drop-shadow-lg text-shadow line-clamp-2">
                                        {card.data.title || card.name}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Palette className="h-12 w-12 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900 truncate">{card.name}</span>
                                <span className="text-xs font-semibold text-gray-500">Inactive</span>
                              </div>
                              {card.occasionType && (
                                <div className="text-xs text-gray-600 font-medium">
                                  🎉 {card.occasionType}
                                </div>
                              )}
                              <div className="text-xs text-gray-500">
                                📅 {t('ecards.cards.sendsOn')} {new Date(card.sendDate).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  setDesignerThemeId(card.id);
                                  setDesignerOpen(true);
                                }}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                {t('common.edit')}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state for inactive holiday cards */}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card Designer */}
        <Suspense fallback={null}>
        <ECardDesignerDialog
          open={designerOpen}
          onOpenChange={(open: boolean) => {
            setDesignerOpen(open);
            
            // When opening, refetch latest data from database
            if (open) {
              console.log('🔄 [Card Designer] Dialog opened, refetching latest data from DB');
              refetchSettings();
            }
            
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
          themeMetadataById={themeMetadataById}
          onSave={async (data: any) => {
            console.log('💾 [onSave] Received data from ECardDesignerDialog:', {
              imageUrl: data.imageUrl,
              customImage: (data as any).customImage,
              title: data.title,
              hasImageUrl: !!data.imageUrl
            });

            try {
              localStorage.setItem(`eCardDesignerDraft:${data.themeId || designerThemeId || 'default'}`, JSON.stringify({ title: data.title, description: data.description, message: data.message, signature: data.signature, imageUrl: data.imageUrl, themeId: data.themeId, customImage: (data as any).customImage }));
            } catch { }

            // Create theme data for preview updates
            const themeData: CustomThemeData = {
              title: data.title,
              description: data.description,
              message: data.message,
              signature: data.signature || '',
              imageUrl: data.imageUrl || null,
              customImage: (data as any).customImage || false,
              imagePosition: (data as any).imagePosition || { x: 0, y: 0 },
              imageScale: (data as any).imageScale || 1,
            };

            console.log('💾 [onSave] Created themeData:', {
              imageUrl: themeData.imageUrl,
              customImage: themeData.customImage,
              hasImageUrl: !!themeData.imageUrl,
              title: themeData.title,
              message: themeData.message,
              signature: themeData.signature,
              description: themeData.description
            });

            // Check if this is a custom card - either starts with 'custom-' or is found in customCards array
            const isCustomCard = designerThemeId && (
              designerThemeId.startsWith('custom-') || 
              customCards.some(c => c.id === designerThemeId)
            );

            if (isCustomCard) {
              const existingCard = customCards.find(c => c.id === designerThemeId);
              const cardName = (data as any).cardName || existingCard?.name || '';
              const sendDate = (data as any).sendDate || existingCard?.sendDate || '';
              const occasionType = (data as any).occasionType || existingCard?.occasionType || '';

              console.log('💾 [Custom Card Save] Preparing to save custom card:', {
                designerThemeId,
                cardName,
                sendDate,
                occasionType,
                themeDataTitle: themeData.title,
                themeDataMessage: themeData.message,
                themeDataSignature: themeData.signature,
                dataReceived: data
              });

              // Validation is now handled in ECardDesignerDialog
              if (!cardName || !sendDate || !occasionType) {
                toast({
                  title: "Save Failed",
                  description: "Card name, send date, and occasion type are required.",
                  variant: "destructive",
                });
                return;
              }

              // Save or update the custom card via API
              try {
                const existing = customCards.find(c => c.id === designerThemeId);
                const cardPayload = {
                  name: cardName,
                  sendDate,
                  occasionType,
                  active: existing?.active ?? true,
                  cardData: JSON.stringify(themeData),
                  promotionIds: [], // TODO: Add promotion support
                };

                console.log('💾 [Custom Card Save] Payload being sent to API:', {
                  ...cardPayload,
                  cardDataParsed: JSON.parse(cardPayload.cardData)
                });

                let response;
                if (existing) {
                  // Update existing card
                  response = await fetch(`/api/custom-cards/${designerThemeId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cardPayload),
                  });
                } else {
                  // Create new card
                  response = await fetch('/api/custom-cards', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cardPayload),
                  });
                }

                if (!response.ok) {
                  throw new Error('Failed to save custom card');
                }

                // Invalidate and refetch custom cards to update the list with fresh data
                await queryClient.invalidateQueries({ queryKey: ['/api/custom-cards'] });

                toast({
                  title: existing ? "Card Updated" : "Card Created",
                  description: `"${cardName}" (${occasionType}) will be sent on ${new Date(sendDate).toLocaleDateString()}.`,
                });

                setDesignerOpen(false);
                return;
              } catch (error) {
                console.error('Error saving custom card:', error);
                toast({
                  title: "Save Failed",
                  description: "Failed to save custom card. Please try again.",
                  variant: "destructive",
                });
                return;
              }
            }

            // Update preview state immediately for instant visual feedback
            setThemePreviewData(prev => ({
              ...prev,
              [designerThemeId || 'default']: themeData
            }));

            // Parse existing customThemeData or create new structure
            // IMPORTANT: Get the latest birthday settings from the cache, not from closure
            const latestECardSettings = queryClient.getQueryData<ECardSettings>(['/api/e-card-settings']) || eCardSettings;
            console.log('🔄 [Card Save] Using latest settings from cache. Has themes:', !!latestECardSettings?.customThemeData);
            let existingThemeData: Record<string, any> = {};
            if (latestECardSettings?.customThemeData) {
              try {
                const parsed = JSON.parse(latestECardSettings.customThemeData);
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
            console.log('💾 [Card Save] Saving theme data for:', currentThemeId, 'Data:', themeData);
            const updatedThemeData = {
              ...existingThemeData,
              themes: {
                ...existingThemeData.themes,
                [currentThemeId]: themeData
              }
            };
            console.log('💾 [Card Save] Updated theme data structure:', JSON.stringify(updatedThemeData));

            // Check if user has made any customizations (title, signature, or image)
            const defaultThemeImage = themeMetadataById[currentThemeId]?.image;
            const hasImageCustomization = themeData.imageUrl !== defaultThemeImage;
            const hasTextCustomizations = data.title !== '' || data.signature !== '';
            const hasCustomizations = hasTextCustomizations || hasImageCustomization;

            console.log('🔍 [Card Save] Customization check:', {
              currentThemeId,
              defaultThemeImage,
              currentImageUrl: themeData.imageUrl,
              hasImageCustomization,
              hasTextCustomizations,
              hasCustomizations
            });

            // Save button should save theme-specific data and update emailTemplate to the specific theme variant
            if (designerThemeId === 'custom') {
              console.log('🎨 [Birthday Cards] Saving custom theme data');

              // Update real-time preview immediately for instant visual feedback
              setCustomThemePreview(themeData);

              const savePayload = {
                ...latestECardSettings,
                emailTemplate: 'custom',
                customMessage: data.message,
                customThemeData: JSON.stringify(updatedThemeData),
              };
              console.log('📤 [Card Save] Sending to server:', { customThemeData: savePayload.customThemeData });

              // Update both the custom theme data and keep the email template as custom
              updateSettingsMutation.mutate(savePayload, {
                onSuccess: () => {
                  // Clear localStorage draft since data is now saved to DB
                  try {
                    localStorage.removeItem(`eCardDesignerDraft:${currentThemeId}`);
                    console.log('🗑️ [Card Save] Cleared localStorage draft for theme:', currentThemeId);
                  } catch (error) {
                    console.warn('⚠️ [Card Save] Failed to clear localStorage draft:', error);
                  }
                  
                  toast({
                    title: "Card Saved",
                    description: "Your custom card has been saved.",
                  });
                  
                  setDesignerOpen(false);
                }
              });
            } else if (hasCustomizations || data.message !== (latestECardSettings?.customMessage || '')) {
              // For holiday theme variants with any customizations (text or image), save the theme-specific data
              // and set emailTemplate to the specific theme variant ID
              console.log('🎨 [Birthday Cards] Saving theme-specific customizations for', currentThemeId, 'with data:', themeData);
              
              const savePayload = {
                ...latestECardSettings,
                emailTemplate: currentThemeId, // Set to the specific theme variant ID
                customMessage: data.message,
                customThemeData: JSON.stringify(updatedThemeData), // Save theme-specific data
              };
              console.log('📤 [Card Save] Sending to server (customizations):', { customThemeData: savePayload.customThemeData });

              updateSettingsMutation.mutate(savePayload, {
                onSuccess: () => {
                  // Clear localStorage draft since data is now saved to DB
                  try {
                    localStorage.removeItem(`eCardDesignerDraft:${currentThemeId}`);
                    console.log('🗑️ [Card Save] Cleared localStorage draft for theme:', currentThemeId);
                  } catch (error) {
                    console.warn('⚠️ [Card Save] Failed to clear localStorage draft:', error);
                  }
                  
                  toast({
                    title: "Card Saved",
                    description: "Your card customizations have been saved.",
                  });
                  
                  setDesignerOpen(false);
                }
              });
            } else {
              // For default themes with no customizations, just save the message
              // but still update emailTemplate if we're editing a specific theme
              updateSettingsMutation.mutate({
                ...latestECardSettings,
                emailTemplate: currentThemeId || 'default', // Use current theme ID
                customMessage: data.message,
              }, {
                onSuccess: () => {
                  // Clear localStorage draft since data is now saved to DB
                  try {
                    localStorage.removeItem(`eCardDesignerDraft:${currentThemeId}`);
                    console.log('🗑️ [Card Save] Cleared localStorage draft for theme:', currentThemeId);
                  } catch (error) {
                    console.warn('⚠️ [Card Save] Failed to clear localStorage draft:', error);
                  }
                  
                  toast({
                    title: "Card Saved",
                    description: "Your card has been saved.",
                  });
                  
                  setDesignerOpen(false);
                }
              });
            }
          }}
          senderName={eCardSettings?.senderName}
          businessName={company?.name || currentUser?.name}
          holidayId={designerThemeId || undefined}
          isHolidayDisabled={designerThemeId ? disabledHolidays.includes(getParentHolidayId(designerThemeId) || designerThemeId) : false}
          onToggleHoliday={handleToggleHoliday}
          customCardActive={
            designerThemeId && (designerThemeId.startsWith("custom-") || customCards.some(c => c.id === designerThemeId))
              ? customCards.find(c => c.id === designerThemeId)?.active 
              : undefined
          }
          onToggleCustomCardActive={
            designerThemeId && (designerThemeId.startsWith("custom-") || customCards.some(c => c.id === designerThemeId))
              ? handleToggleCustomCardActive 
              : undefined
          }
          customCardToggleLoading={customCardToggleLoading}
          selectedPromotions={designerThemeId ? (cardPromotions[designerThemeId] || []) : []}
          onPromotionsChange={designerThemeId ? (promotionIds: string[]) => handleCardPromotionsChange(designerThemeId, promotionIds) : undefined}
          hideDescription={false}
        />
        </Suspense>

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Settings */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    {t('ecards.settings.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Global Enable/Disable */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">{t('ecards.settings.enableTitle')}</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('ecards.settings.enableDescription')}
                      </p>
                    </div>
                    <Switch
                      checked={eCardSettings?.enabled || false}
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
                    {t('ecards.settings.overview.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('ecards.settings.overview.totalCustomers')}</span>
                    <Badge variant="outline">{contacts.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('ecards.settings.overview.withBirthdays')}</span>
                    <Badge variant="outline">{customersWithBirthdays.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('ecards.settings.overview.emailsEnabled')}</span>
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
                    {t('ecards.settings.upcomingBirthdays.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {upcomingBirthdays.length === 0 ? (
                    <div className="text-center py-4">
                      <CakeIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('ecards.settings.upcomingBirthdays.noBirthdays')}
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
                      <Label className="text-sm font-medium text-gray-700">Special Date</Label>
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
                    <Label className="text-sm font-medium text-gray-700">E-Card Email Status</Label>
                    {selectedCustomer.birthdayUnsubscribedAt ? (
                      <div className="space-y-1">
                        <Badge className="bg-orange-100 text-orange-800">
                          Unsubscribed from E-Card Emails
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          Unsubscribed on {new Date(selectedCustomer.birthdayUnsubscribedAt).toLocaleString()}
                        </p>
                      </div>
                    ) : selectedCustomer.birthday ? (
                      <Badge className="bg-green-100 text-green-800">
                        Subscribed to E-Card Emails
                      </Badge>
                    ) : (
                      <span className="text-sm text-gray-500">No date set</span>
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

        {/* Special Date Modal */}
        <Dialog open={birthdayModalOpen} onOpenChange={setBirthdayModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {birthdayContactId && contacts.find(c => c.id === birthdayContactId)?.birthday
                  ? t('ecards.modal.editTitle')
                  : t('ecards.modal.addTitle')}
              </DialogTitle>
              <DialogDescription>
                {birthdayContactId && contacts.find(c => c.id === birthdayContactId)?.birthday
                  ? t('ecards.modal.editDescription')
                  : t('ecards.modal.addDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="birthday-date">Special Date</Label>
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
                <Button variant="outline" onClick={() => setBirthdayModalOpen(false)}>{t('ecards.modal.cancel')}</Button>
                <Button onClick={saveBirthday} disabled={!birthdayDraft || !birthdayContactId || updateContactBirthdayMutation.isPending}>{t('ecards.modal.save')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}





