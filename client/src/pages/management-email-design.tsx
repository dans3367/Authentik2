import { useState, useEffect } from "react";
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
  Mail,
  ShieldAlert
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

interface MasterEmailDesign {
  id: string;
  companyName: string;
  logoUrl?: string;
  logoSize?: string;
  showCompanyName?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  headerText?: string;
  footerText?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
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

const mockMasterDesign: MasterEmailDesign = {
  id: "master-1",
  companyName: "Your Company",
  primaryColor: "#3B82F6",
  secondaryColor: "#1E40AF",
  accentColor: "#10B981",
  fontFamily: "Arial, sans-serif",
  headerText: "Welcome to our newsletter",
  footerText: "© 2025 Your Company. All rights reserved.",
  socialLinks: {},
  updatedAt: new Date().toISOString(),
};

/**
 * Validates that a URL uses a safe scheme (http or https only).
 * Rejects javascript:, data:, vbscript:, and other potentially dangerous schemes.
 */
function isSafeUrl(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return false;
  }

  try {
    const parsed = new URL(trimmedUrl);
    // Only allow http and https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    // If URL parsing fails, check if it starts with a safe protocol
    // This handles cases like "https://example.com" that might fail in edge cases
    const lowerUrl = trimmedUrl.toLowerCase();
    return lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://');
  }
}

/**
 * ColorPicker Component
 * A robust color picker that allows selection from presets or custom hex input.
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

export default function ManagementEmailDesign() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  // State for Draft Changes
  const [draft, setDraft] = useState<Partial<MasterEmailDesign>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState("brand");

  const { data: masterDesign, isLoading, error } = useQuery({
    queryKey: ["/api/master-email-design"],
    queryFn: async () => {
      const response = await fetch('/api/master-email-design', {
        credentials: 'include',
      });
      if (!response.ok) {
        const err = new Error(
          response.status === 403 ? '403: Insufficient permissions' : 'Failed to fetch email design'
        );
        (err as any).status = response.status;
        throw err;
      }
      return response.json();
    },
  });

  // Initialize draft when data loads
  useEffect(() => {
    if (masterDesign && !hasChanges) {
      setDraft(masterDesign);
    }
  }, [masterDesign, hasChanges]);

  const updateField = (field: keyof MasterEmailDesign | string, value: any) => {
    setHasChanges(true);
    setDraft((prev) => {
      const newDraft = { ...prev };

      // Handle nested social links
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
    mutationFn: async (designData: Partial<MasterEmailDesign>) => {
      const response = await fetch('/api/master-email-design', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(designData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update email design');
      }
      return response.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(["/api/master-email-design"], data);
      setDraft(data);
      setHasChanges(false);
      toast({
        title: t('management.emailDesign.toasts.updated') || "Design saved successfully",
        description: "Your master email template has been updated."
      });
    },
    onError: (e: any) => toast({
      title: t('management.emailDesign.toasts.error') || "Error",
      description: e?.message || t('management.emailDesign.toasts.updateError'),
      variant: "destructive"
    }),
  });

  const handleSave = () => {
    updateMutation.mutate({
      ...draft,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleReset = () => {
    if (masterDesign) {
      setDraft(masterDesign);
      setHasChanges(false);
      toast({
        title: "Changes discarded",
        description: "Reverted to the last saved version.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Mail className="w-10 h-10 animate-bounce text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading design studio...</p>
      </div>
    );
  }

  const is403 = error instanceof Error && (error.message?.startsWith('403:') || (error as any).status === 403);
  if (is403) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <ShieldAlert className="h-8 w-8 text-orange-500" />
            <p className="font-medium text-sm">{t('common.permissionDenied', 'Permission Denied')}</p>
            <p className="text-xs text-muted-foreground max-w-xs">{t('common.permissionDeniedDescription', 'You do not have permission to view this section. Contact your administrator to request access.')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Palette className="w-6 h-6 text-primary" />
            {t('management.emailDesign.title')}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t('management.emailDesign.subtitle') || "Customize the look and feel of all your automated emails."}
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
            {t('management.emailDesign.cancel') || "Reset"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            {updateMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                {t('management.emailDesign.saving') || "Saving..."}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                {t('management.emailDesign.saveChanges') || "Save Changes"}
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

                {/* 1. Brand Identity */}
                <AccordionItem value="brand" className="border rounded-lg bg-card px-4 shadow-sm">
                  <AccordionTrigger onClick={() => setActiveTab("brand")} className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md text-blue-600 dark:text-blue-400">
                        <Layout className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-base">{t('management.emailDesign.brandInfo.title') || "Brand Identity"}</h3>
                        <p className="text-sm text-muted-foreground font-normal">Logo and company details</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6 space-y-5">
                    <div className="space-y-2.5">
                      <Label htmlFor="companyName">{t('management.emailDesign.brandInfo.companyName')}</Label>
                      <Input
                        id="companyName"
                        value={draft.companyName || ""}
                        onChange={(e) => updateField("companyName", e.target.value)}
                        placeholder="e.g. Acme Corp"
                      />
                      <div className="flex items-center justify-between pt-1">
                        <Label htmlFor="showCompanyName" className="text-sm font-normal text-muted-foreground cursor-pointer">
                          Show company name in email header
                        </Label>
                        <Switch
                          id="showCompanyName"
                          checked={(draft.showCompanyName ?? 'true') === 'true'}
                          onCheckedChange={(checked) => updateField("showCompanyName", checked ? 'true' : 'false')}
                        />
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="logoUrl">{t('management.emailDesign.brandInfo.logoUrl')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="logoUrl"
                          value={draft.logoUrl || ""}
                          onChange={(e) => updateField("logoUrl", e.target.value)}
                          placeholder="https://..."
                        />
                        {draft.logoUrl && (
                          <div className="w-10 h-10 rounded border bg-white p-1 flex items-center justify-center shrink-0">
                            <img src={draft.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Recommended height: 48px</p>
                      <div className="space-y-2 pt-1">
                        <Label>Logo Size</Label>
                        <div className="flex gap-2">
                          {([
                            { value: 'small', label: 'Small', px: '64px' },
                            { value: 'medium', label: 'Medium', px: '96px' },
                            { value: 'large', label: 'Large', px: '128px' },
                            { value: 'xlarge', label: 'X-Large', px: '160px' },
                          ] as const).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateField("logoSize", opt.value)}
                              className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                                (draft.logoSize || 'medium') === opt.value
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
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 2. Color Scheme */}
                <AccordionItem value="colors" className="border rounded-lg bg-card px-4 shadow-sm">
                  <AccordionTrigger onClick={() => setActiveTab("colors")} className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-md text-purple-600 dark:text-purple-400">
                        <Palette className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-base">{t('management.emailDesign.colorScheme.title') || "Color Scheme"}</h3>
                        <p className="text-sm text-muted-foreground font-normal">Primary, secondary & accent colors</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6 space-y-6">
                    <ColorPicker
                      label={t('management.emailDesign.colorScheme.primaryColor') || "Primary Color"}
                      color={draft.primaryColor || "#000000"}
                      onChange={(c) => updateField("primaryColor", c)}
                    />
                    <Separator />
                    <ColorPicker
                      label={t('management.emailDesign.colorScheme.secondaryColor') || "Secondary Color"}
                      color={draft.secondaryColor || "#000000"}
                      onChange={(c) => updateField("secondaryColor", c)}
                    />
                    <Separator />
                    <ColorPicker
                      label={t('management.emailDesign.colorScheme.accentColor') || "Accent Color"}
                      color={draft.accentColor || "#000000"}
                      onChange={(c) => updateField("accentColor", c)}
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* 3. Typography */}
                <AccordionItem value="typography" className="border rounded-lg bg-card px-4 shadow-sm">
                  <AccordionTrigger onClick={() => setActiveTab("typography")} className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-md text-green-600 dark:text-green-400">
                        <Type className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-base">{t('management.emailDesign.brandInfo.fontFamily') || "Typography"}</h3>
                        <p className="text-sm text-muted-foreground font-normal">Font styles for your emails</p>
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
                        Web-safe fonts ensure your emails look consistent across all email clients (Gmail, Outlook, Apple Mail).
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 4. Content */}
                <AccordionItem value="content" className="border rounded-lg bg-card px-4 shadow-sm">
                  <AccordionTrigger onClick={() => setActiveTab("content")} className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-md text-orange-600 dark:text-orange-400">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-base">{t('management.emailDesign.emailContent.title') || "Email Content"}</h3>
                        <p className="text-sm text-muted-foreground font-normal">Header & footer customization</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6 space-y-5">
                    <div className="space-y-2.5">
                      <Label htmlFor="headerText">{t('management.emailDesign.emailContent.headerText')}</Label>
                      <Input
                        id="headerText"
                        value={draft.headerText || ""}
                        onChange={(e) => updateField("headerText", e.target.value)}
                        placeholder="e.g. Weekly Newsletter"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="footerText">{t('management.emailDesign.emailContent.footerText')}</Label>
                      <Textarea
                        id="footerText"
                        value={draft.footerText || ""}
                        onChange={(e) => updateField("footerText", e.target.value)}
                        placeholder="e.g. Copyright © 2025"
                        rows={4}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 5. Social Links */}
                <AccordionItem value="social" className="border rounded-lg bg-card px-4 shadow-sm">
                  <AccordionTrigger onClick={() => setActiveTab("social")} className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-sky-50 dark:bg-sky-900/20 rounded-md text-sky-600 dark:text-sky-400">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-base">{t('management.emailDesign.socialMedia.title') || "Social Links"}</h3>
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
              <div className="flex items-center gap-2 pl-2">
                <span className="text-sm font-medium text-muted-foreground">Preview Mode:</span>
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

              <Badge variant="outline" className="text-xs font-normal">
                Live Changes
              </Badge>
            </div>

            {/* Email Canvas Background */}
            <div className={`transition-all duration-500 ease-in-out mx-auto p-4 sm:p-8 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl overflow-y-auto max-h-[calc(100vh-12rem)] ${previewDevice === "mobile" ? "max-w-[400px]" : "w-full"
              }`}>

              {/* Actual Email Container */}
              <div className="bg-white text-slate-900 shadow-2xl mx-auto rounded overflow-hidden max-w-[600px] w-full">
                {/* Simulated Email Header (Subject Line Context) */}
                <div className="border-b bg-gray-50 p-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex gap-2 mb-1">
                    <span className="font-semibold text-right w-14">To:</span>
                    <span className="text-gray-900">customer@example.com</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-right w-14">Subject:</span>
                    <span className="text-gray-900 font-bold">Welcome to the future of {draft.companyName || "Service"}!</span>
                  </div>
                </div>

                {/* Email Body */}
                <div className="min-h-[500px] flex flex-col" style={{ fontFamily: draft.fontFamily }}>

                  {/* HERO HEADER */}
                  <div
                    className="p-8 text-center"
                    style={{ backgroundColor: draft.primaryColor, color: "#ffffff" }}
                  >
                    {draft.logoUrl ? (
                      <img
                        src={draft.logoUrl}
                        alt="Logo"
                        className="mx-auto mb-4 object-contain"
                        style={{ height: ({ small: '64px', medium: '96px', large: '128px', xlarge: '160px' } as Record<string, string>)[draft.logoSize || 'medium'] || '96px' }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <div className="h-12 w-12 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <span className="text-xl font-bold opacity-80">{draft.companyName?.charAt(0) || "C"}</span>
                      </div>
                    )}
                    {(draft.showCompanyName ?? 'true') === 'true' && (
                      <h1 className="text-2xl font-bold mb-2 tracking-tight">
                        {draft.companyName || "Your Company"}
                      </h1>
                    )}
                    {draft.headerText && (
                      <p className="text-base opacity-95 max-w-sm mx-auto leading-normal">
                        {draft.headerText}
                      </p>
                    )}
                  </div>

                  {/* BODY CONTENT */}
                  <div className="p-8 flex-1">
                    <div className="space-y-5">
                      <h2 className="text-xl font-bold text-slate-900">Hello there,</h2>
                      <p className="text-slate-600 leading-relaxed text-base">
                        This is how your emails will look to your customers. We've updated our look to match your brand identity perfectly.
                      </p>

                      <div
                        className="p-5 rounded-lg my-6 border border-transparent"
                        style={{ backgroundColor: `${draft.secondaryColor}15`, borderLeft: `4px solid ${draft.secondaryColor}` }}
                      >
                        <h3 className="font-bold text-base mb-1" style={{ color: draft.secondaryColor }}>
                          Important Update
                        </h3>
                        <p className="text-sm text-slate-600">
                          Your appointment has been confirmed for <strong>Tomorrow at 3:00 PM</strong>. We look forward to seeing you!
                        </p>
                      </div>

                      <p className="text-slate-600 leading-relaxed text-base">
                        If you have any questions, feel free to reply to this email or click the button below to manage your booking.
                      </p>
                    </div>

                    <div className="pt-8 pb-4 text-center">
                      <button
                        className="px-6 py-3 rounded font-bold text-white shadow-md hover:shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                        style={{ backgroundColor: draft.accentColor }}
                      >
                        View Appointment Details
                      </button>
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="bg-slate-100 p-8 text-center border-t border-slate-200 mt-auto">
                    <div className="flex justify-center gap-6 mb-6">
                      {isSafeUrl(draft.socialLinks?.facebook) && (
                        <a href={draft.socialLinks!.facebook} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600 transition-colors">Facebook</a>
                      )}
                      {isSafeUrl(draft.socialLinks?.twitter) && (
                        <a href={draft.socialLinks!.twitter} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500 transition-colors">Twitter</a>
                      )}
                      {isSafeUrl(draft.socialLinks?.instagram) && (
                        <a href={draft.socialLinks!.instagram} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-pink-600 transition-colors">Instagram</a>
                      )}
                      {isSafeUrl(draft.socialLinks?.linkedin) && (
                        <a href={draft.socialLinks!.linkedin} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-700 transition-colors">LinkedIn</a>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 space-y-2 max-w-xs mx-auto">
                      <p>{draft.footerText || "© 2025 All rights reserved."}</p>
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
          </div>
        </div>
      </div>
    </div>
  );
}
