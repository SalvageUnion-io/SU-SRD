/**
 * assignLink — the one client entry point for drawing an assignment (ADR-037).
 *
 * Every surface that wires a pilot to a mech, a pilot to a crawler or a mech to
 * a crawler calls this (and `assignCrew` puts an NPC in a crew slot), so none of them has to know which way round a link
 * points or what it replaces:
 *
 *  - the link type comes from the two ends (`resolveLinkType`), so a caller
 *    names *what* it is assigning to *what* and cannot pick the wrong kind;
 *  - the store's `create('softLink')` applies the assignment model — refused
 *    across containers, and REPLACING whatever it conflicts with (a pilot's
 *    old crawler, a mech's old pilot) in the same write;
 *  - a refusal arrives as a `LinkRefused` whose message is player copy, whether
 *    this browser saw it coming or the server said no.
 *
 * Unassigning stays `store.delete('softLink', id)`: removing a link has no
 * rules to apply beyond who may write its `from` end, which the server checks.
 */

import { useEntityStore } from '../../stores/entityStore'
import { serverMessage } from '../connection/serverError'
import type { EntityRef } from '../schemas/entity'
import type { CrewSlot, SoftLink } from '../schemas/softLink'
import { LinkRefused } from './linkRefused'
import { resolveLinkType } from './linkRules'

/** The write surface `assignLink` needs — the store, or a test double. */
export type LinkWriter = {
  create: (type: 'softLink', input: Omit<SoftLink, 'id' | 'createdAt'>) => Promise<SoftLink>
}

/** Assign `from` to `to`, replacing whatever that assignment displaces. */
export async function assignLink(
  from: EntityRef,
  to: EntityRef,
  store: LinkWriter = useEntityStore.getState()
): Promise<SoftLink> {
  const type = resolveLinkType(from.type, to.type)
  return await drawLink(store, {
    from: { type: from.type, id: from.id },
    to: { type: to.type, id: to.id },
    type,
  })
}

/**
 * Put a built NPC in one of a crawler's crew slots (ADR-043), replacing the
 * NPC's old slot and whoever filled this one. Only the crawler's writer may:
 * the server refuses anyone else, and that refusal arrives as `LinkRefused`.
 */
export async function assignCrew(
  npcId: string,
  crawlerId: string,
  slot: CrewSlot,
  store: LinkWriter = useEntityStore.getState()
): Promise<SoftLink> {
  return await drawLink(store, {
    from: { type: 'npc', id: npcId },
    to: { type: 'crawler', id: crawlerId },
    type: 'npc-to-crawler',
    slot,
  })
}

async function drawLink(
  store: LinkWriter,
  input: Omit<SoftLink, 'id' | 'createdAt'>
): Promise<SoftLink> {
  try {
    return await store.create('softLink', input)
  } catch (err) {
    // A server refusal (a `ConvexError`) carries copy written for a player;
    // anything else — offline, a defect — passes through untouched so the
    // caller's own handling (`WritesBlockedOffline`, `runWrite`) still applies.
    const message = serverMessage(err)
    if (message !== null) throw new LinkRefused(message, { cause: err })
    throw err
  }
}
