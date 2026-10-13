import type { CSSProperties } from 'react'
import { color, fontSize, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Glyph } from './glyphs'

export default {
  title: 'Atoms/Glyph',
}

const FRAME = { backgroundColor: color.paper, padding: space[16] } satisfies CSSProperties

/**
 * The `+` add mark, a `currentColor` stroke at `1em`: it scales with the
 * font-size of its container and takes its colour from the surrounding text.
 */
export const Default: Story = () => (
  <div style={FRAME}>
    <Caption>plus · currentColor at 1em, scaling with its container</Caption>
    <div style={{ alignItems: 'flex-end', color: color.ink, display: 'flex', gap: space[16] }}>
      <span style={{ fontSize: fontSize.sm, lineHeight: 'calc(1.25 / 0.875)' }}>
        <Glyph name="plus" />
      </span>
      <span style={{ fontSize: fontSize.xl, lineHeight: 'calc(1.75 / 1.25)' }}>
        <Glyph name="plus" />
      </span>
      <span style={{ fontSize: fontSize['3xl'], lineHeight: 'calc(2.25 / 1.875)' }}>
        <Glyph name="plus" />
      </span>
      <span style={{ color: color.wkMuted, fontSize: '3rem', lineHeight: 1 }}>
        <Glyph name="plus" />
      </span>
    </div>
  </div>
)
