import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { DualColumnLayout } from '../components/shared/DualColumnLayout'
import { MasonryColumns } from '../components/shared/MasonryColumns'
import { FilterRow } from '../components/shared/FilterRow'
import { DisplayCard } from '../components/shared/DisplayCard'
import { Badge } from '../components/chrome/Badge'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
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
    <DisplayCard
      extent="head"
      headerBg="bg-su-green"
      headerContent={<span className="font-cond font-bold uppercase text-ink">{name}</span>}
    />
  )
}

/** DualColumnLayout — two independent columns; collapses to one when a side is empty. */
export const DualColumn: Story = () => (
  <div className="flex max-w-3xl flex-col gap-6 bg-paper p-4">
    <DualColumnLayout
      left={
        <div className="flex flex-col gap-2">
          <Badge shape="stamp">Left</Badge>
          {chassis.slice(0, 3).map((c) => (
            <ChassisRow key={c.name} name={c.name} />
          ))}
        </div>
      }
      right={
        <div className="flex flex-col gap-2">
          <Badge shape="stamp">Right</Badge>
          {chassis.slice(3, 6).map((c) => (
            <ChassisRow key={c.name} name={c.name} />
          ))}
        </div>
      }
    />
  </div>
)

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
