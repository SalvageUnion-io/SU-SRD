import type { EntityRef } from 'salvageunion-reference'
import { Chips, relation, Tag } from '../../entity'
import { relationChips } from './abilityTreeRelations'
import type { EntityPageMeta } from './entityPage'
import type { HomebrewCredit } from './HomebrewCreditChip'
import { HomebrewCreditChip } from './HomebrewCreditChip'
import { labelChips } from './labelChips'

/**
 * EntityPageStamps — what an entity Page's chapter band carries right of its
 * title (EDL E20) — an SRD route's and the app's detail dialog's
 * alike — as one `Chips` strip that wraps (`chips-and-actions.md` C2a), in the
 * class order (C2): the Legal Starting Pattern stamp or a player-made page's
 * dashed HOMEBREW stamp (a mark), then every chip
 * the entity carries (E17; the page body holds none): its stats under their
 * full names (Tech Level first; a
 * chassis's lead its page body instead), its action type and facets
 * (`RNG | Close`), its traits, linking to their entries, what it is built on
 * (a pattern's `CHASSIS | Mazona`, a relation) and what it is linked to (an
 * ability's `TREE | Leadership`), and last its cost in the
 * pointy box, every chip the same gap apart (the SRD page's "Build With This"
 * is the band's `action`, after them). An ability's level is the band's
 * `lead`, left of the title. Never the kind (E9: the title says it to screen
 * readers). Every chip is at Full, the Page's own size (its action cards
 * keep their Compact strips), and what overflows to the
 * page's first row keeps its size. The same facts the card's own chips
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
  /**
   * A player made it (a saved pattern): the dashed HOMEBREW stamp, the band's
   * mark where a book pattern may wear Legal Starting Pattern (ruleset §3.9).
   */
  homebrew?: boolean
  /**
   * A built-in Homebrew Pattern's credit, beside its HOMEBREW stamp: where it
   * was published and who designed it (`MECH MONDAY | Murkdice`), linking the
   * post it came from.
   */
  credit?: HomebrewCredit
}

export function EntityPageStamps({
  meta,
  legalStartingPattern = false,
  parent,
  homebrew = false,
  credit,
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
            <Tag
              key="parent"
              tag={relation('parent', parent.label, parent.ref.name, {
                ref: parent.ref,
                href: parent.href,
              })}
              linkable
              size="full"
              wrap
            />
          ),
          ...relationChips(meta.relations, 'full'),
        ],
      }}
      marks={
        legalStartingPattern || homebrew
          ? [
              ...labelChips(
                { seal: undefined, axisMarkers: [], legalStartingPattern, userMade: homebrew },
                'full'
              ),
              credit && <HomebrewCreditChip key="credit" credit={credit} size="full" linkable />,
            ]
          : undefined
      }
    />
  )
}
