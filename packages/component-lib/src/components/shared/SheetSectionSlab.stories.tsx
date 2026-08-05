import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import type { CSSVarStyle } from '../../styles/cssVars'
import { Button } from '../chrome/Button'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { EntityGridRow } from './EntityGrid'
import { MasonryColumns } from './MasonryColumns'
import { SheetSectionSlab } from './SheetSectionSlab'

export default { title: 'Containers/Sheet Section Slab' }

// Themes via --tone / --tone-deep (mech sage), the same route the live sheets use.
const MECH_TONE: CSSVarStyle = {
  '--tone': 'var(--color-mech)',
  '--tone-deep': 'var(--color-mech-dark)',
}

/** The unframed section: slab leader over entity cards on the bare sheet ground. */
export const Default: Story = () => {
  const systems = SalvageUnionReference.Systems.all().slice(0, 3)
  return (
    <div className="flex flex-col gap-3" style={MECH_TONE}>
      <Caption>
        Entity-card sections use the slab: a stamp title, count and rule, then the cards themselves
        — no second frame around cards that are already framed.
      </Caption>
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
              <ReferenceEntityCard data={system} size="medium" />
            </EntityGridRow>
          ))}
        </MasonryColumns>
      </SheetSectionSlab>
    </div>
  )
}
