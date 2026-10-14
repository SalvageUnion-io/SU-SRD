import { MasonryColumns, ReferenceEntityCard, tokens } from 'component-lib'
import type { Story } from 'component-lib/stories/harness'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityGridRow } from './EntityGrid'

export default {
  title: 'Compositions/Catalog/Entity Grid Row',
}

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[20],
} satisfies CSSProperties

/**
 * One row = one entity card cell. The FLOW is `MasonryColumns`, exactly as the
 * live sheets pair them.
 */
export const Default: Story = () => {
  const systems = SalvageUnionReference.Systems.all().slice(0, 3)
  return (
    <div style={STACK}>
      <Caption>
        EntityGridRow is the cell: a min-w-0 wrapper around the card it holds. MasonryColumns is the
        flow around it (1 column on mobile, up to 3 on desktop).
      </Caption>
      <MasonryColumns>
        {systems.map((system) => (
          <EntityGridRow key={system.id}>
            <ReferenceEntityCard data={system} size="medium" />
          </EntityGridRow>
        ))}
      </MasonryColumns>
    </div>
  )
}
