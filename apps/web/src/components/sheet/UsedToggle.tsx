import type { CSSProperties } from 'react'
import { Button, tokens } from '../index'

/** The used pip: a hollow chip in the control's current colour. */
const PIP = {
  border: `${tokens.borderWidth.pill} solid currentColor`,
  borderRadius: tokens.radius.badge,
  display: 'inline-block',
  flexShrink: 0,
  height: '12px',
  width: '16px',
} satisfies CSSProperties

/** Set: the pip fills with the sheet's tone. */
const PIP_SET = {
  backgroundColor: 'var(--tone, var(--color-pilot))',
  borderColor: 'var(--tone, var(--color-pilot))',
} satisfies CSSProperties

/**
 * The pip that carries a once-per-something flag: hollow while it is free,
 * filled with the sheet's tone once it is used. `UsedToggle` leads with it,
 * and a read-only sheet's static "Used" stamp wears it too.
 */
export function UsedPip({ used }: { used: boolean }) {
  return <span aria-hidden="true" style={used ? { ...PIP, ...PIP_SET } : PIP} />
}

/**
 * "Mark used" — the one toggle for a once-per-Downtime or once-per-scene
 * flag: a pilot's Motto, Keepsake and Background, and an ability's Used.
 *
 * A pencil `Button` (dashed means editable) reading "Used", led by the pip.
 * Its words never change, so a line's shape stays put; the state is the pip
 * (filled with the sheet's tone) and the pressed plate (ink, as every pressed
 * pencil control is). `aria-pressed` carries it to assistive tech, and the
 * caller's `aria-label` names the action ("Mark motto used", "Recharge Hack").
 */
export function UsedToggle({
  used,
  onToggle,
  'aria-label': ariaLabel,
  size = 'compact',
  className,
}: {
  used: boolean
  onToggle: (next: boolean) => void
  /** What pressing it does, in the current state. */
  'aria-label': string
  /** The Size of the line it rides: `mini` beside a field's label, `compact` on an item's line. */
  size?: 'compact' | 'mini'
  className?: string
}) {
  return (
    <Button
      variant="pencil"
      size={size}
      aria-pressed={used}
      aria-label={ariaLabel}
      className={className}
      glyph={<UsedPip used={used} />}
      onClick={() => onToggle(!used)}
    >
      Used
    </Button>
  )
}
