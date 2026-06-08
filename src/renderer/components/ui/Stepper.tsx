import { cn } from '@renderer/lib/cn'
import { Icon } from '@renderer/components/icons'

export interface StepItem {
  /** 步骤标题 */
  title: string
  /** 步骤说明 */
  description?: string
}

interface StepperProps {
  steps: StepItem[]
  /** 当前步骤索引（0 起） */
  current: number
  className?: string
}

/** 横向分步指示器，用于向导式流程（如系统重装）。 */
export function Stepper({ steps, current, className }: StepperProps): React.JSX.Element {
  return (
    <ol className={cn('flex items-center', className)}>
      {steps.map((step, index) => {
        const done = index < current
        const active = index === current
        const last = index === steps.length - 1
        return (
          <li key={step.title} className={cn('flex items-center', !last && 'flex-1')}>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors duration-base',
                  done && 'border-primary bg-primary text-primary-contrast',
                  active && 'border-primary bg-primary-soft text-primary',
                  !done && !active && 'border-border-strong bg-surface text-text-subtle',
                )}
              >
                {done ? <Icon name="check" size={16} /> : index + 1}
              </span>
              <div className="hidden sm:block">
                <div
                  className={cn(
                    'text-sm font-medium',
                    active || done ? 'text-text' : 'text-text-subtle',
                  )}
                >
                  {step.title}
                </div>
                {step.description && (
                  <div className="text-xs text-text-muted">{step.description}</div>
                )}
              </div>
            </div>
            {!last && (
              <div
                className={cn(
                  'mx-3 h-0.5 flex-1 rounded-full transition-colors duration-base',
                  done ? 'bg-primary' : 'bg-border-strong',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
