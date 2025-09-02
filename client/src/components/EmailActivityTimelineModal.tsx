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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Email Activity Timeline</DialogTitle>
          <DialogDescription>
            Detailed activity history for {contactEmail}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {isContactLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : contact?.id ? (
            <EmailActivityTimeline contactId={contact.id} limit={100} />
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">
                Contact not found for {contactEmail}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EmailActivityTimelineModal;
