import type { ComponentPropsWithRef, CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from './interaction'

/** The WCAG 2.2 minimum target, square, never shrinking in a flex line. */
const BOX = {
  cursor: 'pointer',
  flex: 'none',
  height: 'var(--space-24)',
  margin: 0,
  width: 'var(--space-24)',
} satisfies CSSProperties

/** The Full Size square a lone check is pressed through (`hitArea`). */
const HIT = {
  alignItems: 'center',
  cursor: 'pointer',
  display: 'flex',
  flexShrink: 0,
  justifyContent: 'center',
  minHeight: 'var(--size-full)',
  minWidth: 'var(--size-full)',
} satisfies CSSProperties

/**
 * A native `<input type="checkbox">` at the one size every check is drawn at
 * (24px, the WCAG 2.2 minimum target) with the focus ring, its tick painted in
 * `accent` (ink by default; a head's own foreground on a tone or ink band).
 * Name it with `aria-label`. A check with no text beside it (a pick row's)
 * takes `hitArea`: a 44px square around it that presses it, so no caller
 * hand-rolls a `<label>` for its hit area (hard rule R16).
 */
export function Checkbox({
  accent = 'var(--color-ink)',
  hitArea = false,
  className,
  style,
  ...props
}: Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  /** The tick's colour (`accent-color`). */
  accent?: string
  /** Press it through a Full Size (44px) square around the box. */
  hitArea?: boolean
}) {
  const box = (
    <input
      type="checkbox"
      className={cn(FOCUS_RING, className)}
      style={{ ...BOX, accentColor: accent, ...style }}
      {...props}
    />
  )
  if (!hitArea) return box
  return (
    <label htmlFor={props.id} style={HIT}>
      {box}
    </label>
  )
}
