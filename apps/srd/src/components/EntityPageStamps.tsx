import type { EntityPageMeta } from 'component-lib'
import { Badge, Stat } from 'component-lib'
import { space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'

/**
 * EntityPageStamps — what an entity page's chapter band carries at its right
 * (boards 07, 08): the type stamp, then the framed `[TL | 2]` cell (ruleset:
 * TL is the framed ink-on-paper badge, never a text ground), an ability's
 * `[LVL | 1]` and its cost. The same facts the card's seam and header show,
 * resolved by `resolveEntityPageMeta` so the page cannot describe an entity
 * differently from its own card.
 */

type EntityPageStampsProps = {
  meta: EntityPageMeta
}

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
} satisfies CSSProperties

export function EntityPageStamps({ meta }: EntityPageStampsProps) {
  return (
    <div style={ROW}>
      {meta.typeLabel && (
        <Badge shape="stamp" size="compact">
          {meta.typeLabel}
        </Badge>
      )}
      {meta.numeral && (
        <Stat orientation="horizontal" size="compact" label="LVL" value={meta.numeral} />
      )}
      {meta.techLevel && (
        <Stat orientation="horizontal" size="compact" label="TL" value={meta.techLevel} />
      )}
      {meta.cost && (
        <Badge shape="stamp" size="compact" surface="inverse">
          {meta.cost}
        </Badge>
      )}
    </div>
  )
}
