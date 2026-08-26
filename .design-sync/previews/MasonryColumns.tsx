/*
 * Ported from packages/component-lib/src/components/shared/MasonryColumns.stories.tsx.
 * Cards render at `extent="head"` so several columns of them fit a preview cell;
 * the subject here is the column distribution, not the card body.
 */
import { MasonryColumns, ReferenceEntityCard } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

/**
 * Flex-column masonry — round-robin distribution, no cross-column balancing.
 * Column count follows the viewport ladder 1 / 2 / 3 (md / xl), capped by
 * `maxColumns`.
 */
export function ViewportLadder() {
  const equipment = SalvageUnionReference.Equipment.all().slice(0, 6)
  return (
    <div className="flex flex-col gap-3 bg-paper p-4">
      <Caption>ladder 1 / 2 / 3 — cards round-robin into positional columns</Caption>
      <MasonryColumns>
        {equipment.map((item) => (
          <ReferenceEntityCard key={item.id} data={item} size="medium" extent="head" />
        ))}
      </MasonryColumns>
    </div>
  )
}

/** `maxColumns={2}` — the constrained wizard selection-pool shape. */
export function TwoColumnCap() {
  const equipment = SalvageUnionReference.Equipment.all().slice(0, 6)
  return (
    <div className="flex flex-col gap-3 bg-paper p-4">
      <Caption>maxColumns=2 — constrained pools stop at two columns</Caption>
      <MasonryColumns maxColumns={2}>
        {equipment.map((item) => (
          <ReferenceEntityCard key={item.id} data={item} size="medium" extent="head" />
        ))}
      </MasonryColumns>
    </div>
  )
}

/**
 * `radio` + `ariaLabel` wrap the flow in a radiogroup — the exactly-one picker
 * the chassis and crawler-type wizard steps use, each cell carrying the card's
 * own selected ring via `selectionRole="radio"`.
 */
export function RadioSelection() {
  const chassis = SalvageUnionReference.Chassis.all().slice(0, 4)
  return (
    <div className="flex flex-col gap-3 bg-paper p-4">
      <Caption>radio + ariaLabel — pick-one pool with the card&rsquo;s native ring</Caption>
      <MasonryColumns maxColumns={2} radio ariaLabel="Chassis">
        {chassis.map((c, i) => (
          <ReferenceEntityCard
            key={c.id}
            data={c}
            size="medium"
            extent="head"
            selected={i === 1}
            selectionRole="radio"
            cardClickLabel={c.name}
            onCardClick={() => {}}
          />
        ))}
      </MasonryColumns>
    </div>
  )
}
