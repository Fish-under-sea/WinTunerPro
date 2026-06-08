import { cn } from '@renderer/lib/cn'

type ProgressTone = 'primary' | 'success' | 'warning' | 'danger'

interface ProgressProps {
  /** 进度值 0–100 */
  value: number
  tone?: ProgressTone
  /** 不确定进度（持续滚动条纹） */
  indeterminate?: boolean
  className?: string
}

const TONES: Record<ProgressTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

/** 线性进度条，支持确定/不确定两种模式。 */
export function Progress({
  value,
  tone = 'primary',
  indeterminate = false,
  className,
}: ProgressProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-hover', className)}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {indeterminate ? (
        <div className={cn('relative h-full w-2/5 rounded-full', TONES[tone])}>
          <div className="absolute inset-0 animate-[shimmer_1.2s_infinite] rounded-full bg-white/30" />
        </div>
      ) : (
        <div
          className={cn('h-full rounded-full transition-all duration-slow ease-out', TONES[tone])}
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  )
}
