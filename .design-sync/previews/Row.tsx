/*
 * Composed from the Row usage in
 * packages/component-lib/src/components/chrome/Panel.stories.tsx. `Row` has no
 * story file of its own — it ships from `./Panel` as that frame's list item and
 * is demonstrated through it.
 */
import { Panel, Row } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group, Stack } from '../preview-lib/harness'

/** The list item: a name, an optional meta line, and optional trailing actions. */
export function Anatomy() {
  const systems = SalvageUnionReference.Systems.all().slice(0, 3)
  return (
    <div className="bg-paper p-4">
      <Stack gap="1.5rem">
        <Group caption="name only">
          <Panel className="p-2">
            <Row name={systems[0]?.name ?? 'System'} />
          </Panel>
        </Group>
        <Group caption="name + meta">
          <Panel className="p-2">
            <Row
              name={systems[1]?.name ?? 'System'}
              meta={`System · TL${systems[1]?.techLevel ?? 1}`}
            />
          </Panel>
        </Group>
        <Group caption="name + meta + actions">
          <Panel className="p-2">
            <Row
              name={systems[2]?.name ?? 'System'}
              meta={`System · TL${systems[2]?.techLevel ?? 1}`}
              actions={
                <span className="font-cond text-xs font-bold uppercase text-rust">Details</span>
              }
            />
          </Panel>
        </Group>
      </Stack>
    </div>
  )
}

/** A real list — the shape a salvage or loadout panel takes. */
export function AsList() {
  const systems = SalvageUnionReference.Systems.all().slice(0, 6)
  return (
    <div className="bg-paper p-4">
      <Panel className="p-2">
        <div className="flex flex-col gap-2">
          {systems.map((s) => (
            <Row
              key={s.name}
              name={s.name}
              meta={`TL${s.techLevel ?? 1} · SV ${s.salvageValue ?? 1}`}
            />
          ))}
        </div>
      </Panel>
    </div>
  )
}
