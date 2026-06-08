import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@renderer/lib/cn'
import { popVariants } from '@renderer/lib/motion'
import { Icon } from '@renderer/components/icons'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  /** 底部操作区（按钮等） */
  footer?: ReactNode
  /** 最大宽度档位 */
  size?: 'sm' | 'md' | 'lg'
  children?: ReactNode
}

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' } as const

/** 居中模态框：遮罩 + 卡片，带缩放淡入动效，Esc 与点击遮罩关闭。 */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  children,
}: ModalProps): React.JSX.Element {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={popVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            className={cn(
              'relative z-10 w-full rounded-2xl border border-border bg-surface shadow-lg',
              SIZES[size],
            )}
          >
            {(title || description) && (
              <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
                <div>
                  {title && <h2 className="text-base font-semibold text-text">{title}</h2>}
                  {description && (
                    <p className="mt-1 text-sm leading-relaxed text-text-muted">{description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="关闭"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
            )}
            {children && <div className="px-6 py-5">{children}</div>}
            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
