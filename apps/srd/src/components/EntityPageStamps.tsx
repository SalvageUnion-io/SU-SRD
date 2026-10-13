import type { EntityPageMeta } from 'component-lib'
import {
  Badge,
  LEGAL_STARTING_PATTERN,
  LEGAL_STARTING_PATTERN_NOTE,
  StatColumn,
} from 'component-lib'
import { space } from 'component-lib/design/tokens'
import type { CSSProperties, ReactNode } from 'react'

/**
 * EntityPageStamps — what an entity page's chapter band carries right of its
 * title (boards 07, 08; EDL E20), as one line that wraps: `lead` (a pattern's
 * parent link), the Legal Starting Pattern stamp, an ability's level, then
 * the Tech Level. Never the kind (E9: the title says it to screen readers)
 * and never the cost (a chip in the page's chip group, E17). Each is at the
 * stat column's height and type: the level and Tech Level as its
 * framed-numeral cells, the stamps sized to match (`.srd-entity-stamp`). Tech Level is the first thing a table asks of anything it
 * can field or buy, so it is not a chip here: it is the stat column's own cell
 * (`2 | TECH LEVEL`, the framed numeral beside the ink stamp), the size the
 * page body draws its stats, and the body leaves it out of its column; then
 * `end` (the page's "Build with this"). The same facts the card's header shows,
 * resolved by `resolveEntityPageMeta` so the page cannot describe an entity
 * differently from its own card.
 */

type EntityPageStampsProps = {
  meta: EntityPageMeta
  /** A pattern the book sanctions as a starting build: its stamp after the parent link. */
  legalStartingPattern?: boolean
  /** Before the stamps: the link to what the entity is built on. */
  lead?: ReactNode
  /** After the stamps: the page's action. */
  end?: ReactNode
}

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
} satisfies CSSProperties

export function EntityPageStamps({
  meta,
  legalStartingPattern = false,
  lead,
  end,
}: EntityPageStampsProps) {
  return (
    <div style={ROW}>
      {lead}
      {legalStartingPattern && (
        <Badge
          shape="stamp"
          size="compact"
          className="srd-entity-stamp"
          title={LEGAL_STARTING_PATTERN_NOTE}
        >
          {LEGAL_STARTING_PATTERN}
        </Badge>
      )}
      {meta.numeral && (
        <StatColumn stats={[{ key: 'level', label: 'LVL', value: meta.numeral }]} label="Level" />
      )}
      {meta.techLevel && (
        <StatColumn
          stats={[{ key: 'tech-level', label: 'Tech Level', value: meta.techLevel }]}
          label="Tech level"
        />
      )}
      {end}
    </div>
  )
}
