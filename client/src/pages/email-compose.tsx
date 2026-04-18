import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Send,
  Save,
  X,
  Bold,
  Italic,
  Underline,
  Link,
  Image,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Eye,
  Code,
  Paperclip,
  Clock,
  Users,
  FileText,
  Sparkles,
  Settings,
  ChevronDown,
  Plus,
  Trash2
} from "lucide-react";
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EmailDraft {
  to: string[];
  subject: string;
  content: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  template?: string;
  list?: string;
  tags: string[];
  scheduleDate?: string;
  scheduleTime?: string;
}

const mockLists = [
  { id: "all", name: "All Contacts", count: 2847 },
  { id: "premium", name: "Premium Customers", count: 342 },
  { id: "leads", name: "Leads", count: 1205 },
  { id: "trial", name: "Trial Users", count: 89 },
];

const mockTemplates = [
  { id: "blank", name: "Blank Template" },
  { id: "newsletter", name: "Newsletter Template" },
  { id: "promotional", name: "Promotional Template" },
  { id: "welcome", name: "Welcome Email Template" },
];

export default function EmailCompose() {
  const [draft, setDraft] = useState<EmailDraft>({
    to: [],
    subject: "",
    content: "",
    fromName: "Your Company",
    fromEmail: "noreply@company.com",
    replyTo: "support@company.com",
    tags: [],
  });

  const [recipientInput, setRecipientInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [activeTab, setActiveTab] = useState("write");

  const addRecipient = () => {
    if (recipientInput && recipientInput.includes("@")) {
      setDraft({ ...draft, to: [...draft.to, recipientInput] });
      setRecipientInput("");
    }
  };

  const removeRecipient = (index: number) => {
    setDraft({
      ...draft,
      to: draft.to.filter((_, i) => i !== index),
    });
  };

  const addTag = () => {
    if (tagInput && !draft.tags.includes(tagInput)) {
      setDraft({ ...draft, tags: [...draft.tags, tagInput] });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setDraft({
      ...draft,
      tags: draft.tags.filter((t) => t !== tag),
    });
  };

  const EditorToolbar = () => (
    <div className="flex items-center gap-1 p-2 border-b flex-wrap">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bold className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Italic className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Underline className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <AlignRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <List className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Link className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Image className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Code className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Redo className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex-1" />
      
      <Button variant="ghost" size="sm">
        <Sparkles className="h-4 w-4 mr-2" />
        AI Write
      </Button>
    </div>
  );

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compose Email</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create and send email campaigns to your contacts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline">
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Send className="w-4 h-4 mr-2" />
              Send Campaign
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-6">
                  <TabsTrigger value="write">Write</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="test">Test</TabsTrigger>
                </TabsList>
                
                <TabsContent value="write" className="space-y-6">
                  {/* Recipients */}
                  <div>
                    <Label htmlFor="recipients">Recipients</Label>
                    <div className="mt-2 space-y-3">
                      <Select
                        value={draft.list}
                        onValueChange={(value) => setDraft({ ...draft, list: value })}
                      >
                        <SelectTrigger>
                          <Users className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="Select a contact list" />
                        </SelectTrigger>
                        <SelectContent>
                          {mockLists.map((list) => (
                            <SelectItem key={list.id} value={list.id}>
                              {list.name} ({list.count} contacts)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Add individual email addresses..."
                          value={recipientInput}
                          onChange={(e) => setRecipientInput(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && addRecipient()}
                        />
                        <Button onClick={addRecipient} size="sm">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {draft.to.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {draft.to.map((email, index) => (
                            <Badge key={index} variant="secondary" className="flex items-center gap-1">
                              {email}
                              <X
                                className="w-3 h-3 cursor-pointer"
                                onClick={() => removeRecipient(index)}
                              />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Subject */}
                  <div>
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      placeholder="Enter your email subject..."
                      value={draft.subject}
                      onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                      className="mt-2"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Tip: Use personalization tags like {"{"}first_name{"}"} to customize
                    </p>
                  </div>
                  
                  {/* Template Selection */}
                  <div>
                    <Label>Email Template</Label>
                    <Select
                      value={draft.template}
                      onValueChange={(value) => setDraft({ ...draft, template: value })}
                    >
                      <SelectTrigger className="mt-2">
                        <FileText className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Choose a template (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Email Content */}
                  <div>
                    <Label>Email Content</Label>
                    <div className="mt-2 border rounded-lg overflow-hidden">
                      <EditorToolbar />
                      <Textarea
                        placeholder="Write your email content here..."
                        value={draft.content}
                        onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                        className="min-h-[400px] border-0 focus:ring-0"
                      />
                    </div>
                  </div>
                  
                  {/* Tags */}
                  <div>
                    <Label>Tags</Label>
                    <div className="mt-2 space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Add tags..."
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && addTag()}
                        />
                        <Button onClick={addTag} size="sm">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {draft.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {draft.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="flex items-center gap-1">
                              {tag}
                              <X
                                className="w-3 h-3 cursor-pointer"
                                onClick={() => removeTag(tag)}
                              />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="preview" className="min-h-[600px]">
                  <div className="border rounded-lg p-6 bg-gray-50 dark:bg-gray-900">
                    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
                      <div className="mb-6 pb-6 border-b">
                        <h2 className="text-2xl font-bold mb-2">{draft.subject || "Email Subject"}</h2>
                        <p className="text-sm text-gray-500">
                          From: {draft.fromName} &lt;{draft.fromEmail}&gt;
                        </p>
                      </div>
                      <div className="prose dark:prose-invert max-w-none">
                        {draft.content || "Your email content will appear here..."}
                      </div>
                      <div className="mt-8 pt-6 border-t text-sm text-gray-500">
                        <p>You received this email because you're subscribed to our newsletter.</p>
                        <p className="mt-2">
                          <a href="#" className="text-blue-600 hover:underline">Unsubscribe</a> | 
                          <a href="#" className="text-blue-600 hover:underline ml-2">Update preferences</a>
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="test" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Send Test Email</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-600">
                        Send a test email to verify formatting and content before sending to your list.
                      </p>
                      <Input placeholder="Enter test email address" />
                      <Button>
                        <Send className="w-4 h-4 mr-2" />
                        Send Test
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Campaign Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Campaign Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="from-name">From Name</Label>
                <Input
                  id="from-name"
                  value={draft.fromName}
                  onChange={(e) => setDraft({ ...draft, fromName: e.target.value })}
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label htmlFor="from-email">From Email</Label>
                <Input
                  id="from-email"
                  type="email"
                  value={draft.fromEmail}
                  onChange={(e) => setDraft({ ...draft, fromEmail: e.target.value })}
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label htmlFor="reply-to">Reply-To Email</Label>
                <Input
                  id="reply-to"
                  type="email"
                  value={draft.replyTo}
                  onChange={(e) => setDraft({ ...draft, replyTo: e.target.value })}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="schedule-toggle">Schedule for later</Label>
                <Switch
                  id="schedule-toggle"
                  checked={isScheduled}
                  onCheckedChange={setIsScheduled}
                />
              </div>
              
              {isScheduled && (
                <>
                  <div>
                    <Label htmlFor="schedule-date">Date</Label>
                    <Input
                      id="schedule-date"
                      type="date"
                      value={draft.scheduleDate}
                      onChange={(e) => setDraft({ ...draft, scheduleDate: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="schedule-time">Time</Label>
                    <Input
                      id="schedule-time"
                      type="time"
                      value={draft.scheduleTime}
                      onChange={(e) => setDraft({ ...draft, scheduleTime: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                <Paperclip className="w-4 h-4 mr-2" />
                Add Attachment
              </Button>
              <p className="text-sm text-gray-500 mt-2">
                Max file size: 10MB
              </p>
            </CardContent>
          </Card>
          
          {/* Campaign Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Campaign Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Recipients</span>
                <span className="font-medium">
                  {draft.list ? mockLists.find(l => l.id === draft.list)?.count || 0 : 0} + {draft.to.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Subject Length</span>
                <span className="font-medium">{draft.subject.length} chars</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Status</span>
                <Badge variant="outline">Draft</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}