/**
 * useSoftLinks — returns incoming and outgoing SoftLinks for a given entity,
 * and provides assign/unassign actions.
 *
 * The `store` parameter is injectable for testing (dep-injection pattern,
 * no global mock.module() needed). In production, omit `store` and the hook
 * subscribes to `useEntityStore` so components re-render on SoftLink changes.
 *
 * Orphan semantics: deleting a linked entity does NOT cascade. The SoftLink
 * record remains, pointing at a now-missing entity. Consumers should handle
 * the case where an endpoint entity no longer exists in the store.
 */

import { useEntityStore } from '../../stores/entityStore'
import type { SoftLink } from '../../lib/schemas/softLink'
import type { EntityRef } from '../../lib/schemas/entity'

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
  const subscribedLinks = useEntityStore((s) => s.softLinks)
  const allLinks: SoftLink[] = store ? store.softLinks : subscribedLinks

  const outgoing = allLinks.filter(
    (link) => link.from.type === entityType && link.from.id === entityId
  )
  const incoming = allLinks.filter((link) => link.to.type === entityType && link.to.id === entityId)

  async function assign(target: AssignTarget): Promise<SoftLink> {
    const linkType = resolveLinkType(entityType, target.type)
    const s: SoftLinkStore = store ?? useEntityStore.getState()
    return s.create('softLink', {
      from: { type: entityType, id: entityId },
      to: target,
      type: linkType,
    })
  }

  async function unassign(linkId: string): Promise<void> {
    const s: SoftLinkStore = store ?? useEntityStore.getState()
    return s.delete('softLink', linkId)
  }

  return { outgoing, incoming, assign, unassign }
}

/**
 * Maps two entity type ends to a SoftLink type discriminant.
 * Throws for unsupported pairings.
 */
export function resolveLinkType(
  fromType: EntityRef['type'],
  toType: EntityRef['type']
): SoftLink['type'] {
  if (fromType === 'mech' && toType === 'pilot') return 'mech-to-pilot'
  if (fromType === 'pilot' && toType === 'crawler') return 'pilot-to-crawler'
  throw new Error(
    `No SoftLink type defined for ${fromType} → ${toType}. ` +
      `Supported: mech→pilot, pilot→crawler.`
  )
}
