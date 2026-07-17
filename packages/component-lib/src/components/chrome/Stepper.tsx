import { cn } from '../../utils/cn'

type StepperProps = {
  /** Ordered step labels, e.g. ['Class', 'Abilities', 'Equipment', …] */
  steps: string[]
  /** Index of the active step */
  active: number
  /** When provided, completed steps are clickable to navigate back */
  onStepClick?: (index: number) => void
  className?: string
}

/**
 * Vertical wizard nav rail (design-spec §2.9 `.stepper`): zero-padded step
 * numbers, done steps in ink, active step bold with wk-bg-2 ground + inset
 * 3px rust bar.
 */
export function Stepper({ steps, active, onStepClick, className }: StepperProps) {
  return (
    <nav aria-label="Steps" className={cn('flex flex-col gap-[3px]', className)}>
      {steps.map((step, i) => {
        const isDone = i < active
        const isActive = i === active
        const clickable = !!onStepClick && isDone
        return (
          <button
            key={step}
            type="button"
            disabled={!clickable && !isActive}
            aria-current={isActive ? 'step' : undefined}
            onClick={clickable ? () => onStepClick(i) : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-card px-3 py-[7px] text-left font-body text-sm disabled:pointer-events-none',
              isActive
                ? 'bg-wk-bg-2 font-bold text-ink shadow-[inset_3px_0_0_var(--color-rust)]'
                : isDone
                  ? 'text-ink'
                  : 'text-wk-muted',
              clickable && 'cursor-pointer hover:bg-wk-bg-2/60'
            )}
          >
            <span className="w-[18px] shrink-0 font-cond font-bold">
              {String(i + 1).padStart(2, '0')}
            </span>
            {step}
          </button>
        )
      })}
    </nav>
  )
}
