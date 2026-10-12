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
 * One row = one entity card cell. `footMeta` is folded into the card's own
 * foot, so the activation economy reads on the card rather than beside it —
 * here the real .50 Cal Machine Gun cost (EP 2 / +HEAT 1). The FLOW is
 * `MasonryColumns`, exactly as the live sheets pair them.
 */
export const Default: Story = () => {
  const systems = SalvageUnionReference.Systems.all().slice(0, 3)
  return (
    <div style={STACK}>
      <Caption>
        EntityGridRow is the cell: a min-w-0 wrapper that folds footMeta into the card it holds.
        MasonryColumns is the flow around it (1 column on mobile, up to 3 on desktop).
      </Caption>
      <MasonryColumns>
        {systems.map((system) => (
          <EntityGridRow
            key={system.id}
            footMeta={[
              { label: 'EP', value: 2 },
              { label: '+HEAT', value: 1 },
            ]}
          >
            <ReferenceEntityCard data={system} size="medium" />
          </EntityGridRow>
        ))}
      </MasonryColumns>
    </div>
  )
}
