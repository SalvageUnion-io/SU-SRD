import type { EntityRef } from 'salvageunion-reference'
import { Chips, EntityStat } from '../../entity'
import { relationChips } from './abilityTreeRelations'
import type { EntityPageMeta } from './entityPage'
import { labelChips } from './labelChips'

/**
 * EntityPageStamps — what an entity Page's chapter band carries right of its
 * title (boards 07, 08; EDL E20) — an SRD route's and the app's detail dialog's
 * alike — as one `Chips` strip that wraps (`chips-and-actions.md` C2a), in the
 * class order (C2): the Legal Starting Pattern stamp (a mark), then every chip
 * the entity carries (E17; the page body holds none, owner's call
 * 2026-10-14): its stats under their full names (Tech Level first; a
 * chassis's lead its page body instead), its action type and facets
 * (`RNG | Close`), its traits, linking to their entries, what it is built on
 * (a pattern's `CHASSIS | Mazona`, a relation) and what it is linked to (an
 * ability's `TREE | Leadership`, `PRECEDING`, `NEXT`), and last its cost in the
 * pointy box, every chip the same gap apart (the SRD page's "Build With This"
 * is the band's `action`, after them). An ability's level is the band's
 * `lead`, left of the title. Never the kind (E9: the title says it to screen
 * readers). Every chip is at the band's Compact
 * height and type (`.su-entity-stamps`). The same facts the card's own chips
 * show, resolved by `resolveEntityPageMeta` so the page cannot describe an
 * entity differently from its own card.
 *
 * From `sm` the strip fills from its bottom-right corner up: the cost takes
 * the corner and the earlier chips rise above it (`--su-fill`, `Chips`).
 */

type EntityPageStampsProps = {
  meta: EntityPageMeta
  /** A pattern the book sanctions as a starting build: its stamp, the band's mark. */
  legalStartingPattern?: boolean
  /** What the entity is built on (a pattern's chassis): its relation chip, `CHASSIS | Mazona`. */
  parent?: { label: string; ref: EntityRef; href?: string } | undefined
}

export function EntityPageStamps({
  meta,
  legalStartingPattern = false,
  parent,
}: EntityPageStampsProps) {
  const cost = meta.cost
    ? meta.cost.currency
      ? `${meta.cost.value} ${meta.cost.currency}`
      : meta.cost.value
    : undefined
  return (
    // Its fill, gap and alignment are `.su-entity-stamps`'.
    <Chips
      className="su-entity-stamps"
      size="full"
      linkable
      chips={{
        durations: meta.actionTypes,
        facts: [...meta.stats, ...meta.facts],
        tags: meta.tags,
        ...(cost ? { cost } : {}),
      }}
      nodes={{
        relation: [
          parent && (
            <EntityStat
              key="parent"
              label={parent.label}
              entityRef={parent.ref}
              {...(parent.href ? { href: parent.href } : {})}
            />
          ),
          ...relationChips(meta.relations),
        ],
      }}
      marks={
        legalStartingPattern
          ? labelChips({ seal: undefined, axisMarkers: [], legalStartingPattern }, 'full')
          : undefined
      }
    />
  )
}
