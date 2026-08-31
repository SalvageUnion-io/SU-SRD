/* Ported from packages/component-lib/src/components/dashboard/DisplayPanel.stories.tsx. */
import { DisplayPanel } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption, InstrumentStage } from '../preview-lib/harness'

/**
 * The main display, "forward" under glass. Here it shows a statful entity focus:
 * a real chassis reference card with entity-level foot controls (the app wires
 * the play verbs and the sheet link). Other focuses render the Tables view, the
 * SRD Explorer, or the Actions deck slot.
 */
export function EntityFocus() {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  return (
    <div className="flex flex-col gap-4">
      <Caption>main display — a chassis reference card with foot controls</Caption>
      <InstrumentStage width={560}>
        <div
          className="pc-display-light"
          style={{ height: 520, borderRadius: 'var(--radius-panel)' }}
        >
          <DisplayPanel
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

/** A pilot mount — the same display, tinted by the stage's `data-mount`. */
export function PilotMount() {
  const pilotClass = SalvageUnionReference.Classes.all()[0]
  return (
    <div className="flex flex-col gap-4">
      <Caption>pilot mount — the ontology tint follows the stage</Caption>
      <InstrumentStage width={560} mount="pilot">
        <div
          className="pc-display-light"
          style={{ height: 520, borderRadius: 'var(--radius-panel)' }}
        >
          <DisplayPanel
            content={{
              kind: 'entity',
              data: pilotClass ?? null,
              note: 'Class not in the reference set.',
              controls: [{ key: 'sheet', href: '#', label: 'Full pilot sheet →' }],
            }}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}
