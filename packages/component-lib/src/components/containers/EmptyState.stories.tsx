import type { CSSProperties } from 'react'
import { color, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Button } from '../atoms/Button'
import { Glyph } from '../atoms/glyphs'
import { EmptyState } from './EmptyState'

export default {
  title: 'Containers/Empty State',
}

const FRAME = {
  maxWidth: '24rem',
  backgroundColor: color.paper,
  padding: space[16],
} satisfies CSSProperties

/** headline + body + action — stamp voice, dashed = fillable, one rust action. */
export const Default: Story = () => (
  <div style={FRAME}>
    <EmptyState
      headline="No mechs yet"
      body="Build your first chassis to see it here."
      action={
        <Button variant="primary" size="compact">
          New mech ▸
        </Button>
      }
    />
  </div>
)

/** headline only — the minimal empty slot. */
export const HeadlineOnly: Story = () => (
  <div style={FRAME}>
    <EmptyState headline="No pilots yet" />
  </div>
)

/** quiet — the muted app-chrome placeholder: centered, faint dashed frame,
 *  decorative glyph, no stamp. */
export const Quiet: Story = () => (
  <div style={FRAME}>
    <EmptyState
      variant="quiet"
      icon={
        <Glyph name="plus" style={{ width: space[28], height: space[28], color: color.wkMuted }} />
      }
      body="No systems installed yet."
      action={
        <Button variant="primary" size="compact">
          + Add system
        </Button>
      }
    />
  </div>
)
