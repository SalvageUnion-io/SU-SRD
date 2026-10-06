import { containerOf, sameContainer } from '../../container'
import type { LinkShape } from '../../links/linkRules'
import { impliedMechCrawlerLinks } from '../../links/linkRules'
import type { UpgradeTransaction } from './types'

/**
 * v16 → v17: give every docked mech its own `mech-to-crawler` link (ADR-037).
 *
 * A mech used to reach a crawler only through its pilot — `mech-to-pilot`,
 * then the pilot's `pilot-to-crawler`. The assignment model makes a mech's
 * crawler its own link and drops the transitive read entirely, so without this
 * every mech this browser holds would leave its bay the moment the new build
 * loads. This draws the link the old model implied: for a mech with a pilot
 * and no crawler of its own, whose pilot crews a crawler in the mech's own
 * container. The server-side twin is `maintenance.repairSoftLinks`.
 *
 * It matters most for a pre-account roster still waiting in IndexedDB: the
 * claim uploads whatever links it finds here, so a roster migrated after the
 * server repair has run still arrives with its mechs docked. A signed-in
 * cache is reconciled against the server by `WiringSync` either way.
 *
 * Idempotent: a mech that already has a crawler link is skipped. Newest links
 * win where the old code let a mech or pilot hold two, which is the order the
 * shared rule reads them in. The two imports are pure synchronous functions —
 * nothing here awaits anything but the transaction.
 */
export async function migrate(tx: UpgradeTransaction): Promise<void> {
  const linkStore = tx.objectStore('softLinks')
  const [links, mechs, crawlers] = await Promise.all([
    linkStore.getAll() as Promise<Array<LinkShape & { createdAt?: unknown }>>,
    tx.objectStore('mechs').getAll() as Promise<Array<{ id: string; gameId?: string | null }>>,
    tx.objectStore('crawlers').getAll() as Promise<Array<{ id: string; gameId?: string | null }>>,
  ])

  const mechById = new Map(mechs.map((m) => [m.id, m]))
  const crawlerById = new Map(crawlers.map((c) => [c.id, c]))
  const newestFirst = [...links].sort((a, b) =>
    String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
  )

  const implied = impliedMechCrawlerLinks(newestFirst, (mechId, crawlerId) => {
    const mech = mechById.get(mechId)
    const crawler = crawlerById.get(crawlerId)
    // Both ends must be here: a link to a row this browser does not hold could
    // not be shown to share a container, which is the rule it must keep.
    return (
      mech !== undefined &&
      crawler !== undefined &&
      sameContainer(containerOf(mech), containerOf(crawler))
    )
  })

  const createdAt = new Date().toISOString()
  for (const link of implied) {
    await linkStore.put({ id: crypto.randomUUID(), ...link, createdAt })
  }
}
