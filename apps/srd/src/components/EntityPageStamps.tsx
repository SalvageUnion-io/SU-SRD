import type { EntityPageMeta } from 'component-lib'
import { Badge, StatColumn } from 'component-lib'
import { space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'

/**
 * EntityPageStamps — what an entity page's chapter band carries at its right
 * (boards 07, 08): the type stamp, an ability's level and its cost, then
 * the Tech Level, every one at the stat column's height and type: the level
 * and Tech Level as its framed-numeral cells, the stamps sized to match
 * (`.srd-entity-stamp`). Tech Level is the first thing a table asks of anything it
 * can field or buy, so it is not a chip here: it is the stat column's own cell
 * (`2 | TECH LEVEL`, the framed numeral beside the ink stamp), the size the
 * page body draws its stats, and the body leaves it out of its column. The same facts the card's header shows,
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
        <Badge shape="stamp" size="compact" className="srd-entity-stamp">
          {meta.typeLabel}
        </Badge>
      )}
      {meta.numeral && (
        <StatColumn stats={[{ key: 'level', label: 'LVL', value: meta.numeral }]} label="Level" />
      )}
      {meta.cost && (
        <Badge shape="stamp" size="compact" surface="inverse" className="srd-entity-stamp">
          {meta.cost}
        </Badge>
      )}
      {meta.techLevel && (
        <StatColumn
          stats={[{ key: 'tech-level', label: 'Tech Level', value: meta.techLevel }]}
          label="Tech level"
        />
      )}
    </div>
  )
}
