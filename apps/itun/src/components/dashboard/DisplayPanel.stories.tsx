import { Caption } from 'component-lib/stories/harness'
import { SalvageUnionReference } from 'salvageunion-reference'
import { InstrumentStage } from './_dashboardStage'
import { DisplayPanelFrame } from './DisplayPanel'

export default { title: 'Compositions/Dashboard/Display Panel' }

/**
 * The main display, "forward" under glass. Here it shows a statful entity focus:
 * a real chassis reference card with entity-level foot controls (the app wires
 * the play verbs + sheet link). Other focuses render the Tables view, the SRD
 * Explorer, or the Actions deck slot.
 */
export const Default = () => {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  return (
    <div className="flex flex-col gap-4">
      <Caption>Main display — a chassis reference card with entity-level foot controls.</Caption>
      <InstrumentStage width={560}>
        <div
          className="pc-display-light"
          style={{ height: 520, borderRadius: 'var(--radius-panel)' }}
        >
          <DisplayPanelFrame
            content={{
              kind: 'entity',
              data: chassis ?? null,
              note: 'Chassis not in the reference set.',
              controls: [{ key: 'sheet', href: '#', label: 'Full mech sheet →' }],
            }}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}
