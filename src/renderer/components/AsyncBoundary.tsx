import type { ReactNode } from 'react'
import { ErrorState } from '@renderer/components/ui'

interface AsyncBoundaryProps {
  /** 是否处于「首次加载中」（loading 且无数据） */
  loading: boolean
  /** 错误文案（无错误为 null） */
  error: string | null
  /** 重试回调 */
  onRetry?: () => void
  /** 加载中展示的骨架屏 */
  skeleton?: ReactNode
  children: ReactNode
}

/**
 * 异步数据边界：统一处理只读数据的「加载中 / 失败 / 成功」三态。
 * 失败时展示人话错误 + 重试；加载中展示骨架；否则渲染内容。
 */
export function AsyncBoundary({
  loading,
  error,
  onRetry,
  skeleton,
  children,
}: AsyncBoundaryProps): React.JSX.Element {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} compact />
  }
  if (loading) {
    return <>{skeleton}</>
  }
  return <>{children}</>
}
