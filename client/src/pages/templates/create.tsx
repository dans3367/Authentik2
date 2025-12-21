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
import { Copy, LayoutDashboard, ArrowLeft } from "lucide-react";
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
  const [tagInput, setTagInput] = useState("");

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

    const tags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

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
                  <Label htmlFor="template-tags">Tags</Label>
                  <Input
                    id="template-tags"
                    placeholder="Comma separated e.g. onboarding, v1"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                  />
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
    </div>
  );
}
