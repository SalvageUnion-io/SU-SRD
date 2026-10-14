import type { ReactNode } from 'react'
import { splitStatLine } from 'salvageunion-reference'
import { Seam } from '../../../entity/parts/Seam'
import { Tag } from '../../../entity/parts/Tags'
import { ActivationCost } from '../../atoms/ActivationCost'
import { Badge } from '../../atoms/Badge'
import { Stat } from '../../atoms/Stat'
import { StatColumn } from '../../atoms/StatColumn'
import type { StatItem } from '../../containers/statsBarTypes'
import type { EntityPageMeta } from './entityPage'
import { LEGAL_STARTING_PATTERN, LEGAL_STARTING_PATTERN_NOTE } from './legalStartingPattern'

/**
 * EntityPageStamps — what an entity Page's chapter band carries right of its
 * title (boards 07, 08; EDL E20) — an SRD route's and ITUN's detail dialog's
 * alike — as one line that wraps: `lead` (a pattern's
 * parent link), the Legal Starting Pattern stamp, then every chip the entity
 * carries (E17; the page body holds none, owner's call 2026-10-14), in the
 * stat order: its stats (Tech Level first, at the band's compact size; a
 * chassis's lead its page body instead), its action type and facets
 * (`RNG | Close`), its traits, linking to their entries, and last its cost in
 * the pointy box, a wider gap (`Seam`) between the groups;
 * then `end` (the SRD page's "Build With This"). An ability's level is the band's
 * `lead`, left of the title. Never the kind (E9: the title says it to screen
 * readers, the foot band stamps it). Every chip is at the stat column's height
 * and type (`.su-entity-stamp`, `.su-entity-stamps .su-stat-plate`). The same
 * facts the card's own chips show, resolved by `resolveEntityPageMeta` so the
 * page cannot describe an entity differently from its own card.
 */

type EntityPageStampsProps = {
  meta: EntityPageMeta
  /** The page's title, naming its stats for a screen reader ("Gopher stats"). */
  name?: string
  /** A pattern the book sanctions as a starting build: its stamp after the parent link. */
  legalStartingPattern?: boolean
  /** Before the stamps: the link to what the entity is built on. */
  lead?: ReactNode
  /** After the stamps: the page's action. */
  end?: ReactNode
}

function bandFact(fact: StatItem) {
  return (
    <Stat
      key={fact.key}
      orientation="horizontal"
      label={fact.label}
      value={fact.value}
      size="full"
      hoverText={fact.hoverText}
      wrap
    />
  )
}

export function EntityPageStamps({
  meta,
  name,
  legalStartingPattern = false,
  lead,
  end,
}: EntityPageStampsProps) {
  const { stats: leadFacts, action: actionFacts } = splitStatLine(meta.facts)
  return (
    // Its wrap, gap and alignment are `.su-entity-stamps`': balanced rows.
    <div className="su-entity-stamps">
      {lead}
      {legalStartingPattern && (
        <Badge
          shape="stamp"
          size="compact"
          className="su-entity-stamp"
          title={LEGAL_STARTING_PATTERN_NOTE}
        >
          {LEGAL_STARTING_PATTERN}
        </Badge>
      )}
      <StatColumn stats={meta.stats} label={name ? `${name} stats` : 'Stats'} />
      {leadFacts.map(bandFact)}
      {meta.stats.length + leadFacts.length > 0 &&
        meta.actionTypes.length + actionFacts.length > 0 && <Seam />}
      {meta.actionTypes.map((actionType) => (
        <Badge key={actionType} shape="stamp" size="compact" className="su-entity-stamp">
          {actionType}
        </Badge>
      ))}
      {actionFacts.map(bandFact)}
      {meta.tags.length > 0 &&
        meta.stats.length + meta.actionTypes.length + meta.facts.length > 0 && <Seam />}
      {meta.tags.map((tag) => (
        <Tag key={tag.key} tag={tag} rung="full" linkable />
      ))}
      {meta.cost && (
        <span className="su-entity-cost">
          <ActivationCost cost={meta.cost.value} currency={meta.cost.currency} />
        </span>
      )}
      {end}
    </div>
  )
}
