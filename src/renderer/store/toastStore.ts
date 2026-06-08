import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  tone: ToastTone
  title: string
  description?: string
}

interface ToastState {
  toasts: ToastItem[]
  /** 推送一条 toast，返回其 id */
  push: (toast: Omit<ToastItem, 'id'>) => string
  /** 移除指定 toast */
  dismiss: (id: string) => void
}

let seq = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `toast-${Date.now()}-${seq++}`
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    // 自动消失（错误停留更久，便于阅读）
    const timeout = toast.tone === 'error' ? 5000 : 3200
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, timeout)
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** 便捷调用封装：在任意位置 toast.success(...) 即可。 */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'success', title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'error', title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'info', title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'warning', title, description }),
}
