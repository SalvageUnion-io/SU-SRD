/*
 * Composed from the SheetSectionSlab story, which is where `EntityGridRow`
 * appears — it ships from `./EntityGrid` as the row wrapper a masonry cell uses
 * and has no story file of its own.
 */
import { EntityGridRow, MasonryColumns, ReferenceEntityCard } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

/** One row per entity card, packed by `MasonryColumns`. */
export function InMasonry() {
  const systems = SalvageUnionReference.Systems.all().slice(0, 4)
  return (
    <div className="flex flex-col gap-3 bg-paper p-4">
      <Caption>each card wrapped in a grid row</Caption>
      <MasonryColumns maxColumns={2}>
        {systems.map((system) => (
          <EntityGridRow key={system.id}>
            <ReferenceEntityCard data={system} size="medium" extent="head" />
          </EntityGridRow>
        ))}
      </MasonryColumns>
    </div>
  )
}
