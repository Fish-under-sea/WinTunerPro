import type { HTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 开启悬浮抬升效果（用于可点击卡片） */
  interactive?: boolean
  /** 内边距档位 */
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

/** 基础卡片容器：白底、圆角、轻投影、可选悬浮态。 */
export function Card({
  interactive = false,
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-surface shadow-card transition-all duration-base ease-smooth',
        interactive &&
          'cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover hover:border-border-strong',
        PADDING[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
