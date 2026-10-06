/**
 * useSoftLinks — returns incoming and outgoing SoftLinks for a given entity,
 * and provides assign/unassign actions.
 *
 * The `store` parameter is injectable for testing (dep-injection pattern,
 * no global mock.module() needed). In production, omit `store` and the hook
 * subscribes to `useEntityStore` so components re-render on SoftLink changes.
 *
 * `assign` goes through `assignLink` (ADR-037): the link type comes from the
 * two ends, and drawing it replaces whatever it conflicts with — a pilot's old
 * crawler, a mech's old pilot — in the same write.
 *
 * Orphan semantics: an injected store may hold a link whose endpoint is gone.
 * The real store cascades deletes, but consumers should still handle an
 * endpoint that no longer resolves.
 */

import { useSoftLinkList } from '../../hooks/entities'
import { assignLink } from '../../lib/links/assignLink'
import type { EntityRef } from '../../lib/schemas/entity'
import type { SoftLink } from '../../lib/schemas/softLink'
import { useEntityStore } from '../../stores/entityStore'

/** The entity types that can be endpoints in a SoftLink (excludes 'softLink' itself). */
type AssignTarget = EntityRef

type SoftLinkActions = {
  outgoing: SoftLink[]
  incoming: SoftLink[]
  /**
   * Creates a SoftLink from the owning entity to `target`.
   * The link type is inferred from the entity type pair.
   */
  assign: (target: AssignTarget) => Promise<SoftLink>
  /** Removes the SoftLink by id. Does not touch either endpoint entity. */
  unassign: (linkId: string) => Promise<void>
}

/** Minimal store surface needed — extracted for dep-injection in tests. */
export type SoftLinkStore = {
  softLinks: SoftLink[]
  create: (type: 'softLink', input: Omit<SoftLink, 'id' | 'createdAt'>) => Promise<SoftLink>
  delete: (type: 'softLink', id: string) => Promise<void>
}

type UseSoftLinksOptions = {
  entityType: EntityRef['type']
  entityId: string
  /** Injectable store snapshot for testing. When omitted, real Zustand store is used. */
  store?: SoftLinkStore
}

/**
 * useSoftLinks hook — subscribe-to-Zustand path (production).
 * When `store` is injected (tests), the hook still calls useEntityStore but
 * ignores its links in favour of the injected snapshot.
 */
export function useSoftLinks({
  entityType,
  entityId,
  store,
}: UseSoftLinksOptions): SoftLinkActions {
  // Always call the hook (Rules of Hooks). In test-with-injection path the
  // subscription result is unused; we use the injected snapshot instead.
  const subscribedLinks = useSoftLinkList()
  const allLinks: SoftLink[] = store ? store.softLinks : subscribedLinks

  const outgoing = allLinks.filter(
    (link) => link.from.type === entityType && link.from.id === entityId
  )
  const incoming = allLinks.filter((link) => link.to.type === entityType && link.to.id === entityId)

  async function assign(target: AssignTarget): Promise<SoftLink> {
    const s: SoftLinkStore = store ?? useEntityStore.getState()
    return assignLink({ type: entityType, id: entityId }, target, s)
  }

  async function unassign(linkId: string): Promise<void> {
    const s: SoftLinkStore = store ?? useEntityStore.getState()
    return s.delete('softLink', linkId)
  }

  return { outgoing, incoming, assign, unassign }
}
