import { useState, type ReactNode } from "react";
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
import { Loader2, Mail } from "lucide-react";

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
  const { toast } = useToast();

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { subject: string; content: string }) => {
      const response = await apiRequest(
        "POST",
        `/api/email-contacts/${contactId}/send-email`,
        data
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send email");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: `Email successfully sent to ${contactEmail}`,
      });
      setOpen(false);
      setSubject("");
      setContent("");
      onEmailSent?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
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

    sendEmailMutation.mutate({ subject, content });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled && nextOpen) {
      toast({
        title: "Sending disabled",
        description: disabledReason || "You cannot send an email to this contact.",
        variant: "destructive",
      });
      return;
    }
    setOpen(nextOpen);
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
                rows={10}
                className="resize-none"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Plain text content will be automatically formatted for email delivery.
              </p>
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
