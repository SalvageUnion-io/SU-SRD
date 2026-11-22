import type { GameStore, UnitRow } from './store'

/**
 * Which units `actor` may read (ADR-030 §5): every pilot, mech and crawler,
 * for any member; nothing for a non-member. An NPC in a Game is its
 * Mediator's (r3 A3): the table runner reads it, and whoever made it; the
 * rest of the table only one that crews a crawler, which that crawler's
 * sheet shows them. The room withholds every other, so a player who follows
 * its address is served nothing of it.
 */
export function readerOf(store: GameStore, actor: string): (unit: UnitRow) => boolean {
  const member = store.member(actor)
  if (member === null) return () => false
  if (store.isTableRunner(member)) return () => true
  return (unit) =>
    unit.kind !== 'npc' ||
    unit.ownerId === actor ||
    store.linksTouching(unit.id).some((link) => link.type === 'npc-to-crawler')
}

/** The ids of the units the room withholds from `actor` (`readerOf`). */
export function hiddenFrom(store: GameStore, actor: string): ReadonlySet<string> {
  const reads = readerOf(store, actor)
  return new Set(
    store
      .units('npc')
      .filter((unit) => !reads(unit))
      .map((unit) => unit.id)
  )
}
