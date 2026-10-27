/**
 * A link row as a server read serves it, and the local record it becomes
 * (ADR-037).
 */

import type { EntityRef } from 'game-domain/schemas/entity'
import type { CrewSlot, SoftLink } from 'game-domain/schemas/softLink'

/** A link row as `entities.listWiring` returns it. */
export type ServedLink = {
  _id: string
  _creationTime: number
  gameId: string | null
  from: EntityRef
  to: EntityRef
  type: SoftLink['type']
  /** The crew slot of an `npc-to-crawler` link (ADR-044); absent otherwise. */
  slot?: CrewSlot
}

/**
 * The local record for a served link.
 *
 * A server link has no id of its own — its identity is the (type, from, to)
 * triple, plus its crew slot — so the row id stands in: stable, unique, and the same on
 * every device that syncs it. A link drawn in this browser keeps the id it was
 * minted with; the two never need to agree, because nothing addresses a link
 * by id across the wire.
 */
export function softLinkFromServer(row: ServedLink): SoftLink {
  return {
    id: row._id,
    from: { type: row.from.type, id: row.from.id },
    to: { type: row.to.type, id: row.to.id },
    type: row.type,
    ...(row.slot === undefined ? {} : { slot: row.slot }),
    createdAt: new Date(row._creationTime).toISOString(),
  }
}
