import { tokens } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { InstrumentStage } from './_dashboardStage'
import { DashboardGauge } from './DashboardGauge'

const STACK_16 = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
} satisfies CSSProperties

export default { title: 'Compositions/Dashboard/Gauge' }

/**
 * The single-row instrument gauge, one per vital. Hue encodes ontology (mech
 * green / pilot orange / crawler pink); a filled segment at/after `danger` reads
 * redline. Values are the real Salvage Union vitals a mech/pilot tracks.
 */
export const Default = () => (
  <div style={STACK_16}>
    <Caption>
      Instrument gauges — one gauge primitive (VitalGauge), warm-paper cockpit skin.
    </Caption>
    <InstrumentStage>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DashboardGauge label="SP" value={4} max={6} tone="mech" />
        <DashboardGauge label="HEAT" value={5} max={6} tone="mech" danger={4} />
        <DashboardGauge label="EP" value={2} max={4} tone="pilot" />
        <DashboardGauge label="HP" value={8} max={10} tone="crawler" />
        {/* The §4.5 row split on a long track: 12 → 6/6, 16 → 5/5/6. */}
        <DashboardGauge label="SP" value={9} max={12} tone="mech" />
        <DashboardGauge label="CARGO" value={7} max={16} tone="mech" />
      </div>
    </InstrumentStage>
  </div>
)
