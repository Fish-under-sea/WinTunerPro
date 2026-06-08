import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'
import { Icon } from '@renderer/components/icons'
import type { IconName } from '@renderer/components/icons'
import { Card } from './Card'

interface SectionCardProps {
  /** 区块标题 */
  title: string
  /** 副标题/说明 */
  description?: ReactNode
  /** 标题左侧图标 */
  icon?: IconName
  /** 标题右侧操作区（按钮等） */
  action?: ReactNode
  className?: string
  bodyClassName?: string
  children?: ReactNode
}

/** 带标题栏的内容区块卡片，用于页面内的功能分组。 */
export function SectionCard({
  title,
  description,
  icon,
  action,
  className,
  bodyClassName,
  children,
}: SectionCardProps): React.JSX.Element {
  return (
    <Card padding="none" className={cn('overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          {icon && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Icon name={icon} size={18} />
            </span>
          )}
          <div>
            <h3 className="text-sm font-semibold text-text">{title}</h3>
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </Card>
  )
}
