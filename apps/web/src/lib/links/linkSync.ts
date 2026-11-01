/**
 * A link as a server read serves it, and the local record it becomes
 * (ADR-037).
 */

import type { LinkShape } from 'game-domain/links/linkRules'
import type { SoftLink } from 'game-domain/schemas/softLink'

/**
 * The local record for a served link.
 *
 * A server link has no id of its own: its identity is the (type, from, to)
 * triple (an NPC fills one crew slot), so that stands in. It is stable, unique, and the
 * same on every device that reads it. A link drawn in this browser keeps the
 * id it was minted with; the two never need to agree, because nothing
 * addresses a link by id across the wire.
 */
export function softLinkOf(link: LinkShape): SoftLink {
  return {
    id: `${link.type}:${link.from.id}:${link.to.id}`,
    from: { type: link.from.type, id: link.from.id },
    to: { type: link.to.type, id: link.to.id },
    type: link.type,
    ...(link.slot === undefined ? {} : { slot: link.slot }),
  }
}
