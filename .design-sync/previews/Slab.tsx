/* Ported from packages/component-lib/src/components/chrome/Slab.stories.tsx. */
import { Slab } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group, Stack } from '../preview-lib/harness'

/**
 * The section separator, dashed (the default) — a label, an optional count, and
 * optional trailing actions.
 */
export function Dashed() {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  return (
    <div className="bg-paper p-4">
      <Stack gap="1.5rem">
        <Group caption="label only">
          <Slab label="Systems" />
        </Group>
        <Group caption="with count">
          <Slab label="Systems" count={`${chassis?.systemSlots ?? 6}`} />
        </Group>
        <Group caption="with rich count">
          <Slab label="Cargo" count={`0 lots · 0/${chassis?.cargoCapacity ?? 6} slots`} />
        </Group>
        <Group caption="with actions">
          <Slab
            label="Modules"
            count={`${chassis?.moduleSlots ?? 2}`}
            actions={<span className="font-cond text-xs font-bold uppercase text-rust">+ Add</span>}
          />
        </Group>
      </Stack>
    </div>
  )
}

/** `variant="solid"` — the poster `.sect` rule the printed sheets use. */
export function Solid() {
  return (
    <div className="bg-paper p-4">
      <Stack gap="1.5rem">
        <Group caption="label only">
          <Slab variant="solid" label="Salvage" />
        </Group>
        <Group caption="with count + actions">
          <Slab
            variant="solid"
            label="Salvage"
            count="5 items"
            actions={<span className="font-cond text-xs font-bold uppercase text-rust">Edit</span>}
          />
        </Group>
      </Stack>
    </div>
  )
}
