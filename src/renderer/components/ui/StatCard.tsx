import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'
import { Icon } from '@renderer/components/icons'
import type { IconName } from '@renderer/components/icons'
import { Card } from './Card'

type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

interface StatCardProps {
  /** 指标名称 */
  label: string
  /** 指标主值 */
  value: ReactNode
  /** 图标 */
  icon?: IconName
  /** 图标配色 */
  tone?: StatTone
  /** 辅助说明（值下方小字） */
  hint?: ReactNode
  className?: string
}

const ICON_TONES: Record<StatTone, string> = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-surface-2 text-text-muted',
}

/** 指标统计卡：图标 + 名称 + 主值 + 辅助说明。 */
export function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
  hint,
  className,
}: StatCardProps): React.JSX.Element {
  return (
    <Card className={cn('flex items-start gap-4', className)}>
      {icon && (
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            ICON_TONES[tone],
          )}
        >
          <Icon name={icon} size={22} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-text-muted">{label}</div>
        <div
          className="mt-1 truncate text-lg font-semibold text-text"
          title={typeof value === 'string' ? value : undefined}
        >
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-text-subtle">{hint}</div>}
      </div>
    </Card>
  )
}
