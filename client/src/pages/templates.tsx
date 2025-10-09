import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
  Copy,
  Eye,
  Filter,
  MoreVertical,
  Plus,
  Search,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";

const channelOptions = [
  { value: "individual", label: "Individual Email", description: "Send one-to-one emails quickly" },
  { value: "promotional", label: "Promotional", description: "Campaign blasts and seasonal offers" },
  { value: "newsletter", label: "Newsletter", description: "Recurring newsletter layouts" },
  { value: "transactional", label: "Transactional", description: "Receipts, confirmations, and notifications" },
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

interface Template {
  id: string;
  name: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  subjectLine: string;
  preview: string;
  body: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  lastUsed?: string | null;
  isFavorite: boolean;
  tags: string[];
}

const initialTemplates: Template[] = [
  {
    id: "tmpl-individual-welcome",
    name: "Personal Welcome",
    channel: "individual",
    category: "welcome",
    subjectLine: "Welcome aboard, {{first_name}}!",
    preview: "Hi {{first_name}}, it was great connecting with you today. Here's a quick recap of what we discussed and the next steps...",
    body: `Hi {{first_name}},\n\nIt was great connecting with you today. This email includes a quick recap of what we covered and some helpful links to get started.\n\n• Account portal: {{account_portal_url}}\n• Next steps: {{next_steps}}\n\nLet me know if you need anything else!\n\nBest,\n{{sender_name}}`,
    usageCount: 42,
    createdAt: "2025-07-10T09:24:00.000Z",
    updatedAt: "2025-07-28T15:02:00.000Z",
    lastUsed: "2025-07-28T09:12:00.000Z",
    isFavorite: true,
    tags: ["follow-up", "sales"],
  },
  {
    id: "tmpl-promo-summer",
    name: "Summer Campaign Blast",
    channel: "promotional",
    category: "seasonal",
    subjectLine: "☀️ Summer deals inside: save up to 40%",
    preview: "Kick off the season with a curated collection of limited-time offers. Free shipping included on orders over $50...",
    body: `<h1>Summer Savings Are Here!</h1><p>Kick off the season with a curated collection of limited-time offers.</p><ul><li>25% off new arrivals</li><li>Free shipping on orders over $50</li><li>Bonus gift on purchases above $100</li></ul><p>Shop before {{sale_end_date}} to secure your favorites.</p>`,
    usageCount: 18,
    createdAt: "2025-06-01T16:45:00.000Z",
    updatedAt: "2025-07-15T11:10:00.000Z",
    lastUsed: "2025-07-20T14:30:00.000Z",
    isFavorite: false,
    tags: ["seasonal", "discount"],
  },
  {
    id: "tmpl-newsletter-monthly",
    name: "Monthly Product Digest",
    channel: "newsletter",
    category: "update",
    subjectLine: "{{month}} highlights: new releases and tips",
    preview: "A look back at what we shipped this month, along with best practices to help your team get the most out of our platform...",
    body: `{{month}} Highlights\n\n• Feature spotlight: {{feature_name}}\n• Customer story: {{customer_name}}\n• Pro tip: {{pro_tip}}\n\nHave feedback? Reply directly — we read every message.`,
    usageCount: 9,
    createdAt: "2025-04-05T08:12:00.000Z",
    updatedAt: "2025-07-01T10:40:00.000Z",
    lastUsed: "2025-07-01T10:40:00.000Z",
    isFavorite: false,
    tags: ["product", "monthly"],
  },
  {
    id: "tmpl-transactional-order",
    name: "Order Confirmation",
    channel: "transactional",
    category: "retention",
    subjectLine: "Order #{{order_number}} confirmed",
    preview: "Thanks for shopping with us! We received your order and it's already being prepared. Track progress in your customer portal...",
    body: `Hi {{first_name}},\n\nThank you for your order! We're preparing your items and will let you know once they ship.\n\nOrder summary:\n• Order number: {{order_number}}\n• Estimated arrival: {{delivery_date}}\n\nTrack your order anytime at {{tracking_url}}.`,
    usageCount: 312,
    createdAt: "2025-02-18T13:08:00.000Z",
    updatedAt: "2025-06-22T20:18:00.000Z",
    isFavorite: true,
    tags: ["confirmation", "orders"],
  },
];

function hasContent(html: string): boolean {
  // Remove HTML tags and check if there's actual text content
  const text = html.replace(/<[^>]*>/g, '').trim();
  return text.length > 0;
}

interface CreateTemplatePayload {
  name: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  subjectLine: string;
  content: string;
  tags: string[];
}

interface TemplateCardProps {
  template: Template;
  onToggleFavorite: (id: string) => void;
  onDuplicate: (template: Template) => void;
  onDelete: (id: string) => void;
  onUse: (template: Template) => void;
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
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300";
  }
}

function TemplateCard({ template, onToggleFavorite, onDuplicate, onDelete, onUse }: TemplateCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <Card className="h-full flex flex-col">
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
              <span>Used {template.usageCount}×</span>
              {template.lastUsed && (
                <span>Last sent {new Date(template.lastUsed).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => onToggleFavorite(template.id)}
            >
              {template.isFavorite ? (
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              ) : (
                <StarOff className="h-5 w-5 text-gray-400" />
              )}
              <span className="sr-only">Toggle favorite</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Template actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setPreviewOpen(true)}>Preview</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(template)}>Duplicate</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => onDelete(template.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Subject line</p>
          <p className="text-sm font-mono bg-gray-50 dark:bg-gray-800 rounded-md px-3 py-2 text-gray-800 dark:text-gray-100 break-words">
            {template.subjectLine}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Preview</p>
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
            {template.preview}
          </p>
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
                Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>{template.name}</DialogTitle>
                <DialogDescription>
                  Subject: {template.subjectLine}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm whitespace-pre-wrap">
                {template.body}
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onUse(template)}
          >
            <Copy className="mr-2 h-4 w-4" />
            Use template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface CreateTemplateDialogProps {
  onCreate: (payload: CreateTemplatePayload) => void;
}

function CreateTemplateDialog({ onCreate }: CreateTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<TemplateChannel>("individual");
  const [category, setCategory] = useState<TemplateCategory>("welcome");
  const [subjectLine, setSubjectLine] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");

  const resetForm = () => {
    setName("");
    setChannel("individual");
    setCategory("welcome");
    setSubjectLine("");
    setContent("");
    setTagInput("");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !subjectLine.trim() || !hasContent(content)) {
      return;
    }

    const tags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    onCreate({
      name: name.trim(),
      channel,
      category,
      subjectLine: subjectLine.trim(),
      content: content.trim(),
      tags,
    });

    resetForm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Create template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6 pb-2">
          <DialogHeader>
            <DialogTitle>Create template</DialogTitle>
            <DialogDescription>
              Build a reusable template for individual outreach, promotional campaigns, or transactional emails.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="template-name">Template name</Label>
              <Input
                id="template-name"
                placeholder="e.g. New customer welcome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-channel">Channel</Label>
              <Select value={channel} onValueChange={(value: TemplateChannel) => setChannel(value)}>
                <SelectTrigger id="template-channel">
                  <SelectValue placeholder="Select channel" />
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

            <div className="grid gap-2">
              <Label htmlFor="template-category">Category</Label>
              <Select value={category} onValueChange={(value: TemplateCategory) => setCategory(value)}>
                <SelectTrigger id="template-category">
                  <SelectValue placeholder="Select category" />
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
              <Label htmlFor="template-subject">Subject line</Label>
              <Input
                id="template-subject"
                placeholder="e.g. Welcome to {{company_name}}"
                value={subjectLine}
                onChange={(event) => setSubjectLine(event.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-content">Content</Label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Write your email content or paste HTML"
                className="min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                {"Use liquid-style variables such as {{first_name}} or {{order_number}} to personalise your message."}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-tags">Tags</Label>
              <Input
                id="template-tags"
                placeholder="Comma separated e.g. onboarding, v1"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save template</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | TemplateChannel>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | TemplateCategory>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { toast } = useToast();

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.subjectLine.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesChannel = channelFilter === "all" || template.channel === channelFilter;
      const matchesCategory = categoryFilter === "all" || template.category === categoryFilter;
      const matchesFavorites = !favoritesOnly || template.isFavorite;

      return matchesSearch && matchesChannel && matchesCategory && matchesFavorites;
    });
  }, [templates, searchTerm, channelFilter, categoryFilter, favoritesOnly]);

  const stats = useMemo(() => {
    const total = templates.length;
    const favorites = templates.filter((template) => template.isFavorite).length;
    const byChannel = channelOptions.map((option) => ({
      channel: option.value,
      label: option.label,
      count: templates.filter((template) => template.channel === option.value).length,
    }));

    return { total, favorites, byChannel };
  }, [templates]);

  const handleCreateTemplate = (payload: CreateTemplatePayload) => {
    const now = new Date().toISOString();
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `tmpl-${Date.now()}`;

    const newTemplate: Template = {
      id,
      name: payload.name,
      channel: payload.channel,
      category: payload.category,
      subjectLine: payload.subjectLine,
      preview: payload.content.slice(0, 160),
      body: payload.content,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
      lastUsed: null,
      isFavorite: false,
      tags: payload.tags,
    };

    setTemplates((previous) => [newTemplate, ...previous]);
    toast({
      title: "Template created",
      description: `${payload.name} is ready to use across your campaigns.`,
    });
  };

  const handleToggleFavorite = (id: string) => {
    setTemplates((previous) =>
      previous.map((template) =>
        template.id === id ? { ...template, isFavorite: !template.isFavorite } : template
      )
    );
  };

  const handleUseTemplate = (template: Template) => {
    toast({
      title: "Template applied",
      description: `We copied "${template.name}" so you can personalise it for your next send.`,
    });
  };

  const handleDeleteTemplate = (id: string) => {
    const template = templates.find((item) => item.id === id);
    if (!template) return;

    const confirmed = window.confirm(
      `Delete "${template.name}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setTemplates((previous) => previous.filter((item) => item.id !== id));
    toast({
      title: "Template deleted",
      description: `${template.name} has been removed.`,
    });
  };

  const handleDuplicateTemplate = (template: Template) => {
    const now = new Date().toISOString();
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `tmpl-${Date.now()}-copy`;

    const duplicated: Template = {
      ...template,
      id,
      name: `${template.name} copy`,
      usageCount: 0,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      lastUsed: null,
    };

    setTemplates((previous) => [duplicated, ...previous]);
    toast({
      title: "Template duplicated",
      description: `${template.name} copy is ready to edit.`,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Templates</h1>
            <p className="text-gray-600 dark:text-gray-300">
              Create reusable content for one-to-one emails, promotional campaigns, newsletters, and system notifications.
            </p>
          </div>
          <CreateTemplateDialog onCreate={handleCreateTemplate} />
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 space-y-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total templates</p>
              <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50">{stats.total}</p>
              <p className="text-xs text-muted-foreground">
                {stats.favorites} favourited for quick access
              </p>
            </CardContent>
          </Card>
          {stats.byChannel.slice(0, 2).map((stat) => (
            <Card key={stat.channel}>
              <CardContent className="p-5 space-y-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.label}</p>
                <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50">{stat.count}</p>
                <p className="text-xs text-muted-foreground">Templates ready for this channel</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg shadow-sm">
          <div className="border-b border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, subject line, or tag"
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
                    <SelectItem value="all">All channels</SelectItem>
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
                    <SelectItem value="all">All categories</SelectItem>
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
                  Favorites
                </Button>
              </div>
            </div>
          </div>
          <div className="p-6">
            {filteredTemplates.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No templates match your filters</h3>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your search terms, channel, or category selections.
                  </p>
                  <Button variant="outline" onClick={() => {
                    setSearchTerm("");
                    setChannelFilter("all");
                    setCategoryFilter("all");
                    setFavoritesOnly(false);
                  }}>
                    Reset filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onToggleFavorite={handleToggleFavorite}
                    onDuplicate={handleDuplicateTemplate}
                    onDelete={handleDeleteTemplate}
                    onUse={handleUseTemplate}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
