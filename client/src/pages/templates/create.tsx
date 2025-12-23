import { useState } from "react";
import { useLocation } from "wouter";
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
import { Copy, LayoutDashboard, ArrowLeft, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
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
];

const categoryOptions = [
  { value: "welcome", label: "Welcome & Onboarding" },
  { value: "retention", label: "Retention & Engagement" },
  { value: "seasonal", label: "Seasonal & Events" },
  { value: "update", label: "Product Updates" },
  { value: "custom", label: "Custom" },
];

const themeOptions = [
  {
    value: "minimal",
    label: "Minimal",
    description: "Clean and simple design with plenty of white space",
    preview: "A minimalist layout with centered content and subtle borders",
  },
  {
    value: "modern",
    label: "Modern",
    description: "Bold typography with accent colors and modern spacing",
    preview: "Contemporary design with strong visual hierarchy",
  },
  {
    value: "classic",
    label: "Classic",
    description: "Traditional email layout with header, body, and footer",
    preview: "Timeless design that works across all email clients",
  },
  {
    value: "newsletter",
    label: "Newsletter",
    description: "Multi-column layout perfect for content-rich emails",
    preview: "Structured layout with sections and featured content areas",
  },
  {
    value: "promotional",
    label: "Promotional",
    description: "Eye-catching design with prominent CTA buttons",
    preview: "High-impact layout designed to drive conversions",
  },
];

type TemplateChannel = (typeof channelOptions)[number]["value"];
type TemplateCategory = (typeof categoryOptions)[number]["value"];
type TemplateTheme = (typeof themeOptions)[number]["value"];

interface CreateTemplatePayload {
  name: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  subjectLine: string;
  body: string;
  tags: string[];
  theme?: string;
}

function hasContent(html: string): boolean {
  const text = html.replace(/<[^>]*>/g, '').trim();
  return text.length > 0;
}

function getThemePreviewHTML(theme: string, content: string): string {
  const sampleContent = content || "<p>Your email content will appear here. This is a preview of how your message will look with the selected theme.</p>";
  
  switch (theme) {
    case "minimal":
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; background-color: #ffffff;">
            ${sampleContent}
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
            <p>© 2024 Your Company. All rights reserved.</p>
          </div>
        </div>
      `;
    
    case "modern":
      return `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Your Brand</h1>
          </div>
          <div style="padding: 40px 20px; background-color: #ffffff;">
            ${sampleContent}
          </div>
          <div style="background-color: #1f2937; padding: 30px 20px; text-align: center; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">© 2024 Your Company. All rights reserved.</p>
          </div>
        </div>
      `;
    
    case "classic":
      return `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background-color: #1e40af; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Your Company Name</h1>
          </div>
          <div style="padding: 40px 30px; line-height: 1.6; color: #374151;">
            ${sampleContent}
          </div>
          <div style="background-color: #f3f4f6; padding: 20px 30px; border-top: 3px solid #1e40af;">
            <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">© 2024 Your Company | All Rights Reserved</p>
          </div>
        </div>
      `;
    
    case "newsletter":
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background-color: #0ea5e9; padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: bold;">Newsletter</h1>
            <p style="color: #e0f2fe; margin: 5px 0 0 0; font-size: 14px;">Your monthly update</p>
          </div>
          <div style="padding: 30px 20px;">
            <div style="margin-bottom: 30px;">
              ${sampleContent}
            </div>
            <div style="display: table; width: 100%; margin-top: 30px;">
              <div style="display: table-cell; width: 48%; padding: 20px; background-color: #f0f9ff; border-radius: 8px; vertical-align: top;">
                <h3 style="margin: 0 0 10px 0; color: #0369a1; font-size: 16px;">Featured Section</h3>
                <p style="margin: 0; color: #475569; font-size: 14px;">Additional content area</p>
              </div>
              <div style="display: table-cell; width: 4%;"></div>
              <div style="display: table-cell; width: 48%; padding: 20px; background-color: #f0f9ff; border-radius: 8px; vertical-align: top;">
                <h3 style="margin: 0 0 10px 0; color: #0369a1; font-size: 16px;">Quick Links</h3>
                <p style="margin: 0; color: #475569; font-size: 14px;">More information here</p>
              </div>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
            <p style="margin: 0;">© 2024 Your Company. All rights reserved.</p>
          </div>
        </div>
      `;
    
    case "promotional":
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #fef3c7;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #dc2626 100%); padding: 50px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 32px; font-weight: bold; text-transform: uppercase;">Special Offer!</h1>
            <p style="color: #fef3c7; margin: 0; font-size: 18px;">Limited Time Only</p>
          </div>
          <div style="padding: 40px 20px; background-color: #ffffff; text-align: center;">
            ${sampleContent}
            <div style="margin-top: 30px;">
              <a href="#" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);">Shop Now</a>
            </div>
          </div>
          <div style="background-color: #1f2937; padding: 30px 20px; text-align: center; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">© 2024 Your Company. All rights reserved.</p>
          </div>
        </div>
      `;
    
    default:
      return sampleContent;
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
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Templates", href: "/templates", icon: Copy },
    { label: "Create Template" }
  ]);

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<TemplateChannel>("individual");
  const [category, setCategory] = useState<TemplateCategory>("welcome");
  const [subjectLine, setSubjectLine] = useState("");
  const [content, setContent] = useState("");
  const [theme, setTheme] = useState<TemplateTheme>("minimal");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<TemplateTheme>("minimal");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !subjectLine.trim() || !hasContent(content)) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
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
        theme,
      });

      toast({
        title: "Template created",
        description: `${name} is ready to use across your campaigns.`,
      });

      setLocation('/templates');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <header className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Create Template</h1>
            <p className="text-gray-600 dark:text-gray-300">
              Build a reusable template for individual outreach, promotional campaigns, newsletters, and system notifications.
            </p>
          </div>
        </header>

        <div className="max-w-4xl mx-auto space-y-8">

          <Card className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm">
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="template-name">Template name *</Label>
                  <Input
                    id="template-name"
                    placeholder="e.g. New customer welcome"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="template-channel">Channel *</Label>
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
                  <Label htmlFor="template-category">Category *</Label>
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
                  <Label htmlFor="template-subject">Subject line *</Label>
                  <Input
                    id="template-subject"
                    placeholder="e.g. Welcome to {{company_name}}"
                    value={subjectLine}
                    onChange={(event) => setSubjectLine(event.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="template-content">Content *</Label>
                  <RichTextEditor
                    value={content}
                    onChange={setContent}
                    placeholder="Write your email content or paste HTML"
                    className="min-h-[300px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    {"Use liquid-style variables such as {{first_name}} or {{order_number}} to personalise your message."}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="template-theme">Email Theme</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Choose a design template that will wrap your content for email compatibility
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {themeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTheme(option.value as TemplateTheme)}
                        className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                          theme === option.value
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-sm">{option.label}</h4>
                          {theme === option.value && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path d="M5 13l4 4L19 7"></path>
                              </svg>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{option.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">{option.preview}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTheme(option.value as TemplateTheme);
                            setPreviewOpen(true);
                          }}
                          className="mt-2 w-full gap-2 text-xs"
                        >
                          <Eye className="h-3 w-3" />
                          Preview
                        </Button>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="template-tags">Tags</Label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-background">
                      {tags.length === 0 && (
                        <span className="text-sm text-muted-foreground">No tags added yet</span>
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
                        placeholder="Add a tag (e.g. onboarding, v1)"
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
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Press Enter or click Add to create a tag. Click the X to remove.
                    </p>
                  </div>
                </div>
              </div>

                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation('/templates')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Create template"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {themeOptions.find(t => t.value === previewTheme)?.label} Theme Preview
            </DialogTitle>
            <DialogDescription>
              {themeOptions.find(t => t.value === previewTheme)?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <div className="bg-gray-100 dark:bg-gray-900 p-6 rounded-lg">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: getThemePreviewHTML(previewTheme, content) 
                }}
              />
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setPreviewOpen(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setTheme(previewTheme);
                  setPreviewOpen(false);
                  toast({
                    title: "Theme selected",
                    description: `${themeOptions.find(t => t.value === previewTheme)?.label} theme has been applied.`,
                  });
                }}
              >
                Use This Theme
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
