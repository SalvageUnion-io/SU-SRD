import type { CSSProperties } from 'react'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Button } from './Button'
import type { GlyphName } from './glyphs'
import { Glyph } from './glyphs'

export default {
  title: 'Atoms/Glyph',
}

/** Filled geometry — the original set. */
const FILLED: GlyphName[] = ['gear', 'clock', 'pennant', 'x']
/** Stroked geometry — the live-sheet edit-language affordances. */
const STROKED: GlyphName[] = ['pencil', 'check', 'plus', 'remove', 'swap']

const FRAME = { backgroundColor: color.paper, padding: space[16] } satisfies CSSProperties

const SET_ROW = {
  alignItems: 'center',
  color: color.ink,
  display: 'flex',
  gap: space[24],
} satisfies CSSProperties

/** `text-2xl`, with its paired line-height. */
const SPECIMEN = {
  alignItems: 'center',
  display: 'flex',
  fontSize: fontSize['2xl'],
  gap: space[8],
  lineHeight: 'calc(2 / 1.5)',
} satisfies CSSProperties

const NAME = {
  fontFamily: font.cond,
  fontSize: fontSize.xs,
  letterSpacing: tracking.capsTight,
  lineHeight: 'calc(1 / 0.75)',
  textTransform: 'uppercase',
} satisfies CSSProperties

/**
 * name — the whole set at a glance. The set carries BOTH filled icons (gear /
 * clock / pennant / ✕) and stroked control affordances (pencil / check / plus /
 * remove / swap); `Glyph` picks the right rendering per name, so a caller never
 * has to know which is which.
 */
export const AllGlyphs: Story = () => (
  <div style={FRAME}>
    <div style={{ marginBottom: space[20] }}>
      <Caption>filled · currentColor at 1em</Caption>
      <div style={SET_ROW}>
        {FILLED.map((name) => (
          <span key={name} style={SPECIMEN}>
            <Glyph name={name} />
            <span style={NAME}>{name}</span>
          </span>
        ))}
      </div>
    </div>
    <div>
      <Caption>stroked · the edit-language affordances</Caption>
      <div style={SET_ROW}>
        {STROKED.map((name) => (
          <span key={name} style={SPECIMEN}>
            <Glyph name={name} />
            <span style={NAME}>{name}</span>
          </span>
        ))}
      </div>
    </div>
  </div>
)

/** currentColor — a glyph takes its colour from surrounding text (rust in action). */
export const CurrentColor: Story = () => (
  <div style={FRAME}>
    <Caption>currentColor · inherits ink, or paper on an action</Caption>
    <div
      style={{
        alignItems: 'center',
        color: color.ink,
        display: 'flex',
        gap: space[8],
        marginBottom: space[12],
      }}
    >
      <Glyph name="gear" />
      <span
        style={{
          fontFamily: font.cond,
          fontSize: fontSize.sm,
          fontWeight: weight.bold,
          letterSpacing: tracking.capsTight,
          lineHeight: 'calc(1.25 / 0.875)',
          textTransform: 'uppercase',
        }}
      >
        Turn Action · ink
      </span>
    </div>
    <Button variant="primary" size="compact">
      <Glyph name="pennant" />1 AP · rust = action
    </Button>
  </div>
)

/** 1em — the glyph scales with the font-size of its container. */
export const Sizing: Story = () => (
  <div
    style={{
      ...FRAME,
      alignItems: 'flex-end',
      color: color.ink,
      display: 'flex',
      gap: space[16],
    }}
  >
    <span style={{ fontSize: fontSize.sm, lineHeight: 'calc(1.25 / 0.875)' }}>
      <Glyph name="clock" />
    </span>
    <span style={{ fontSize: fontSize.xl, lineHeight: 'calc(1.75 / 1.25)' }}>
      <Glyph name="clock" />
    </span>
    <span style={{ fontSize: fontSize['3xl'], lineHeight: 'calc(2.25 / 1.875)' }}>
      <Glyph name="clock" />
    </span>
    <span style={{ fontSize: '3rem', lineHeight: 1 }}>
      <Glyph name="clock" />
    </span>
  </div>
)

/** title — an accessible (non-decorative) glyph exposes an img role + label. */
export const Accessible: Story = () => (
  <div
    style={{ ...FRAME, color: color.ink, fontSize: fontSize['2xl'], lineHeight: 'calc(2 / 1.5)' }}
  >
    <Glyph name="pennant" title="1 Action Point" />
  </div>
)
