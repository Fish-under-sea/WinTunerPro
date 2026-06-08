import { cn } from '@renderer/lib/cn'

interface SpinnerProps {
  className?: string
  /** 像素尺寸 */
  size?: number
}

/** 旋转加载指示器（纯 CSS 动画，尊重 reduced-motion）。 */
export function Spinner({ className, size = 18 }: SpinnerProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin', className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
