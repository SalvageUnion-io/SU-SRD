/**
 * On-demand seeding of the built-in Starter Set workspace.
 *
 * The roster is NOT seeded eagerly (no DB migration). Instead it is spawned into
 * THIS browser's IndexedDB the first time the user opens the Starter Set
 * workspace — see the Dashboard's workspace-select handler. Everything is
 * written in one transaction from the static records in `./starterSet`, then the
 * stores rehydrate so the dashboard renders the crew immediately.
 *
 * Idempotent, and it never resurrects deletions: the guard is the workspace's
 * existence. If the workspace is present the seed is skipped (so deleting an
 * individual pilot and re-opening does not bring it back). If the user deletes
 * the whole Starter Set workspace, re-opening it spawns a fresh copy — the
 * intended "summon the built-in set" behaviour.
 */

import { useEntityStore } from '../../stores/entityStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { atomicWrite } from '../db'
import type { AtomicWriteOp } from '../db'
import { STORE_NAMES } from '../db/stores'
import {
  STARTER_CRAWLERS,
  STARTER_MECHS,
  STARTER_PILOTS,
  STARTER_SOFT_LINKS,
  STARTER_WORKSPACE,
  STARTER_WORKSPACE_ID,
} from './starterSet'

/** Whether the Starter Set workspace already exists in the in-memory store. */
export function isStarterSetSeeded(): boolean {
  return useWorkspaceStore
    .getState()
    .list()
    .some((w) => w.id === STARTER_WORKSPACE_ID)
}

/**
 * Spawn the Starter Set roster into this browser once, on first visit. No-op if
 * the workspace already exists. Deterministic ids make the single transaction
 * safe to re-run (a double-click overwrites rather than duplicates).
 */
export async function ensureStarterSetSeeded(): Promise<void> {
  await useWorkspaceStore.getState().hydrate()
  if (isStarterSetSeeded()) return

  const put = (storeName: string, record: { id: string }): AtomicWriteOp => ({
    op: 'put',
    storeName,
    record,
  })

  await atomicWrite([
    put(STORE_NAMES.workspaces, STARTER_WORKSPACE),
    ...STARTER_PILOTS.map((r) => put(STORE_NAMES.pilots, r)),
    ...STARTER_MECHS.map((r) => put(STORE_NAMES.mechs, r)),
    ...STARTER_CRAWLERS.map((r) => put(STORE_NAMES.crawlers, r)),
    ...STARTER_SOFT_LINKS.map((r) => put(STORE_NAMES.softLinks, r)),
  ])

  // Reflect the newly-written rows in memory so the dashboard renders them.
  await useWorkspaceStore.getState().rehydrate()
  await Promise.all(
    (['pilot', 'mech', 'crawler', 'softLink'] as const).map((t) =>
      useEntityStore.getState().rehydrate(t)
    )
  )
}
