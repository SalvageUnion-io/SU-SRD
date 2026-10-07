import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Avatar } from './Avatar'

export default {
  title: 'Atoms/Avatar',
}

/** Real pilot class names standing in for player names, so the initials are real. */
const names = SalvageUnionReference.Classes.all()
  .slice(0, 3)
  .map((c) => c.name)

const ROW = {
  alignItems: 'center',
  display: 'flex',
  gap: space[12],
  marginBottom: space[16],
} satisfies CSSProperties

// The avatar's home is the dark masthead, so it is shown there too.
const MASTHEAD = {
  ...ROW,
  backgroundColor: color.inkDeep,
  padding: space[16],
} satisfies CSSProperties

/**
 * Avatar — a person's picture in a circle. With no picture (or one that will
 * not load) it shows their initial; with no name either, a generic glyph.
 * Shown at the masthead's two sizes: 28 beside a name, 32 alone on mobile.
 */
export const Default: Story = () => (
  <div>
    <Caption>initial fallback · 28px (beside a name)</Caption>
    <div style={ROW}>
      {names.map((name) => (
        <Avatar key={name} name={name} />
      ))}
      <Avatar name="" />
    </div>
    <Caption>on the masthead · 32px (avatar-only trigger)</Caption>
    <div style={MASTHEAD}>
      {names.map((name) => (
        <Avatar key={name} name={name} size={32} />
      ))}
    </div>
  </div>
)
