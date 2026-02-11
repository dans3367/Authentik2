import { useState, useRef, useCallback, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Paperclip, X, FileText, Image, FileSpreadsheet, File } from "lucide-react";

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

interface SendEmailModalProps {
  contactId: string;
  contactEmail: string;
  contactName?: string;
  trigger?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  onEmailSent?: () => void;
}

export default function SendEmailModal({
  contactId,
  contactEmail,
  contactName,
  trigger,
  disabled = false,
  disabledReason,
  onEmailSent,
}: SendEmailModalProps) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const totalSize = attachments.reduce((sum, f) => sum + f.size, 0);
  const estimatedBase64Size = Math.ceil(totalSize / 3) * 4;

  const addFiles = useCallback((files: FileList | File[]) => {
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

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (attachments.length > 0) {
        // Use FormData for multipart/form-data when attachments are present
        const formData = new FormData();
        formData.append("subject", subject);
        formData.append("content", content);
        attachments.forEach((file) => {
          formData.append("attachments", file);
        });

        const response = await fetch(`/api/email-contacts/${contactId}/send-email`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || `Failed to send email (${response.status})`);
        }

        return response.json();
      } else {
        // Use JSON when no attachments (standard path)
        const response = await apiRequest(
          "POST",
          `/api/email-contacts/${contactId}/send-email`,
          { subject, content }
        );
        return response.json();
      }
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: `Email successfully sent to ${contactEmail}`,
      });
      setOpen(false);
      setSubject("");
      setContent("");
      setAttachments([]);
      onEmailSent?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Email",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a subject",
        variant: "destructive",
      });
      return;
    }
    
    if (!content.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter email content",
        variant: "destructive",
      });
      return;
    }

    sendEmailMutation.mutate();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setAttachments([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" disabled={disabled}>
            <Mail className="w-4 h-4 mr-2" />
            Send Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>
              Send an individual email to{" "}
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
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Enter email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sendEmailMutation.isPending}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                placeholder="Enter email content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={sendEmailMutation.isPending}
                rows={8}
                className="resize-none"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Plain text content will be automatically formatted for email delivery.
              </p>
            </div>

            {/* Attachments */}
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
                disabled={sendEmailMutation.isPending}
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
                          onClick={(e) => { e.stopPropagation(); removeAttachment(idx); }}
                          className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                          disabled={sendEmailMutation.isPending}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {attachments.length} file{attachments.length !== 1 ? "s" : ""} &middot; {formatFileSize(totalSize)} raw &middot; ~{formatFileSize(estimatedBase64Size)} encoded
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={sendEmailMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={sendEmailMutation.isPending}
            >
              {sendEmailMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
