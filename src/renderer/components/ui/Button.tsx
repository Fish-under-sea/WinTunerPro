import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'
import { Icon } from '@renderer/components/icons'
import type { IconName } from '@renderer/components/icons'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** 左侧图标 */
  leftIcon?: IconName
  /** 右侧图标 */
  rightIcon?: IconName
  /** 加载态：禁用交互并显示 spinner */
  loading?: boolean
  /** 撑满父容器宽度 */
  block?: boolean
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-contrast shadow-primary hover:bg-primary-hover active:bg-primary-hover',
  secondary: 'bg-primary-soft text-primary hover:bg-sky-200/70 active:bg-sky-200',
  outline:
    'border border-border-strong bg-surface text-text hover:bg-surface-hover hover:border-border-strong',
  ghost: 'text-text-muted hover:bg-surface-hover hover:text-text',
  danger: 'bg-danger text-white hover:bg-red-700 active:bg-red-700',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-base gap-2 rounded-lg',
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 15, md: 17, lg: 19 }

/** 主操作按钮。支持 5 种变体、3 种尺寸、加载态与左右图标。 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    leftIcon,
    rightIcon,
    loading = false,
    block = false,
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-fast ease-smooth',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        !isDisabled && 'cursor-pointer',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner size={ICON_SIZE[size]} />
      ) : (
        leftIcon && <Icon name={leftIcon} size={ICON_SIZE[size]} />
      )}
      {children}
      {!loading && rightIcon && <Icon name={rightIcon} size={ICON_SIZE[size]} />}
    </button>
  )
})
