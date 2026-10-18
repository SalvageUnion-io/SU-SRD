import type { CSSProperties, ReactNode } from 'react'
import { splitStatLine } from 'salvageunion-reference'
import { ActivationCost } from '../../atoms/ActivationCost'
import { Badge } from '../../atoms/Badge'
import { Stat } from '../../atoms/Stat'
import { StatColumn } from '../../atoms/StatColumn'
import type { StatItem } from '../../containers/statsBarTypes'
import { Tag } from '../../entity/parts/Tags'
import type { EntityPageMeta } from './entityPage'
import { LEGAL_STARTING_PATTERN, LEGAL_STARTING_PATTERN_NOTE } from './legalStartingPattern'

/**
 * EntityPageStamps — what an entity Page's chapter band carries right of its
 * title (boards 07, 08; EDL E20) — an SRD route's and the Cantina's detail dialog's
 * alike — as one line that wraps: `lead` (a pattern's
 * parent link), the Legal Starting Pattern stamp, then every chip the entity
 * carries (E17; the page body holds none, owner's call 2026-10-14), in the
 * stat order: its stats (Tech Level first, at the band's compact size; a
 * chassis's lead its page body instead), its action type and facets
 * (`RNG | Close`), its traits, linking to their entries, and last its cost in
 * the pointy box, every chip the same gap apart (the SRD page's "Build With
 * This" is the band's `action`, after them). An ability's level is the band's
 * `lead`, left of the title. Never the kind (E9: the title says it to screen
 * readers, the foot band stamps it). Every chip is at the stat column's height
 * and type (`.su-entity-stamp`, `.su-entity-stamps .su-stat-plate`). The same
 * facts the card's own chips show, resolved by `resolveEntityPageMeta` so the
 * page cannot describe an entity differently from its own card.
 */

type EntityPageStampsProps = {
  meta: EntityPageMeta
  /** The page's title, naming its stats for a screen reader ("Gopher header stats"). */
  name?: string
  /** A pattern the book sanctions as a starting build: its stamp after the parent link. */
  legalStartingPattern?: boolean
  /** Before the stamps: the link to what the entity is built on. */
  lead?: ReactNode
}

/**
 * A chip's place counted from the END of the cluster (the cost is 0), the
 * band's fill order (`--su-fill`, `.su-entity-stamps`): from `sm` the cluster
 * fills from its bottom-right corner up, so its last chip, the cost, takes
 * the corner and the earlier ones rise above. Only the order drawn changes;
 * the source, and so a screen reader and the tab order, keep the stat order.
 */
function fillAt(place: number): CSSProperties {
  return { '--su-fill': place } as CSSProperties
}

function bandFact(fact: StatItem, place: number) {
  return (
    <span key={fact.key} className="su-entity-stamps__item" style={fillAt(place)}>
      <Stat
        orientation="horizontal"
        label={fact.label}
        value={fact.value}
        size="full"
        hoverText={fact.hoverText}
        wrap
      />
    </span>
  )
}

export function EntityPageStamps({
  meta,
  name,
  legalStartingPattern = false,
  lead,
}: EntityPageStampsProps) {
  const { stats: leadFacts, action: actionFacts } = splitStatLine(meta.facts)
  // Each chip's place from the end, in the stat order (`fillAt`).
  const parts = [
    lead ? 1 : 0,
    legalStartingPattern ? 1 : 0,
    meta.stats.length,
    leadFacts.length,
    meta.actionTypes.length,
    actionFacts.length,
    meta.tags.length,
    meta.cost ? 1 : 0,
  ]
  const count = parts.reduce((sum, n) => sum + n, 0)
  const startOf = (part: number) => parts.slice(0, part).reduce((sum, n) => sum + n, 0)
  const placeOf = (part: number, index = 0) => count - 1 - startOf(part) - index
  return (
    // Its fill, gap and alignment are `.su-entity-stamps`'.
    <div className="su-entity-stamps">
      {lead && (
        <span className="su-entity-stamps__item" style={fillAt(placeOf(0))}>
          {lead}
        </span>
      )}
      {legalStartingPattern && (
        <span className="su-entity-stamps__item" style={fillAt(placeOf(1))}>
          <Badge
            shape="stamp"
            size="compact"
            className="su-entity-stamp"
            title={LEGAL_STARTING_PATTERN_NOTE}
          >
            {LEGAL_STARTING_PATTERN}
          </Badge>
        </span>
      )}
      <StatColumn
        stats={meta.stats}
        // Its own name: a chassis page's body column is "<name> stats".
        label={name ? `${name} header stats` : 'Header stats'}
        cellStyle={(index) => fillAt(placeOf(2, index))}
      />
      {leadFacts.map((fact, index) => bandFact(fact, placeOf(3, index)))}
      {meta.actionTypes.map((actionType, index) => (
        <span key={actionType} className="su-entity-stamps__item" style={fillAt(placeOf(4, index))}>
          <Badge shape="stamp" size="compact" className="su-entity-stamp">
            {actionType}
          </Badge>
        </span>
      ))}
      {actionFacts.map((fact, index) => bandFact(fact, placeOf(5, index)))}
      {meta.tags.map((tag, index) => (
        <span key={tag.key} className="su-entity-stamps__item" style={fillAt(placeOf(6, index))}>
          <Tag tag={tag} size="full" linkable />
        </span>
      ))}
      {meta.cost && (
        <span className="su-entity-stamps__item su-entity-cost" style={fillAt(0)}>
          <ActivationCost cost={meta.cost.value} currency={meta.cost.currency} />
        </span>
      )}
    </div>
  )
}
