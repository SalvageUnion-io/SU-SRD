import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../utils/cn'

/**
 * `Toggle` — the BARE boolean switch, for a control that already sits inside a
 * framed row.
 *
 * The sibling of `Checkbox`/`Radio`, not a replacement: those are the *form*
 * vocabulary — a self-framed choice-row card (`rounded-card border-chrome
 * border-ink bg-paper`) wrapping a native input, for a standalone question in a
 * form. This is the *instrument* vocabulary — a switch and nothing else, no card
 * of its own, for a row that is already bordered and already carries its own
 * label (the dial-config list, a settings row, an inline show/hide).
 *
 * Dropping `Checkbox` into such a row nests a bordered card inside a bordered
 * row and swaps the condensed instrument label for body text; that is exactly
 * why the dial config had been holding a native `<input>` open-coded instead.
 * This is the missing rung, so those callsites can stop reaching for the raw
 * element — and with it the browser's default accent blue, the one colour with
 * no place in a paper/ink/rust palette.
 *
 * A real `<input type="checkbox" role="switch">` carries the semantics: the
 * whole thing is a `<label>`, so pointer targets and screen-reader naming come
 * from the platform, and `role="switch"` makes assistive tech announce on/off
 * rather than checked/unchecked.
 */

type ToggleProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'role' | 'children'> & {
  /**
   * Accessible name. A bare switch has no text of its own, so this is required
   * even when the visible label lives elsewhere in the row.
   */
  label: string
  /**
   * Render `label` as visible text after the switch. Off by default: the
   * instrument rows this is built for label themselves.
   */
  showLabel?: boolean
}

/*
 * The knob lives INSIDE the track, so it is a descendant of the input's sibling
 * rather than a sibling itself — `peer-checked:` alone (a `~` combinator) cannot
 * reach it. Every knob state is therefore expressed on the track as a child
 * variant, which compiles to `.peer:checked ~ .track > span`. Same reason the
 * disabled+checked pair is one arbitrary variant rather than two chained peer
 * variants: chaining would emit two `~` hops and match nothing.
 */

/** Track: paper with an ink hairline when off, solid rust when on. */
const TRACK = cn(
  'relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full',
  'border-chrome border-ink bg-paper',
  'transition-colors duration-150 motion-reduce:transition-none',
  'peer-checked:border-rust peer-checked:bg-rust',
  'peer-focus-visible:ring-[3px] peer-focus-visible:ring-rust/25',
  // Knob position + colour, driven from the track.
  'peer-checked:[&>span]:translate-x-[14px] peer-checked:[&>span]:bg-paper',
  // Disabled reads as *drained*, not merely faded. A blanket opacity on a
  // filled control leaves a pastel tint that looks like an enabled variant
  // nobody recognises rather than an off control — so the track empties out
  // instead, on both the on and off sides.
  'peer-disabled:border-ink-30 peer-disabled:bg-ink-8',
  'peer-disabled:[&>span]:bg-ink-30',
  'peer-[:disabled:checked]:border-ink-30 peer-[:disabled:checked]:bg-ink-30',
  'peer-[:disabled:checked]:[&>span]:bg-paper'
)

/** Knob: ink dot on the paper track; the track flips it to paper when on. */
const KNOB = cn(
  'pointer-events-none absolute left-[2px] h-[12px] w-[12px] rounded-full bg-ink',
  'transition-transform duration-150 will-change-transform',
  'motion-reduce:transition-none'
)

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(function Toggle(
  { label, showLabel = false, className, disabled, ...props },
  ref
) {
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        disabled={disabled}
        aria-label={showLabel ? undefined : label}
        className="peer sr-only"
        {...props}
      />
      <span className={TRACK} aria-hidden="true">
        <span className={KNOB} />
      </span>
      {showLabel && <span className="font-body text-sm font-medium text-ink">{label}</span>}
    </label>
  )
})
