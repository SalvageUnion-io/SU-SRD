import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { InstrumentStage } from '../../stories/_dashboardStage'
import { DashboardGauge } from './DashboardGauge'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Compositions/Dashboard/Gauge' }

/**
 * The single-row instrument gauge, one per vital. Hue encodes ontology (mech
 * green / pilot orange / crawler pink); a filled segment at/after `danger` reads
 * redline. Values are the real Salvage Union vitals a mech/pilot tracks.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>Instrument gauges — one gauge primitive (VitalGauge), dark instrument skin.</Caption>
    <InstrumentStage>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DashboardGauge label="SP" value={4} max={6} tone="mech" />
        <DashboardGauge label="HEAT" value={5} max={6} tone="mech" danger={4} />
        <DashboardGauge label="EP" value={2} max={4} tone="pilot" />
        <DashboardGauge label="HP" value={8} max={10} tone="crawler" />
      </div>
    </InstrumentStage>
  </div>
)
