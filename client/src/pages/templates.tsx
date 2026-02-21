import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SINGLE_PURPOSE_PRESETS, type SinglePurposePreset } from "@/config/templatePresets";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle,
  Clock,
  Copy,
  CreditCard,
  Eye,
  Filter,
  Loader2,
  Mail,
  MapPin,
  Monitor,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  Star,
  StarOff,
  Tag,
  Trash2,
  User,
  LayoutDashboard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/LazyRichTextEditor";

const channelOptions = [
  { value: "individual", label: "Individual Email", description: "Send one-to-one emails quickly" },
  { value: "promotional", label: "Promotional", description: "Campaign blasts and seasonal offers" },
  { value: "newsletter", label: "Newsletter", description: "Recurring newsletter layouts" },
  { value: "transactional", label: "Transactional", description: "Receipts, confirmations, and notifications" },
  { value: "single-purpose", label: "Single Purpose", description: "One-off templates for specific occasions" },
];

const categoryOptions = [
  { value: "welcome", label: "Welcome & Onboarding" },
  { value: "retention", label: "Retention & Engagement" },
  { value: "seasonal", label: "Seasonal & Events" },
  { value: "update", label: "Product Updates" },
  { value: "custom", label: "Custom" },
];

type TemplateChannel = (typeof channelOptions)[number]["value"];

type TemplateCategory = (typeof categoryOptions)[number]["value"];

// Template types from API
interface Template {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  subjectLine: string;
  preview?: string | null;
  body: string;
  usageCount: number;
  lastUsed?: string | null;
  isFavorite: boolean;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

interface TemplateStats {
  totalTemplates: number;
  activeTemplates: number;
  favoriteTemplates: number;
  individualTemplates: number;
  promotionalTemplates: number;
  newsletterTemplates: number;
  transactionalTemplates: number;
  averageUsageCount: number;
}

interface TemplatePagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// API helper functions
const fetchTemplates = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  channel?: string;
  category?: string;
  favoritesOnly?: boolean;
  sortBy?: string;
  sortOrder?: string;
}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'all') {
      searchParams.append(key, value.toString());
    }
  });

  const response = await fetch(`/api/templates?${searchParams}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch templates');
  }

  return response.json();
};

const fetchTemplateStats = async (): Promise<TemplateStats> => {
  const response = await fetch('/api/templates/stats', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch template stats');
  }

  return response.json();
};

const createTemplate = async (templateData: CreateTemplatePayload) => {
  const response = await fetch('/api/templates', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(templateData),
  });

  if (!response.ok) {
    throw new Error('Failed to create template');
  }

  return response.json();
};

const updateTemplate = async (id: string, templateData: Partial<CreateTemplatePayload>) => {
  const response = await fetch(`/api/templates/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(templateData),
  });

  if (!response.ok) {
    throw new Error('Failed to update template');
  }

  return response.json();
};

const deleteTemplate = async (id: string) => {
  const response = await fetch(`/api/templates/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete template');
  }

  return response.json();
};

const toggleTemplateFavorite = async (id: string) => {
  const response = await fetch(`/api/templates/${id}/favorite`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to toggle favorite');
  }

  return response.json();
};

const useTemplate = async (id: string) => {
  const response = await fetch(`/api/templates/${id}/use`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to record template usage');
  }

  return response.json();
};

const duplicateTemplate = async (id: string, name?: string) => {
  const response = await fetch(`/api/templates/${id}/duplicate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('Failed to duplicate template');
  }

  return response.json();
};

function hasContent(html: string): boolean {
  // Remove HTML tags and check if there's actual text content
  const text = html.replace(/<[^>]*>/g, '').trim();
  return text.length > 0;
}

/**
 * Validates that a URL uses a safe scheme (http or https only).
 * Rejects javascript:, data:, vbscript:, and other potentially dangerous schemes.
 */
function isSafeUrl(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return false;
  try {
    const parsed = new URL(trimmedUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    const lowerUrl = trimmedUrl.toLowerCase();
    return lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://');
  }
}

const TEMPLATE_VARIABLES = [
  { key: 'first_name', icon: User, labelKey: 'ecards.editor.firstName' },
  { key: 'last_name', icon: User, labelKey: 'ecards.editor.lastName' },
  { key: 'email', icon: Mail, labelKey: 'ecards.editor.emailVar' },
  { key: 'phone', icon: Phone, labelKey: 'ecards.editor.phone' },
  { key: 'address', icon: MapPin, labelKey: 'ecards.editor.address' },
  { key: 'office_hours', icon: Clock, labelKey: 'ecards.editor.officeHours' },
] as const;

const CONTACT_CARD_TEMPLATE = `<p><strong>{{company_name}}</strong></p><p>✉ {{email}}</p><p>☎ {{phone}}</p><p>📍 {{address}}</p>`;

function formatOperatingHours(raw: string | undefined | null): string {
  if (!raw) return 'Mon–Fri 9AM–5PM';
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayAbbr: Record<string, string> = {
      monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
      friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
    };

    const fmt = (t: string) => {
      if (!t || !t.includes(':')) return t;
      const parts = t.split(':');
      if (parts.length !== 2) return t;
      const [hRaw, mRaw] = parts;
      if (!/^\d+$/.test(hRaw) || !/^\d+$/.test(mRaw)) return t;
      const h = Number(hRaw);
      const m = Number(mRaw);
      if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return t;
      const suffix = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
    };

    const groups: { days: string[]; hours: string }[] = [];
    for (const day of dayOrder) {
      const info = data[day];
      const hours = info?.closed ? 'Closed' : info?.open && info?.close ? `${fmt(info.open)}\u2013${fmt(info.close)}` : null;
      if (!hours) continue;
      const last = groups[groups.length - 1];
      if (last && last.hours === hours) {
        last.days.push(dayAbbr[day]);
      } else {
        groups.push({ days: [dayAbbr[day]], hours });
      }
    }

    return groups.map(g => {
      const label = g.days.length > 2
        ? `${g.days[0]}\u2013${g.days[g.days.length - 1]}`
        : g.days.join(', ');
      return `${label}: ${g.hours}`;
    }).join(' | ');
  } catch {
    return String(raw);
  }
}

interface CreateTemplatePayload {
  name: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  subjectLine: string;
  body: string;
  tags: string[];
}

interface TemplateCardProps {
  template: Template;
  masterDesign: any;
  onToggleFavorite: (id: string) => void;
  onDuplicate: (template: Template) => void;
  onDelete: (id: string) => void;
  onEdit: (template: Template) => void;
  isDeleting?: boolean;
  isTogglingFavorite?: boolean;
}

function getChannelBadgeClasses(channel: TemplateChannel) {
  switch (channel) {
    case "individual":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300";
    case "promotional":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300";
    case "newsletter":
      return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300";
    case "transactional":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300";
    case "single-purpose":
      return "bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300";
  }
}

function TemplateCard({ template, masterDesign, onToggleFavorite, onDuplicate, onDelete, onEdit, isDeleting, isTogglingFavorite }: TemplateCardProps) {
  const { t } = useTranslation();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <Card className={`h-full flex flex-col relative overflow-hidden transition-opacity duration-300 ${isDeleting ? 'opacity-60 pointer-events-none' : ''}`}>
      {isDeleting && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-red-500" />
            <span className="text-xs font-medium text-red-600 dark:text-red-400">{t('templatesPage.actions.deleting', 'Deleting…')}</span>
          </div>
        </div>
      )}
      <CardHeader className="flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="text-lg leading-tight text-gray-900 dark:text-gray-50 break-words">
              {template.name}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Badge className={`${getChannelBadgeClasses(template.channel)} capitalize`}>
                {template.channel}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {template.category.replace("_", " ")}
              </Badge>
              <span>{t('templatesPage.card.used', { count: template.usageCount })}</span>
              {template.lastUsed && (
                <span>{t('templatesPage.card.lastSent', { date: new Date(template.lastUsed).toLocaleDateString() })}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => onToggleFavorite(template.id)}
              disabled={isTogglingFavorite}
            >
              {isTogglingFavorite ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              ) : template.isFavorite ? (
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              ) : (
                <StarOff className="h-5 w-5 text-gray-400" />
              )}
              <span className="sr-only">{t('templatesPage.actions.toggleFavorite')}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Template actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onEdit(template)}>{t('templatesPage.actions.edit')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPreviewOpen(true)}>{t('templatesPage.actions.preview')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(template)}>{t('templatesPage.actions.duplicate')}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => onDelete(template.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('templatesPage.actions.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('templatesPage.card.subjectLine')}</p>
          <p className="text-sm font-mono bg-gray-50 dark:bg-gray-800 rounded-md px-3 py-2 text-gray-800 dark:text-gray-100 break-words">
            {template.subjectLine}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('templatesPage.card.preview')}</p>
          <div
            className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3"
            dangerouslySetInnerHTML={{ __html: template.preview || t('templatesPage.card.noPreview') }}
          />
        </div>
        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {template.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs uppercase tracking-wide">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <Eye className="mr-2 h-4 w-4" />
                {t('templatesPage.card.preview')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  {template.name}
                </DialogTitle>
                <DialogDescription>
                  {t('templatesPage.subject')}: {template.subjectLine}
                </DialogDescription>
              </DialogHeader>

              {/* Device toggle */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Preview:</span>
                  <div className="flex bg-muted/50 p-1 rounded-md">
                    <Button
                      variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => setPreviewDevice("desktop")}
                      type="button"
                    >
                      <Monitor className="w-3.5 h-3.5 mr-1.5" />
                      Desktop
                    </Button>
                    <Button
                      variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => setPreviewDevice("mobile")}
                      type="button"
                    >
                      <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                      Mobile
                    </Button>
                  </div>
                </div>
              </div>

              {/* Email preview canvas */}
              <div className="flex-1 overflow-y-auto">
                <div className={`transition-all duration-300 mx-auto p-4 sm:p-6 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl ${previewDevice === "mobile" ? "max-w-[400px]" : "w-full"
                  }`}>
                  <div className="bg-white text-slate-900 shadow-2xl mx-auto rounded overflow-hidden max-w-[600px] w-full" style={{ fontFamily: masterDesign?.fontFamily || "Arial, sans-serif" }}>

                    {/* Simulated email header */}
                    <div className="border-b bg-gray-50 p-4 text-xs sm:text-sm text-gray-500">
                      <div className="flex gap-2 mb-1">
                        <span className="font-semibold text-right w-14">To:</span>
                        <span className="text-gray-900">customer@example.com</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-semibold text-right w-14">Subject:</span>
                        <span className="text-gray-900 font-bold">{template.subjectLine || "(no subject)"}</span>
                      </div>
                    </div>

                    {/* Hero header from email design */}
                    {(masterDesign?.headerMode || 'logo') === 'banner' && masterDesign?.bannerUrl ? (
                      <div>
                        <img
                          src={masterDesign.bannerUrl}
                          alt="Email banner"
                          style={{ display: 'block', width: '100%', height: 'auto' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        {((masterDesign?.showCompanyName ?? 'true') === 'true' || masterDesign?.headerText) && (
                          <div
                            className="px-8 py-4 text-center"
                            style={{ backgroundColor: masterDesign?.primaryColor || "#3B82F6", color: "#ffffff" }}
                          >
                            {(masterDesign?.showCompanyName ?? 'true') === 'true' && (
                              <h1 className="text-2xl font-bold mb-1 tracking-tight">
                                {masterDesign?.companyName || "Your Company"}
                              </h1>
                            )}
                            {masterDesign?.headerText && (
                              <p className="text-base opacity-95 max-w-sm mx-auto leading-normal">
                                {masterDesign.headerText}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className="p-8"
                        style={{
                          backgroundColor: masterDesign?.primaryColor || "#3B82F6",
                          color: "#ffffff",
                          textAlign: (masterDesign?.logoAlignment as 'left' | 'center' | 'right') || 'center',
                        }}
                      >
                        {masterDesign?.logoUrl ? (
                          <img
                            src={masterDesign.logoUrl}
                            alt="Logo"
                            className="mb-4 object-contain"
                            style={{
                              height: ({ small: '64px', medium: '96px', large: '128px', xlarge: '160px' } as Record<string, string>)[masterDesign?.logoSize || 'medium'] || '96px',
                              display: 'block',
                              marginLeft: (masterDesign?.logoAlignment || 'center') === 'center' ? 'auto' : (masterDesign?.logoAlignment === 'right' ? 'auto' : '0'),
                              marginRight: (masterDesign?.logoAlignment || 'center') === 'center' ? 'auto' : (masterDesign?.logoAlignment === 'right' ? '0' : 'auto'),
                            }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div
                            className="h-12 w-12 bg-white/20 rounded-full mb-4 flex items-center justify-center"
                            style={{
                              marginLeft: (masterDesign?.logoAlignment || 'center') === 'center' ? 'auto' : (masterDesign?.logoAlignment === 'right' ? 'auto' : '0'),
                              marginRight: (masterDesign?.logoAlignment || 'center') === 'center' ? 'auto' : (masterDesign?.logoAlignment === 'right' ? '0' : 'auto'),
                            }}
                          >
                            <span className="text-xl font-bold opacity-80">{masterDesign?.companyName?.charAt(0) || "C"}</span>
                          </div>
                        )}
                        {(masterDesign?.showCompanyName ?? 'true') === 'true' && (
                          <h1 className="text-2xl font-bold mb-2 tracking-tight">
                            {masterDesign?.companyName || "Your Company"}
                          </h1>
                        )}
                        {masterDesign?.headerText && (
                          <p className="text-base opacity-95 max-w-sm leading-normal" style={{
                            marginLeft: (masterDesign?.logoAlignment || 'center') === 'center' ? 'auto' : (masterDesign?.logoAlignment === 'right' ? 'auto' : '0'),
                            marginRight: (masterDesign?.logoAlignment || 'center') === 'center' ? 'auto' : (masterDesign?.logoAlignment === 'right' ? '0' : 'auto'),
                          }}>
                            {masterDesign.headerText}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Template body content */}
                    <div className="p-8 flex-1">
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: template.body || "<p style='color:#94a3b8;'>No content</p>" }}
                      />
                    </div>

                    {/* Footer from email design */}
                    <div className="bg-slate-100 p-8 text-center border-t border-slate-200">
                      <div className="flex justify-center gap-6 mb-6">
                        {isSafeUrl(masterDesign?.socialLinks?.facebook) && (
                          <a href={masterDesign!.socialLinks!.facebook} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600 transition-colors text-sm">Facebook</a>
                        )}
                        {isSafeUrl(masterDesign?.socialLinks?.twitter) && (
                          <a href={masterDesign!.socialLinks!.twitter} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500 transition-colors text-sm">Twitter</a>
                        )}
                        {isSafeUrl(masterDesign?.socialLinks?.instagram) && (
                          <a href={masterDesign!.socialLinks!.instagram} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-pink-600 transition-colors text-sm">Instagram</a>
                        )}
                        {isSafeUrl(masterDesign?.socialLinks?.linkedin) && (
                          <a href={masterDesign!.socialLinks!.linkedin} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-700 transition-colors text-sm">LinkedIn</a>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 space-y-2 max-w-xs mx-auto">
                        <p>{masterDesign?.footerText || "© 2025 All rights reserved."}</p>
                        <p className="text-slate-400">
                          You are receiving this email because you signed up on our website.
                          <br />
                          <span className="underline cursor-pointer hover:text-slate-600">Unsubscribe</span>
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}


interface EditTemplateDialogProps {
  template: Template | null;
  onSave: (id: string, payload: CreateTemplatePayload) => void;
  onCancel: () => void;
}

function EditTemplateDialog({ template, onSave, onCancel }: EditTemplateDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<TemplateChannel>("individual");
  const [category, setCategory] = useState<TemplateCategory>("welcome");
  const [subjectLine, setSubjectLine] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const editorRef = useRef<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  const { data: masterDesign } = useQuery({
    queryKey: ["/api/master-email-design", "edit-preview"],
    queryFn: async () => {
      const response = await fetch('/api/master-email-design', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch email design');
      return response.json();
    },
  });

  const { data: companyData } = useQuery({
    queryKey: ["/api/company", "edit-preview"],
    queryFn: async () => {
      const response = await fetch('/api/company', {
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
  });

  const { data: shopsData } = useQuery({
    queryKey: ["/api/shops", "edit-preview"],
    queryFn: async () => {
      const response = await fetch('/api/shops?limit=1', {
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
  });

  const replaceVariables = useMemo(() => {
    const firstShop = shopsData?.shops?.[0];
    const variableMap: Record<string, string> = {
      first_name: 'John',
      last_name: 'Doe',
      email: companyData?.companyEmail || 'john.doe@example.com',
      phone: companyData?.phone || '(555) 123-4567',
      address: companyData?.address || '123 Main St',
      office_hours: formatOperatingHours(firstShop?.operatingHours),
      company_name: companyData?.name || masterDesign?.companyName || 'Your Company',
    };

    return (text: string) => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variableMap[key] ?? match;
      });
    };
  }, [companyData, shopsData, masterDesign]);

  // Initialize form when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setChannel(template.channel);
      setCategory(template.category);
      setSubjectLine(template.subjectLine);
      setContent(template.body);
      setTagInput(template.tags.join(", "));
      setOpen(true);
      // If editing a single-purpose template, try to match it to a preset
      if (template.channel === "single-purpose") {
        const matchedPreset = SINGLE_PURPOSE_PRESETS.find(p => p.label === template.name);
        setSelectedPreset(matchedPreset?.id || null);
      } else {
        setSelectedPreset(null);
      }
    }
  }, [template]);

  const handleSelectPreset = (preset: SinglePurposePreset) => {
    setSelectedPreset(preset.id);
    setName(preset.label);
    setCategory(preset.category as TemplateCategory);
    setSubjectLine(preset.subjectLine);
    setContent(preset.body);
    setTagInput(preset.tags.join(", "));
  };

  const handleChannelChange = (value: TemplateChannel) => {
    setChannel(value);
    if (value !== "single-purpose") {
      setSelectedPreset(null);
    }
  };

  const resetForm = () => {
    setName("");
    setChannel("individual");
    setCategory("welcome");
    setSubjectLine("");
    setContent("");
    setTagInput("");
    setSelectedPreset(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!template || !name.trim() || !subjectLine.trim() || !hasContent(content)) {
      return;
    }

    const tags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    onSave(template.id, {
      name: name.trim(),
      channel,
      category,
      subjectLine: subjectLine.trim(),
      body: content.trim(),
      tags,
    });

    resetForm();
    setOpen(false);
    onCancel();
  };

  const handleCancel = () => {
    resetForm();
    setOpen(false);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6 pb-2">
          <DialogHeader>
            <DialogTitle>{t('templatesPage.editDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('templatesPage.editDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-template-name">{t('templatesPage.editDialog.templateName')}</Label>
              <Input
                id="edit-template-name"
                placeholder={t('templatesPage.editDialog.templateNamePlaceholder')}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-template-channel">{t('templatesPage.editDialog.channel')}</Label>
              <Select value={channel} onValueChange={(value: TemplateChannel) => handleChannelChange(value)}>
                <SelectTrigger id="edit-template-channel">
                  <SelectValue placeholder={t('templatesPage.editDialog.selectChannel')} />
                </SelectTrigger>
                <SelectContent>
                  {channelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {channel === "single-purpose" && (
              <div className="grid gap-2">
                <Label>{t('templatesPage.createTemplatePage.selectPurpose', 'Select a Purpose')}</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  {t('templatesPage.createTemplatePage.selectPurposeHelp', 'Choose a preset to auto-fill the template with starter content. You can customize it afterwards.')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SINGLE_PURPOSE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`relative flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all hover:shadow-sm ${selectedPreset === preset.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-400 ring-1 ring-blue-500 dark:ring-blue-400"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                    >
                      {selectedPreset === preset.id && (
                        <CheckCircle className="absolute top-2 right-2 h-4 w-4 text-blue-500 dark:text-blue-400" />
                      )}
                      <div className="flex items-center gap-2">
                        <Sparkles className={`h-4 w-4 ${selectedPreset === preset.id ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{preset.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground leading-snug">{preset.description}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {preset.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="edit-template-category">{t('templatesPage.editDialog.category')}</Label>
              <Select value={category} onValueChange={(value: TemplateCategory) => setCategory(value)}>
                <SelectTrigger id="edit-template-category">
                  <SelectValue placeholder={t('templatesPage.editDialog.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-template-subject">{t('templatesPage.editDialog.subjectLine')}</Label>
              <Input
                id="edit-template-subject"
                placeholder={t('templatesPage.editDialog.subjectLinePlaceholder')}
                value={subjectLine}
                onChange={(event) => setSubjectLine(event.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-template-content">{t('templatesPage.editDialog.content')}</Label>

              {/* Variable quick-insert bar */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{t('ecards.editor.insertPlaceholders')}:</span>
                </div>
                {TEMPLATE_VARIABLES.map((v) => {
                  const Icon = v.icon;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => {
                        if (editorRef.current) {
                          editorRef.current.chain().focus().insertContent(`{{${v.key}}}`).run();
                        } else {
                          setContent((prev) => prev + `{{${v.key}}}`);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
                      title={`Insert {{${v.key}}}`}
                    >
                      <Icon className="w-3 h-3" />
                      {t(v.labelKey, v.key)}
                      <span className="text-blue-400 dark:text-blue-500 font-mono text-[10px]">{`{{${v.key}}}`}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    if (editorRef.current) {
                      editorRef.current.chain().focus().insertContent(CONTACT_CARD_TEMPLATE).run();
                    } else {
                      setContent((prev) => prev + CONTACT_CARD_TEMPLATE);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer"
                  title="Insert formatted contact card block"
                >
                  <CreditCard className="w-3 h-3" />
                  {t('ecards.editor.contactCard', 'Contact Card')}
                </button>
              </div>

              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder={t('templatesPage.editDialog.contentPlaceholder')}
                className="min-h-[200px]"
                onEditorReady={(editor) => { editorRef.current = editor; }}
              />
              <p className="text-xs text-muted-foreground">
                {t('templatesPage.editDialog.contentHelp')}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-template-tags">{t('templatesPage.editDialog.tags')}</Label>
              <Input
                id="edit-template-tags"
                placeholder={t('templatesPage.editDialog.tagsPlaceholder')}
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 justify-end">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {t('templatesPage.editDialog.cancel')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={!hasContent(content)}
            >
              <Eye className="w-4 h-4 mr-2" />
              {t('templatesPage.createTemplatePage.preview')}
            </Button>
            <Button type="submit">{t('templatesPage.editDialog.saveChanges')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {t('templatesPage.createTemplatePage.preview')} — {name || t('templatesPage.editDialog.templateNamePlaceholder')}
            </DialogTitle>
            <DialogDescription>
              {t('templatesPage.createTemplatePage.emailThemeDescription')}
            </DialogDescription>
          </DialogHeader>

          {/* Device toggle */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Preview:</span>
              <div className="flex bg-muted/50 p-1 rounded-md">
                <Button
                  variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setPreviewDevice("desktop")}
                  type="button"
                >
                  <Monitor className="w-3.5 h-3.5 mr-1.5" />
                  Desktop
                </Button>
                <Button
                  variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setPreviewDevice("mobile")}
                  type="button"
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                  Mobile
                </Button>
              </div>
            </div>
          </div>

          {/* Email preview canvas */}
          <div className="flex-1 overflow-y-auto">
            <div className={`transition-all duration-300 mx-auto p-4 sm:p-6 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl ${previewDevice === "mobile" ? "max-w-[400px]" : "w-full"
              }`}>
              <div className="bg-white text-slate-900 shadow-2xl mx-auto rounded overflow-hidden max-w-[600px] w-full" style={{ fontFamily: masterDesign?.fontFamily || "Arial, sans-serif" }}>

                {/* Simulated email header */}
                <div className="border-b bg-gray-50 p-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex gap-2 mb-1">
                    <span className="font-semibold text-right w-14">To:</span>
                    <span className="text-gray-900">customer@example.com</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-right w-14">Subject:</span>
                    <span className="text-gray-900 font-bold">{replaceVariables(subjectLine) || "(no subject)"}</span>
                  </div>
                </div>

                {/* Hero header from email design */}
                {(masterDesign?.headerMode || 'logo') === 'banner' && masterDesign?.bannerUrl ? (
                  <div>
                    <img
                      src={masterDesign.bannerUrl}
                      alt="Email banner"
                      style={{ display: 'block', width: '100%', height: 'auto' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    {((masterDesign?.showCompanyName ?? 'true') === 'true' || masterDesign?.headerText) && (
                      <div
                        className="px-8 py-4 text-center"
                        style={{ backgroundColor: masterDesign?.primaryColor || "#3B82F6", color: "#ffffff" }}
                      >
                        {(masterDesign?.showCompanyName ?? 'true') === 'true' && (
                          <h1 className="text-2xl font-bold mb-1 tracking-tight">
                            {masterDesign?.companyName || "Your Company"}
                          </h1>
                        )}
                        {masterDesign?.headerText && (
                          <p className="text-base opacity-95 max-w-sm mx-auto leading-normal">
                            {masterDesign.headerText}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="p-8"
                    style={{
                      backgroundColor: masterDesign?.primaryColor || "#3B82F6",
                      color: "#ffffff",
                      textAlign: (masterDesign?.logoAlignment as 'left' | 'center' | 'right') || 'center',
                    }}
                  >
                    {masterDesign?.logoUrl ? (
                      <img
                        src={masterDesign.logoUrl}
                        alt="Logo"
                        className="mb-4 object-contain"
                        style={{
                          height: ({ small: '64px', medium: '96px', large: '128px', xlarge: '160px' } as Record<string, string>)[masterDesign?.logoSize || 'medium'] || '96px',
                          display: 'block',
                          marginLeft: (masterDesign?.logoAlignment || 'center') === 'center' ? 'auto' : (masterDesign?.logoAlignment === 'right' ? 'auto' : '0'),
                          marginRight: (masterDesign?.logoAlignment || 'center') === 'center' ? 'auto' : (masterDesign?.logoAlignment === 'right' ? '0' : 'auto'),
                        }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div
                        className="h-12 w-12 bg-white/20 rounded-full mb-4 flex items-center justify-center"
                        style={{
                          marginLeft: (masterDesign?.logoAlignment || 'center') === 'center' ? 'auto' : (masterDesign?.logoAlignment === 'right' ? 'auto' : '0'),
                          marginRight: (masterDesign?.logoAlignment || 'center') === 'center' ? 'auto' : (masterDesign?.logoAlignment === 'right' ? '0' : 'auto'),
                        }}
                      >
                        <span className="text-xl font-bold opacity-80">{masterDesign?.companyName?.charAt(0) || "C"}</span>
                      </div>
                    )}
                    {(masterDesign?.showCompanyName ?? 'true') === 'true' && (
                      <h1 className="text-2xl font-bold mb-2 tracking-tight">
                        {masterDesign?.companyName || "Your Company"}
                      </h1>
                    )}
                    {masterDesign?.headerText && (
                      <p className="text-base opacity-95 max-w-sm leading-normal" style={{
                        marginLeft: (masterDesign?.logoAlignment || 'center') === 'center' ? 'auto' : (masterDesign?.logoAlignment === 'right' ? 'auto' : '0'),
                        marginRight: (masterDesign?.logoAlignment || 'center') === 'center' ? 'auto' : (masterDesign?.logoAlignment === 'right' ? '0' : 'auto'),
                      }}>
                        {masterDesign.headerText}
                      </p>
                    )}
                  </div>
                )}

                {/* Template body content */}
                <div className="p-8 flex-1">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: replaceVariables(content) || "<p style='color:#94a3b8;'>Your template content will appear here...</p>" }}
                  />
                </div>

                {/* Footer from email design */}
                <div className="bg-slate-100 p-8 text-center border-t border-slate-200">
                  <div className="flex justify-center gap-6 mb-6">
                    {isSafeUrl(masterDesign?.socialLinks?.facebook) && (
                      <a href={masterDesign!.socialLinks!.facebook} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600 transition-colors text-sm">Facebook</a>
                    )}
                    {isSafeUrl(masterDesign?.socialLinks?.twitter) && (
                      <a href={masterDesign!.socialLinks!.twitter} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500 transition-colors text-sm">Twitter</a>
                    )}
                    {isSafeUrl(masterDesign?.socialLinks?.instagram) && (
                      <a href={masterDesign!.socialLinks!.instagram} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-pink-600 transition-colors text-sm">Instagram</a>
                    )}
                    {isSafeUrl(masterDesign?.socialLinks?.linkedin) && (
                      <a href={masterDesign!.socialLinks!.linkedin} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-700 transition-colors text-sm">LinkedIn</a>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 space-y-2 max-w-xs mx-auto">
                    <p>{masterDesign?.footerText || "© 2025 All rights reserved."}</p>
                    <p className="text-slate-400">
                      You are receiving this email because you signed up on our website.
                      <br />
                      <span className="underline cursor-pointer hover:text-slate-600">Unsubscribe</span>
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

export default function TemplatesPage() {
  const { t } = useTranslation();

  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: t('navigation.dashboard'), href: "/", icon: LayoutDashboard },
    { label: t('templatesPage.title'), icon: Copy }
  ]);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [pagination, setPagination] = useState<TemplatePagination>({ page: 1, limit: 50, total: 0, pages: 0 });
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | TemplateChannel>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | TemplateCategory>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<string | null>(null);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const { data: masterDesign } = useQuery({
    queryKey: ["/api/master-email-design"],
    queryFn: async () => {
      const response = await fetch('/api/master-email-design', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch email design');
      return response.json();
    },
  });

  // Load templates and stats on component mount and when filters change
  const loadTemplates = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setIsSearching(true);
      }
      setError(null);
      const result = await fetchTemplates({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm || undefined,
        channel: channelFilter !== 'all' ? channelFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        favoritesOnly: favoritesOnly || undefined,
      });
      setTemplates(result.templates);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
      toast({
        title: t('templatesPage.toasts.error'),
        description: t('templatesPage.toasts.loadError'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await fetchTemplateStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load template stats:', err);
    }
  };

  // Load data on mount and when location changes (e.g., returning from create page)
  useEffect(() => {
    // Only reload if we're on the templates page (not a subpage)
    if (location === '/templates') {
      loadTemplates(true);
      loadStats();
    }
  }, [location]);

  // Reload templates when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadTemplates();
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchTerm, channelFilter, categoryFilter, favoritesOnly, pagination.page]);

  // Filtered templates for display (now handled server-side)
  const filteredTemplates = templates;


  const handleToggleFavorite = async (id: string) => {
    if (togglingFavoriteId) return; // Prevent multiple simultaneous toggles

    setTogglingFavoriteId(id);

    // Optimistically update the UI
    const previousTemplates = [...templates];
    const previousStats = stats ? { ...stats } : null;

    setTemplates(prevTemplates =>
      prevTemplates.map(t =>
        t.id === id ? { ...t, isFavorite: !t.isFavorite } : t
      )
    );

    // Update stats optimistically
    if (stats) {
      const template = templates.find(t => t.id === id);
      if (template) {
        setStats({
          ...stats,
          favoriteTemplates: template.isFavorite
            ? stats.favoriteTemplates - 1
            : stats.favoriteTemplates + 1
        });
      }
    }

    try {
      await toggleTemplateFavorite(id);
    } catch (error) {
      // Revert on error
      setTemplates(previousTemplates);
      if (previousStats) {
        setStats(previousStats);
      }

      toast({
        title: t('templatesPage.toasts.error'),
        description: t('templatesPage.toasts.favoriteError'),
        variant: "destructive",
      });
    } finally {
      setTogglingFavoriteId(null);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const template = templates.find((item) => item.id === id);
    if (!template || deletingId) return;

    const confirmed = window.confirm(
      `Delete "${template.name}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteTemplate(id);

      // Remove the template from local state in-place (no full reload)
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));

      // Refresh stats silently in the background
      loadStats();

      toast({
        title: t('templatesPage.toasts.templateDeleted'),
        description: t('templatesPage.toasts.templateDeletedDesc', { name: template.name }),
      });
    } catch (error) {
      toast({
        title: t('templatesPage.toasts.error'),
        description: t('templatesPage.toasts.deleteError'),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicateTemplate = async (template: Template) => {
    try {
      await duplicateTemplate(template.id, `${template.name} copy`);
      await loadTemplates();
      await loadStats();
      toast({
        title: t('templatesPage.toasts.templateDuplicated'),
        description: t('templatesPage.toasts.templateDuplicatedDesc', { name: template.name }),
      });
    } catch (error) {
      toast({
        title: t('templatesPage.toasts.error'),
        description: t('templatesPage.toasts.duplicateError'),
        variant: "destructive",
      });
    }
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
  };

  const handleSaveEdit = async (id: string, payload: CreateTemplatePayload) => {
    try {
      await updateTemplate(id, {
        name: payload.name,
        channel: payload.channel,
        category: payload.category,
        subjectLine: payload.subjectLine,
        body: payload.body,
        tags: payload.tags,
      });

      await loadTemplates();
      await loadStats();

      toast({
        title: t('templatesPage.toasts.templateUpdated'),
        description: t('templatesPage.toasts.templateUpdatedDesc', { name: payload.name }),
      });
    } catch (error) {
      toast({
        title: t('templatesPage.toasts.error'),
        description: t('templatesPage.toasts.updateError'),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">{t('templatesPage.title')}</h1>
            <p className="text-gray-600 dark:text-gray-300">
              {t('templatesPage.subtitle')}
            </p>
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setLocation('/templates/create')}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('templatesPage.createTemplate')}
          </Button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 space-y-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('templatesPage.stats.totalTemplates')}</p>
              <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
                {stats ? stats.totalTemplates : '...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats ? t('templatesPage.stats.favorited', { count: stats.favoriteTemplates }) : t('templatesPage.stats.loading')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 space-y-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('templatesPage.stats.individual')}</p>
              <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
                {stats ? stats.individualTemplates : '...'}
              </p>
              <p className="text-xs text-muted-foreground">{t('templatesPage.stats.templatesReady')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 space-y-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('templatesPage.stats.promotional')}</p>
              <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
                {stats ? stats.promotionalTemplates : '...'}
              </p>
              <p className="text-xs text-muted-foreground">{t('templatesPage.stats.templatesReady')}</p>
            </CardContent>
          </Card>
        </section>

        <section className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg shadow-sm">
          <div className="border-b border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('templatesPage.filters.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Select value={channelFilter} onValueChange={(value: TemplateChannel | "all") => setChannelFilter(value)}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('templatesPage.filters.allChannels')}</SelectItem>
                    {channelOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={(value: TemplateCategory | "all") => setCategoryFilter(value)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('templatesPage.filters.allCategories')}</SelectItem>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant={favoritesOnly ? "default" : "outline"}
                  onClick={() => setFavoritesOnly((previous) => !previous)}
                >
                  {favoritesOnly ? <Star className="mr-2 h-4 w-4" /> : <StarOff className="mr-2 h-4 w-4" />}
                  {t('templatesPage.filters.favorites')}
                </Button>
              </div>
            </div>
          </div>
          <div className="p-6 relative" style={{ minHeight: '200px' }}>
            {/* Subtle top-bar indicator for search/filter reloads */}
            {isSearching && (
              <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden z-10">
                <div className="h-full bg-blue-500 animate-pulse" />
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-muted-foreground">{t('templatesPage.loading.text')}</p>
                </div>
              </div>
            ) : error ? (
              <Card className="border-dashed border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
                <CardContent className="py-12 text-center space-y-3">
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">{t('templatesPage.error.title')}</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                  <Button variant="outline" onClick={() => loadTemplates(true)}>
                    {t('templatesPage.error.tryAgain')}
                  </Button>
                </CardContent>
              </Card>
            ) : filteredTemplates.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('templatesPage.empty.noTemplates')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchTerm || channelFilter !== 'all' || categoryFilter !== 'all' || favoritesOnly
                      ? t('templatesPage.empty.adjustFilters')
                      : t('templatesPage.empty.getStarted')}
                  </p>
                  <div className="space-x-2">
                    {(searchTerm || channelFilter !== 'all' || categoryFilter !== 'all' || favoritesOnly) && (
                      <Button variant="outline" onClick={() => {
                        setSearchTerm("");
                        setChannelFilter("all");
                        setCategoryFilter("all");
                        setFavoritesOnly(false);
                      }}>
                        {t('templatesPage.empty.resetFilters')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 transition-opacity duration-150 ${isSearching ? 'opacity-60' : 'opacity-100'}`}>
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    masterDesign={masterDesign}
                    onToggleFavorite={handleToggleFavorite}
                    onDuplicate={handleDuplicateTemplate}
                    onDelete={handleDeleteTemplate}
                    onEdit={handleEditTemplate}
                    isDeleting={deletingId === template.id}
                    isTogglingFavorite={togglingFavoriteId === template.id}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
        <EditTemplateDialog
          template={editingTemplate}
          onSave={handleSaveEdit}
          onCancel={() => setEditingTemplate(null)}
        />
      </div>
    </div>
  );
}
