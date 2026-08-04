import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { MasonryColumns } from './MasonryColumns'

/**
 * MasonryColumns — flex-column masonry (round-robin distribution, no
 * cross-column balancing). Column count follows the viewport ladder 1 / 2 / 3
 * (md / xl), capped by `maxColumns`; `radio` adds radiogroup semantics for
 * exactly-one pickers.
 */
export default {
  title: 'Containers/Masonry Columns',
}

const equipment = SalvageUnionReference.Equipment.all().slice(0, 6)
const chassis = SalvageUnionReference.Chassis.all().slice(0, 4)

/**
 * The SRD schema-listing grid: uncapped ladder (1 column narrow, 2 at md, 3 at
 * xl) packing real compact entity cards of uneven heights — resize the viewport
 * to watch columns redistribute only when a breakpoint is crossed.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-3">
    <Caption>Viewport ladder 1 / 2 / 3 — cards round-robin into positional columns</Caption>
    <MasonryColumns>
      {equipment.map((item) => (
        <ReferenceEntityCard key={item.id} data={item} size="medium" />
      ))}
    </MasonryColumns>
  </div>
)

/** The wizard selection-pool shape: `maxColumns={2}` never splits past two. */
export const TwoColumnCap: Story = () => (
  <div className="flex flex-col gap-3">
    <Caption>maxColumns=2 — constrained pools (wizard steps) stop at two columns</Caption>
    <MasonryColumns maxColumns={2}>
      {equipment.map((item) => (
        <ReferenceEntityCard key={item.id} data={item} size="medium" hide={{ actions: true }} />
      ))}
    </MasonryColumns>
  </div>
)

/**
 * An exactly-one picker (the crawler-type / chassis wizard steps): `radio` +
 * `ariaLabel` wrap the flow in a radiogroup, each cell a real card carrying the
 * native selected ring with `selectionRole="radio"`.
 */
export const RadioSelection: Story = () => {
  const [chosen, setChosen] = useState('')
  return (
    <div className="flex flex-col gap-3">
      <Caption>radio + ariaLabel — pick-one pool with the card's native selected ring</Caption>
      <MasonryColumns maxColumns={2} radio ariaLabel="Chassis">
        {chassis.map((c) => (
          <ReferenceEntityCard
            key={c.id}
            data={c}
            size="medium"
            extent="head"
            selected={chosen === c.name}
            selectionRole="radio"
            cardClickLabel={c.name}
            onCardClick={() => setChosen((cur) => (cur === c.name ? '' : c.name))}
          />
        ))}
      </MasonryColumns>
    </div>
  )
}
