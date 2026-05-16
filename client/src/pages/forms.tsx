import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Calendar, MoreVertical, Eye, Edit, Trash2, RefreshCw, QrCode, LayoutDashboard, FileText, ClipboardList, FileQuestion, Mail, MessageSquare, CheckCircle2, TrendingUp, Clock } from 'lucide-react';
import { useReduxAuth } from '@/hooks/useReduxAuth';
import { useAuth } from '@/hooks/useAuth';
import { useAppSelector } from '@/store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useSetBreadcrumbs } from '@/contexts/PageTitleContext';
import { FormPreviewModal } from '@/components/form-preview-modal';
import { FormQRCode } from '@/components/form-builder/form-qr-code';
import { FormResponses } from '@/components/form-builder/form-responses';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Form {
  id: string;
  title: string;
  description: string;
  category?: string;
  formData: string;
  theme: string;
  tags?: string[];
  shopId?: string | null;
  isActive: boolean;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
}

// CSS gradient strings keyed to form theme, used as the preview background. Matches design tokens.
const getThemeHeaderGradient = (themeId: string): string => {
  const map: Record<string, string> = {
    'minimal':           'linear-gradient(135deg, #64748b 0%, #334155 100%)',
    'modern':            'linear-gradient(135deg, #2563eb 0%, #a855f7 60%, #ec4899 100%)',
    'professional':      'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)',
    'playful':           'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
    'elegant':           'linear-gradient(135deg, #fbbf24 0%, #b45309 100%)',
    'modern-bold':       'linear-gradient(135deg, #f97316 0%, #ef4444 60%, #7c3aed 100%)',
    'neon':              'linear-gradient(135deg, #22d3ee 0%, #34d399 100%)',
    'nature':            'linear-gradient(135deg, #10b981 0%, #047857 100%)',
    'luxury':            'linear-gradient(135deg, #fbbf24 0%, #92400e 100%)',
    'retro':             'linear-gradient(135deg, #f97316 0%, #ec4899 60%, #a855f7 100%)',
    'neo-modern':        'linear-gradient(135deg, #34d399 0%, #0d9488 100%)',
    'aurora':            'linear-gradient(135deg, #0ea5e9 0%, #d946ef 60%, #f43f5e 100%)',
    'cosmic':            'linear-gradient(135deg, #a855f7 0%, #ec4899 60%, #22d3ee 100%)',
    'brutalist':         'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
    'pastel-dream':      'linear-gradient(135deg, #c4b5fd 0%, #fbcfe8 100%)',
    'promotional':       'linear-gradient(135deg, #ef4444 0%, #f97316 50%, #fbbf24 100%)',
    'brutalist-pop':     'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
    'brutalist-noir':    'linear-gradient(135deg, #1e40af 0%, #0f172a 100%)',
    'ocean-breeze':      'linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)',
    'sunset-warmth':     'linear-gradient(135deg, #f59e0b 0%, #ef6f6f 50%, #ec4899 100%)',
    'monospace-terminal':'linear-gradient(135deg, #16a34a 0%, #064e3b 100%)',
    'silk':              'linear-gradient(135deg, #fda4af 0%, #fde68a 50%, #fb7185 100%)',
    'art-deco':          'linear-gradient(135deg, #c9a84c 0%, #8a6f24 100%)',
    'vapor':             'linear-gradient(135deg, #ff2d95 0%, #b967ff 50%, #01cdfe 100%)',
    'custom':            'linear-gradient(135deg, #7c5cff 0%, #5b3df5 60%, #2dd4bf 100%)',
  };
  return map[themeId] || map['minimal'];
};

// Thin gradient stripe across the bottom of the preview — same palette as the header but extended.
const getThemeStripeGradient = (themeId: string): string => {
  const map: Record<string, string> = {
    'minimal':           'linear-gradient(90deg, #64748b, #cbd5e1)',
    'modern':            'linear-gradient(90deg, #2563eb, #a855f7, #ec4899)',
    'professional':      'linear-gradient(90deg, #1d4ed8, #60a5fa)',
    'playful':           'linear-gradient(90deg, #ec4899, #a855f7)',
    'elegant':           'linear-gradient(90deg, #fbbf24, #f59e0b)',
    'modern-bold':       'linear-gradient(90deg, #f97316, #ef4444, #7c3aed)',
    'neon':              'linear-gradient(90deg, #22d3ee, #34d399)',
    'nature':            'linear-gradient(90deg, #10b981, #34d399)',
    'luxury':            'linear-gradient(90deg, #fbbf24, #f59e0b)',
    'retro':             'linear-gradient(90deg, #f97316, #ec4899)',
    'neo-modern':        'linear-gradient(90deg, #34d399, #0d9488)',
    'aurora':            'linear-gradient(90deg, #0ea5e9, #d946ef, #f43f5e)',
    'cosmic':            'linear-gradient(90deg, #a855f7, #ec4899, #22d3ee)',
    'brutalist':         'linear-gradient(90deg, #ef6f6f, #f5b25b, #34d399)',
    'pastel-dream':      'linear-gradient(90deg, #c4b5fd, #fbcfe8)',
    'promotional':       'linear-gradient(90deg, #ef4444, #f97316, #fbbf24)',
    'brutalist-pop':     'linear-gradient(90deg, #ef4444, #f87171)',
    'brutalist-noir':    'linear-gradient(90deg, #1e40af, #60a5fa)',
    'ocean-breeze':      'linear-gradient(90deg, #06b6d4, #0ea5e9)',
    'sunset-warmth':     'linear-gradient(90deg, #f5b25b, #ef6f6f)',
    'monospace-terminal':'linear-gradient(90deg, #16a34a, #4ade80)',
    'silk':              'linear-gradient(90deg, #fda4af, #fde68a, #fb7185)',
    'art-deco':          'linear-gradient(90deg, #c9a84c, #d4b85c)',
    'vapor':             'linear-gradient(90deg, #ff2d95, #b967ff, #01cdfe)',
    'custom':            'linear-gradient(90deg, #7c5cff, #2dd4bf)',
  };
  return map[themeId] || map['minimal'];
};

const formatRelativeTime = (iso: string): string => {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '—';
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const computeCompleteness = (form: Form, elementCount: number): number => {
  let score = 0;
  if (elementCount > 0) score += 25;
  if (form.description?.trim()) score += 25;
  if (form.tags && form.tags.length > 0) score += 25;
  if (form.isActive) score += 25;
  return score;
};

// Deterministic synthetic time-series for sparklines — we don't have per-form weekly response counts,
// so derive a stable pattern from the form id so each card has a consistent visual signature.
const buildTrendSeries = (seed: string, length = 12): number[] => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    out.push(((h >>> 0) % 100) / 100);
  }
  return out;
};

function Spark({ values, color, width = 64, height = 22 }: { values: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 2) - 1).toFixed(1)}`)
    .join(' ');
  const area = `0,${height} ${pts} ${width},${height}`;
  const gradId = `spark-${seedId(values.join(','))}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function seedId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Per-theme decorative tile rendered in the center of the preview header.
const getThemePreviewContent = (themeId: string) => {
  switch (themeId) {
    case 'neon':
      return (
        <div className="text-cyan-400 font-bold text-sm tracking-wider drop-shadow-lg">
          CYBER<span className="text-green-400">FORM</span>
        </div>
      );
    case 'nature':
      return (
        <div className="text-green-800 font-semibold text-sm">
          🌿 Natural Form 🌿
        </div>
      );
    case 'luxury':
      return (
        <div className="text-yellow-400 font-light text-sm tracking-widest font-serif">
          LUXURY DESIGN
        </div>
      );
    case 'retro':
      return (
        <div className="text-white font-black text-sm tracking-wider transform -skew-x-12 uppercase">
          80S STYLE
        </div>
      );
    case 'cosmic':
      return (
        <div className="text-purple-300 font-bold text-sm tracking-wider drop-shadow-lg">
          <span className="text-cyan-400">✦</span> COSMIC <span className="text-pink-400">✦</span>
        </div>
      );
    case 'brutalist':
      return (
        <div className="text-white font-black text-sm tracking-wider uppercase">
          BRUTALIST
        </div>
      );
    case 'pastel-dream':
      return (
        <div className="text-purple-600 font-medium text-sm tracking-wide">
          ✨ Pastel Dreams ✨
        </div>
      );
    case 'professional':
      return (
        <div className="text-blue-600 font-semibold text-sm">
          PROFESSIONAL
        </div>
      );
    case 'playful':
      return (
        <div className="text-white font-bold text-sm tracking-wide drop-shadow-lg">
          🎨 PLAYFUL 🎨
        </div>
      );
    case 'elegant':
      return (
        <div className="text-yellow-400 font-light text-sm tracking-widest font-serif">
          ELEGANT
        </div>
      );
    case 'neo-modern':
      return (
        <div className="text-green-400 font-mono font-bold text-sm tracking-wider">
          &gt; NEO_MODERN.exe
        </div>
      );
    case 'modern-bold':
      return (
        <div className="text-white font-black text-sm tracking-wider drop-shadow-lg">
          MODERN BOLD
        </div>
      );
    case 'aurora':
      return (
        <div className="text-slate-800 font-extrabold text-sm tracking-wide">
          Aurora
        </div>
      );
    case 'modern':
      return (
        <div className="text-white font-bold text-sm tracking-wide drop-shadow-lg">
          MODERN
        </div>
      );
    case 'minimal':
      return (
        <div className="text-gray-800 font-light text-sm tracking-wide">
          MINIMAL
        </div>
      );
    case 'promotional':
      return (
        <div className="text-white font-black text-sm tracking-wider drop-shadow-lg uppercase">
          PROMO
        </div>
      );
    case 'ocean-breeze':
      return (
        <div className="text-white font-bold text-sm tracking-wide drop-shadow-lg">
          <span className="text-cyan-100">~</span> Ocean Breeze <span className="text-cyan-100">~</span>
        </div>
      );
    case 'sunset-warmth':
      return (
        <div className="text-white font-bold text-sm tracking-wide drop-shadow-lg">
          Sunset Warmth
        </div>
      );
    default:
      return (
        <div className="text-white font-semibold opacity-90 text-sm">Form Theme</div>
      );
  }
};

export default function Forms2() {
  const { isAuthenticated, isLoading: authLoading, isInitialized } = useReduxAuth();
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewForm, setPreviewForm] = useState<any>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const { hasPermission } = usePermissions();
  const canViewForms = hasPermission('forms.view');
  const canCreateForms = hasPermission('forms.create');
  const canEditForms = hasPermission('forms.edit');
  const canDeleteForms = hasPermission('forms.delete');

  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Forms", icon: Edit }
  ]);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [qrForm, setQrForm] = useState<Form | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [responsesForm, setResponsesForm] = useState<Form | null>(null);
  const [isResponsesModalOpen, setIsResponsesModalOpen] = useState(false);

  // Handle refresh with timestamp update
  const handleRefresh = () => {
    refetch();
    setLastRefreshedAt(new Date());
  };

  // Format time for display
  const formatRefreshTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Fetch shops for name lookup
  const { data: shopsData } = useQuery({
    queryKey: ['/api/shops', { limit: 100 }],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/shops?limit=100');
      return response.json();
    },
    enabled: isAuthenticated && isInitialized,
    staleTime: 60000,
  });

  const shopsMap = new Map<string, string>();
  if (shopsData?.shops) {
    for (const shop of shopsData.shops) {
      shopsMap.set(shop.id, shop.name);
    }
  }

  // Fetch forms data (x-shop-id header automatically injected by queryClient)
  const { data: formsData, isLoading: formsLoading, error: formsError, refetch } = useQuery({
    queryKey: ['/api/forms', selectedShopId],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/forms');
      const data = await response.json();
      return data;
    },
    enabled: isAuthenticated && isInitialized,
    staleTime: 30000,
  });

  const forms: Form[] = formsData?.forms || [];

  const summary = useMemo(() => {
    const total = forms.length;
    const active = forms.filter(f => f.isActive).length;
    const responses = forms.reduce((sum, f) => sum + (f.responseCount || 0), 0);
    const avgPerForm = total ? Math.round(responses / total) : 0;
    return { total, active, responses, avgPerForm };
  }, [forms]);

  const formattedDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Delete form mutation
  const deleteFormMutation = useMutation({
    mutationFn: async (formId: string) => {
      const response = await apiRequest('DELETE', `/api/forms/${formId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/forms', selectedShopId] });
      toast({
        title: "Success",
        description: "Form deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete form",
        variant: "destructive",
      });
    },
  });

  // Handle form actions
  const handleViewForm = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    if (form) {
      setPreviewForm(form);
      setIsPreviewModalOpen(true);
    } else {
      toast({
        title: "Error",
        description: "Form not found",
        variant: "destructive",
      });
    }
  };

  const handleEditForm = (formId: string) => {
    setLocation(`/forms/${formId}/edit`);
  };

  const handleDeleteForm = (formId: string) => {
    deleteFormMutation.mutate(formId);
  };

  const handleQRForm = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    if (form) {
      setQrForm(form);
      setIsQRModalOpen(true);
    } else {
      toast({
        title: "Error",
        description: "Form not found",
        variant: "destructive",
      });
    }
  };

  const handleViewResponses = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    if (form) {
      setResponsesForm(form);
      setIsResponsesModalOpen(true);
    } else {
      toast({
        title: "Error",
        description: "Form not found",
        variant: "destructive",
      });
    }
  };

  // Helper function to render a form card (used in both sections)
  const renderFormCard = (form: Form) => {
    let themeData: { id: string; name: string } = { id: 'minimal', name: 'Unknown' };
    try {
      const parsed = JSON.parse(form.theme);
      themeData = { id: parsed.id || 'minimal', name: parsed.name || parsed.id || 'Unknown' };
    } catch {
      themeData = { id: 'minimal', name: form.theme || 'Unknown' };
    }

    // Parse form data to get element count
    let elementCount = 0;
    try {
      const formDataParsed = JSON.parse(form.formData);
      elementCount = formDataParsed.elements?.length || 0;
    } catch (e) {
      elementCount = 0;
    }

    const category = form.category || 'intake';
    const categoryLabel = category === 'email-signup' ? 'email' : category;
    const headerGradient = getThemeHeaderGradient(themeData.id);
    const stripeGradient = getThemeStripeGradient(themeData.id);
    const completeness = computeCompleteness(form, elementCount);
    const trendSeries = buildTrendSeries(form.id);
    const status: 'active' | 'draft' = form.isActive ? 'active' : 'draft';
    const newResponses = 0; // no delta data wired yet — design supports +N pill when available

    const statusStyles = status === 'active'
      ? { color: '#34d399', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)', dot: '#34d399' }
      : { color: '#f5b25b', borderColor: 'rgba(245,178,91,0.3)', background: 'rgba(245,178,91,0.08)', dot: '#f5b25b' };

    return (
      <div
        key={form.id}
        className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0e0e17] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)] transition-[border-color,background,transform] duration-200 hover:-translate-y-px hover:border-white/[0.18] hover:bg-[#14141f]"
        tabIndex={0}
      >
        {/* Preview */}
        <div
          className="relative h-[110px] overflow-hidden border-b border-white/[0.06]"
          style={{ background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 100%), ${headerGradient}` }}
        >
          {/* faint grid overlay */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '18px 18px',
              WebkitMaskImage: 'linear-gradient(180deg, black, transparent)',
              maskImage: 'linear-gradient(180deg, black, transparent)',
            }}
          />
          <div className="serif italic absolute left-3.5 top-3 z-10 text-[13px] tracking-[0.04em] text-white/60">
            {categoryLabel}
          </div>

          {/* Theme-specific decorative tile */}
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
            <div className="inline-flex items-center rounded border border-white/40 bg-black/25 px-3 py-1.5 backdrop-blur-sm shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]">
              {getThemePreviewContent(themeData.id)}
            </div>
          </div>

          {/* Dropdown menu (visible on hover) */}
          <div className="absolute right-2.5 top-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-black/35 text-white/70 backdrop-blur-md transition-colors hover:text-white"
                  aria-label="Form actions"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleViewForm(form.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleQRForm(form.id)}>
                  <QrCode className="mr-2 h-4 w-4" />
                  QR
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleViewResponses(form.id)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Responses ({form.responseCount})
                </DropdownMenuItem>
                {canEditForms && (
                  <DropdownMenuItem onClick={() => handleEditForm(form.id)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDeleteForms && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="text-red-600 dark:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the form "{form.title}" and all its responses.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteForm(form.id)}
                          className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                          disabled={deleteFormMutation.isPending}
                        >
                          {deleteFormMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Delete Form'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* bottom gradient stripe */}
          <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: stripeGradient }} />
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-2.5 px-3.5 pb-3 pt-3.5">
          <h3 className="m-0 text-[15.5px] font-medium leading-[1.3] tracking-[-0.01em] text-[#f4f4f8] line-clamp-2">
            {form.title}
          </h3>

          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex h-[22px] items-center gap-1.5 rounded-[5px] border px-2 text-[11.5px] leading-none"
              style={{ color: statusStyles.color, borderColor: statusStyles.borderColor, background: statusStyles.background }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusStyles.dot }} />
              {status}
            </span>
            <span className="inline-flex h-[22px] items-center rounded-[5px] border border-white/[0.10] bg-[#14141f] px-2 text-[11.5px] leading-none text-[#c8c8d4]">
              {themeData.name.toLowerCase()}
            </span>
            {form.tags?.slice(0, 1).map((tagId) => (
              <span
                key={tagId}
                className="inline-flex h-[22px] items-center rounded-[5px] border border-white/[0.10] bg-[#14141f] px-2 text-[11.5px] leading-none text-[#c8c8d4]"
              >
                {tagId.slice(0, 10)}
              </span>
            ))}
            {form.shopId && shopsMap.get(form.shopId) && (
              <span
                className="inline-flex h-[22px] items-center rounded-[5px] border px-2 text-[11.5px] leading-none"
                style={{ color: '#9b82ff', borderColor: 'rgba(124,92,255,0.3)', background: 'rgba(124,92,255,0.08)' }}
              >
                {shopsMap.get(form.shopId)}
              </span>
            )}
          </div>

          <div className="mt-0.5 flex items-center gap-3 text-[12px] text-[#8689a0]">
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-[#5b5e74]" strokeWidth={1.75} />
              {elementCount} field{elementCount !== 1 ? 's' : ''}
            </span>
            <span className="text-[#5b5e74]">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-[#5b5e74]" strokeWidth={1.75} />
              {formatRelativeTime(form.updatedAt || form.createdAt)}
            </span>
            <span className="text-[#5b5e74]">·</span>
            <span>{completeness}% complete</span>
          </div>
        </div>

        {/* Footer */}
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-dashed border-white/[0.06] bg-white/[0.015] px-3.5 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="serif text-[20px] leading-none text-[#f4f4f8]">{form.responseCount.toLocaleString()}</span>
            <span className="mono text-[11px] uppercase tracking-[0.1em] text-[#8689a0]">responses</span>
            {newResponses > 0 && (
              <span className="mono inline-flex h-[18px] items-center rounded px-1.5 text-[10.5px] font-semibold tracking-[0.04em] text-[#34d399]" style={{ background: 'rgba(52,211,153,0.12)' }}>
                +{newResponses}
              </span>
            )}
          </div>
          <div style={{ color: status === 'active' ? '#7c5cff' : '#5b5e74' }}>
            <Spark values={trendSeries} color="currentColor" width={64} height={22} />
          </div>
        </div>
      </div>
    );
  };

  // Handle authentication errors after forms query fails (moved to useEffect to avoid render-time side effects)
  useEffect(() => {
    if (isInitialized && formsError && (formsError.message?.includes('401') || formsError.message?.includes('Authentication failed'))) {
      setLocation('/auth');
    }
  }, [isInitialized, formsError, setLocation]);

  // Shared header used across loading / error / loaded states
  const renderPageHead = () => (
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pt-1">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-[0.15em]">
          {formattedDate}
        </p>
        <h1
          className="text-2xl sm:text-3xl lg:text-[2rem] font-extrabold tracking-tight leading-none"
          data-testid="text-forms-title"
        >
          Your <em className="serif font-normal italic">forms</em>.
        </h1>
        <p className="text-sm text-muted-foreground/80">
          Create and manage custom forms to collect information and responses.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {lastRefreshedAt && (
          <span className="mono text-[11px] text-muted-foreground/70 mr-1">
            Refreshed {formatRefreshTime(lastRefreshedAt)}
          </span>
        )}
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={formsLoading}
          className="h-9 rounded-[10px]"
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${formsLoading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          Refresh
        </Button>
        {canCreateForms && (
          <Link href="/forms/add">
            <Button className="h-9 rounded-[10px] bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-3.5 w-3.5" strokeWidth={2} />
              New form
            </Button>
          </Link>
        )}
      </div>
    </div>
  );

  // Show loading while authentication is being determined
  if (!isInitialized || authLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-5 lg:space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Authenticating…</span>
        </div>
      </div>
    );
  }

  // Permission denied - no forms.view access
  if (!canViewForms) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-5 lg:space-y-6">
        <Card className="rounded-[10px] border border-border bg-card">
          <CardContent className="text-center py-12">
            <h2 className="text-lg font-semibold text-foreground mb-1.5">Access denied</h2>
            <p className="text-sm text-muted-foreground">You don't have permission to view forms.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading while forms are being fetched
  if (formsLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-5 lg:space-y-6">
        {renderPageHead()}
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Loading forms…</span>
        </div>
      </div>
    );
  }

  // Show error state if forms failed to load
  if (formsError) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-5 lg:space-y-6">
        {renderPageHead()}
        <Card className="rounded-[10px] border border-border bg-card">
          <CardContent className="text-center py-12">
            <p className="text-[color:var(--bad)] text-sm mb-4">Failed to load forms</p>
            <Button onClick={() => refetch()} variant="outline" className="rounded-[10px]">Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summaryCards = [
    {
      label: 'Total forms',
      icon: FileText,
      value: summary.total,
      unit: null as string | null,
    },
    {
      label: 'Active',
      icon: CheckCircle2,
      value: summary.active,
      unit: summary.total > 0 ? `/ ${summary.total}` : null,
    },
    {
      label: 'Total responses',
      icon: MessageSquare,
      value: summary.responses,
      unit: null,
    },
    {
      label: 'Avg. per form',
      icon: TrendingUp,
      value: summary.avgPerForm,
      unit: null,
    },
  ];

  const categorySections: Array<{
    key: string;
    title: string;
    sub: string;
    icon: typeof ClipboardList;
    filter: (f: Form) => boolean;
    emptyLabel: string;
  }> = [
    {
      key: 'intake',
      title: 'Intake forms',
      sub: 'sign-ups · newsletters · lead capture',
      icon: ClipboardList,
      filter: (f) => !f.category || f.category === 'intake',
      emptyLabel: 'No intake forms yet',
    },
    {
      key: 'survey',
      title: 'Survey forms',
      sub: 'questionnaires · reviews · feedback',
      icon: FileQuestion,
      filter: (f) => f.category === 'survey',
      emptyLabel: 'No survey forms yet',
    },
    {
      key: 'email-signup',
      title: 'Email signup forms',
      sub: 'email collection · communication consent',
      icon: Mail,
      filter: (f) => f.category === 'email-signup',
      emptyLabel: 'No email signup forms yet',
    },
  ];

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-5 lg:space-y-6 overflow-y-auto">
      {renderPageHead()}

      {/* Summary stat panel — single bordered frame, hairline dividers, serif numerals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-[10px] border border-border bg-card overflow-hidden shadow-[0_1px_0_rgba(20,16,10,.02),0_1px_2px_rgba(20,16,10,.03)]">
        {summaryCards.map((stat, index) => {
          const borders = [
            "border-r border-b lg:border-b-0",
            "border-b lg:border-b-0 lg:border-r",
            "border-r",
            "",
          ][index];
          return (
            <div
              key={stat.label}
              className={`relative flex flex-col gap-2.5 p-4 sm:p-5 min-w-0 border-border ${borders}`}
              data-testid={`forms-stat-${index}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {stat.label}
                </span>
                <stat.icon className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" strokeWidth={1.5} />
              </div>
              <div className="serif flex items-baseline gap-1.5 text-[32px] sm:text-[38px] leading-none tracking-[-0.02em] text-foreground">
                {(stat.value ?? 0).toLocaleString()}
                {stat.unit && (
                  <span className="mono text-[13px] font-medium text-muted-foreground not-italic">
                    {stat.unit}
                  </span>
                )}
              </div>
              <div className="min-h-[12px]" />
            </div>
          );
        })}
      </div>

      {forms.length === 0 ? (
        <Card className="rounded-[10px] border border-border bg-card">
          <CardContent className="text-center py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No forms created yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Start collecting information and responses.</p>
            </div>
            {canCreateForms && (
              <Link href="/forms/add" className="mt-1">
                <Button className="rounded-[10px] bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="mr-2 h-3.5 w-3.5" strokeWidth={2} />
                  Create your first form
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {categorySections.map((section) => {
            const sectionForms = forms.filter(section.filter);
            return (
              <div
                key={section.key}
                className="rounded-[10px] border border-border bg-card overflow-hidden shadow-[0_1px_0_rgba(20,16,10,.02),0_1px_2px_rgba(20,16,10,.03)]"
              >
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <section.icon className="h-4 w-4 text-muted-foreground/70 shrink-0" strokeWidth={1.5} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold tracking-[-0.005em] text-foreground">
                        {section.title}
                      </div>
                      <div className="mono text-[11px] text-muted-foreground/80 mt-0.5 truncate">
                        {section.sub}
                      </div>
                    </div>
                  </div>
                  <span className="mono text-[10.5px] font-medium text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-muted/40 shrink-0">
                    {sectionForms.length} {sectionForms.length === 1 ? 'form' : 'forms'}
                  </span>
                </div>
                <div className="p-4 sm:p-5">
                  {sectionForms.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                      <section.icon className="h-6 w-6 opacity-40" strokeWidth={1.25} />
                      <p className="text-xs">{section.emptyLabel}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sectionForms.map((form) => renderFormCard(form))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Preview Modal */}
      {previewForm && (
        <FormPreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => {
            setIsPreviewModalOpen(false);
            setPreviewForm(null);
          }}
          form={previewForm}
          formSettings={{
            showProgressBar: true,
            showFormTitle: true,
            allowSaveProgress: false
          }}
        />
      )}

      {/* QR Code Modal */}
      <Dialog open={isQRModalOpen} onOpenChange={setIsQRModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              {qrForm ? `QR Code for "${qrForm.title}"` : 'QR Code'}
            </DialogTitle>
          </DialogHeader>
          {qrForm && (
            <FormQRCode
              formId={qrForm.id}
              formTitle={qrForm.title}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Form Responses Modal */}
      {responsesForm && (
        <FormResponses
          formId={responsesForm.id}
          formTitle={responsesForm.title}
          isOpen={isResponsesModalOpen}
          onClose={() => {
            setIsResponsesModalOpen(false);
            setResponsesForm(null);
          }}
        />
      )}
    </div>
  );
}
