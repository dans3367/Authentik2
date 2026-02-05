import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { getCustomerName, formatDateTime, type AppointmentWithCustomer } from "@/utils/appointment-utils";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithCustomer | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  appointment,
  onConfirm,
  isDeleting,
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Appointment
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this appointment? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {appointment && (
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <p className="font-medium">{appointment.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {getCustomerName(appointment.customer)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {formatDateTime(appointment.appointmentDate)}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteConfirmDialog;
