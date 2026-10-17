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

/**
 * A native `<input type="checkbox">` at the one size every check is drawn at
 * (24px, the WCAG 2.2 minimum target) with the focus ring, its tick painted in
 * `accent` (ink by default; a head's own foreground on a tone or ink band).
 * Name it with `aria-label`, or wrap it in a `<label>`.
 */
export function Checkbox({
  accent = 'var(--color-ink)',
  className,
  style,
  ...props
}: Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  /** The tick's colour (`accent-color`). */
  accent?: string
}) {
  return (
    <input
      type="checkbox"
      className={cn(FOCUS_RING, className)}
      style={{ ...BOX, accentColor: accent, ...style }}
      {...props}
    />
  )
}
