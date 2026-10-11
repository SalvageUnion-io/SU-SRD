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

import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../utils/cn'
import { INPUT_FOCUS } from './interaction'

type InputProps = ComponentPropsWithRef<'input'> & {
  /**
   * Integer-only field: opens the digit keypad on phones by setting
   * `inputMode="numeric"`, `pattern="[0-9]*"` and `enterKeyHint="done"`.
   * `pattern` is the legacy iOS keypad hint and does not validate
   * `type="number"`; keep `type="number"` for min/max/step.
   */
  numeric?: boolean
}

const NUMERIC_KEYPAD = { inputMode: 'numeric', pattern: '[0-9]*', enterKeyHint: 'done' } as const

/**
 * Text input (design-spec §2.5 `.input`): paper bg, 1.5px ink border, 3px
 * radius, the focus ring (no outline).
 */
export function Input({ className, numeric = false, ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-card border-chrome border-ink bg-paper px-3 py-2.5 font-body text-base text-ink placeholder:text-wk-muted',
        INPUT_FOCUS,
        className
      )}
      // Before `props`, so an explicit inputMode/pattern/enterKeyHint wins.
      {...(numeric ? NUMERIC_KEYPAD : {})}
      {...props}
    />
  )
}

type TextareaProps = ComponentPropsWithRef<'textarea'>

/**
 * Multiline text input (design-spec §2.5): the `Input` sibling — identical
 * paper / 1.5px-ink / 3px-radius / focus-ring skin, with vertical resize.
 * `Field`-wrappable exactly like `Input`. Distinct from `InlineEditField`'s
 * internal textarea (that one is a click-to-edit control, this is a plain field).
 */
export function Textarea({ className, rows = 3, ref, ...props }: TextareaProps) {
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
}
