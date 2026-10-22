/**
 * The owner chip (ADR-030 §6): who holds an entity in a Game, as data. An
 * ownerless entity reads "Unassigned", never a blank (`UNASSIGNED_LABEL`). It
 * renders as the roster's `OwnerSeal` (`play/games/OwnerSeal.tsx`) and as a
 * linked unit's state chip in a sheet's `AssignedUnits` (`owner`).
 */

/** How an entity's ownership should read on a card. */
export type OwnerChip = {
  /** The text on the chip. Never empty — see `UNASSIGNED_LABEL`. */
  label: string
  /** True when nobody owns this entity. Callers may style it differently. */
  unassigned: boolean
  /** True when the viewer owns it, for a subtler "yours" treatment. */
  mine: boolean
}

/**
 * What an ownerless entity reads as.
 *
 * **Unassigned is a rendered state, not a blank.** An ownerless pilot is a
 * normal, useful thing — a pre-gen waiting to be handed out — and rendering it
 * as an empty chip would make it look broken rather than available. This is the
 * single most likely place for the nullable `ownerId` to leak as a visual bug.
 */
export const UNASSIGNED_LABEL = 'Unassigned'

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
 * entity, so it must not silently collapse into "Unassigned" — that would tell
 * a Mediator a pilot is free to assign when it is not. An unknown owner reads
 * as a crewmate whose name has not loaded, which is honest.
 */
export function ownerChipFor(ownerId: string | null | undefined, lookup: OwnerLookup): OwnerChip {
  if (ownerId === null || ownerId === undefined) {
    return { label: UNASSIGNED_LABEL, unassigned: true, mine: false }
  }

  if (lookup.viewerId !== null && ownerId === lookup.viewerId) {
    return { label: 'You', unassigned: false, mine: true }
  }

  const name = lookup.namesById.get(ownerId)
  return {
    // Owned but unresolved — NOT unassigned. Conflating the two would offer a
    // Mediator an entity that already belongs to somebody.
    label: name ?? 'Crewmate',
    unassigned: false,
    mine: false,
  }
}
