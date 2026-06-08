import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

export interface InfoRow {
  label: string
  value: ReactNode
}

interface InfoListProps {
  rows: InfoRow[]
  /** 列数：1 列（窄卡片）或 2 列（宽卡片） */
  columns?: 1 | 2
  className?: string
}

/** 键值信息列表，用于设备/系统等只读信息的整齐展示。 */
export function InfoList({ rows, columns = 1, className }: InfoListProps): React.JSX.Element {
  return (
    <dl
      className={cn(
        'grid gap-x-8 gap-y-3.5',
        columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1',
        className,
      )}
    >
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4">
          <dt className="shrink-0 text-sm text-text-muted">{row.label}</dt>
          <dd className="min-w-0 text-right text-sm font-medium text-text">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
