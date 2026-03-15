import { toast as sonnerToast } from "sonner"

type ToastProps = {
  title?: string
  description?: string
  variant?: "default" | "destructive"
  duration?: number
}

function toast({ title, description, variant, duration = 4000 }: ToastProps) {
  if (variant === "destructive") {
    return sonnerToast.error(title, { description, duration })
  }
  return sonnerToast.success(title, { description, duration })
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    toasts: [],
  }
}

export { useToast, toast }
