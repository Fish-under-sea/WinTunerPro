import { cn } from '@renderer/lib/cn'

interface SkeletonProps {
  className?: string
}

/** 骨架屏占位块，用于数据加载中的结构性占位。 */
export function Skeleton({ className }: SkeletonProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-surface-hover',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer',
        'after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent',
        className,
      )}
      aria-hidden="true"
    />
  )
}

/** 多行文本骨架 */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}
