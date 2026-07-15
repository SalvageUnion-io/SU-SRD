import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Stamp } from '../../components/chrome/Stamp'
import { Glyph } from '../../components/chrome/glyphs'
import { ConditionSwatch } from '../../components/stat/ConditionSwatch'
import { SlotGrid } from '../../components/shared/SlotGrid'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Primitives/Atoms',
}

// Real reference data drives the readouts (preloaded by .ladle/components.tsx).
const chassis = SalvageUnionReference.Chassis.all()[0]
const chassisName = chassis?.name ?? 'Chassis'
const cargo = chassis?.cargoCapacity ?? 16
const tl = chassis?.techLevel ?? 1

const Caption = ({ children }: { children: ReactNode }) => (
  <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">{children}</div>
)

/** Stamp — the one ink label/header atom, its three surfaces and the seam. */
export const StampAtom: Story = () => (
  <div className="space-y-5 bg-paper p-4">
    <div>
      <Caption>surfaces · on-ink / inverse / on-tone</Caption>
      <div className="flex flex-wrap items-center gap-3">
        <Stamp>{chassisName}</Stamp>
        <Stamp surface="inverse">Structure</Stamp>
        <div className="bg-su-green px-2 py-1">
          <Stamp surface="on-tone">On tone</Stamp>
        </div>
      </div>
    </div>
    <div>
      <Caption>sizes · sm / md / lg</Caption>
      <div className="flex flex-wrap items-end gap-3">
        <Stamp size="sm">SP</Stamp>
        <Stamp size="md">TL {tl}</Stamp>
        <Stamp size="lg">{chassisName}</Stamp>
      </div>
    </div>
    <div>
      <Caption>seam · rides the top border (StampSeam)</Caption>
      <div className="relative mt-3 w-48 rounded-[3px] border-2 border-ink bg-paper px-3 py-4">
        <Stamp seam className="left-3">
          {chassisName}
        </Stamp>
        <span className="font-body text-sm text-ink">Body content</span>
      </div>
    </div>
  </div>
)

/** ConditionSwatch — tri-state glyph; fill-shape is primary, no gradients. */
export const ConditionSwatchAtom: Story = () => (
  <div className="space-y-4 bg-paper p-4">
    <Caption>intact (solid) · damaged (clip-path half) · destroyed (SVG ✕)</Caption>
    <div className="flex items-center gap-6">
      {(['intact', 'damaged', 'destroyed'] as const).map((state) => (
        <span key={state} className="flex items-center gap-2">
          <ConditionSwatch state={state} className="size-5" />
          <span className="font-cond text-xs uppercase tracking-caps-tight text-ink">{state}</span>
        </span>
      ))}
    </div>
  </div>
)

/** SlotGrid — 1 cell = 1 slot = 1 scrap; dashed empty, cargo filled, over-cap red. */
export const SlotGridAtom: Story = () => (
  <div className="space-y-5 bg-paper p-4">
    <div>
      <Caption>
        pip scale · {Math.ceil(cargo * 0.6)}/{cargo} filled · {chassisName} hold
      </Caption>
      <SlotGrid used={Math.ceil(cargo * 0.6)} cap={cargo} />
    </div>
    <div>
      <Caption>sheet scale · addressable cells</Caption>
      <SlotGrid used={Math.ceil(cargo * 0.6)} cap={cargo} scale="sheet" />
    </div>
    <div>
      <Caption>over capacity · used &gt; cap → status-bad cells</Caption>
      <SlotGrid used={cargo + 2} cap={cargo} scale="sheet" />
    </div>
  </div>
)

/** Glyph — currentColor, 1em, CSP-safe. Takes colour + scale from its context. */
export const GlyphAtom: Story = () => (
  <div className="space-y-4 bg-paper p-4">
    <Caption>gear · clock · pennant · ✕ — currentColor at 1em</Caption>
    <div className="flex items-center gap-6 text-ink">
      {(['gear', 'clock', 'pennant', 'x'] as const).map((name) => (
        <span key={name} className="flex items-center gap-2 text-2xl">
          <Glyph name={name} />
          <span className="font-cond text-xs uppercase tracking-caps-tight">{name}</span>
        </span>
      ))}
    </div>
    <div className="flex items-center gap-2 text-rust">
      <Glyph name="pennant" />
      <span className="font-cond text-sm font-bold uppercase tracking-caps-tight">
        1 AP · rust = action
      </span>
    </div>
  </div>
)
