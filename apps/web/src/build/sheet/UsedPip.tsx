import type { CSSProperties } from 'react'
import { tokens } from '../../components/index'

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
 * filled with the sheet's tone once it is used. The sheet's Mark used (a
 * pencil `Toggle`) leads with it, and a read-only sheet's static "Used" stamp
 * wears it too.
 */
export function UsedPip({ used }: { used: boolean }) {
  return <span aria-hidden="true" style={used ? { ...PIP, ...PIP_SET } : PIP} />
}
