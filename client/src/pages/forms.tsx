import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Calendar, MoreVertical, Eye, Edit, Trash2, RefreshCw, QrCode, LayoutDashboard, FileText, ClipboardList, FileQuestion, Mail, MessageSquare, CheckCircle2, TrendingUp } from 'lucide-react';
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

// Helper function to get theme preview classes
const getThemePreview = (themeId: string): string => {
  const themePreviewMap: Record<string, string> = {
    'minimal': 'bg-white border border-gray-200 shadow-sm',
    'modern': 'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500',
    'professional': 'bg-gray-50 border-l-4 border-blue-600 shadow-sm',
    'playful': 'bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400',
    'elegant': 'bg-gradient-to-r from-gray-900 to-gray-700 border border-yellow-400/20',
    'modern-bold': 'bg-gradient-to-br from-orange-500 via-red-500 to-purple-600',
    'neon': 'bg-black border-2 border-cyan-400 shadow-cyan-400/50 shadow-lg',
    'nature': 'bg-gradient-to-r from-green-500 to-emerald-600',
    'luxury': 'bg-gradient-to-r from-purple-900 to-indigo-900 border border-yellow-400/30',
    'retro': 'bg-gradient-to-r from-orange-400 to-pink-500 border-4 border-yellow-300',
    'neo-modern': 'bg-gradient-to-br from-slate-800 via-gray-800 to-black border border-green-400/30',
    'aurora': 'bg-[radial-gradient(120%_120%_at_0%_0%,_#7dd3fc_0%,_transparent_40%),_radial-gradient(120%_120%_at_100%_0%,_#c084fc_0%,_transparent_40%),_radial-gradient(120%_120%_at_100%_100%,_#fca5a5_0%,_transparent_40%),_radial-gradient(120%_120%_at_0%_100%,_#86efac_0%,_transparent_40%)]',
    'cosmic': 'bg-gradient-to-br from-purple-900 via-indigo-900 to-black',
    'brutalist': 'bg-gray-800 border-4 border-black',
    'pastel-dream': 'bg-gradient-to-br from-pink-200 via-purple-200 to-indigo-200',
    'promotional': 'bg-gradient-to-br from-red-500 to-orange-500',
    'ocean-breeze': 'bg-gradient-to-br from-cyan-400 via-teal-500 to-blue-600',
    'sunset-warmth': 'bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500'
  };

  return themePreviewMap[themeId] || themePreviewMap['minimal'];
};

// Helper function to get theme-specific preview content
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
        <div className="text-white font-black text-sm tracking-wider uppercase border-2 border-white px-2 py-1">
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
    // Parse theme data to get theme info
    let themeData: { id: string; name: string; preview?: string } = { id: 'minimal', name: 'Unknown' };
    try {
      const parsed = JSON.parse(form.theme);
      themeData = {
        id: parsed.id || 'minimal',
        name: parsed.name || parsed.id || 'Unknown',
        preview: getThemePreview(parsed.id || 'minimal')
      };
    } catch (e) {
      themeData = { id: 'minimal', name: form.theme || 'Unknown', preview: getThemePreview('minimal') };
    }

    // Parse form data to get element count
    let elementCount = 0;
    try {
      const formDataParsed = JSON.parse(form.formData);
      elementCount = formDataParsed.elements?.length || 0;
    } catch (e) {
      elementCount = 0;
    }

    return (
      <Card key={form.id} className="bg-card border border-border rounded-[10px] shadow-[0_1px_0_rgba(20,16,10,.02),0_1px_2px_rgba(20,16,10,.03)] hover:shadow-[0_4px_16px_rgba(20,16,10,.06)] transition-shadow duration-200 group overflow-hidden">
        {/* Theme Preview Header */}
        <div className={`h-20 relative flex items-center justify-center overflow-hidden ${themeData.preview}`}>
          <div className="text-center px-4">
            {getThemePreviewContent(themeData.id)}
          </div>
          {/* Dropdown Menu positioned over theme preview */}
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 bg-black/20 hover:bg-black/30 text-white/90 hover:text-white backdrop-blur-sm rounded-full opacity-70 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
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
        </div>

        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-foreground text-[15px] font-semibold leading-snug tracking-[-0.005em] line-clamp-2">
            {form.title}
          </CardTitle>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <span className="mono inline-flex items-center gap-1.5 text-[10.5px] font-medium px-1.5 py-0.5 rounded border border-border text-muted-foreground">
              {themeData.name}
            </span>
            <span className={`mono inline-flex items-center gap-1.5 text-[10.5px] font-medium px-1.5 py-0.5 rounded border ${form.isActive
              ? 'border-[color:var(--good)]/30 text-[color:var(--good)] bg-[color:var(--good)]/5'
              : 'border-border text-muted-foreground/70'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${form.isActive ? 'bg-[color:var(--good)]' : 'bg-muted-foreground/40'}`} />
              {form.isActive ? 'Active' : 'Inactive'}
            </span>
            {form.shopId && shopsMap.get(form.shopId) && (
              <span className="mono inline-flex items-center text-[10.5px] font-medium px-1.5 py-0.5 rounded border border-[color:var(--accent-warm)]/30 text-[color:var(--accent-warm)] bg-[color:var(--accent-warm)]/5">
                {shopsMap.get(form.shopId)}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 pb-4">
          {form.description && (
            <p className="text-muted-foreground text-[12.5px] leading-relaxed line-clamp-2">
              {form.description}
            </p>
          )}

          {/* Tags */}
          {form.tags && form.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {form.tags.slice(0, 3).map((tagId) => (
                <span
                  key={tagId}
                  className="mono inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
                >
                  {tagId.slice(0, 8)}
                </span>
              ))}
              {form.tags.length > 3 && (
                <span className="mono inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground/70">
                  +{form.tags.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-border/60">
            <div className="mono flex items-center gap-3 text-[11px] text-muted-foreground pt-2">
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" strokeWidth={1.5} />
                {elementCount} field{elementCount !== 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" strokeWidth={1.5} />
                {new Date(form.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <span className="mono text-[11px] text-foreground pt-2">
              {form.responseCount} <span className="text-muted-foreground/60">resp.</span>
            </span>
          </div>
        </CardContent>
      </Card>
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