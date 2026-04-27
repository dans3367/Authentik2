import { useState, useRef, useCallback, useMemo, useEffect, type ReactNode } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import RichTextEditor from "@/components/LazyRichTextEditor";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Paperclip, X, FileText, Image, FileSpreadsheet, File, Check, ChevronsUpDown } from "lucide-react";
import { wrapInEmailPreview } from "@/utils/email-preview-wrapper";
import { sanitizeHtmlForPreview } from "@/utils/sanitize-html";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// 40MB total limit (including base64 overhead ~33%)
const MAX_TOTAL_RAW_SIZE = 30 * 1024 * 1024; // 30MB raw = ~40MB after base64
const MAX_FILES = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SelectableContact {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status?: string;
}

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

function getContactDisplayName(contact: Pick<SelectableContact, "firstName" | "lastName" | "email">): string {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return name || contact.email;
}

function parseEmailList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\s;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  );
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
  const [showPreview, setShowPreview] = useState(false);
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [showCcInput, setShowCcInput] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([contactId]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ccInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const totalSize = attachments.reduce((sum, f) => sum + f.size, 0);
  const estimatedBase64Size = Math.ceil(totalSize / 3) * 4;

  useEffect(() => {
    if (open) {
      setSelectedContactIds([contactId]);
      setRecipientSearch("");
      setRecipientPickerOpen(false);
      setShowCcInput(false);
    }
  }, [open, contactId]);

  useEffect(() => {
    if (showCcInput) {
      ccInputRef.current?.focus();
    }
  }, [showCcInput]);

  const { data: masterDesign } = useQuery({
    queryKey: ["/api/master-email-design"],
    enabled: open,
    queryFn: async () => {
      const response = await fetch('/api/master-email-design', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch email design');
      return response.json();
    },
  });

  const { data: contactsData, isLoading: contactsLoading } = useQuery<{ contacts: SelectableContact[] }>({
    queryKey: ["/api/email-contacts", "send-email-recipients"],
    enabled: open,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/email-contacts?status=active&limit=200");
      return response.json();
    },
  });

  const currentContact = useMemo<SelectableContact>(() => ({
    id: contactId,
    email: contactEmail,
    firstName: contactName?.split(" ")[0],
    lastName: contactName?.split(" ").slice(1).join(" "),
  }), [contactId, contactEmail, contactName]);

  const allRecipientContacts = useMemo(() => {
    const map = new Map<string, SelectableContact>();
    map.set(currentContact.id, currentContact);
    for (const contact of contactsData?.contacts || []) {
      map.set(contact.id, contact);
    }
    return Array.from(map.values());
  }, [contactsData, currentContact]);

  const recipientOptions = useMemo(() => {
    const search = recipientSearch.trim().toLowerCase();
    return allRecipientContacts.filter((contact) => {
      if (!search) return true;
      return (
        contact.email.toLowerCase().includes(search) ||
        getContactDisplayName(contact).toLowerCase().includes(search)
      );
    });
  }, [allRecipientContacts, recipientSearch]);

  const selectedRecipientContacts = useMemo(() => {
    const allContacts = new Map(allRecipientContacts.map((contact) => [contact.id, contact]));
    return selectedContactIds.map((id) => allContacts.get(id)).filter(Boolean) as SelectableContact[];
  }, [allRecipientContacts, selectedContactIds]);

  const recipientTriggerLabel = useMemo(() => {
    if (selectedRecipientContacts.length === 0) return "Select recipients";
    if (selectedRecipientContacts.length === 1) {
      const recipient = selectedRecipientContacts[0];
      return `${getContactDisplayName(recipient)} (${recipient.email})`;
    }

    const firstRecipient = selectedRecipientContacts[0];
    return `${getContactDisplayName(firstRecipient)} +${selectedRecipientContacts.length - 1} more`;
  }, [selectedRecipientContacts]);

  const ccEmails = useMemo(() => parseEmailList(ccInput), [ccInput]);
  const invalidCcEmails = useMemo(() => ccEmails.filter((email) => !EMAIL_PATTERN.test(email)), [ccEmails]);

  const toggleRecipient = (recipientId: string, checked: boolean) => {
    setSelectedContactIds((prev) => {
      if (checked) return prev.includes(recipientId) ? prev : [...prev, recipientId];
      return prev.filter((id) => id !== recipientId);
    });
  };

  const parsedSocialLinks = (() => {
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
  })();

  const previewHtml = useMemo(() => {
    const sanitizedContent = content ? sanitizeHtmlForPreview(content) : "<p style='color:#94a3b8;'>No content yet...</p>";
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
        formData.append("recipientContactIds", JSON.stringify(selectedContactIds));
        if (ccEmails.length > 0) {
          formData.append("cc", JSON.stringify(ccEmails));
        }
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
          { subject, content, recipientContactIds: selectedContactIds, cc: ccEmails }
        );
        return response.json();
      }
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: `Email successfully sent to ${selectedContactIds.length} recipient${selectedContactIds.length === 1 ? "" : "s"}`,
      });
      setOpen(false);
      setSubject("");
      setContent("");
      setCcInput("");
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

    if (selectedContactIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one recipient",
        variant: "destructive",
      });
      return;
    }

    if (invalidCcEmails.length > 0) {
      toast({
        title: "Validation Error",
        description: `Invalid CC email: ${invalidCcEmails[0]}`,
        variant: "destructive",
      });
      return;
    }

    if (!hasEditorContent(content)) {
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
      setShowPreview(false);
      setCcInput("");
      setRecipientPickerOpen(false);
      setShowCcInput(false);
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
                      <Mail className="w-4 h-4 mr-2" />
                      Send Email
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
              <Mail className="w-4 h-4 mr-2" />
              Send Email
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>
              Send an email to one or more contacts. The current contact is selected by default:{" "}
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
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="recipients-trigger">To</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedContactIds.length} selected
                </span>
              </div>
              <Popover open={recipientPickerOpen} onOpenChange={setRecipientPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="recipients-trigger"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={recipientPickerOpen}
                    disabled={sendEmailMutation.isPending}
                    className={cn(
                      "w-full justify-between font-normal",
                      selectedRecipientContacts.length === 0 && "text-muted-foreground"
                    )}
                  >
                    <span className="truncate text-left">{recipientTriggerLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                  usePortal={false}
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search contacts by name or email..."
                      value={recipientSearch}
                      onValueChange={setRecipientSearch}
                    />
                    <CommandList className="max-h-72 overflow-y-auto">
                      {contactsLoading ? (
                        <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading contacts...
                        </div>
                      ) : (
                        <>
                          <CommandEmpty>No matching contacts</CommandEmpty>
                          <CommandGroup>
                            {recipientOptions.map((contact) => {
                              const checked = selectedContactIds.includes(contact.id);
                              return (
                                <CommandItem
                                  key={contact.id}
                                  value={contact.id}
                                  onSelect={() => toggleRecipient(contact.id, !checked)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      checked ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex min-w-0 flex-col">
                                    <span className="truncate text-sm font-medium">
                                      {getContactDisplayName(contact)}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                      {contact.email}
                                    </span>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              {!showCcInput && ccInput.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setShowCcInput(true)}
                  disabled={sendEmailMutation.isPending}
                  className="ml-auto w-fit text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Add Cc
                </button>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="cc">Cc</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setCcInput("");
                        setShowCcInput(false);
                      }}
                      disabled={sendEmailMutation.isPending}
                      className="text-xs text-gray-500 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Remove
                    </button>
                  </div>
                  <Input
                    ref={ccInputRef}
                    id="cc"
                    type="text"
                    placeholder="cc@example.com, another@example.com"
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    disabled={sendEmailMutation.isPending}
                    aria-invalid={invalidCcEmails.length > 0}
                  />
                  <p className={`text-xs ${invalidCcEmails.length > 0 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
                    {invalidCcEmails.length > 0
                      ? `Invalid email: ${invalidCcEmails[0]}`
                      : "Optional. Separate multiple CC addresses with commas, spaces, or semicolons."}
                  </p>
                </>
              )}
            </div>

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
              <div id="content" aria-disabled={sendEmailMutation.isPending}>
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
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Rich text content will be sent as HTML in the email.
              </p>
            </div>

            {/* Attachments */}
            <div className="grid gap-2">
              <Label>Attachments</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isDragOver
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
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.zip,.json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,image/jpeg,image/png,image/gif,image/webp,application/zip,application/x-zip-compressed,application/json"
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
              onClick={() => setShowPreview(true)}
              disabled={sendEmailMutation.isPending || !hasEditorContent(content)}
            >
              Preview Email
            </Button>
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

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview of how this message will look in an email client.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto p-4 sm:p-6 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl">
              <div className="bg-white text-slate-900 shadow-2xl mx-auto rounded overflow-hidden max-w-[600px] w-full">
                <div className="border-b bg-gray-50 p-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex gap-2 mb-1">
                    <span className="font-semibold text-right w-14">To:</span>
                    <span className="text-gray-900">
                      {selectedRecipientContacts.map((contact) => contact.email).join(", ")}
                    </span>
                  </div>
                  {ccEmails.length > 0 && (
                    <div className="flex gap-2 mb-1">
                      <span className="font-semibold text-right w-14">Cc:</span>
                      <span className="text-gray-900">{ccEmails.join(", ")}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="font-semibold text-right w-14">Subject:</span>
                    <span className="text-gray-900 font-bold">{subject || "(no subject)"}</span>
                  </div>
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
