import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

export interface TableColumn<T> {
  /** 表头文案 */
  header: string
  /** 单元格渲染 */
  cell: (row: T, index: number) => ReactNode
  /** 列宽 className（如 w-32） */
  className?: string
  /** 右对齐（数值列常用） */
  align?: 'left' | 'right' | 'center'
}

interface TableProps<T> {
  columns: TableColumn<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  className?: string
}

const ALIGN: Record<NonNullable<TableColumn<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

/** 轻量数据表格：浅色表头、行悬浮高亮、零边框分隔线风格。 */
export function Table<T>({ columns, rows, rowKey, className }: TableProps<T>): React.JSX.Element {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface-2">
            {columns.map((col, i) => (
              <th
                key={i}
                className={cn(
                  'px-4 py-2.5 text-xs font-semibold text-text-muted',
                  ALIGN[col.align ?? 'left'],
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              className="border-t border-border transition-colors duration-fast hover:bg-surface-hover"
            >
              {columns.map((col, i) => (
                <td
                  key={i}
                  className={cn('px-4 py-3 text-text', ALIGN[col.align ?? 'left'], col.className)}
                >
                  {col.cell(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
