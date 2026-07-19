import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { InstrumentStage } from '../../stories/_dashboardStage'
import { DisplayView } from './DisplayView'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Dashboard/DisplayView' }

/**
 * The main display, "forward" under glass. Here it shows a statful entity focus:
 * a real chassis reference card with entity-level foot controls (the app wires
 * the play verbs + sheet link). Other focuses render the Tables view, the SRD
 * Explorer, or the Actions deck slot.
 */
export const Default: Story = () => {
  const chassis = SalvageUnionReference.Chassis.all()[0] as unknown as SURefEntity
  return (
    <div className="flex flex-col gap-4">
      <Caption>Main display — a chassis reference card with entity-level foot controls.</Caption>
      <InstrumentStage width={560}>
        <div
          className="pc-display-light"
          style={{ height: 520, borderRadius: 'var(--radius-panel)' }}
        >
          <DisplayView
            content={{
              kind: 'entity',
              data: chassis,
              note: 'Chassis not in the reference set.',
              controls: [{ key: 'sheet', href: '#', label: 'Full mech sheet →' }],
            }}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}
