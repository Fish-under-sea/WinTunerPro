import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'
import { Icon } from '@renderer/components/icons'
import type { IconName } from '@renderer/components/icons'

interface EmptyStateProps {
  icon?: IconName
  title: string
  description?: string
  /** 操作区（按钮等） */
  action?: ReactNode
  className?: string
}

/** 空状态占位：无数据时的友好提示与引导操作。 */
export function EmptyState({
  icon = 'list',
  title,
  description,
  action,
  className,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-text-subtle">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-text">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
