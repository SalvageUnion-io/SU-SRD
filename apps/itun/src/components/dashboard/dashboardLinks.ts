/**
 * dashboardLinks — SoftLink helpers for the Dashboard launch chooser (plan §8).
 *
 * Split out of DashboardChooser.tsx so the component module exports only a
 * component (Biome's useComponentExportOnlyModules / Fast Refresh rule).
 */

import { assignLink } from '../../lib/links/assignLink'
import { resolveLinkType, sameLink } from '../../lib/links/linkRules'
import type { EntityRef } from '../../lib/schemas/entity'
import type { SoftLink } from '../../lib/schemas/softLink'

/** Minimal SoftLink write surface — injectable for tests. */
export type LinkWriteStore = {
  create: (type: 'softLink', input: Omit<SoftLink, 'id' | 'createdAt'>) => Promise<SoftLink>
  delete: (type: 'softLink', id: string) => Promise<void>
}

/**
 * Ensure the assignments the Dashboard reads exist for the chosen crew: the
 * mech flies the pilot, and — when a crawler is chosen — both the pilot and the
 * mech are aboard it. The mech's crawler is its OWN link since ADR-037, so the
 * pilot's crew link alone would leave the Dashboard's mech with no crawler.
 *
 * Each one goes through `assignLink`, which replaces whatever the assignment
 * displaces (the mech's old pilot, the pilot's old crawler, …) in the same
 * write, so this no longer repairs conflicts by hand. A link already in place
 * is left alone.
 *
 * Reversible bookkeeping — safe to auto-apply (ADR-007).
 */
export async function ensureDashboardLinks(args: {
  store: LinkWriteStore
  links: SoftLink[]
  pilotId: string
  mechId: string
  crawlerId?: string
}): Promise<void> {
  const { store, links, pilotId, mechId, crawlerId } = args
  const mech: EntityRef = { type: 'mech', id: mechId }
  const pilot: EntityRef = { type: 'pilot', id: pilotId }

  const wanted: Array<[EntityRef, EntityRef]> = [[mech, pilot]]
  if (crawlerId) {
    const crawler: EntityRef = { type: 'crawler', id: crawlerId }
    wanted.push([pilot, crawler], [mech, crawler])
  }

  for (const [from, to] of wanted) {
    const type = resolveLinkType(from.type, to.type)
    if (links.some((l) => sameLink(l, { from, to, type }))) continue
    await assignLink(from, to, store)
  }
}
