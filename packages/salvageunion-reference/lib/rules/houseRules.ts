/**
 * The house rules: every place the tools deliberately depart from the book.
 *
 * A house rule is a product decision, not a bug, but a player who knows the
 * book cannot see one unless it is named. So each is registered here once,
 * with the book's own rule cited by page, and two surfaces read this list:
 *
 *   - stat provenance: a contribution a house rule produces carries its
 *     `houseRule` id (`ResolvedContribution`), and its ledger line says
 *     "house rule";
 *   - the About pages of both apps list every entry.
 *
 * Adding a deviation means adding an entry here and tagging what it produces.
 *
 * Pure data ([ADR-006](../../../../docs/ARCHITECTURE.md#decisions)).
 */

/** The ids of the registered house rules. */
export type HouseRuleId = 'stat-training-follows-crawler'

export type HouseRule = {
  id: HouseRuleId
  /** A short name for the rule, as the About pages list it. */
  title: string
  /** Where the book states the rule this departs from, with page numbers. */
  cite: string
  /** What the tools do instead, and what that changes for a player. */
  deviation: string
}

export const HOUSE_RULES: readonly HouseRule[] = [
  {
    id: 'stat-training-follows-crawler',
    title: 'Stat Training follows the crawler',
    cite: 'Salvage Union core rulebook, pp. 224–225 (Pilot Bay, “Stat Training”)',
    deviation:
      'The book grants a one-off +2 HP and +1 AP for training during Downtime in each Pilot Bay from Tech 2 to Tech 6, in order. Here the bonus is derived from the current crawler’s Tech Level instead (+2 HP and +1 AP per tier above Tech 1), with no record of which tiers a pilot trained in, so moving to a lower-tier crawler lowers max HP and AP again. A table that tracks training strictly can correct it with the manual adjustment or a pinned value.',
  },
]
