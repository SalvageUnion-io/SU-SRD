/**
 * assignLink — the one client entry point for drawing an assignment (ADR-037).
 *
 * Every surface that wires a pilot to a mech, a pilot to a crawler or a mech to
 * a crawler calls this, so none of them has to know which way round a link
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
import type { SoftLink } from '../schemas/softLink'
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
  try {
    return await store.create('softLink', {
      from: { type: from.type, id: from.id },
      to: { type: to.type, id: to.id },
      type,
    })
  } catch (err) {
    // A server refusal (a `ConvexError`) carries copy written for a player;
    // anything else — offline, a defect — passes through untouched so the
    // caller's own handling (`WritesBlockedOffline`, `runWrite`) still applies.
    const message = serverMessage(err)
    if (message !== null) throw new LinkRefused(message, { cause: err })
    throw err
  }
}
