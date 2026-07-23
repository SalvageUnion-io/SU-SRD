import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../utils/cn'
import { DISABLED, FOCUS_RING } from './interaction'

type StepButtonProps = ComponentPropsWithoutRef<'button'>

/**
 * 24×24 stat stepper button (design-spec §2.10 `stepbtn`): '–'/'+' beside a
 * StatBlock value. Hovers to the sheet `--ground` when present. Stays visually
 * h-6 w-6 on desktop; `min-h-11 min-w-11 sm:min-h-0 sm:min-w-0` grows the tap
 * area to the 44px touch minimum below `sm` without changing the desktop layout.
 * The accessible name comes from the caller (pass an `aria-label`).
 */
export const StepButton = forwardRef<HTMLButtonElement, StepButtonProps>(function StepButton(
  { className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex h-6 w-6 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-card border-chrome border-ink bg-paper font-body text-lede font-bold leading-none text-ink hover:bg-[var(--ground,var(--color-ink-8))] sm:min-h-0 sm:min-w-0',
        FOCUS_RING,
        DISABLED,
        className
      )}
      {...props}
    />
  )
})
