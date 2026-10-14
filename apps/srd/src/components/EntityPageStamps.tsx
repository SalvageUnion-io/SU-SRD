import type { EntityPageMeta } from 'component-lib'
import {
  ActivationCost,
  Badge,
  LEGAL_STARTING_PATTERN,
  LEGAL_STARTING_PATTERN_NOTE,
  Stat,
  StatColumn,
  Tag,
} from 'component-lib'
import type { ReactNode } from 'react'

/**
 * EntityPageStamps — what an entity page's chapter band carries right of its
 * title (boards 07, 08; EDL E20), as one line that wraps: `lead` (a pattern's
 * parent link), the Legal Starting Pattern stamp, then every chip the entity
 * carries (E17; the page body holds none, owner's call 2026-10-14): its action
 * type, the book's stats (Tech Level among them, in the book's order, at the
 * band's compact size; a chassis's lead its page body instead), its other facts (`RNG | Close`),
 * its traits, linking to their entries, and last its cost in the pointy box;
 * then `end` (the page's "Build With This"). An ability's level is the band's
 * `lead`, left of the title. Never the kind (E9: the title says it to screen
 * readers, the foot band stamps it). Every chip is at the stat column's height
 * and type (`.srd-entity-stamp`, `.srd-entity-stamps .su-stat-plate`). The same
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

export function EntityPageStamps({
  meta,
  name,
  legalStartingPattern = false,
  lead,
  end,
}: EntityPageStampsProps) {
  return (
    // Its wrap, gap and alignment are `.srd-entity-stamps`': balanced rows.
    <div className="srd-entity-stamps">
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
      {meta.actionTypes.map((actionType) => (
        <Badge key={actionType} shape="stamp" size="compact" className="srd-entity-stamp">
          {actionType}
        </Badge>
      ))}
      <StatColumn stats={meta.stats} label={name ? `${name} stats` : 'Stats'} />
      {meta.facts.map((fact) => (
        <Stat
          key={fact.key}
          orientation="horizontal"
          label={fact.label}
          value={fact.value}
          size="full"
          hoverText={fact.hoverText}
          wrap
        />
      ))}
      {meta.tags.map((tag) => (
        <Tag key={tag.key} tag={tag} rung="full" linkable />
      ))}
      {meta.cost && (
        <span className="srd-entity-cost">
          <ActivationCost cost={meta.cost.value} currency={meta.cost.currency} />
        </span>
      )}
      {end}
    </div>
  )
}
