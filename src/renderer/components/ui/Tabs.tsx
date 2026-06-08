import { cn } from '@renderer/lib/cn'
import { Icon } from '@renderer/components/icons'
import type { IconName } from '@renderer/components/icons'

export interface TabItem {
  /** 唯一值 */
  value: string
  /** 显示文案 */
  label: string
  icon?: IconName
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/** 分段标签页（受控），用于页面内视图切换。 */
export function Tabs({ items, value, onChange, className }: TabsProps): React.JSX.Element {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-border bg-surface-2 p-1',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-fast ease-smooth',
              active ? 'bg-surface text-primary shadow-sm' : 'text-text-muted hover:text-text',
            )}
          >
            {item.icon && <Icon name={item.icon} size={15} />}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
