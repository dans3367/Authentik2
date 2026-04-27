import { useState, useRef, useCallback, useMemo, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/LazyRichTextEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIMEZONE_OPTIONS } from "@/utils/appointment-utils";
import { wrapInEmailPreview } from "@/utils/email-preview-wrapper";
import { sanitizeHtmlForPreview } from "@/utils/sanitize-html";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Loader2, Paperclip, X, FileText, Image, FileSpreadsheet, File } from "lucide-react";

const MAX_TOTAL_RAW_SIZE = 30 * 1024 * 1024;
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

function hasEditorContent(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

interface ScheduleEmailModalProps {
  contactId: string;
  contactEmail: string;
  contactName?: string;
  trigger?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  onScheduled?: () => void;
}

export default function ScheduleEmailModal({
  contactId,
  contactEmail,
  contactName,
  trigger,
  disabled = false,
  disabledReason,
  onScheduled,
}: ScheduleEmailModalProps) {
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago"
  );
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const totalSize = attachments.reduce((sum, f) => sum + f.size, 0);
  const estimatedBase64Size = Math.ceil(totalSize / 3) * 4;

  const { data: masterDesign } = useQuery({
    queryKey: ["/api/master-email-design"],
    enabled: open,
    queryFn: async () => {
      const response = await fetch("/api/master-email-design", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch email design");
      return response.json();
    },
  });

  const parsedSocialLinks = useMemo(() => {
    const raw = (masterDesign as any)?.socialLinks;
    if (!raw) return undefined;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    }
    return raw;
  }, [masterDesign]);

  const previewHtml = useMemo(() => {
    const sanitizedContent = content
      ? sanitizeHtmlForPreview(content)
      : "<p style='color:#94a3b8;'>No content yet...</p>";
    return wrapInEmailPreview(
      `
        <div style="padding:64px 48px;min-height:200px;">
          <div style="font-size:16px;line-height:1.625;color:#334155;">
            ${sanitizedContent}
          </div>
        </div>
      `,
      {
        companyName: (masterDesign as any)?.companyName || "",
        headerMode: (masterDesign as any)?.headerMode,
        primaryColor: (masterDesign as any)?.primaryColor,
        logoUrl: (masterDesign as any)?.logoUrl,
        logoSize: (masterDesign as any)?.logoSize,
        logoAlignment: (masterDesign as any)?.logoAlignment,
        bannerUrl: (masterDesign as any)?.bannerUrl,
        showCompanyName: (masterDesign as any)?.showCompanyName,
        headerText: (masterDesign as any)?.headerText,
        footerText: (masterDesign as any)?.footerText,
        fontFamily: (masterDesign as any)?.fontFamily,
        socialLinks: parsedSocialLinks,
      }
    );
  }, [content, masterDesign, parsedSocialLinks]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
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
    },
    [toast]
  );

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (attachments.length > 0) {
        const formData = new FormData();
        formData.append("subject", subject);
        formData.append("html", content);
        formData.append("date", date);
        formData.append("time", time || "00:00");
        formData.append("timezone", timezone);
        attachments.forEach((file) => {
          formData.append("attachments", file);
        });

        const response = await fetch(`/api/email-contacts/${contactId}/schedule`, {
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
        const response = await apiRequest(
          "POST",
          `/api/email-contacts/${contactId}/schedule`,
          {
            subject,
            html: content,
            date,
            time: time || "00:00",
            timezone,
          }
        );
        return response.json();
      }
    },
    onSuccess: () => {
      toast({
        title: "Email Scheduled",
        description: `Scheduled for ${date} at ${time || "00:00"} (${timezone}).`,
      });
      setOpen(false);
      setSubject("");
      setContent("");
      setDate("");
      setTime("");
      setAttachments([]);
      onScheduled?.();
    },
    onError: (error: any) => {
      toast({
        title: "Scheduling Failed",
        description: error?.message || "Failed to schedule email",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      toast({ title: "Validation Error", description: "Please enter a subject", variant: "destructive" });
      return;
    }
    if (!hasEditorContent(content)) {
      toast({ title: "Validation Error", description: "Please enter email content", variant: "destructive" });
      return;
    }
    if (!date) {
      toast({ title: "Validation Error", description: "Please choose a date", variant: "destructive" });
      return;
    }

    scheduleMutation.mutate();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setAttachments([]);
      setShowPreview(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {disabled && disabledReason ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block" tabIndex={0}>
                <DialogTrigger asChild>
                  {trigger || (
                    <Button variant="outline" disabled={disabled}>
                      <Clock className="w-4 h-4 mr-2" />
                      Schedule Email
                    </Button>
                  )}
                </DialogTrigger>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-sm">
              <p>{disabledReason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" disabled={disabled}>
              <Clock className="w-4 h-4 mr-2" />
              Schedule Email
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Schedule Email</DialogTitle>
            <DialogDescription>
              Schedule an email to{" "}
              {contactName ? (
                <>
                  <strong>{contactName}</strong> ({contactEmail})
                </>
              ) : (
                <strong>{contactEmail}</strong>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="schedule-subject">Subject</Label>
              <Input
                id="schedule-subject"
                placeholder="Enter email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={scheduleMutation.isPending}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="schedule-content">Content</Label>
              <div id="schedule-content" aria-disabled={scheduleMutation.isPending}>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Write your email..."
                  className="min-h-[220px]"
                  customerInfo={{
                    firstName: contactName?.split(" ")[0] || undefined,
                    lastName: contactName?.split(" ").slice(1).join(" ") || undefined,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="schedule-date">Date</Label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={scheduleMutation.isPending}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="schedule-time">Time</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={scheduleMutation.isPending}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="schedule-timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone} disabled={scheduleMutation.isPending}>
                <SelectTrigger id="schedule-timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Attachments</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
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
                  Drop files here or{" "}
                  <span className="text-blue-600 dark:text-blue-400 font-medium">browse</span>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Max {MAX_FILES} files, 40MB total
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
                <div className="space-y-1.5 mt-1">
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
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAttachment(idx);
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                          disabled={scheduleMutation.isPending}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {attachments.length} file{attachments.length !== 1 ? "s" : ""} &middot;{" "}
                    {formatFileSize(totalSize)} raw &middot; ~{formatFileSize(estimatedBase64Size)} encoded
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={scheduleMutation.isPending || !hasEditorContent(content)}
            >
              Preview Email
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={scheduleMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Schedule Email
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview of how this message will look in an email client for {contactEmail}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto p-4 sm:p-6 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl">
              <div className="bg-white text-slate-900 shadow-2xl mx-auto rounded overflow-hidden max-w-[600px] w-full">
                <div className="border-b bg-gray-50 p-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex gap-2 mb-1">
                    <span className="font-semibold text-right w-14">To:</span>
                    <span className="text-gray-900">{contactEmail}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-right w-14">Subject:</span>
                    <span className="text-gray-900 font-bold">{subject || "(no subject)"}</span>
                  </div>
                  {date && (
                    <div className="flex gap-2 mt-1">
                      <span className="font-semibold text-right w-14">Scheduled:</span>
                      <span className="text-gray-900">
                        {`${date} ${time || "00:00"} (${timezone})`}
                      </span>
                    </div>
                  )}
                </div>

                <iframe
                  srcDoc={previewHtml}
                  title="Email body preview"
                  sandbox=""
                  className="w-full border-0"
                  style={{ minHeight: "640px", background: "#fff" }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
