import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../utils/cn'

type StepBtnProps = ComponentPropsWithoutRef<'button'>

/**
 * 24×24 stat stepper button (design-spec §2.10 `stepbtn`): '–'/'+' beside a
 * StatBlock value. Hovers to the sheet `--ground` when present.
 */
export const StepBtn = forwardRef<HTMLButtonElement, StepBtnProps>(function StepBtn(
  { className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-[3px] border-[1.5px] border-ink bg-paper font-body text-[15px] font-bold leading-none text-ink hover:bg-[var(--ground,var(--color-wk-bg-2))] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25 disabled:pointer-events-none disabled:opacity-40',
        className
      )}
      {...props}
    />
  )
})

type MiniBtnProps = ComponentPropsWithoutRef<'button'>

/**
 * Tiny uppercase action button (design-spec §2.10 `minibtn`), e.g. '⇄ Swap'
 * on rail chips.
 */
export const MiniBtn = forwardRef<HTMLButtonElement, MiniBtnProps>(function MiniBtn(
  { className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1 rounded-[2px] border-[1.5px] border-ink bg-paper px-2 py-[3px] font-cond text-[10.5px] font-semibold uppercase leading-none text-ink hover:bg-[var(--ground,var(--color-wk-bg-2))] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25 disabled:pointer-events-none disabled:opacity-40',
        className
      )}
      {...props}
    />
  )
})
