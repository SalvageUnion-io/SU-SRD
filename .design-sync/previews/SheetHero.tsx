/*
 * Ported from the SheetHero cluster in
 * packages/component-lib/src/components/sheet/SheetPresentation.stories.tsx.
 * The story's `ChassisStats` spec strip is not part of the public barrel, so the
 * `specs` slot is filled with the equivalent `Stat` row instead — the slot takes
 * any node.
 */
import { SheetHero, Stat } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption, Row } from '../preview-lib/harness'

/** The poster identity band a live sheet opens with. */
export function MechHero() {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  return (
    <div className="sheet--mech flex flex-col gap-4 bg-paper p-4">
      <Caption>mech — category wordmark, name, spec strip, tracker cluster</Caption>
      <SheetHero
        cat="MECH"
        name={chassis?.name ?? 'Mule'}
        specs={
          <Row>
            <Stat label="SP" value={10} max={10} size="mini" />
            <Stat label="EP" value={5} max={5} size="mini" />
            <Stat label="HEAT" value={0} max={4} size="mini" />
          </Row>
        }
        trackers={<Stat label="SP" value={10} max={10} />}
      />
    </div>
  )
}

/** A pilot hero — the same band, with quiet identity lines beneath the name. */
export function PilotHero() {
  const pilotClass = SalvageUnionReference.Classes.all()[0]
  return (
    <div className="sheet--pilot flex flex-col gap-4 bg-paper p-4">
      <Caption>pilot — identity lines, and empty values are skipped</Caption>
      <SheetHero
        cat="PILOT"
        name="Ace"
        identity={[
          { label: 'CLASS', value: pilotClass?.name ?? 'Salvager' },
          { label: 'BACKGROUND', value: 'Salvager' },
          { label: 'MOTTO', value: 'No retreat, no surrender.' },
          { label: 'KEEPSAKE', value: '' },
        ]}
        trackers={<Stat label="HP" value={14} max={16} />}
      />
    </div>
  )
}
