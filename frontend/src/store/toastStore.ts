import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastState {
  toasts: ToastItem[]
  addToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
  clearAll: () => void
}

let _toastId = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type = 'info', duration = 4000) => {
    const id = `toast-${++_toastId}-${Date.now()}`
    const toast: ToastItem = { id, message, type, duration }

    set((state) => ({
      toasts: [...state.toasts.slice(-4), toast], // Keep max 5 toasts
    }))

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
    }
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearAll: () => set({ toasts: [] }),
}))

// Convenience functions for use outside React components (e.g. API interceptor)
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'success', duration),
  error: (message: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'error', duration ?? 6000),
  info: (message: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'info', duration),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'warning', duration ?? 5000),
}
