import { cn } from '@renderer/lib/cn'
import { Icon } from '@renderer/components/icons'
import { Button } from './Button'

interface ErrorStateProps {
  /** 「人话」错误描述 */
  message?: string
  /** 重试回调 */
  onRetry?: () => void
  /** 跳过回调（可选） */
  onSkip?: () => void
  className?: string
  /** 紧凑模式（用于卡片内联） */
  compact?: boolean
}

/**
 * 错误态展示：人话提示 + 「重试 / 跳过」操作。
 * 用于读取失败、写操作失败等场景，保证失败不崩、可恢复。
 */
export function ErrorState({
  message = '操作失败了，请稍后重试。',
  onRetry,
  onSkip,
  className,
  compact = false,
}: ErrorStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-12',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <Icon name="alert" size={24} />
      </span>
      <p className="mt-3 max-w-md text-sm font-medium text-text">{message}</p>
      {(onRetry || onSkip) && (
        <div className="mt-4 flex items-center gap-2">
          {onRetry && (
            <Button size="sm" variant="primary" leftIcon="refresh" onClick={onRetry}>
              重试
            </Button>
          )}
          {onSkip && (
            <Button size="sm" variant="ghost" onClick={onSkip}>
              跳过
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
