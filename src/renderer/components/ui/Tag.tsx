import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'
import { Icon } from '@renderer/components/icons'
import type { IconName } from '@renderer/components/icons'

export type TagTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

interface TagProps {
  tone?: TagTone
  icon?: IconName
  /** 是否带左侧圆点指示 */
  dot?: boolean
  className?: string
  children: ReactNode
}

const TONES: Record<TagTone, string> = {
  neutral: 'bg-surface-2 text-text-muted border-border',
  primary: 'bg-primary-soft text-primary border-sky-200',
  success: 'bg-success-soft text-success border-green-200',
  warning: 'bg-warning-soft text-warning border-amber-200',
  danger: 'bg-danger-soft text-danger border-red-200',
}

const DOT_COLORS: Record<TagTone, string> = {
  neutral: 'bg-text-subtle',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

/** 状态标签 / 徽标，用于呈现状态、分类、计数等。 */
export function Tag({
  tone = 'neutral',
  icon,
  dot,
  className,
  children,
}: TagProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOT_COLORS[tone])} />}
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  )
}
