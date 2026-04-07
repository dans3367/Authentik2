import { Toaster as SonnerToaster, toast } from "sonner"
import { useEffect } from "react"
import { useTheme } from "@/contexts/ThemeContext"

function ClickToDismiss() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const toastEl = (e.target as HTMLElement).closest('[data-sonner-toast]')
      if (toastEl) {
        const id = toastEl.getAttribute('data-sonner-toast')
        if (id) toast.dismiss(id)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])
  return null
}

export function Toaster() {
  const { theme } = useTheme();
  return (
    <>
      <ClickToDismiss />
      <SonnerToaster
        position="top-center"
        theme={theme}
        style={{ zIndex: 2147483647 }}
        toastOptions={{
          duration: 4000,
          className: "font-sans border border-border bg-background text-foreground shadow-lg rounded-lg cursor-pointer",
        }}
      />
    </>
  )
}
