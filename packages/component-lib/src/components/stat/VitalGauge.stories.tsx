import type { Story } from '@ladle/react'
import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { VitalGauge } from './VitalGauge'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Vital Gauge',
}

const noop = () => {}

// Real chassis stats drive every gauge (reference data preloaded by .ladle/components.tsx).
const chassis = SalvageUnionReference.Chassis.all()[0]
const sp = chassis?.structurePoints ?? 12
const ep = chassis?.energyPoints ?? 4
const heat = chassis?.heatCapacity ?? 6
const cargo = chassis?.cargoCapacity ?? 16

function Row({ label, skin, children }: { label: string; skin: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`${skin} max-w-md`}>{children}</div>
      <code className="text-nano text-ink-2">{label}</code>
    </div>
  )
}

/** Every VitalGauge variant on one page — read-only through overridden-max. */
export const Default: Story = () => (
  <div className="flex flex-col gap-5 bg-paper p-5 font-mono text-ink">
    <p className="max-w-2xl text-xs leading-relaxed text-ink-2">
      The segmented current/max gauge. readOnly is a static read-out; onChange makes segments
      click-to-set; dense auto-engages at max ≥ 12; danger redlines from a segment index; caption /
      subLabel annotate; an overridden max shows the hand-pinned cap + revert.
    </p>
    <Row label="readOnly" skin="sheet--pilot">
      <VitalGauge label="EP" value={Math.ceil(ep / 2)} max={ep} readOnly />
    </Row>
    <Row label="editable (onChange)" skin="sheet--mech">
      <VitalGauge label="Heat" value={Math.ceil(heat / 2)} max={heat} onChange={noop} />
    </Row>
    <Row label="dense (max ≥ 12)" skin="sheet--crawler">
      <VitalGauge label="Cargo" value={Math.ceil(cargo * 0.7)} max={cargo} onChange={noop} />
    </Row>
    <Row label="danger redline" skin="sheet--mech">
      <VitalGauge
        label="Heat"
        value={heat - 1}
        max={heat}
        danger={Math.max(1, heat - 2)}
        onChange={noop}
      />
    </Row>
    <Row label="caption pair" skin="sheet--crawler">
      <VitalGauge
        label="Cargo"
        value={Math.ceil(cargo * 0.6)}
        max={cargo}
        caption={['Stowed', 'Bays']}
        onChange={noop}
      />
    </Row>
    <Row label="subLabel" skin="sheet--mech">
      <VitalGauge
        label="SP"
        subLabel="Structure"
        value={Math.ceil(sp * 0.75)}
        max={sp}
        onChange={noop}
      />
    </Row>
    <Row label="overridden max" skin="sheet--pilot">
      <VitalGauge
        label="SP"
        value={Math.ceil(sp * 0.7)}
        max={sp + 2}
        onChange={noop}
        onMaxChange={noop}
        overriddenFrom={sp}
        onRevertOverride={noop}
      />
    </Row>
  </div>
)

/** COMPACT — the single-row instrument bar (label · one segment row · value/max).
 *  `surface="sheet"` (light, default) and `surface="instrument"` (dark ground):
 *  the same primitive the dashboard now renders in place of its bespoke gauge. */
export const Compact: Story = () => (
  <div className="flex flex-col gap-5 bg-paper p-5 font-mono text-ink">
    <p className="max-w-2xl text-xs leading-relaxed text-ink-2">
      The single-row compact gauge: label, one segment row, and value/max on one line — no big
      numeral, caption, or multi-row split. Filled segments use the sheet's <code>--tone</code>, and
      Heat redlines at its danger index. The dashboard instruments render this (dark instrument
      surface) instead of a bespoke bar.
    </p>
    <Row label="compact · sheet surface" skin="sheet--mech">
      <VitalGauge label="Heat" value={heat - 1} max={heat} danger={Math.max(1, heat - 2)} compact />
    </Row>
    <Row label="compact · editable" skin="sheet--pilot">
      <VitalGauge label="EP" value={Math.ceil(ep / 2)} max={ep} compact onChange={noop} />
    </Row>
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-2 rounded-card bg-[#1b1712] p-3">
        <VitalGauge
          label="SP"
          value={12}
          max={15}
          compact
          surface="instrument"
          readOnly
          style={{ '--tone': '#8fb996', '--tone-deep': '#4f6b55' } as CSSProperties}
        />
        <VitalGauge
          label="Heat"
          value={5}
          max={6}
          danger={4}
          compact
          surface="instrument"
          readOnly
          style={{ '--tone': '#c98b5e', '--tone-deep': '#7d4f2f' } as CSSProperties}
        />
      </div>
      <code className="text-nano text-ink-2">compact · instrument surface (dark ground)</code>
    </div>
  </div>
)
