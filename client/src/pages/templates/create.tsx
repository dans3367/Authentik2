import { useState, useRef, useMemo } from "react";
import { SINGLE_PURPOSE_PRESETS, type SinglePurposePreset } from "@/config/templatePresets";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, LayoutDashboard, Eye, X, Monitor, Smartphone, Tag, User, Mail, Phone, MapPin, Clock, CreditCard, Sparkles, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/LazyRichTextEditor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const channelOptions = [
  { value: "individual", label: "Individual Email", description: "Send one-to-one emails quickly" },
  { value: "promotional", label: "Promotional", description: "Campaign blasts and seasonal offers" },
  { value: "newsletter", label: "Newsletter", description: "Recurring newsletter layouts" },
  { value: "transactional", label: "Transactional", description: "Receipts, confirmations, and notifications" },
  { value: "single-purpose", label: "Single Purpose", description: "One-off templates for specific occasions" },
];

const getChannelOptions = (t: any) => [
  { value: "individual", label: t('templatesPage.channels.individual'), description: t('templatesPage.channels.individualDesc') },
  { value: "promotional", label: t('templatesPage.channels.promotional'), description: t('templatesPage.channels.promotionalDesc') },
  { value: "newsletter", label: t('templatesPage.channels.newsletter'), description: t('templatesPage.channels.newsletterDesc') },
  { value: "transactional", label: t('templatesPage.channels.transactional'), description: t('templatesPage.channels.transactionalDesc') },
  { value: "single-purpose", label: t('templatesPage.channels.singlePurpose', 'Single Purpose'), description: t('templatesPage.channels.singlePurposeDesc', 'One-off templates for specific occasions') },
];

const categoryOptions = [
  { value: "welcome", label: "Welcome & Onboarding" },
  { value: "retention", label: "Retention & Engagement" },
  { value: "seasonal", label: "Seasonal & Events" },
  { value: "update", label: "Product Updates" },
  { value: "custom", label: "Custom" },
];

const getCategoryOptions = (t: any) => [
  { value: "welcome", label: t('templatesPage.categories.welcome') },
  { value: "retention", label: t('templatesPage.categories.retention') },
  { value: "seasonal", label: t('templatesPage.categories.seasonal') },
  { value: "update", label: t('templatesPage.categories.update') },
  { value: "custom", label: t('templatesPage.categories.custom') },
];


type TemplateChannel = (typeof channelOptions)[number]["value"];
type TemplateCategory = (typeof categoryOptions)[number]["value"];

interface CreateTemplatePayload {
  name: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  subjectLine: string;
  body: string;
  tags: string[];
}

function hasContent(html: string): boolean {
  const text = html.replace(/<[^>]*>/g, '').trim();
  return text.length > 0;
}

function appendIntoLastBlock(prev: string, token: string): string {
  // Regex matches closing block tags: p, div, h1-h6, li, blockquote, pre
  const closingBlockRegex = /<\/(p|div|h[1-6]|li|blockquote|pre)>\s*$/i;
  const match = prev.match(closingBlockRegex);

  if (match && match.index !== undefined) {
    // Insert token before the closing tag to stay inside the block
    return prev.slice(0, match.index) + token + prev.slice(match.index);
  }

  // Fallback: if no closing block found, wrap in a new paragraph
  // This ensures valid HTML structure even if the previous content was empty or malformed
  return prev ? (prev + `<p>${token}</p>`) : `<p>${token}</p>`;
}

const TEMPLATE_VARIABLES = [
  { key: 'first_name', icon: User, labelKey: 'ecards.editor.firstName' },
  { key: 'last_name', icon: User, labelKey: 'ecards.editor.lastName' },
  { key: 'email', icon: Mail, labelKey: 'ecards.editor.emailVar' },
  { key: 'phone', icon: Phone, labelKey: 'ecards.editor.phone' },
  { key: 'address', icon: MapPin, labelKey: 'ecards.editor.address' },
  { key: 'office_hours', icon: Clock, labelKey: 'ecards.editor.officeHours' },
] as const;

const CONTACT_CARD_TEMPLATE = `<p><strong>{{company_name}}</strong></p><p>\u2709 {{email}}</p><p>\u260E {{phone}}</p><p>\u{1F4CD} {{address}}</p>`;

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
      const [h, m] = t.split(':').map(Number);
      const suffix = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
    };

    // Group consecutive days with the same hours
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

export default function CreateTemplatePage() {
  const { t } = useTranslation();

  useSetBreadcrumbs([
    { label: t('navigation.dashboard'), href: "/", icon: LayoutDashboard },
    { label: t('templatesPage.title'), href: "/templates", icon: Copy },
    { label: t('templatesPage.createTemplatePage.title') }
  ]);

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get localized options
  const localizedChannelOptions = getChannelOptions(t);
  const localizedCategoryOptions = getCategoryOptions(t);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<TemplateChannel>("individual");
  const [category, setCategory] = useState<TemplateCategory>("welcome");
  const [subjectLine, setSubjectLine] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const editorRef = useRef<any>(null);

  const handleSelectPreset = (preset: SinglePurposePreset) => {
    setSelectedPreset(preset.id);
    setName(preset.label);
    setCategory(preset.category);
    setSubjectLine(preset.subjectLine);
    setContent(preset.body);
    setTags(preset.tags);
    setTagInput("");
  };

  const handleChannelChange = (value: TemplateChannel) => {
    setChannel(value);
    if (value !== "single-purpose") {
      setSelectedPreset(null);
    }
  };

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

  const { data: companyData } = useQuery({
    queryKey: ["/api/company"],
    queryFn: async () => {
      const response = await fetch('/api/company', {
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
  });

  const { data: shopsData } = useQuery({
    queryKey: ["/api/shops", "preview"],
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !subjectLine.trim() || !hasContent(content)) {
      toast({
        title: t('templatesPage.createTemplatePage.validation.error'),
        description: t('templatesPage.createTemplatePage.validation.fillRequired'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await createTemplate({
        name: name.trim(),
        channel,
        category,
        subjectLine: subjectLine.trim(),
        body: content.trim(),
        tags,
      });

      toast({
        title: t('templatesPage.createTemplatePage.toasts.templateCreated'),
        description: t('templatesPage.createTemplatePage.toasts.templateCreatedDesc', { name }),
      });

      setLocation('/templates');
    } catch (error) {
      toast({
        title: t('templatesPage.createTemplatePage.toasts.error'),
        description: t('templatesPage.createTemplatePage.toasts.createError'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('templatesPage.createTemplatePage.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('templatesPage.createTemplatePage.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('templatesPage.createTemplatePage.templateDetails')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="template-name">{t('templatesPage.createTemplatePage.templateName')}</Label>
                <Input
                  id="template-name"
                  placeholder={t('templatesPage.createTemplatePage.templateNamePlaceholder')}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="template-channel">{t('templatesPage.createTemplatePage.channel')}</Label>
                <Select value={channel} onValueChange={(value: TemplateChannel) => handleChannelChange(value)}>
                  <SelectTrigger id="template-channel">
                    <SelectValue placeholder={t('templatesPage.createTemplatePage.selectChannel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {localizedChannelOptions.map((option) => (
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
                <Label htmlFor="template-category">{t('templatesPage.createTemplatePage.category')}</Label>
                <Select value={category} onValueChange={(value: TemplateCategory) => setCategory(value)}>
                  <SelectTrigger id="template-category">
                    <SelectValue placeholder={t('templatesPage.createTemplatePage.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {localizedCategoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="template-subject">{t('templatesPage.createTemplatePage.subjectLine')}</Label>
                <Input
                  id="template-subject"
                  placeholder={t('templatesPage.createTemplatePage.subjectLinePlaceholder')}
                  value={subjectLine}
                  onChange={(event) => setSubjectLine(event.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="template-content">{t('templatesPage.createTemplatePage.content')}</Label>

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
                            setContent((prev) => appendIntoLastBlock(prev, `{{${v.key}}}`));
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
                  placeholder={t('templatesPage.createTemplatePage.contentPlaceholder')}
                  className="min-h-[300px]"
                  onEditorReady={(editor) => { editorRef.current = editor; }}
                />
                <p className="text-xs text-muted-foreground">
                  {t('templatesPage.createTemplatePage.contentHelp')}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="template-tags">{t('templatesPage.createTemplatePage.tags')}</Label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-background">
                    {tags.length === 0 && (
                      <span className="text-sm text-muted-foreground">{t('templatesPage.createTemplatePage.noTagsAdded')}</span>
                    )}
                    {tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => setTags(tags.filter((_, i) => i !== index))}
                          className="ml-1 rounded-full hover:bg-muted p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="template-tags"
                      placeholder={t('templatesPage.createTemplatePage.addTagPlaceholder')}
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          const newTag = tagInput.trim();
                          if (newTag && !tags.includes(newTag)) {
                            setTags([...tags, newTag]);
                            setTagInput("");
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const newTag = tagInput.trim();
                        if (newTag && !tags.includes(newTag)) {
                          setTags([...tags, newTag]);
                          setTagInput("");
                        }
                      }}
                      disabled={!tagInput.trim()}
                    >
                      {t('common.add')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('templatesPage.createTemplatePage.addTagHelp')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation('/templates')}
                disabled={isSubmitting}
              >
                {t('templatesPage.createTemplatePage.cancel')}
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('templatesPage.createTemplatePage.creating') : t('templatesPage.createTemplatePage.createTemplate')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {t('templatesPage.createTemplatePage.preview')} — {name || t('templatesPage.createTemplatePage.templateNamePlaceholder')}
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
                <div
                  className="p-8 text-center"
                  style={{ backgroundColor: masterDesign?.primaryColor || "#3B82F6", color: "#ffffff" }}
                >
                  {masterDesign?.logoUrl ? (
                    <img
                      src={masterDesign.logoUrl}
                      alt="Logo"
                      className="h-12 mx-auto mb-4 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="h-12 w-12 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-xl font-bold opacity-80">{masterDesign?.companyName?.charAt(0) || "C"}</span>
                    </div>
                  )}
                  <h1 className="text-2xl font-bold mb-2 tracking-tight">
                    {masterDesign?.companyName || "Your Company"}
                  </h1>
                  {masterDesign?.headerText && (
                    <p className="text-base opacity-95 max-w-sm mx-auto leading-normal">
                      {masterDesign.headerText}
                    </p>
                  )}
                </div>

                {/* Template body content */}
                <div className="p-8 flex-1">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: replaceVariables(content) || "<p style='color:#94a3b8;'>Your template content will appear here...</p>" }}
                  />
                </div>

                {/* Footer from email design */}
                <div className="bg-slate-100 p-8 text-center border-t border-slate-200">
                  {(masterDesign?.socialLinks?.facebook || masterDesign?.socialLinks?.twitter || masterDesign?.socialLinks?.instagram || masterDesign?.socialLinks?.linkedin) && (
                    <div className="flex justify-center gap-6 mb-6">
                      {masterDesign?.socialLinks?.facebook && (
                        <span className="text-slate-400 text-sm">Facebook</span>
                      )}
                      {masterDesign?.socialLinks?.twitter && (
                        <span className="text-slate-400 text-sm">Twitter</span>
                      )}
                      {masterDesign?.socialLinks?.instagram && (
                        <span className="text-slate-400 text-sm">Instagram</span>
                      )}
                      {masterDesign?.socialLinks?.linkedin && (
                        <span className="text-slate-400 text-sm">LinkedIn</span>
                      )}
                    </div>
                  )}
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
  );
}
