import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmailActivityTimeline from "@/components/EmailActivityTimeline";
import { Calendar, User, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmailActivityTimelineModalProps {
  contactId?: string;
  contactEmail?: string;
  contactName?: string;
  trigger: React.ReactNode;
}

export default function EmailActivityTimelineModal({ 
  contactId, 
  contactEmail, 
  contactName,
  trigger 
}: EmailActivityTimelineModalProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // If we only have email, look up the contact
  const { data: contactData, isLoading: isLookingUpContact, error: contactError } = useQuery({
    queryKey: ['contact-lookup', contactEmail],
    queryFn: async () => {
      if (!contactEmail) return null;
      const response = await apiRequest('GET', `/api/email-contacts?search=${encodeURIComponent(contactEmail)}&limit=1`);
      const data = await response.json();
      return data.contacts && data.contacts.length > 0 ? data.contacts[0] : null;
    },
    enabled: open && !contactId && !!contactEmail,
  });

  const resolvedContactId = contactId || contactData?.id;
  const displayName = contactName || contactData?.firstName && contactData?.lastName 
    ? `${contactData.firstName} ${contactData.lastName}`.trim()
    : contactEmail || contactData?.email || 'Contact';

  const handleOpenModal = () => {
    setOpen(true);
    // If we have neither contactId nor contactEmail, show error
    if (!contactId && !contactEmail) {
      toast({
        title: "Error",
        description: "Cannot open activity timeline - contact information is missing.",
        variant: "destructive",
      });
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={handleOpenModal}>
        {trigger}
      </div>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span>Email Activity Timeline</span>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{displayName}</span>
                </div>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            Complete email engagement history showing all opens, clicks, bounces, and other activities for this contact
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {isLookingUpContact ? (
            <div className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Looking up contact information...
              </div>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : contactError || (!resolvedContactId && contactEmail) ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Contact Not Found
              </h3>
              <p className="text-muted-foreground max-w-md">
                {contactEmail ? 
                  `The email address "${contactEmail}" was not found in your contacts list.` :
                  "Contact information is missing or invalid."
                }
              </p>
            </div>
          ) : resolvedContactId ? (
            <EmailActivityTimeline contactId={resolvedContactId} limit={100} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
