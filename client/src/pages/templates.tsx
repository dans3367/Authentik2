import { useMemo, useState, useEffect } from "react";
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
  onEdit: (template: Template) => void;
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

function TemplateCard({ template, onToggleFavorite, onDuplicate, onDelete, onUse, onEdit }: TemplateCardProps) {
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
                <DropdownMenuItem onClick={() => onEdit(template)}>Edit</DropdownMenuItem>
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
            {template.preview || 'No preview available'}
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

interface EditTemplateDialogProps {
  template: Template | null;
  onSave: (id: string, payload: CreateTemplatePayload) => void;
  onCancel: () => void;
}

function EditTemplateDialog({ template, onSave, onCancel }: EditTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<TemplateChannel>("individual");
  const [category, setCategory] = useState<TemplateCategory>("welcome");
  const [subjectLine, setSubjectLine] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");

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
    }
  }, [template]);

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
      content: content.trim(),
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
            <DialogTitle>Edit template</DialogTitle>
            <DialogDescription>
              Update your template content, channel, or category.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-template-name">Template name</Label>
              <Input
                id="edit-template-name"
                placeholder="e.g. New customer welcome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-template-channel">Channel</Label>
              <Select value={channel} onValueChange={(value: TemplateChannel) => setChannel(value)}>
                <SelectTrigger id="edit-template-channel">
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
              <Label htmlFor="edit-template-category">Category</Label>
              <Select value={category} onValueChange={(value: TemplateCategory) => setCategory(value)}>
                <SelectTrigger id="edit-template-category">
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
              <Label htmlFor="edit-template-subject">Subject line</Label>
              <Input
                id="edit-template-subject"
                placeholder="e.g. Welcome to {{company_name}}"
                value={subjectLine}
                onChange={(event) => setSubjectLine(event.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-template-content">Content</Label>
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
              <Label htmlFor="edit-template-tags">Tags</Label>
              <Input
                id="edit-template-tags"
                placeholder="Comma separated e.g. onboarding, v1"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 justify-end">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pagination, setPagination] = useState<TemplatePagination>({ page: 1, limit: 50, total: 0, pages: 0 });
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | TemplateChannel>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | TemplateCategory>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load templates and stats on component mount and when filters change
  const loadTemplates = async () => {
    try {
      setLoading(true);
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
        title: "Error",
        description: "Failed to load templates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  // Load data on mount
  useEffect(() => {
    loadTemplates();
    loadStats();
  }, []);

  // Reload templates when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadTemplates();
    }, 300); // Debounce search
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm, channelFilter, categoryFilter, favoritesOnly, pagination.page]);

  // Filtered templates for display (now handled server-side)
  const filteredTemplates = templates;

  const handleCreateTemplate = async (payload: CreateTemplatePayload) => {
    try {
      const result = await createTemplate({
        name: payload.name,
        channel: payload.channel,
        category: payload.category,
        subjectLine: payload.subjectLine,
        preview: payload.content.slice(0, 160),
        body: payload.content,
        tags: payload.tags,
        isFavorite: false,
      });
      
      await loadTemplates();
      await loadStats();
      
      toast({
        title: "Template created",
        description: `${payload.name} is ready to use across your campaigns.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      await toggleTemplateFavorite(id);
      await loadTemplates();
      await loadStats();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle favorite status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUseTemplate = async (template: Template) => {
    try {
      await useTemplate(template.id);
      await loadTemplates(); // Refresh to show updated usage count
      toast({
        title: "Template applied",
        description: `We copied "${template.name}" so you can personalise it for your next send.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to use template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const template = templates.find((item) => item.id === id);
    if (!template) return;

    const confirmed = window.confirm(
      `Delete "${template.name}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteTemplate(id);
      await loadTemplates();
      await loadStats();
      toast({
        title: "Template deleted",
        description: `${template.name} has been removed.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDuplicateTemplate = async (template: Template) => {
    try {
      await duplicateTemplate(template.id, `${template.name} copy`);
      await loadTemplates();
      await loadStats();
      toast({
        title: "Template duplicated",
        description: `${template.name} copy is ready to edit.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to duplicate template. Please try again.",
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
        preview: payload.content.slice(0, 160),
        body: payload.content,
        tags: payload.tags,
      });
      
      await loadTemplates();
      await loadStats();
      
      toast({
        title: "Template updated",
        description: `${payload.name} has been saved.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update template. Please try again.",
        variant: "destructive",
      });
    }
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
              <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
                {stats ? stats.totalTemplates : '...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats ? `${stats.favoriteTemplates} favourited for quick access` : 'Loading...'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 space-y-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Individual</p>
              <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
                {stats ? stats.individualTemplates : '...'}
              </p>
              <p className="text-xs text-muted-foreground">Templates ready for this channel</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 space-y-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Promotional</p>
              <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
                {stats ? stats.promotionalTemplates : '...'}
              </p>
              <p className="text-xs text-muted-foreground">Templates ready for this channel</p>
            </CardContent>
          </Card>
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
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-muted-foreground">Loading templates...</p>
                </div>
              </div>
            ) : error ? (
              <Card className="border-dashed border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
                <CardContent className="py-12 text-center space-y-3">
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">Error loading templates</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                  <Button variant="outline" onClick={() => loadTemplates()}>
                    Try again
                  </Button>
                </CardContent>
              </Card>
            ) : filteredTemplates.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No templates found</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchTerm || channelFilter !== 'all' || categoryFilter !== 'all' || favoritesOnly
                      ? 'Try adjusting your search terms or filters.'
                      : 'Get started by creating your first email template.'}
                  </p>
                  <div className="space-x-2">
                    {(searchTerm || channelFilter !== 'all' || categoryFilter !== 'all' || favoritesOnly) && (
                      <Button variant="outline" onClick={() => {
                        setSearchTerm("");
                        setChannelFilter("all");
                        setCategoryFilter("all");
                        setFavoritesOnly(false);
                      }}>
                        Reset filters
                      </Button>
                    )}
                  </div>
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
                    onEdit={handleEditTemplate}
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
