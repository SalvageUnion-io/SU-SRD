import type { Story } from '@ladle/react'
import { Caption } from '../_harness'

import { ConditionSwatch } from '../../components/stat/ConditionSwatch'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/ConditionSwatch',
}

const STATES = ['intact', 'damaged', 'destroyed'] as const

/** state — fill-shape is the primary encoding, hue secondary, NO gradients. */
export const States: Story = () => (
  <div className="space-y-2 bg-paper p-4">
    <Caption>state · intact (solid) / damaged (clip-path half) / destroyed (SVG ✕)</Caption>
    <div className="flex items-center gap-6">
      {STATES.map((state) => (
        <span key={state} className="flex items-center gap-2">
          <ConditionSwatch state={state} className="size-5" />
          <span className="font-cond text-xs uppercase tracking-caps-tight text-ink">{state}</span>
        </span>
      ))}
    </div>
  </div>
)

/** Grayscale-legible — the shape reads even without colour (accessibility law). */
export const GrayscaleLegible: Story = () => (
  <div className="space-y-2 bg-paper p-4">
    <Caption>fill-shape carries the meaning — legible desaturated</Caption>
    <div className="flex items-center gap-6 grayscale">
      {STATES.map((state) => (
        <ConditionSwatch key={state} state={state} className="size-6" />
      ))}
    </div>
  </div>
)

/** Tally sizing — the small swatch used inline beside a bay count. */
export const InlineTally: Story = () => (
  <div className="space-y-2 bg-paper p-4">
    <Caption>inline tally · swatch + count</Caption>
    <div className="flex items-center gap-4">
      {(
        [
          ['intact', 4],
          ['damaged', 2],
          ['destroyed', 1],
        ] as const
      ).map(([state, count]) => (
        <span key={state} className="flex items-center gap-1.5">
          <ConditionSwatch state={state} className="size-[11px]" />
          <span className="font-body text-[17px] font-bold leading-none text-ink">{count}</span>
          <span className="font-cond text-[9.5px] uppercase leading-none text-wk-muted">
            {state}
          </span>
        </span>
      ))}
    </div>
  </div>
)
