import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * App-level toast messages that any screen can raise. Kept tiny on purpose.
 */
export interface ToastMessage {
  id: number;
  text: string;
  action?: { label: string; onClick: () => void };
  /** On its way out: plays the exit animation before it is removed */
  leaving?: boolean;
}

interface UiApi {
  toast: (text: string, action?: ToastMessage['action']) => void;
  dismissToast: (id: number) => void;
  toasts: ToastMessage[];
}

const UiContext = createContext<UiApi | null>(null);
const TOAST_MS = 4600;
/** Matches the exit animation in Toaster.module.css */
const LEAVE_MS = 260;

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const seq = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), LEAVE_MS);
  }, []);
  const toast = useCallback(
    (text: string, action?: ToastMessage['action']) => {
      const id = ++seq.current;
      // one message at a time reads calmer than a stack; the newest wins
      setToasts([{ id, text, action }]);
      window.setTimeout(() => dismissToast(id), TOAST_MS);
    },
    [dismissToast],
  );

  const api = useMemo(() => ({ toast, dismissToast, toasts }), [toast, dismissToast, toasts]);
  return <UiContext.Provider value={api}>{children}</UiContext.Provider>;
}

export function useUi(): UiApi {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside UiProvider');
  return ctx;
}
