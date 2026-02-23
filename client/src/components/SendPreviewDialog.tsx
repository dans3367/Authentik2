import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Mail, Search, Loader2, User, Users, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PreviewRecipient {
  id: string;
  email: string;
  name: string;
  role: string;
  type: "user" | "contact";
}

interface SendPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getHtmlContent: () => string;
  subject?: string;
}

export function SendPreviewDialog({
  open,
  onOpenChange,
  getHtmlContent,
  subject = "Newsletter Preview",
}: SendPreviewDialogProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const MAX_RECIPIENTS = 5;

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedEmails([]);
      setSending(false);
    }
  }, [open]);

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) => {
      if (prev.includes(email)) {
        return prev.filter((e) => e !== email);
      }
      if (prev.length >= MAX_RECIPIENTS) {
        toast({ title: "Limit reached", description: `You can select up to ${MAX_RECIPIENTS} recipients.`, variant: "destructive" });
        return prev;
      }
      return [...prev, email];
    });
  };

  const removeEmail = (email: string) => {
    setSelectedEmails((prev) => prev.filter((e) => e !== email));
  };

  const { data, isLoading } = useQuery<{ recipients: PreviewRecipient[] }>({
    queryKey: ["/api/newsletters/preview-recipients"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/newsletters/preview-recipients");
      return res.json();
    },
    enabled: open,
  });

  const recipients = data?.recipients || [];
  const filtered = recipients.filter(
    (r) =>
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = async () => {
    if (selectedEmails.length === 0) {
      toast({ title: "Select a recipient", description: "Please select at least one email address to send the preview to.", variant: "destructive" });
      return;
    }

    const html = getHtmlContent();
    if (!html || html.trim().length < 10) {
      toast({ title: "No content", description: "Add some content to your newsletter before sending a preview.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      await apiRequest("POST", "/api/newsletters/send-preview", {
        to: selectedEmails,
        subject,
        html,
      });
      const count = selectedEmails.length;
      toast({ title: "Preview sent", description: `Preview email sent to ${count} recipient${count > 1 ? "s" : ""}` });
      onOpenChange(false);
      setSelectedEmails([]);
      setSearch("");
    } catch (error: any) {
      toast({ title: "Failed to send", description: error.message || "Could not send preview email", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Preview Email
          </DialogTitle>
          <DialogDescription>
            Select up to {MAX_RECIPIENTS} recipients to send a preview of your newsletter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="border rounded-md max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {search ? "No matching recipients" : "No recipients found"}
              </div>
            ) : (
              filtered.map((r) => {
                const isSelected = selectedEmails.includes(r.email);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleEmail(r.email)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors border-b last:border-b-0 ${
                      isSelected ? "bg-accent" : ""
                    }`}
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 dark:border-gray-600"
                    }`}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                      r.type === "user" ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" : "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
                    }`}>
                      {r.type === "user" ? <User className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {selectedEmails.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Sending to {selectedEmails.length} recipient{selectedEmails.length > 1 ? "s" : ""}:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs font-medium"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="hover:text-blue-600 dark:hover:text-blue-100 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={selectedEmails.length === 0 || sending}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Preview{selectedEmails.length > 1 ? ` (${selectedEmails.length})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
