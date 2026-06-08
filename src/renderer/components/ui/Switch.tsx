import { cn } from '@renderer/lib/cn'

interface SwitchProps {
  checked: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  /** 无障碍标签 */
  label?: string
  className?: string
}

/** 开关控件（受控）。用于布尔型优化项的启用/禁用。 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  className,
}: SwitchProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-fast ease-smooth',
        checked ? 'bg-primary' : 'bg-border-strong',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-fast ease-smooth',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
