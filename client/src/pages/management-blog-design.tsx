import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  RotateCcw,
  Smartphone,
  Monitor,
  Palette,
  Type,
  Layout,
  Globe,
  BookOpen,
  ShieldAlert,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Calendar,
  ArrowRight,
  PenTool,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import phoneMockup from "@assets/phone_14.svg";

interface BlogDesignData {
  id: string;
  companyName: string;
  headerMode?: string;
  logoUrl?: string;
  logoSize?: string;
  logoAlignment?: string;
  bannerUrl?: string;
  showCompanyName?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pageBackgroundColor?: string;
  fontFamily: string;
  headerText?: string;
  footerText?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
  newsletterEditorType?: string;
  updatedAt: string;
}

const PRESET_COLORS = [
  "#FFFFFF", "#EF4444", "#EC4899", "#A855F7", "#6366F1", "#3B82F6",
  "#0EA5E9", "#06B6D4", "#14B8A6", "#22C55E", "#84CC16",
  "#FACC15", "#F59E0B", "#F97316", "#EA580C", "#8B5E3C",
  "#64748B", "#111827", "#10B981", "#9333EA", "#2563EB",
];

const FONT_OPTIONS = [
  { value: "Arial, sans-serif", label: "Arial", style: { fontFamily: "Arial, sans-serif" } },
  { value: "Helvetica, sans-serif", label: "Helvetica", style: { fontFamily: "Helvetica, sans-serif" } },
  { value: "Georgia, serif", label: "Georgia", style: { fontFamily: "Georgia, serif" } },
  { value: "'Times New Roman', serif", label: "Times New Roman", style: { fontFamily: "'Times New Roman', serif" } },
  { value: "'Courier New', monospace", label: "Courier New", style: { fontFamily: "'Courier New', monospace" } },
  { value: "Verdana, sans-serif", label: "Verdana", style: { fontFamily: "Verdana, sans-serif" } },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS", style: { fontFamily: "'Trebuchet MS', sans-serif" } },
  { value: "'Inter', sans-serif", label: "Inter (System)", style: { fontFamily: "'Inter', sans-serif" } },
];

/**
 * Validates that a URL uses a safe scheme (http or https only).
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

/**
 * ColorPicker Component
 */
function ColorPicker({
  label,
  color,
  onChange,
  disabled
}: {
  label: string;
  color: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</Label>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full border border-slate-200 shadow-sm"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-mono text-slate-500 uppercase">{color}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Input
            value={color}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="pl-9 pr-12 font-mono uppercase"
            maxLength={7}
          />
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-slate-200"
            style={{ backgroundColor: color }}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-8 h-8 right-3 top-1/2 -translate-y-1/2 absolute rounded cursor-pointer border border-slate-200"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            disabled={disabled}
            className={`w-6 h-6 rounded-full hover:scale-110 transition-transform ${color.toLowerCase() === c.toLowerCase() ? "ring-2 ring-primary ring-offset-2" : ""
              } ${c === "#FFFFFF" ? "border border-gray-300" : "border border-transparent"}`}
            style={{ backgroundColor: c }}
            aria-label={`Select color ${c}`}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}

// Sample newsletter cards for the preview
const SAMPLE_NEWSLETTERS = [
  { title: "Our Latest Product Launch", subject: "Exciting new features you'll love", date: "March 5, 2026" },
  { title: "Monthly Industry Roundup", subject: "Key trends and insights from the past month", date: "February 28, 2026" },
  { title: "Behind the Scenes", subject: "A look at how our team builds amazing products", date: "February 15, 2026" },
];

export default function ManagementBlogDesign() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [draft, setDraft] = useState<Partial<BlogDesignData>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewPage, setPreviewPage] = useState<"hub" | "article">("hub");

  const screenRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ active: false, startY: 0, startScrollTop: 0, moved: false });

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!screenRef.current) return;
    dragState.current = {
      active: true,
      startY: e.clientY,
      startScrollTop: screenRef.current.scrollTop,
      moved: false,
    };
    screenRef.current.style.cursor = 'grabbing';
  };

  const handleDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState.current.active || !screenRef.current) return;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dy) > 3) dragState.current.moved = true;
    screenRef.current.scrollTop = dragState.current.startScrollTop - dy;
  };

  const handleDragEnd = () => {
    if (!screenRef.current) return;
    dragState.current.active = false;
    screenRef.current.style.cursor = 'grab';
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const { data: blogDesign, isLoading, error } = useQuery({
    queryKey: ["/api/blog-design"],
    queryFn: async () => {
      const response = await fetch('/api/blog-design', {
        credentials: 'include',
      });
      if (!response.ok) {
        const err = new Error(
          response.status === 403 ? '403: Insufficient permissions' : 'Failed to fetch blog design'
        );
        (err as any).status = response.status;
        throw err;
      }
      return response.json();
    },
  });

  // Initialize draft when data loads
  useEffect(() => {
    if (blogDesign && !hasChanges) {
      setDraft(blogDesign);
    }
  }, [blogDesign, hasChanges]);

  const updateField = (field: keyof BlogDesignData | string, value: any) => {
    setHasChanges(true);
    setDraft((prev) => {
      const newDraft = { ...prev };
      if (field.startsWith('socialLinks.')) {
        const socialKey = field.split('.')[1] as keyof typeof prev.socialLinks;
        newDraft.socialLinks = {
          ...prev.socialLinks,
          [socialKey]: value
        };
      } else {
        // @ts-ignore
        newDraft[field] = value;
      }
      return newDraft;
    });
  };

  const updateMutation = useMutation({
    mutationFn: async (designData: Partial<BlogDesignData>) => {
      const response = await fetch('/api/blog-design', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(designData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update blog design');
      }
      return response.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(["/api/blog-design"], data);
      setDraft(data);
      setHasChanges(false);
      toast({
        title: "Blog design saved",
        description: "Your blog page design has been updated."
      });
    },
    onError: (e: any) => toast({
      title: "Error",
      description: e?.message || "Failed to save blog design",
      variant: "destructive"
    }),
  });

  const handleSave = () => {
    const { updatedAt, id, ...payload } = draft;
    updateMutation.mutate(payload);
  };

  const handleReset = () => {
    if (blogDesign) {
      setDraft(blogDesign);
      setHasChanges(false);
      toast({
        title: "Changes discarded",
        description: "Reverted to the last saved version.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <BookOpen className="w-10 h-10 animate-bounce text-primary mb-4" />
          <p className="text-muted-foreground animate-pulse">Loading blog design studio...</p>
        </div>
      </div>
      </div>
    );
  }

  const is403 = error instanceof Error && (error.message?.startsWith('403:') || (error as any).status === 403);
  if (is403) {
    return (
      <div className="p-6 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <ShieldAlert className="h-8 w-8 text-orange-500" />
              <p className="font-medium text-sm">{t('common.permissionDenied', 'Permission Denied')}</p>
              <p className="text-xs text-muted-foreground max-w-xs">{t('common.permissionDeniedDescription', 'You do not have permission to view this section. Contact your administrator to request access.')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    );
  }

  const logoSizeMap: Record<string, string> = {
    small: "40px",
    medium: "56px",
    large: "72px",
    xlarge: "96px",
  };

  const logoHeight = logoSizeMap[draft.logoSize || 'medium'] || "56px";

  return (
    <div className="p-6 bg-background min-h-screen">
    <div className="max-w-7xl mx-auto">
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">
            Blog Design
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customize the look and feel of your public newsletter blog pages.
          </p>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || updateMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            {updateMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Changes
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

        {/* Left Panel: Settings Controls */}
        <div className="xl:col-span-4 space-y-6 order-2 xl:order-1">
          <Card className="border-0 shadow-sm bg-card/50">
            <CardContent className="p-0">
              <Accordion type="single" collapsible defaultValue="brand" className="space-y-4">

                {/* 0. Newsletter Editor */}
                <AccordionItem value="editor" className="border rounded-lg bg-card px-4 shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-md text-indigo-600 dark:text-indigo-400">
                        <PenTool className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-base">Newsletter Editor</h3>
                        <p className="text-sm text-muted-foreground font-normal">Choose your editing experience</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Select which editor to use when creating newsletters. This setting applies to all new newsletters.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Classic (Puck) */}
                      <button
                        type="button"
                        onClick={() => updateField("newsletterEditorType", "classic")}
                        className={`relative flex flex-col items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${(draft.newsletterEditorType || 'classic') === 'classic'
                            ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20'
                            : 'border-input bg-background hover:border-muted-foreground/30 hover:bg-muted/50'
                          }`}
                      >
                        {(draft.newsletterEditorType || 'classic') === 'classic' && (
                          <div className="absolute top-2.5 right-2.5">
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                        <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                          <Layout className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">Classic Editor</h4>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Drag-and-drop block editor with visual components. Best for richly designed email newsletters with images, grids, and custom layouts.
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Puck Editor</Badge>
                      </button>

                      {/* Notion-like (TipTap) */}
                      <button
                        type="button"
                        onClick={() => updateField("newsletterEditorType", "notion")}
                        className={`relative flex flex-col items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${draft.newsletterEditorType === 'notion'
                            ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20'
                            : 'border-input bg-background hover:border-muted-foreground/30 hover:bg-muted/50'
                          }`}
                      >
                        {draft.newsletterEditorType === 'notion' && (
                          <div className="absolute top-2.5 right-2.5">
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                        <div className="p-2.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                          <PenTool className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">Notion-like Editor</h4>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Clean writing experience with slash commands (<code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">/</code>). Best for text-focused newsletters and blog-style content.
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">TipTap Editor</Badge>
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 1. Brand Identity */}
                <AccordionItem value="brand" className="border rounded-lg bg-card px-4 shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md text-blue-600 dark:text-blue-400">
                        <Layout className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-base">Brand Identity</h3>
                        <p className="text-sm text-muted-foreground font-normal">Logo and company details</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6 space-y-5">
                    <div className="space-y-2.5">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={draft.companyName || ""}
                        onChange={(e) => updateField("companyName", e.target.value)}
                        placeholder="e.g. Acme Corp"
                      />
                      <div className="flex items-center justify-between pt-1">
                        <Label htmlFor="showCompanyName" className="text-sm font-normal text-muted-foreground cursor-pointer">
                          Show company name in blog header
                        </Label>
                        <Switch
                          id="showCompanyName"
                          checked={(draft.showCompanyName ?? 'true') === 'true'}
                          onCheckedChange={(checked) => updateField("showCompanyName", checked ? 'true' : 'false')}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Header Mode Toggle */}
                    <div className="space-y-2.5">
                      <Label>Blog Header Style</Label>
                      <div className="flex gap-2">
                        {([
                          { value: 'logo', label: 'Logo', icon: Layout },
                          { value: 'banner', label: 'Banner', icon: ImageIcon },
                        ] as const).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateField("headerMode", opt.value)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm rounded-md border transition-colors ${(draft.headerMode || 'logo') === opt.value
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background hover:bg-muted border-input'
                              }`}
                          >
                            <opt.icon className="w-4 h-4" />
                            <span className="font-medium">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(draft.headerMode || 'logo') === 'banner'
                          ? 'Full-width banner image replaces the logo in the blog header.'
                          : 'Display your logo in the blog header.'}
                      </p>
                    </div>

                    {/* Logo fields */}
                    {(draft.headerMode || 'logo') === 'logo' && (
                      <div className="space-y-2.5">
                        <Label htmlFor="logoUrl">Logo URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id="logoUrl"
                            value={draft.logoUrl || ""}
                            onChange={(e) => updateField("logoUrl", e.target.value)}
                            placeholder="https://..."
                          />
                          {draft.logoUrl && isSafeUrl(draft.logoUrl) && (
                            <div className="w-10 h-10 rounded border bg-white p-1 flex items-center justify-center shrink-0">
                              <img src={draft.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Recommended height: 128px</p>
                        <div className="space-y-2 pt-1">
                          <Label>Logo Size</Label>
                          <div className="flex gap-2">
                            {([
                              { value: 'small', label: 'Small', px: '40px' },
                              { value: 'medium', label: 'Medium', px: '56px' },
                              { value: 'large', label: 'Large', px: '72px' },
                              { value: 'xlarge', label: 'X-Large', px: '96px' },
                            ] as const).map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateField("logoSize", opt.value)}
                                className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${(draft.logoSize || 'medium') === opt.value
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-muted border-input'
                                  }`}
                              >
                                <div className="font-medium">{opt.label}</div>
                                <div className="text-[10px] opacity-70">{opt.px}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2 pt-1">
                          <Label>Logo Alignment</Label>
                          <div className="flex gap-2">
                            {([
                              { value: 'left', label: 'Left', icon: AlignLeft },
                              { value: 'center', label: 'Center', icon: AlignCenter },
                              { value: 'right', label: 'Right', icon: AlignRight },
                            ] as const).map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateField("logoAlignment", opt.value)}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md border transition-colors ${(draft.logoAlignment || 'center') === opt.value
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-muted border-input'
                                  }`}
                              >
                                <opt.icon className="w-4 h-4" />
                                <span className="font-medium">{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Banner fields */}
                    {(draft.headerMode || 'logo') === 'banner' && (
                      <div className="space-y-2.5">
                        <Label htmlFor="bannerUrl">Banner Image URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id="bannerUrl"
                            value={draft.bannerUrl || ""}
                            onChange={(e) => updateField("bannerUrl", e.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Recommended size: 1200 x 300px for desktop. The image will span the full width.</p>
                        {draft.bannerUrl && isSafeUrl(draft.bannerUrl) && (
                          <div className="mt-2 rounded-md border overflow-hidden bg-white">
                            <img
                              src={draft.bannerUrl}
                              alt="Banner preview"
                              className="w-full h-auto object-cover"
                              style={{ maxHeight: '120px' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* 2. Color Scheme */}
                <AccordionItem value="colors" className="border rounded-lg bg-card px-4 shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-md text-purple-600 dark:text-purple-400">
                        <Palette className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-base">Color Scheme</h3>
                        <p className="text-sm text-muted-foreground font-normal">Primary, secondary, accent & background colors</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6 space-y-6">
                    <ColorPicker
                      label="Primary Color"
                      color={draft.primaryColor || "#000000"}
                      onChange={(c) => updateField("primaryColor", c)}
                    />
                    <Separator />
                    <ColorPicker
                      label="Secondary Color"
                      color={draft.secondaryColor || "#000000"}
                      onChange={(c) => updateField("secondaryColor", c)}
                    />
                    <Separator />
                    <ColorPicker
                      label="Accent Color"
                      color={draft.accentColor || "#000000"}
                      onChange={(c) => updateField("accentColor", c)}
                    />
                    <Separator />
                    <ColorPicker
                      label="Page Background Color"
                      color={draft.pageBackgroundColor || "#F3F4F6"}
                      onChange={(c) => updateField("pageBackgroundColor", c)}
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* 3. Typography */}
                <AccordionItem value="typography" className="border rounded-lg bg-card px-4 shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-md text-green-600 dark:text-green-400">
                        <Type className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-base">Typography</h3>
                        <p className="text-sm text-muted-foreground font-normal">Font styles for your blog</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6">
                    <div className="space-y-3">
                      <Label>Font Family</Label>
                      <Select
                        value={draft.fontFamily}
                        onValueChange={(val) => updateField("fontFamily", val)}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select a font" />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_OPTIONS.map((font) => (
                            <SelectItem key={font.value} value={font.value} style={font.style} className="cursor-pointer py-3">
                              <span className="text-base">{font.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Web-safe fonts ensure your blog looks consistent across all browsers and devices.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 4. Content */}
                <AccordionItem value="content" className="border rounded-lg bg-card px-4 shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-md text-orange-600 dark:text-orange-400">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-base">Blog Content</h3>
                        <p className="text-sm text-muted-foreground font-normal">Header & footer customization</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6 space-y-5">
                    <div className="space-y-2.5">
                      <Label htmlFor="headerText">Header Tagline</Label>
                      <Input
                        id="headerText"
                        value={draft.headerText || ""}
                        onChange={(e) => updateField("headerText", e.target.value)}
                        placeholder="e.g. Insights & Updates"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="footerText">Footer Text</Label>
                      <Textarea
                        id="footerText"
                        value={draft.footerText || ""}
                        onChange={(e) => updateField("footerText", e.target.value)}
                        placeholder="e.g. Copyright © 2026"
                        rows={4}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 5. Social Links */}
                <AccordionItem value="social" className="border rounded-lg bg-card px-4 shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-sky-50 dark:bg-sky-900/20 rounded-md text-sky-600 dark:text-sky-400">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-base">Social Links</h3>
                        <p className="text-sm text-muted-foreground font-normal">Links to your profiles</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6 space-y-4">
                    {["facebook", "twitter", "instagram", "linkedin"].map((platform) => (
                      <div key={platform} className="space-y-2">
                        <Label htmlFor={platform} className="capitalize">{platform}</Label>
                        <Input
                          id={platform}
                          // @ts-ignore
                          value={draft.socialLinks?.[platform] || ""}
                          onChange={(e) => updateField(`socialLinks.${platform}`, e.target.value)}
                          placeholder={`https://${platform}.com/...`}
                        />
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>

              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Live Preview */}
        <div className="xl:col-span-8 order-1 xl:order-2">
          <div className="sticky top-6 space-y-4">
            <div className="flex items-center justify-between bg-card p-2 rounded-lg border shadow-sm">
              <div className="flex items-center gap-4 pl-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Preview:</span>
                  <div className="flex bg-muted/50 p-1 rounded-md">
                    <Button
                      variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => setPreviewDevice("desktop")}
                    >
                      <Monitor className="w-3.5 h-3.5 mr-1.5" />
                      Desktop
                    </Button>
                    <Button
                      variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => setPreviewDevice("mobile")}
                    >
                      <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                      Mobile
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Page:</span>
                  <div className="flex bg-muted/50 p-1 rounded-md">
                    <Button
                      variant={previewPage === "hub" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => setPreviewPage("hub")}
                    >
                      Hub
                    </Button>
                    <Button
                      variant={previewPage === "article" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => setPreviewPage("article")}
                    >
                      Article
                    </Button>
                  </div>
                </div>
              </div>

              <Badge variant="outline" className="text-xs font-normal">
                Live Changes
              </Badge>
            </div>

            {/* Blog Canvas */}
            <div className={`transition-all duration-500 ease-in-out mx-auto p-4 sm:p-6 bg-muted/50 rounded-xl overflow-y-auto max-h-[calc(100vh-12rem)] ${previewDevice === "mobile" ? "max-w-[400px]" : "w-full"
              }`}>
              <div
                className={`mx-auto w-full relative ${
                  previewDevice === "mobile"
                    ? "max-w-[340px]"
                    : "shadow-2xl bg-gray-50 rounded-lg overflow-hidden"
                }`}
                style={previewDevice === "mobile"
                  ? { aspectRatio: '436 / 878', fontFamily: draft.fontFamily }
                  : { fontFamily: draft.fontFamily }}
              >

                {/* Phone SVG mockup overlay — mobile only */}
                {previewDevice === "mobile" && (
                  <img
                    src={phoneMockup}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="absolute inset-0 w-full h-full pointer-events-none select-none z-20"
                  />
                )}

                {/* Simulated browser chrome — desktop only */}
                {previewDevice === "desktop" && (
                  <div className="bg-gray-200 dark:bg-gray-700 px-3 py-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-600">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 bg-white dark:bg-gray-600 rounded px-2 py-0.5">&nbsp;</div>
                  </div>
                )}

                <div
                  ref={previewDevice === "mobile" ? screenRef : undefined}
                  onMouseDown={previewDevice === "mobile" ? handleDragStart : undefined}
                  onMouseMove={previewDevice === "mobile" ? handleDragMove : undefined}
                  onMouseUp={previewDevice === "mobile" ? handleDragEnd : undefined}
                  onMouseLeave={previewDevice === "mobile" ? handleDragEnd : undefined}
                  onClickCapture={previewDevice === "mobile" ? handleClickCapture : undefined}
                  className={previewDevice === "mobile"
                    ? "absolute overflow-y-auto overflow-x-hidden bg-gray-50 z-10 select-none scrollbar-hide"
                    : "relative bg-gray-50"}
                  style={previewDevice === "mobile" ? {
                    top: '4.04%',
                    left: '6.84%',
                    right: '6.46%',
                    bottom: '2.71%',
                    borderRadius: '12.7% / 5.86%',
                    cursor: 'grab',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                  } as React.CSSProperties : undefined}
                >

                {previewPage === "hub" ? (
                  /* ─── Newsletter Hub Preview ─── */
                  <div className="min-h-[500px]" style={{ backgroundColor: draft.pageBackgroundColor || '#F3F4F6' }}>
                    {/* Header */}
                    {(draft.headerMode || 'logo') === 'banner' && draft.bannerUrl && isSafeUrl(draft.bannerUrl) ? (
                      <div>
                        <img
                          src={draft.bannerUrl}
                          alt="Banner"
                          className="w-full h-auto object-cover"
                          style={{ maxHeight: '160px' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <div className="px-6 py-6 text-center" style={{ backgroundColor: draft.primaryColor, color: "#fff" }}>
                          {(draft.showCompanyName ?? 'true') === 'true' && (
                            <h1 className="text-2xl font-bold mb-1">{draft.companyName || "Your Company"}</h1>
                          )}
                          {draft.headerText && (
                            <p className="text-sm opacity-90">{draft.headerText}</p>
                          )}
                          <div className="mt-2 text-white/70 text-xs font-medium uppercase tracking-wider">Newsletter Archive</div>
                        </div>
                      </div>
                    ) : (
                      <header className="px-6 py-8" style={{ backgroundColor: draft.primaryColor, color: "#fff" }}>
                        <div className={`${draft.logoAlignment === 'left' ? 'text-left' : draft.logoAlignment === 'right' ? 'text-right' : 'text-center'}`}>
                          {draft.logoUrl && isSafeUrl(draft.logoUrl) ? (
                            <img
                              src={draft.logoUrl}
                              alt="Logo"
                              className={`mb-3 object-contain ${draft.logoAlignment === 'left' ? '' : draft.logoAlignment === 'right' ? 'ml-auto' : 'mx-auto'}`}
                              style={{ height: logoHeight, width: "auto" }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            (draft.showCompanyName ?? 'true') !== 'true' && (
                              <div className={`mb-3 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold ${draft.logoAlignment === 'left' ? '' : draft.logoAlignment === 'right' ? 'ml-auto' : 'mx-auto'}`}>
                                {draft.companyName?.charAt(0) || "C"}
                              </div>
                            )
                          )}
                          {(draft.showCompanyName ?? 'true') === 'true' && (
                            <h1 className="text-2xl font-bold mb-1">{draft.companyName || "Your Company"}</h1>
                          )}
                          {draft.headerText && (
                            <p className="text-sm opacity-90 max-w-md mx-auto">{draft.headerText}</p>
                          )}
                          <div className="mt-3 text-white/70 text-xs font-medium uppercase tracking-wider">Newsletter Archive</div>
                        </div>
                      </header>
                    )}

                    {/* Newsletter Cards Grid */}
                    <div className={`p-6 grid gap-4 ${previewDevice === "mobile" ? "grid-cols-1" : "grid-cols-3"}`}>
                      {SAMPLE_NEWSLETTERS.map((nl, i) => (
                        <article key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                          <div className="h-1.5" style={{ backgroundColor: draft.primaryColor }} />
                          <div className="p-4">
                            <div className="flex items-center text-[10px] text-gray-400 mb-2">
                              <Calendar className="h-3 w-3 mr-1" />
                              {nl.date}
                            </div>
                            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">{nl.title}</h3>
                            <p className="text-xs text-gray-500 line-clamp-2 mb-3">{nl.subject}</p>
                            <div className="flex items-center text-xs font-medium" style={{ color: draft.primaryColor }}>
                              Read more
                              <ArrowRight className="h-3 w-3 ml-1" />
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>

                    {/* Footer */}
                    <footer className="border-t border-gray-200 bg-white px-6 py-6 text-center">
                      <div className="flex items-center justify-center gap-4 mb-3 text-xs">
                        {isSafeUrl(draft.socialLinks?.facebook) && (
                          <span className="text-gray-400 hover:text-gray-600 cursor-pointer">Facebook</span>
                        )}
                        {isSafeUrl(draft.socialLinks?.twitter) && (
                          <span className="text-gray-400 hover:text-gray-600 cursor-pointer">Twitter</span>
                        )}
                        {isSafeUrl(draft.socialLinks?.instagram) && (
                          <span className="text-gray-400 hover:text-gray-600 cursor-pointer">Instagram</span>
                        )}
                        {isSafeUrl(draft.socialLinks?.linkedin) && (
                          <span className="text-gray-400 hover:text-gray-600 cursor-pointer">LinkedIn</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {draft.footerText || `© ${new Date().getFullYear()} ${draft.companyName || "Your Company"}. All rights reserved.`}
                      </p>
                    </footer>
                  </div>
                ) : (
                  /* ─── Article View Preview ─── */
                  <div className="min-h-[500px] bg-gray-50">
                    {/* Header: banner spread or compact nav bar */}
                    {(draft.headerMode || 'logo') === 'banner' && draft.bannerUrl && isSafeUrl(draft.bannerUrl) ? (
                      <div>
                        <img
                          src={draft.bannerUrl}
                          alt="Banner"
                          className="w-full h-auto object-cover"
                          style={{ maxHeight: '160px' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <div className="px-6 py-3 flex items-center justify-between" style={{ backgroundColor: draft.primaryColor, color: "#fff" }}>
                          <span className="text-xs font-medium opacity-80 flex items-center gap-1">
                            ← All Newsletters
                          </span>
                          <div className="flex items-center gap-2">
                            {(draft.showCompanyName ?? 'true') === 'true' && (
                              <span className="text-sm font-semibold">{draft.companyName || "Your Company"}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <header className="px-6 py-3 flex items-center justify-between" style={{ backgroundColor: draft.primaryColor, color: "#fff" }}>
                        <span className="text-xs font-medium opacity-80 flex items-center gap-1">
                          ← All Newsletters
                        </span>
                        <div className="flex items-center gap-2">
                          {draft.logoUrl && isSafeUrl(draft.logoUrl) ? (
                            <img
                              src={draft.logoUrl}
                              alt="Logo"
                              className="object-contain"
                              style={{ height: "28px", width: "auto" }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <span className="text-sm font-semibold">{draft.companyName || "Your Company"}</span>
                          )}
                        </div>
                      </header>
                    )}

                    {/* Article body */}
                    <main className={`${previewDevice === "mobile" ? "px-4 py-6" : "px-10 py-8"} max-w-3xl mx-auto`}>
                      <div className="mb-6">
                        <div className="flex items-center text-xs text-gray-400 mb-3">
                          <Calendar className="h-3.5 w-3.5 mr-1.5" />
                          March 5, 2026
                        </div>
                        <h1 className={`font-bold text-gray-900 tracking-tight leading-tight mb-2 ${previewDevice === "mobile" ? "text-xl" : "text-2xl"}`}>
                          Our Latest Product Launch
                        </h1>
                        <p className="text-sm text-gray-500">Exciting new features you'll love</p>
                        <div className="mt-4 h-1 w-12 rounded-full" style={{ backgroundColor: draft.primaryColor }} />
                      </div>

                      <article className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 prose prose-sm max-w-none" style={{ fontFamily: draft.fontFamily, color: "#334155" }}>
                          <h2 className="text-base font-bold text-gray-900 mt-0">Hello there,</h2>
                          <p className="text-sm leading-relaxed text-gray-600">
                            We're thrilled to announce our latest product update! This release includes several features that our community has been requesting.
                          </p>
                          <div
                            className="p-4 rounded-lg my-4 border-l-4"
                            style={{ backgroundColor: `${draft.secondaryColor}15`, borderLeftColor: draft.secondaryColor }}
                          >
                            <h3 className="font-bold text-sm mb-1" style={{ color: draft.secondaryColor }}>
                              What's New
                            </h3>
                            <p className="text-xs text-gray-600">
                              Enhanced dashboard, new integrations, and improved performance across the board.
                            </p>
                          </div>
                          <p className="text-sm leading-relaxed text-gray-600">
                            Click the button below to explore all the new features and improvements.
                          </p>
                          <div className="text-center py-4">
                            <span
                              className="inline-block px-5 py-2.5 rounded text-white text-sm font-bold"
                              style={{ backgroundColor: draft.accentColor }}
                            >
                              Explore Features
                            </span>
                          </div>
                        </div>
                      </article>

                      <div className="mt-6 text-center">
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700">
                          ← Back to all newsletters
                        </span>
                      </div>
                    </main>

                    {/* Footer */}
                    <footer className="px-6 py-6 text-center mt-4">
                      <div className="flex items-center justify-center gap-4 mb-3 text-xs">
                        {isSafeUrl(draft.socialLinks?.facebook) && (
                          <span className="text-gray-400 hover:text-gray-600 cursor-pointer">Facebook</span>
                        )}
                        {isSafeUrl(draft.socialLinks?.twitter) && (
                          <span className="text-gray-400 hover:text-gray-600 cursor-pointer">Twitter</span>
                        )}
                        {isSafeUrl(draft.socialLinks?.instagram) && (
                          <span className="text-gray-400 hover:text-gray-600 cursor-pointer">Instagram</span>
                        )}
                        {isSafeUrl(draft.socialLinks?.linkedin) && (
                          <span className="text-gray-400 hover:text-gray-600 cursor-pointer">LinkedIn</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {draft.footerText || `© ${new Date().getFullYear()} ${draft.companyName || "Your Company"}. All rights reserved.`}
                      </p>
                    </footer>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}
