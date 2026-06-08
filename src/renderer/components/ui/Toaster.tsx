import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useToastStore } from '@renderer/store/toastStore'
import type { ToastTone } from '@renderer/store/toastStore'
import { cn } from '@renderer/lib/cn'
import { Icon } from '@renderer/components/icons'
import type { IconName } from '@renderer/components/icons'

const TONE_META: Record<ToastTone, { icon: IconName; ring: string; iconColor: string }> = {
  success: { icon: 'checkCircle', ring: 'border-l-success', iconColor: 'text-success' },
  error: { icon: 'alert', ring: 'border-l-danger', iconColor: 'text-danger' },
  warning: { icon: 'shieldAlert', ring: 'border-l-warning', iconColor: 'text-warning' },
  info: { icon: 'info', ring: 'border-l-primary', iconColor: 'text-primary' },
}

/** 全局 Toast 容器：右下角堆叠，监听 toastStore，挂载于 MainLayout。 */
export function Toaster(): React.JSX.Element {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return createPortal(
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-80 flex-col gap-2.5">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const meta = TONE_META[t.tone]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border border-border border-l-4 bg-surface p-3.5 shadow-lg',
                meta.ring,
              )}
            >
              <Icon name={meta.icon} size={20} className={cn('mt-0.5 shrink-0', meta.iconColor)} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text">{t.title}</div>
                {t.description && (
                  <div className="mt-0.5 text-xs leading-relaxed text-text-muted">
                    {t.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="关闭通知"
                className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-surface-hover hover:text-text"
              >
                <Icon name="x" size={15} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>,
    document.body,
  )
}
