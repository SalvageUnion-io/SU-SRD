/**
 * The two bare text-entry primitives, in a LEAF module.
 *
 * They live apart from `Field.tsx`, whose edit state draws them, so no
 * importer of either is ever in an import cycle. Cycles are worse here than in
 * most codebases: srd's SSR pass evaluates this TypeScript under Bun with no
 * bundler in the loop, where cyclic module initialisation is TDZ-sensitive and
 * depends on evaluation order.
 *
 * Their skin is the `.su-text-input` class (`styles/partials/atoms-fields.css`), all of it: callers
 * restyle both by className and by `style`.
 *
 * ## Both are 16px, and that is a functional requirement
 *
 * iOS Safari zooms the viewport whenever a focused form control renders below
 * 16px. These were 14px, so every tap into a field on an iPhone
 * yanked the page — on the live sheets, that is most of the app's input. The
 * rung is therefore not a typographic preference and should not be tuned down
 * to match a neighbouring label; a control the user types into is the one place
 * the type ladder has a hard floor.
 */

import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/cn'
import { INPUT_FOCUS } from './interaction'

type InputProps = Omit<ComponentPropsWithRef<'input'>, 'size'> & {
  /**
   * The Size (`styles/sizing.ts`) of the line it sits on: Full (the default, a
   * page's field) or Compact (beside a sheet's Compact buttons). Its height is
   * that Size's token, so it matches them.
   */
  size?: 'full' | 'compact'
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
export function Input({ className, numeric = false, size = 'full', ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      className={cn(
        'su-text-input',
        size === 'compact' && 'su-text-input--compact',
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
 * `Field`-wrappable exactly like `Input`; a multiline `Field`'s edit state
 * opens into one.
 */
export function Textarea({ className, rows = 3, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn('su-text-input su-textarea', INPUT_FOCUS, className)}
      {...props}
    />
  )
}
