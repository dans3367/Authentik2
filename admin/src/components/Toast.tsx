import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  /** controls the CSS enter/exit transition */
  visible: boolean;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({ success: () => {}, error: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const DISPLAY_MS = 3500;
const EXIT_MS = 300;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    // start exit transition
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false } : t)));
    // remove from DOM after transition
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), EXIT_MS);
  }, []);

  const add = useCallback(
    (type: ToastType, message: string) => {
      const id = ++counter.current;
      // Insert as invisible, then flip to visible on next tick to trigger transition
      setToasts((prev) => [...prev, { id, type, message, visible: false }]);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: true } : t)));
        });
      });
      setTimeout(() => dismiss(id), DISPLAY_MS);
    },
    [dismiss]
  );

  const success = useCallback((message: string) => add('success', message), [add]);
  const error = useCallback((message: string) => add('error', message), [add]);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const isSuccess = toast.type === 'success';

  return (
    <div
      style={{
        transition: `opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms ease`,
        opacity: toast.visible ? 1 : 0,
        transform: toast.visible ? 'translateY(0)' : 'translateY(-8px)',
      }}
      className={`pointer-events-auto flex items-center gap-3 pl-4 pr-3 py-3 rounded-lg shadow-lg border text-sm font-medium min-w-[280px] max-w-sm ${
        isSuccess
          ? 'bg-white border-green-200 text-gray-800'
          : 'bg-white border-red-200 text-gray-800'
      }`}
    >
      {isSuccess ? (
        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
      )}
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-400 hover:text-gray-600 transition-colors ml-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
