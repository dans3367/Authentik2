import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Search, Star } from "lucide-react";

interface Template {
  id: string;
  name: string;
  channel: string;
  category: string;
  subjectLine: string;
  preview?: string | null;
  body: string;
  usageCount: number;
  isFavorite: boolean;
  tags: string[];
}

interface TemplateSelectorProps {
  onSelect: (template: { subject: string; content: string }) => void;
  trigger?: React.ReactNode;
  channel?: string; // Filter by channel (e.g., 'individual')
}

export function TemplateSelector({ onSelect, trigger, channel }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Fetch templates
  const { data, isLoading } = useQuery({
    queryKey: ["/api/templates", { search: searchTerm, channel, limit: 100 }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (channel) params.append("channel", channel);
      params.append("limit", "100");
      
      const res = await apiRequest("GET", `/api/templates?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
    enabled: open,
  });

  const templates = data?.templates || [];

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
  };

  const handleUseTemplate = () => {
    if (selectedTemplate) {
      onSelect({
        subject: selectedTemplate.subjectLine,
        content: selectedTemplate.body,
      });
      setOpen(false);
      setSelectedTemplate(null);
    }
  };

  const getChannelBadgeColor = (channel: string) => {
    switch (channel) {
      case "individual":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "promotional":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "newsletter":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "transactional":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" type="button">
            <FileText className="w-4 h-4 mr-2" />
            Use Template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] p-0 flex flex-col">
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle>Select Email Template</DialogTitle>
            <DialogDescription>
              Choose a template to populate the subject and content fields
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 flex-1 overflow-hidden flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Templates List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 flex-1">
            {/* Template List */}
            <div className="border rounded-lg">
              <div className="p-3 border-b bg-gray-50 dark:bg-gray-800">
                <Label className="text-sm font-medium">Available Templates</Label>
              </div>
              <ScrollArea className="h-full max-h-full">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
                    <FileText className="w-12 h-12 mb-2 opacity-50" />
                    <p className="text-sm">No templates found</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {templates.map((template: Template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => handleSelectTemplate(template)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedTemplate?.id === template.id
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm truncate">{template.name}</h4>
                              {template.isFavorite && (
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mb-1">
                              <Badge className={`text-xs ${getChannelBadgeColor(template.channel)}`}>
                                {template.channel}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {template.category.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {template.subjectLine}
                            </p>
                          </div>
                          <div className="text-xs text-gray-400 flex-shrink-0">
                            {template.usageCount}×
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Preview */}
            <div className="border rounded-lg">
              <div className="p-3 border-b bg-gray-50 dark:bg-gray-800">
                <Label className="text-sm font-medium">Preview</Label>
              </div>
              <ScrollArea className="h-full max-h-full">
                {selectedTemplate ? (
                  <div className="p-4 space-y-4">
                    <div>
                      <Label className="text-xs text-gray-500 dark:text-gray-400">Template Name</Label>
                      <p className="font-medium mt-1">{selectedTemplate.name}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 dark:text-gray-400">Subject Line</Label>
                      <p className="mt-1">{selectedTemplate.subjectLine}</p>
                    </div>
                    {selectedTemplate.preview && (
                      <div>
                        <Label className="text-xs text-gray-500 dark:text-gray-400">Preview Text</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedTemplate.preview}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-gray-500 dark:text-gray-400">Content</Label>
                      <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded border text-sm max-h-[200px] overflow-auto">
                        <div dangerouslySetInnerHTML={{ __html: selectedTemplate.body }} />
                      </div>
                    </div>
                    {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
                      <div>
                        <Label className="text-xs text-gray-500 dark:text-gray-400">Tags</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedTemplate.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center p-4">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Select a template to preview</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

        </div>

        <div className="px-6 py-4 border-t bg-white dark:bg-slate-900 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} type="button">
            Cancel
          </Button>
          <Button
            onClick={handleUseTemplate}
            disabled={!selectedTemplate}
            type="button"
          >
            Use This Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

