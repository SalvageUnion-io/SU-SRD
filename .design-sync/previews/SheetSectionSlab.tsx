/* Ported from packages/component-lib/src/components/shared/SheetSectionSlab.stories.tsx. */
import { Button, EntityGridRow, MasonryColumns, ReferenceEntityCard, SheetSectionSlab } from 'component-lib'
import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

// Themed via --tone / --tone-deep (mech sage), the same route the live sheets use.
const MECH_TONE = {
  '--tone': 'var(--color-mech)',
  '--tone-deep': 'var(--color-mech-dark)',
} as CSSProperties

/**
 * The unframed section: a slab leader — stamp title, count and rule — over
 * entity cards on the bare sheet ground. Entity-card sections use the slab
 * precisely so there is no second frame around cards that are already framed.
 */
export function EntitySection() {
  const systems = SalvageUnionReference.Systems.all().slice(0, 3)
  return (
    <div className="flex flex-col gap-3 bg-paper p-4" style={MECH_TONE}>
      <Caption>slab leader, then the cards themselves — no outer frame</Caption>
      <SheetSectionSlab
        title="Systems"
        count="3/6 slots"
        controls={
          <Button variant="ghost" size="mini">
            + Add
          </Button>
        }
      >
        <MasonryColumns>
          {systems.map((system) => (
            <EntityGridRow key={system.id}>
              <ReferenceEntityCard data={system} size="medium" extent="head" />
            </EntityGridRow>
          ))}
        </MasonryColumns>
      </SheetSectionSlab>
    </div>
  )
}

/** Title and count only — no controls. */
export function LeaderOnly() {
  return (
    <div className="flex flex-col gap-3 bg-paper p-4" style={MECH_TONE}>
      <SheetSectionSlab title="Modules" count="0/2 slots">
        <p className="font-body text-caption text-wk-muted">Nothing fitted yet.</p>
      </SheetSectionSlab>
    </div>
  )
}
