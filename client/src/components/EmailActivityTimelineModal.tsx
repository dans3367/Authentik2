import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import EmailActivityTimeline from "./EmailActivityTimeline";

interface EmailActivityTimelineModalProps {
  contactEmail: string;
  trigger: React.ReactNode;
}

export function EmailActivityTimelineModal({ contactEmail, trigger }: EmailActivityTimelineModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Find the contact ID by email when modal is opened
  const { data: contactData, isLoading: isContactLoading } = useQuery({
    queryKey: ['/api/email-contacts', 'by-email', contactEmail],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/email-contacts?search=${encodeURIComponent(contactEmail)}&limit=1`);
      return response.json();
    },
    enabled: isOpen && !!contactEmail,
  });

  const contact = contactData?.contacts?.[0];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-4xl h-[90vh] sm:h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 shrink-0">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                <span className="text-base sm:text-lg font-semibold">Email Activity Timeline</span>
                <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="truncate">{displayName}</span>
                </div>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Complete email engagement history showing all opens, clicks, bounces, and other activities for this contact
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {isLookingUpContact ? (
            <div className="space-y-4 p-3 sm:p-6">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-primary"></div>
                Looking up contact information...
              </div>
              <Skeleton className="h-24 sm:h-32 w-full" />
              <Skeleton className="h-24 sm:h-32 w-full" />
            </div>
          ) : contactError || (!resolvedContactId && contactEmail) ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center px-4">
              <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">
                Contact Not Found
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
                {contactEmail ? 
                  `The email address "${contactEmail}" was not found in your contacts list.` :
                  "Contact information is missing or invalid."
                }
              </p>
            </div>
          ) : (
            <EmailActivityTimeline contactId={contact?.id} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EmailActivityTimelineModal;
