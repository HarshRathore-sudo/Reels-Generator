import { useEffect, useState } from 'react'
import { useToastStore } from '../../store/toastStore'
import type { ToastItem, ToastType } from '../../store/toastStore'

const TYPE_STYLES: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'bg-green-900/90',
    border: 'border-green-600/50',
    icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  error: {
    bg: 'bg-red-900/90',
    border: 'border-red-600/50',
    icon: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  warning: {
    bg: 'bg-amber-900/90',
    border: 'border-amber-600/50',
    icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  },
  info: {
    bg: 'bg-blue-900/90',
    border: 'border-blue-600/50',
    icon: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
  },
}

const ICON_COLORS: Record<ToastType, string> = {
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-blue-400',
}

/**
 * Global toast container — renders all active toasts.
 * Mount once in App.tsx.
 */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div
      className="fixed bottom-0 right-0 z-[100] p-4 flex flex-col-reverse gap-2 pointer-events-none max-h-[50vh] overflow-hidden"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastNotification key={t.id} toast={t} />
      ))}
    </div>
  )
}

function ToastNotification({ toast: t }: { toast: ToastItem }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  const style = TYPE_STYLES[t.type]
  const iconColor = ICON_COLORS[t.type]

  // Animate in
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleDismiss = () => {
    setIsLeaving(true)
    setTimeout(() => removeToast(t.id), 200)
  }

  return (
    <div
      className={`
        pointer-events-auto max-w-sm w-full
        ${style.bg} ${style.border}
        border rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm
        transition-all duration-200 ease-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}
      `}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <svg
          className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColor}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={style.icon} />
        </svg>

        {/* Message */}
        <p className="text-sm text-white flex-1 leading-snug">{t.message}</p>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="text-white/40 hover:text-white/80 transition-colors flex-shrink-0 -mr-1"
          aria-label="Dismiss notification"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
