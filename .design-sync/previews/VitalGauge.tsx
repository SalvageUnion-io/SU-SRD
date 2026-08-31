/* Ported from packages/component-lib/src/components/stat/VitalGauge.stories.tsx. */
import { VitalGauge } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

// Instrument-surface tones for the dark-ground pair (SP green, Heat ember).
const SP_TONE = { '--tone': '#8fb996', '--tone-deep': '#4f6b55' } as CSSProperties
const HEAT_TONE = { '--tone': '#c98b5e', '--tone-deep': '#7d4f2f' } as CSSProperties

function useVitals() {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  return {
    sp: chassis?.structurePoints ?? 12,
    ep: chassis?.energyPoints ?? 4,
    heat: chassis?.heatCapacity ?? 6,
    cargo: chassis?.cargoCapacity ?? 16,
  }
}

function Row({ label, skin, children }: { label: string; skin: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`${skin} max-w-md`}>{children}</div>
      <code className="font-body text-nano text-wk-muted">{label}</code>
    </div>
  )
}

/**
 * The segmented current/max gauge. `readOnly` is a static read-out; `onChange`
 * makes segments click-to-set; `dense` auto-engages at max ≥ 12; `danger`
 * redlines from a segment index.
 */
export function Anatomy() {
  const v = useVitals()
  return (
    <div className="flex flex-col gap-5 bg-paper p-5 font-body text-ink">
      <Row label="readOnly" skin="sheet--pilot">
        <VitalGauge label="EP" value={Math.ceil(v.ep / 2)} max={v.ep} readOnly />
      </Row>
      <Row label="editable (onChange)" skin="sheet--mech">
        <VitalGauge label="Heat" value={Math.ceil(v.heat / 2)} max={v.heat} onChange={() => {}} />
      </Row>
      <Row label="dense (max ≥ 12)" skin="sheet--crawler">
        <VitalGauge
          label="Cargo"
          value={Math.ceil(v.cargo * 0.7)}
          max={v.cargo}
          onChange={() => {}}
        />
      </Row>
      <Row label="danger redline" skin="sheet--mech">
        <VitalGauge
          label="Heat"
          value={v.heat - 1}
          max={v.heat}
          danger={Math.max(1, v.heat - 2)}
          onChange={() => {}}
        />
      </Row>
      <Row label="caption pair" skin="sheet--crawler">
        <VitalGauge
          label="Cargo"
          value={Math.ceil(v.cargo * 0.6)}
          max={v.cargo}
          caption={['Stowed', 'Bays']}
          onChange={() => {}}
        />
      </Row>
    </div>
  )
}

/**
 * COMPACT — the single-row instrument bar: label, one segment row, and
 * value/max on one line. No big numeral, caption, or multi-row split.
 */
export function Compact() {
  const v = useVitals()
  return (
    <div className="flex flex-col gap-5 bg-paper p-5 font-body text-ink">
      <Row label="compact · sheet surface" skin="sheet--mech">
        <VitalGauge
          label="Heat"
          value={v.heat - 1}
          max={v.heat}
          danger={Math.max(1, v.heat - 2)}
          size="compact"
        />
      </Row>
      <Row label="compact · editable" skin="sheet--pilot">
        <VitalGauge
          label="EP"
          value={Math.ceil(v.ep / 2)}
          max={v.ep}
          size="compact"
          onChange={() => {}}
        />
      </Row>
    </div>
  )
}

/**
 * `surface="instrument"` on the dark ground — what the dashboard renders in
 * place of a bespoke bar. The tone is supplied by the host surface.
 */
export function Instrument() {
  return (
    <div className="flex flex-col gap-1.5 bg-paper p-5">
      <div className="flex flex-col gap-2 rounded-card bg-[#1b1712] p-3">
        <VitalGauge
          label="SP"
          value={12}
          max={15}
          size="compact"
          surface="instrument"
          readOnly
          style={SP_TONE}
        />
        <VitalGauge
          label="Heat"
          value={5}
          max={6}
          danger={4}
          size="compact"
          surface="instrument"
          readOnly
          style={HEAT_TONE}
        />
      </div>
      <code className="font-body text-nano text-wk-muted">
        compact · instrument surface (dark ground)
      </code>
    </div>
  )
}
