import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'

import { Glyph, type GlyphName } from './glyphs'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Glyph',
}

const NAMES: GlyphName[] = ['gear', 'clock', 'pennant', 'x']

/** name — the whole set at a glance (gear / clock / pennant / ✕). */
export const AllGlyphs: Story = () => (
  <div className="bg-paper p-4">
    <Caption>name · currentColor at 1em</Caption>
    <div className="flex items-center gap-6 text-ink">
      {NAMES.map((name) => (
        <span key={name} className="flex items-center gap-2 text-2xl">
          <Glyph name={name} />
          <span className="font-cond text-xs uppercase tracking-caps-tight">{name}</span>
        </span>
      ))}
    </div>
  </div>
)

/** currentColor — a glyph takes its colour from surrounding text (rust in action). */
export const CurrentColor: Story = () => (
  <div className="space-y-3 bg-paper p-4">
    <Caption>currentColor · inherits ink / rust from context</Caption>
    <div className="flex items-center gap-2 text-ink">
      <Glyph name="gear" />
      <span className="font-cond text-sm font-bold uppercase tracking-caps-tight">
        Turn Action · ink
      </span>
    </div>
    <div className="flex items-center gap-2 text-rust">
      <Glyph name="pennant" />
      <span className="font-cond text-sm font-bold uppercase tracking-caps-tight">
        1 AP · rust = action
      </span>
    </div>
  </div>
)

/** 1em — the glyph scales with the font-size of its container. */
export const Sizing: Story = () => (
  <div className="flex items-end gap-4 bg-paper p-4 text-ink">
    <span className="text-sm">
      <Glyph name="clock" />
    </span>
    <span className="text-xl">
      <Glyph name="clock" />
    </span>
    <span className="text-3xl">
      <Glyph name="clock" />
    </span>
    <span className="text-5xl">
      <Glyph name="clock" />
    </span>
  </div>
)

/** title — an accessible (non-decorative) glyph exposes an img role + label. */
export const Accessible: Story = () => (
  <div className="bg-paper p-4 text-2xl text-ink">
    <Glyph name="pennant" title="1 Action Point" />
  </div>
)
