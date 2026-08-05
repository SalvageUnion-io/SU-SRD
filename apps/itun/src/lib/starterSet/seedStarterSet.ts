/**
 * On-demand seeding of the built-in Starter Set roster.
 *
 * The roster is NOT seeded eagerly (no DB migration). It is spawned into THIS
 * browser's IndexedDB when the user asks for it from the Roster, written in one
 * transaction from the static records in `./starterSet`, after which the stores
 * rehydrate so the crew appears immediately.
 *
 * ## It lands on the Shelf
 *
 * It used to live in its own Workspace, which is what kept it from mixing into
 * the user's own builds. Workspaces are gone (ADR-030 §2) and the two remaining
 * containers are a shared Game and the personal Shelf — a Solo user has only
 * the latter, and a pre-built sample roster is not a shared campaign. So the
 * Shelf is where it goes, and the isolation it used to get from its own
 * container it no longer has. That is the honest consequence of the container
 * model rather than a regression to design around: the seed is opt-in, and
 * every seeded row is individually deletable.
 *
 * ## Idempotence
 *
 * The guard is the presence of the seeded rows themselves, not a container
 * record — with no Workspace to test for, the roster IS the evidence. Checking
 * every seeded pilot (rather than any) means a partially-deleted set re-seeds
 * to whole, while an intact one is skipped; deterministic ids keep the write
 * safe to re-run, so a double-click overwrites rather than duplicates.
 */

import { useEntityStore } from '../../stores/entityStore'
import type { AtomicWriteOp } from '../db'
import { atomicWrite } from '../db'
import { STORE_NAMES } from '../db/stores'
import { STARTER_CRAWLERS, STARTER_MECHS, STARTER_PILOTS, STARTER_SOFT_LINKS } from './starterSet'

/** Whether every Starter Set pilot is already present in this browser. */
export function isStarterSetSeeded(): boolean {
  const pilots = useEntityStore.getState().list('pilot')
  return STARTER_PILOTS.every((seed) => pilots.some((p) => p.id === seed.id))
}

/**
 * Spawn the Starter Set roster into this browser. No-op when it is already
 * fully present.
 */
export async function ensureStarterSetSeeded(): Promise<void> {
  await useEntityStore.getState().hydrate('pilot')
  if (isStarterSetSeeded()) return

  const put = (storeName: string, record: { id: string }): AtomicWriteOp => ({
    op: 'put',
    storeName,
    record,
  })

  await atomicWrite([
    ...STARTER_PILOTS.map((r) => put(STORE_NAMES.pilots, r)),
    ...STARTER_MECHS.map((r) => put(STORE_NAMES.mechs, r)),
    ...STARTER_CRAWLERS.map((r) => put(STORE_NAMES.crawlers, r)),
    ...STARTER_SOFT_LINKS.map((r) => put(STORE_NAMES.softLinks, r)),
  ])

  // Reflect the newly-written rows in memory so the roster renders them.
  await Promise.all(
    (['pilot', 'mech', 'crawler', 'softLink'] as const).map((t) =>
      useEntityStore.getState().rehydrate(t)
    )
  )
}
