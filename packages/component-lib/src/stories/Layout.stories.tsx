import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { MasonryColumns } from '../components/shared/MasonryColumns'
import { FilterRow } from '../components/shared/FilterRow'
import { Card } from '../components/shared/Card'
import { Badge } from '../components/chrome/Badge'

export default {
  title: 'Foundations/Layout',
}

// Real SRD content fills every layout so wrapping/overflow read truthfully.
const chassis = SalvageUnionReference.Chassis.all().slice(0, 6)
const traits = SalvageUnionReference.Traits.all()
  .slice(0, 6)
  .map((t) => t.name)

function ChassisRow({ name }: { name: string }) {
  return (
    <Card
      extent="head"
      headerBg="bg-mech"
      headerContent={<span className="font-cond font-bold uppercase text-ink">{name}</span>}
    />
  )
}

/** MasonryColumns — viewport-driven column count; balances cards across columns. */
export const Masonry: Story = () => (
  <div className="max-w-4xl bg-paper p-4">
    <MasonryColumns>
      {chassis.map((c) => (
        <ChassisRow key={c.name} name={c.name} />
      ))}
    </MasonryColumns>
  </div>
)

/** FilterRow — a labelled row of controls that wraps under its label on mobile. */
export const Filters: Story = () => (
  <div className="flex max-w-2xl flex-col gap-4 bg-paper p-4">
    <FilterRow label="Traits">
      {traits.map((t) => (
        <Badge key={t}>{t}</Badge>
      ))}
    </FilterRow>
  </div>
)
