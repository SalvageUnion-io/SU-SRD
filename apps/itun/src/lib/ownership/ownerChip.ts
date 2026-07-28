/**
 * The owner chip (ADR-030, D32).
 *
 * Every entity row in a Game shows who holds it. This module produces the chip
 * *content* as data; the rendering goes through the entity card's existing
 * `controls` API as a `badge`, which is why there is no component here.
 *
 * That choice is deliberate and worth stating: `component-lib` is shared with
 * `apps/srd`, which has no accounts and never will. Teaching the card about
 * users would push an ITUN-only concept into a package whose contract is to
 * stay backend-agnostic. Passing a `badge` in from the app keeps the knowledge
 * where it belongs, and `badge` renders at every card extent — full, head, and
 * catalog — so a dense listing row and an expanded card show the same chip.
 */

/** How an entity's ownership should read on a card. */
export type OwnerChip = {
  /** The text on the chip. Never empty — see `UNCLAIMED_LABEL`. */
  label: string
  /** True when nobody owns this entity. Callers may style it differently. */
  unclaimed: boolean
  /** True when the viewer owns it, for a subtler "yours" treatment. */
  mine: boolean
}

/**
 * What an ownerless entity reads as.
 *
 * **Unclaimed is a rendered state, not a blank.** An ownerless pilot is a
 * normal, useful thing — a pre-gen waiting to be handed out — and rendering it
 * as an empty chip would make it look broken rather than available. This is the
 * single most likely place for the nullable `ownerId` to leak as a visual bug.
 */
export const UNCLAIMED_LABEL = 'Unclaimed'

export type OwnerLookup = {
  /** The viewer, so their own entities can read as "You". */
  viewerId: string | null
  /** userId → display name, from the Game roster. */
  namesById: ReadonlyMap<string, string>
}

/**
 * Resolve the chip for an entity.
 *
 * The fallback order matters: a name we cannot resolve is still an owned
 * entity, so it must not silently collapse into "Unclaimed" — that would tell
 * a Mediator a pilot is free to assign when it is not. An unknown owner reads
 * as a crewmate whose name has not loaded, which is honest.
 */
export function ownerChipFor(ownerId: string | null | undefined, lookup: OwnerLookup): OwnerChip {
  if (ownerId === null || ownerId === undefined) {
    return { label: UNCLAIMED_LABEL, unclaimed: true, mine: false }
  }

  if (lookup.viewerId !== null && ownerId === lookup.viewerId) {
    return { label: 'You', unclaimed: false, mine: true }
  }

  const name = lookup.namesById.get(ownerId)
  return {
    // Owned but unresolved — NOT unclaimed. Conflating the two would offer a
    // Mediator an entity that already belongs to somebody.
    label: name ?? 'Crewmate',
    unclaimed: false,
    mine: false,
  }
}

/**
 * Whether the viewer may edit this entity.
 *
 * Mirrors the server rule exactly (`assertMayWrite`): the owner may write, and
 * nobody else — not even a Mediator, who proposes instead. Unclaimed entities
 * are not editable until assigned, so a pre-gen cannot be quietly taken by
 * editing it.
 *
 * This is a *courtesy* for the UI, never the boundary. The server check is the
 * boundary, and it is tested separately.
 */
export function viewerMayEdit(
  ownerId: string | null | undefined,
  viewerId: string | null
): boolean {
  if (viewerId === null) return false
  if (ownerId === null || ownerId === undefined) return false
  return ownerId === viewerId
}
