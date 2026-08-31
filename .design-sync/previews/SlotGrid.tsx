/* Ported from packages/component-lib/src/components/shared/SlotGrid.stories.tsx. */
import { SlotGrid } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group, Stack } from '../preview-lib/harness'

function useCargo() {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  return { name: chassis?.name ?? 'Chassis', cargo: chassis?.cargoCapacity ?? 16 }
}

/** The two scales: dense inline pips, and the addressable sheet cells. */
export function Scales() {
  const { name, cargo } = useCargo()
  const used = Math.ceil(cargo * 0.6)
  return (
    <div className="bg-paper p-4">
      <Stack gap="1.5rem">
        <Group caption={`scale=pip · ${used}/${cargo} filled · ${name} hold`}>
          <SlotGrid used={used} cap={cargo} />
        </Group>
        <Group caption="scale=sheet · larger addressable cells (Live Sheet / Dashboard)">
          <SlotGrid used={used} cap={cargo} scale="sheet" />
        </Group>
      </Stack>
    </div>
  )
}

/** Empty, full, and over capacity — dashed is fillable, overflow reads bad. */
export function Fill() {
  const { cargo } = useCargo()
  return (
    <div className="bg-paper p-4">
      <Stack gap="1.5rem">
        <Group caption="empty · all dashed (fillable)">
          <SlotGrid used={0} cap={cargo} scale="sheet" />
        </Group>
        <Group caption="full · all cargo">
          <SlotGrid used={cargo} cap={cargo} scale="sheet" />
        </Group>
        <Group caption="over capacity · used > cap renders the overflow as status-bad cells">
          <SlotGrid used={cargo + 2} cap={cargo} scale="sheet" />
        </Group>
      </Stack>
    </div>
  )
}
