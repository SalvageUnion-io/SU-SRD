/**
 * The two bare text-entry primitives, in a LEAF module.
 *
 * They lived in `Field.tsx`, which imports `InlineEditField`, which imports
 * them back — a two-node runtime import cycle (both edges are value imports,
 * not types). Cycles are worse here than in most codebases: srd's SSR pass
 * evaluates this TypeScript under Bun with no bundler in the loop, where cyclic
 * module initialisation is TDZ-sensitive and depends on evaluation order.
 *
 * Nothing else changes — `Field.tsx` re-exports both, so every existing import
 * still resolves and no rendered markup moves.
 *
 * ## Both are `text-base`, and that is a functional requirement
 *
 * iOS Safari zooms the viewport whenever a focused form control renders below
 * 16px. These were `text-sm` (14px), so every tap into a field on an iPhone
 * yanked the page — on the live sheets, that is most of the app's input. The
 * rung is therefore not a typographic preference and should not be tuned down
 * to match a neighbouring label; a control the user types into is the one place
 * the type ladder has a hard floor.
 */

import type { ComponentPropsWithoutRef } from 'react'
import { forwardRef } from 'react'
import { cn } from '../../utils/cn'
import { INPUT_FOCUS } from './interaction'

type InputProps = ComponentPropsWithoutRef<'input'>

/**
 * Text input (design-spec §2.5 `.input`): paper bg, 1.5px ink border, 3px
 * radius, rust focus ring (no outline).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-card border-chrome border-ink bg-paper px-3 py-2.5 font-body text-base text-ink placeholder:text-wk-muted',
        INPUT_FOCUS,
        className
      )}
      {...props}
    />
  )
})

type TextareaProps = ComponentPropsWithoutRef<'textarea'>

/**
 * Multiline text input (design-spec §2.5): the `Input` sibling — identical
 * paper / 1.5px-ink / 3px-radius / rust-ring skin, with vertical resize.
 * `Field`-wrappable exactly like `Input`. Distinct from `InlineEditField`'s
 * internal textarea (that one is a click-to-edit control, this is a plain field).
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 3, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full resize-y rounded-card border-chrome border-ink bg-paper px-3 py-2.5 font-body text-base text-ink placeholder:text-wk-muted',
        INPUT_FOCUS,
        className
      )}
      {...props}
    />
  )
})
