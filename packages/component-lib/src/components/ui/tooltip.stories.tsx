import type { CSSProperties } from 'react'
import { color, font, fontSize, radius, space, tracking, weight } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Tooltip } from './tooltip'

export default {
  title: 'Atoms/Tooltip',
}

const trigger = {
  backgroundColor: color.ink,
  borderRadius: radius.card,
  color: color.paper,
  fontFamily: font.cond,
  letterSpacing: tracking.capsTight,
  paddingBlock: space[8],
  paddingInline: space[16],
  textTransform: 'uppercase',
} satisfies CSSProperties

const PAGE = {
  backgroundColor: color.paper,
  color: color.ink,
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
  padding: space[32],
} satisfies CSSProperties

const INTRO = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: 1.625,
  maxWidth: '42rem',
} satisfies CSSProperties

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[32],
  padding: space[32],
} satisfies CSSProperties

/** Sides, rich content, and delay — every Tooltip mode on one page (hover each). */
export const Default: Story = () => (
  <div style={PAGE}>
    <p style={INTRO}>
      Hover a trigger. side positions the tip (top / right / bottom / left); content accepts rich
      nodes; delayDuration tunes the open delay.
    </p>
    <div style={ROW}>
      <Tooltip content="Top" side="top">
        <button type="button" style={trigger}>
          Top
        </button>
      </Tooltip>
      <Tooltip content="Right" side="right">
        <button type="button" style={trigger}>
          Right
        </button>
      </Tooltip>
      <Tooltip content="Bottom" side="bottom">
        <button type="button" style={trigger}>
          Bottom
        </button>
      </Tooltip>
      <Tooltip content="Left" side="left">
        <button type="button" style={trigger}>
          Left
        </button>
      </Tooltip>
      <Tooltip
        content={
          <div style={{ padding: space[4] }}>
            <div style={{ fontWeight: weight.bold }}>System: Laser Cutter</div>
            <div style={{ fontSize: fontSize.sm, lineHeight: 'calc(1.25 / 0.875)' }}>
              Tech Level 2 · 1 EP
            </div>
          </div>
        }
      >
        <button type="button" style={trigger}>
          Rich content
        </button>
      </Tooltip>
      <Tooltip content="Instant" delayDuration={0}>
        <button type="button" style={trigger}>
          No delay
        </button>
      </Tooltip>
      <Tooltip content="Slow" delayDuration={1000}>
        <button type="button" style={trigger}>
          1s delay
        </button>
      </Tooltip>
    </div>
  </div>
)
