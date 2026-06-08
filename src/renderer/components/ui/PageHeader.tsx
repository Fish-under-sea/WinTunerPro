import type { ReactNode } from 'react'
import { Icon } from '@renderer/components/icons'
import type { IconName } from '@renderer/components/icons'

interface PageHeaderProps {
  /** 页面标题 */
  title: string
  /** 标题图标 */
  icon?: IconName
  /** 副标题说明 */
  description?: string
  /** 右侧操作区 */
  action?: ReactNode
}

/** 页面顶部标题栏，统一各页面的标题排版与操作位。 */
export function PageHeader({
  title,
  icon,
  description,
  action,
}: PageHeaderProps): React.JSX.Element {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Icon name={icon} size={22} />
          </span>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
