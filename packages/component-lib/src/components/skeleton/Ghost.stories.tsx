import type { Story } from '@ladle/react'
import { space } from '../../design/tokens'
import { Caption } from '../../stories/_harness'
import { Ghost } from './Skeleton'

export default {
  title: 'Atoms/Ghost',
}

/** Placeholder slots at the sizes a card actually reserves. */
const SLOTS = [
  { label: 'heading', size: { height: space[24], width: '66%' } },
  { label: 'stat pill', size: { height: space[20], width: space[64] } },
  { label: 'body line', size: { height: space[12], width: '100%' } },
  { label: 'last body line', size: { height: space[12], width: '83%' } },
]

/**
 * Ghost — the single ink-alpha bar every loading placeholder is built from:
 * `Skeleton`'s three modes here, and ITUN's sheet-shaped `SheetSkeleton`, which
 * composes it directly. Sized by the caller, so it can stand in for a heading, a
 * stat pill or a line of body text without any layout shift when content lands.
 */
export const Default: Story = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: space[12], maxWidth: 380 }}>
    <Caption>A heading-width ghost, a stat-pill ghost, two lines of body text</Caption>
    {SLOTS.map((slot) => (
      // A grid cell stretches its one child to the cell, so the slot's size
      // reaches the Ghost without a sizing class on it.
      <div key={slot.label} aria-hidden style={{ display: 'grid', ...slot.size }}>
        <Ghost />
      </div>
    ))}
  </div>
)
