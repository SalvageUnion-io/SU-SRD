/**
 * cockpitLinks — SoftLink helpers for the Play Cockpit launch chooser (plan §8).
 *
 * Split out of CockpitChooser.tsx so the component module exports only a
 * component (Biome's useComponentExportOnlyModules / Fast Refresh rule).
 */

import type { SoftLink } from '../../lib/schemas/softLink'

/** Minimal SoftLink write surface — injectable for tests. */
export type LinkWriteStore = {
  create: (type: 'softLink', input: Omit<SoftLink, 'id' | 'createdAt'>) => Promise<SoftLink>
  delete: (type: 'softLink', id: string) => Promise<void>
}

/**
 * Ensure the SoftLinks the mech-kind composition reads exist, repairing any
 * conflicting outgoing link on the same source first (mech-to-pilot from the
 * chosen mech; pilot-to-crawler from the chosen pilot when a crawler is given).
 *
 * Reversible bookkeeping — safe to auto-apply (ADR-007). Writes go through the
 * same `softLink` create/delete the wiring components (useSoftLinks) use.
 */
export async function ensureCockpitLinks(args: {
  store: LinkWriteStore
  links: SoftLink[]
  pilotId: string
  mechId: string
  crawlerId?: string
}): Promise<void> {
  const { store, links, pilotId, mechId, crawlerId } = args

  // mech-to-pilot: exactly one outgoing link from the chosen mech → pilot.
  const mechLinks = links.filter((l) => l.type === 'mech-to-pilot' && l.from.id === mechId)
  const keptMech = mechLinks.find((l) => l.to.id === pilotId)
  for (const l of mechLinks) {
    if (l.id !== keptMech?.id) await store.delete('softLink', l.id)
  }
  if (!keptMech) {
    await store.create('softLink', {
      from: { type: 'mech', id: mechId },
      to: { type: 'pilot', id: pilotId },
      type: 'mech-to-pilot',
    })
  }

  if (!crawlerId) return

  // pilot-to-crawler: exactly one outgoing link from the chosen pilot → crawler.
  const crawlerLinks = links.filter((l) => l.type === 'pilot-to-crawler' && l.from.id === pilotId)
  const keptCrawler = crawlerLinks.find((l) => l.to.id === crawlerId)
  for (const l of crawlerLinks) {
    if (l.id !== keptCrawler?.id) await store.delete('softLink', l.id)
  }
  if (!keptCrawler) {
    await store.create('softLink', {
      from: { type: 'pilot', id: pilotId },
      to: { type: 'crawler', id: crawlerId },
      type: 'pilot-to-crawler',
    })
  }
}
