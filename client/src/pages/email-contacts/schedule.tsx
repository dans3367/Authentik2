import { useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Calendar, Clock, Mail, AlertTriangle, Eye, Paperclip, X, FileText, Image, FileSpreadsheet, File } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TemplateSelector } from "@/components/TemplateSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIMEZONE_OPTIONS } from "@/utils/appointment-utils";
import { useToast } from "@/hooks/use-toast";

// 40MB total limit (including base64 overhead ~33%)
const MAX_TOTAL_RAW_SIZE = 30 * 1024 * 1024; // 30MB raw = ~40MB after base64
const MAX_FILES = 10;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return Image;
  if (type.includes("spreadsheet") || type.includes("excel") || type === "text/csv") return FileSpreadsheet;
  if (type.includes("pdf") || type.includes("word") || type.includes("document") || type === "text/plain") return FileText;
  return File;
}

export default function ScheduleContactEmailPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isUsingTemplate, setIsUsingTemplate] = useState(false);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago");
  const [showPreview, setShowPreview] = useState(false);
  const [attachments, setAttachments] = useState<globalThis.File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const totalAttachmentSize = attachments.reduce((sum, f) => sum + f.size, 0);
  const estimatedBase64Size = Math.ceil(totalAttachmentSize / 3) * 4;

  const addFiles = useCallback((files: FileList | globalThis.File[]) => {
    const newFiles = Array.from(files);
    setAttachments((prev) => {
      const combined = [...prev, ...newFiles];
      if (combined.length > MAX_FILES) {
        toast({
          title: "Too many files",
          description: `Maximum ${MAX_FILES} attachments allowed.`,
          variant: "destructive",
        });
        return prev;
      }
      const newTotal = combined.reduce((s, f) => s + f.size, 0);
      if (newTotal > MAX_TOTAL_RAW_SIZE) {
        toast({
          title: "Attachments too large",
          description: `Total size (${formatFileSize(newTotal)}) exceeds the ~30MB limit (40MB after encoding).`,
          variant: "destructive",
        });
        return prev;
      }
      return combined;
    });
  }, [toast]);

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  // Load contact for context and validation
  const { data: contactResp, isLoading: contactLoading, error: contactError } = useQuery({
    queryKey: ["/api/email-contacts", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/email-contacts/${id}`);
      if (!res.ok) throw new Error("Failed to load contact");
      return res.json();
    },
  });

  const contact = (contactResp as any)?.contact;

  // Bounce/suppression check
  const { data: bouncedCheck } = useQuery({
    queryKey: ["/api/bounced-emails/check", contact?.email],
    enabled: !!contact?.email,
    queryFn: async ({ queryKey }) => {
      const res = await apiRequest("GET", `/api/bounced-emails/check/${encodeURIComponent(String(queryKey[1]))}`);
      return res.json();
    },
  });

  // Fetch master email design for preview wrapper
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

  const isUnsubscribed = contact?.status === "unsubscribed" || contact?.status === "bounced" || !!bouncedCheck?.isBounced;

  const isBounced = contact?.status === "bounced" || !!bouncedCheck?.isBounced;
  let suppressedTitle = "Suppressed Contact";

  if (isBounced) {
    suppressedTitle = "Suppressed Contact (bounced)";
  } else if (contact?.status === "unsubscribed") {
    suppressedTitle = "Suppressed Contact (unsubscribed)";
  } else if (contact?.suppressionReason) {
    suppressedTitle = `Suppressed Contact (${contact.suppressionReason})`;
  }

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (attachments.length > 0) {
        // Use FormData for multipart/form-data when attachments are present
        const formData = new FormData();
        formData.append("subject", subject);
        formData.append("html", content);
        formData.append("date", date);
        formData.append("time", time || "00:00");
        formData.append("timezone", timezone);
        attachments.forEach((file) => {
          formData.append("attachments", file);
        });

        const response = await fetch(`/api/email-contacts/${id}/schedule`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || `Failed to schedule email (${response.status})`);
        }

        return response.json();
      } else {
        // Use JSON when no attachments (standard path)
        return apiRequest("POST", `/api/email-contacts/${id}/schedule`, {
          subject,
          html: content,
          date,
          time: time || "00:00",
          timezone,
        }).then((r) => r.json());
      }
    },
    onSuccess: () => {
      toast({
        title: "Email Scheduled",
        description: `Your email has been scheduled for ${date} at ${time || "00:00"} (${timezone}).`,
      });
      navigate(`/email-contacts/view/${id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Scheduling Failed",
        description: error?.message || "Failed to schedule email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const scheduleWarningMessage = "This customer has unsubscribed from the mailing list. Please do not send marketing or promotional emails to this contact. You may still send direct or scheduled messages if needed.";

  const canSubmit = !!subject && !!content && !!date && !!id;

  const handleTemplateSelect = (template: { subject: string; content: string }) => {
    setSubject(template.subject);
    setContent(template.content);
    setIsUsingTemplate(true);
  };

  const handleUseCustomMessage = () => {
    setIsUsingTemplate(false);
    // Clear content if switching from template
    if (isUsingTemplate) {
      setSubject("");
      setContent("");
    }
  };

  if (contactLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (contactError || !contact) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(`/email-contacts/view/${id}`)} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Contact
          </Button>
          <Alert>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load contact.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Button variant="ghost" onClick={() => navigate(`/email-contacts/view/${id}`)} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Contact
            </Button>
            <h1 className="text-2xl font-bold">Schedule Email</h1>
            <p className="text-gray-600 dark:text-gray-400">Send a B2C email to {contact.email} at a later time.</p>
          </div>
        </div>

        {isUnsubscribed && (
          <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm font-medium">{suppressedTitle}</AlertTitle>
            <AlertDescription className="text-sm">{scheduleWarningMessage}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Message</CardTitle>
            <div className="flex gap-2">
              {isUsingTemplate && (
                <Button variant="outline" type="button" onClick={handleUseCustomMessage}>
                  Use Custom Message
                </Button>
              )}
              {(subject || content) && (
                <Button variant="outline" type="button" onClick={() => setShowPreview(true)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
              )}
              <TemplateSelector onSelect={handleTemplateSelect} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>To</Label>
              <Input value={contact.email} disabled className="mt-2" />
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject..."
                className="mt-2"
                disabled={isUsingTemplate}
              />
            </div>
            <div>
              <Label>Content</Label>
              {isUsingTemplate ? (
                <div
                  className="mt-2 min-h-[220px] p-3 rounded-md border border-input bg-gray-50 dark:bg-gray-900 text-sm overflow-auto"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your email..."
                  className="mt-2 min-h-[220px]"
                />
              )}
            </div>

            {/* Attachments */}
            <div>
              <Label>Attachments</Label>
              <div
                className={`mt-2 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Drop files here or <span className="text-blue-600 dark:text-blue-400 font-medium">browse</span>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Max {MAX_FILES} files, 40MB total (PDF, images, docs, spreadsheets, etc.)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
                disabled={scheduleMutation.isPending}
              />

              {attachments.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {attachments.map((file, idx) => {
                    const Icon = getFileIcon(file.type);
                    return (
                      <div
                        key={`${file.name}-${idx}`}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-sm"
                      >
                        <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="truncate flex-1 text-gray-700 dark:text-gray-300">{file.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeAttachment(idx); }}
                          className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                          disabled={scheduleMutation.isPending}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {attachments.length} file{attachments.length !== 1 ? "s" : ""} &middot; {formatFileSize(totalAttachmentSize)} raw &middot; ~{formatFileSize(estimatedBase64Size)} encoded
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>Time</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-2" />
              </div>
            </div>
            <div>
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {TIMEZONE_OPTIONS.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                The email will be sent at the scheduled time in this timezone
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(`/email-contacts/view/${id}`)}>
            Cancel
          </Button>
          <Button onClick={() => scheduleMutation.mutate()} disabled={!canSubmit || scheduleMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
            <Clock className="w-4 h-4 mr-2" /> {scheduleMutation.isPending ? "Scheduling..." : "Schedule Email"}
          </Button>
        </div>
      </div>

      {/* Email Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Email Preview
            </DialogTitle>
            <DialogDescription>
              Preview of the email that will be sent to {contact?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto p-4 sm:p-6 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl">
              <div className="bg-white text-slate-900 shadow-2xl mx-auto rounded overflow-hidden max-w-[600px] w-full" style={{ fontFamily: masterDesign?.fontFamily || "Arial, sans-serif" }}>

                {/* Simulated email header */}
                <div className="border-b bg-gray-50 p-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex gap-2 mb-1">
                    <span className="font-semibold text-right w-14">To:</span>
                    <span className="text-gray-900">{contact?.email}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-right w-14">Subject:</span>
                    <span className="text-gray-900 font-bold">{subject || "(no subject)"}</span>
                  </div>
                  {date && (
                    <div className="flex gap-2 mt-1">
                      <span className="font-semibold text-right w-14">Scheduled:</span>
                      <span className="text-gray-900">
                        {(() => {
                          try {
                            const scheduledDate = new Date(`${date}T${time || "00:00"}`);
                            // Format with the user-selected timezone
                            return scheduledDate.toLocaleString(undefined, {
                              timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            });
                          } catch (e) {
                            // Fallback if timezone is invalid
                            return new Date(`${date}T${time || "00:00"}`).toLocaleString();
                          }
                        })()}
                      </span>
                    </div>
                  )}
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

                {/* Email body content */}
                <div className="p-8 flex-1">
                  {isUsingTemplate ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: content || "<p style='color:#94a3b8;'>No content yet...</p>" }}
                    />
                  ) : (
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                      {content || <span style={{ color: "#94a3b8" }}>No content yet...</span>}
                    </div>
                  )}
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
                    <p>{masterDesign?.footerText || "\u00A9 2025 All rights reserved."}</p>
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
