import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, radius, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import type { CSSVarStyle } from '../../styles/cssVars'
import { VitalGauge } from './VitalGauge'

export default {
  title: 'Atoms/Vital Gauge',
}

const noop = () => {}

// Instrument-surface tones for the dark-ground pair (SP green, Heat ember).
const SP_TONE: CSSVarStyle = { '--tone': '#8fb996', '--tone-deep': '#4f6b55' }
const HEAT_TONE: CSSVarStyle = { '--tone': '#c98b5e', '--tone-deep': '#7d4f2f' }

// Real chassis stats drive every gauge (reference data preloaded by catalog.tsx).
const chassis = SalvageUnionReference.Chassis.all()[0]
const sp = chassis?.structurePoints ?? 12
const ep = chassis?.energyPoints ?? 4
const heat = chassis?.heatCapacity ?? 6
const cargo = chassis?.cargoCapacity ?? 16

const PAGE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[20],
  backgroundColor: color.paper,
  padding: space[20],
  fontFamily: font.body,
  color: color.ink,
}
const INTRO: CSSProperties = {
  maxWidth: '42rem',
  fontSize: fontSize.xs,
  lineHeight: 1.625,
  color: color.wkMuted,
}
const ROW: CSSProperties = { display: 'flex', flexDirection: 'column', gap: space[6] }
const ROW_LABEL: CSSProperties = { fontSize: fontSize.badge, color: color.wkMuted }
const INSTRUMENT_GROUND: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  borderRadius: radius.card,
  backgroundColor: '#1b1712',
  padding: space[12],
}

function Row({ label, skin, children }: { label: string; skin: string; children: ReactNode }) {
  return (
    <div style={ROW}>
      <div className={skin} style={{ maxWidth: '28rem' }}>
        {children}
      </div>
      <code style={ROW_LABEL}>{label}</code>
    </div>
  )
}

/** Every VitalGauge variant on one page — read-only through overridden-max. */
export const Default: Story = () => (
  <div style={PAGE}>
    <p style={INTRO}>
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
        breakdown={{ overridden: true, derived: sp }}
        onRevertOverride={noop}
      />
    </Row>
  </div>
)

/** COMPACT — the instrument bar (label · fixed-size pips that wrap · value/max).
 *  `surface="sheet"` (light, default) and `surface="instrument"` (dark ground):
 *  the same primitive the dashboard now renders in place of its bespoke gauge. */
export const Compact: Story = () => (
  <div style={PAGE}>
    <p style={INTRO}>
      The compact gauge: label, the pips, and value/max — no big numeral or caption. The pips are a
      fixed size and a long track wraps onto a second row rather than thinning (issue 1255). Filled
      segments use the sheet's <code>--tone</code>, and Heat redlines at its danger index. The
      dashboard instruments render this.
    </p>
    <Row label="compact · sheet surface" skin="sheet--mech">
      <VitalGauge
        label="Heat"
        value={heat - 1}
        max={heat}
        danger={Math.max(1, heat - 2)}
        size="compact"
      />
    </Row>
    <Row label="compact · editable" skin="sheet--pilot">
      <VitalGauge label="EP" value={Math.ceil(ep / 2)} max={ep} size="compact" onChange={noop} />
    </Row>
    <Row label="compact · a long track wraps (SP 20)" skin="sheet--crawler">
      <div style={{ width: 240 }}>
        <VitalGauge label="SP" value={17} max={20} size="compact" readOnly />
      </div>
    </Row>
    <div style={ROW}>
      <div style={INSTRUMENT_GROUND}>
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
      <code style={ROW_LABEL}>compact · instrument surface (dark ground)</code>
    </div>
  </div>
)
