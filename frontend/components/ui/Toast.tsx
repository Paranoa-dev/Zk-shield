'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id:       string
  kind:     ToastKind
  title:    string
  message?: string
  duration?: number
}

interface ToastContextType {
  toasts:  Toast[]
  success: (title: string, message?: string) => void
  error:   (title: string, message?: string) => void
  info:    (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  dismiss: (id: string) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType>({
  toasts:  [],
  success: () => {},
  error:   () => {},
  info:    () => {},
  warning: () => {},
  dismiss: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((kind: ToastKind, title: string, message?: string, duration = 4500) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev.slice(-4), { id, kind, title, message, duration }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{
      toasts,
      success: (t, m) => add('success', t, m),
      error:   (t, m) => add('error',   t, m, 6000),
      info:    (t, m) => add('info',    t, m),
      warning: (t, m) => add('warning', t, m, 5500),
      dismiss,
    }}>
      {children}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

// ─── Icons / colours ──────────────────────────────────────────────────────────

const ICONS: Record<ToastKind, string> = {
  success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️',
}
const WRAP: Record<ToastKind, string> = {
  success: 'border-emerald-200 bg-emerald-50',
  error:   'border-red-200 bg-red-50',
  info:    'border-blue-200 bg-blue-50',
  warning: 'border-amber-200 bg-amber-50',
}
const TITLE_C: Record<ToastKind, string> = {
  success: 'text-emerald-900', error: 'text-red-900',
  info: 'text-blue-900',       warning: 'text-amber-900',
}
const MSG_C: Record<ToastKind, string> = {
  success: 'text-emerald-700', error: 'text-red-700',
  info: 'text-blue-700',       warning: 'text-amber-700',
}

// ─── Single toast ─────────────────────────────────────────────────────────────

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), toast.duration ?? 4500)
    return () => clearTimeout(t)
  }, [toast, dismiss])

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-slide-up max-w-sm w-full ${WRAP[toast.kind]}`} role="alert">
      <span className="text-lg flex-shrink-0 mt-0.5">{ICONS[toast.kind]}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${TITLE_C[toast.kind]}`}>{toast.title}</p>
        {toast.message && (
          <p className={`text-xs mt-0.5 leading-relaxed break-words ${MSG_C[toast.kind]}`}>{toast.message}</p>
        )}
      </div>
      <button onClick={() => dismiss(toast.id)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 text-xl leading-none transition-colors" aria-label="Dismiss">×</button>
    </div>
  )
}

// ─── Stack ────────────────────────────────────────────────────────────────────

function ToastStack({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} dismiss={dismiss} />)}
    </div>
  )
}
