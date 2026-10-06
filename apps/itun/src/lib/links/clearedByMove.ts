/**
 * What a move clears, as this browser holds it — the confirm's half of
 * ADR-037's move prune.
 *
 * A move prunes every link whose other end would sit in a different container
 * (`linksBrokenByMove` in `linkRules.ts`). The store does that after the move
 * commits (`pruneLinksAfterMove` in `stores/entityStore.ts`); a confirm has to
 * say it before. Both go through {@link linksClearedByMove}, over the same held
 * entities and links, so a dialog can never name a different set from the one
 * the store then drops.
 *
 * Client only: the server prunes from its own rows in the move mutation. A
 * link whose other end this browser does not hold counts as cleared, exactly as
 * the store's prune treats it; it is named by kind alone.
 */

import type { Container, ContainerFields } from '../container'
import { containerOf } from '../container'
import type { EntityRef } from '../schemas/entity'
import type { LinkShape, SoftLinkType } from './linkRules'
import { linksBrokenByMove } from './linkRules'

type EndType = EntityRef['type']

/** One link end as this browser holds it: enough to place it and to name it. */
type HeldEntity = ContainerFields & { id: string; name: string }

/** What this browser holds — the entity store's three lists and its links. */
export type HeldEntities<L extends LinkShape = LinkShape> = {
  pilots: readonly HeldEntity[]
  mechs: readonly HeldEntity[]
  crawlers: readonly HeldEntity[]
  softLinks: readonly L[]
}

/** The entity being moved. */
type Moved = { type: EndType; id: string }

/** One assignment a move clears: the link's type, and who is on the other end. */
export type ClearedAssignment = {
  type: SoftLinkType
  /** The other end. `name` is null when this browser does not hold it. */
  other: { kind: EndType; name: string | null }
}

const LIST_OF: Readonly<Record<EndType, 'pilots' | 'mechs' | 'crawlers'>> = {
  pilot: 'pilots',
  mech: 'mechs',
  crawler: 'crawlers',
}

function heldEnd(held: HeldEntities, ref: Moved): HeldEntity | null {
  return held[LIST_OF[ref.type]].find((e) => e.id === ref.id) ?? null
}

/**
 * The link records a move of `moved` into `destination` drops — the store's
 * prune reads exactly this.
 */
export function linksClearedByMove<L extends LinkShape>(
  held: HeldEntities<L>,
  moved: Moved,
  destination: Container
): L[] {
  return linksBrokenByMove(held.softLinks, moved, destination, (ref) => {
    const end = heldEnd(held, ref)
    return end === null ? null : containerOf(end)
  })
}

/**
 * The same links as {@link linksClearedByMove}, described for a player: each
 * one's type and the other end's kind and name. Empty means the move clears
 * nothing.
 */
export function assignmentsClearedByMove(
  held: HeldEntities,
  moved: Moved,
  destination: Container
): ClearedAssignment[] {
  return linksClearedByMove(held, moved, destination).map((link) => {
    const other = link.from.type === moved.type && link.from.id === moved.id ? link.to : link.from
    return {
      type: link.type,
      other: { kind: other.type, name: heldEnd(held, other)?.name ?? null },
    }
  })
}
