/**
 * On-demand seeding of the built-in "The Eldridge Coast" workspace.
 *
 * Mirrors the Starter Set seeder (lib/starterSet/seedStarterSet.ts): the roster
 * is NOT seeded eagerly (no DB migration). It is spawned into THIS browser's
 * IndexedDB the first time the user opens the Eldridge Coast workspace — see the
 * Roster's workspace-select handler. Everything is written in one transaction
 * from the static records in `./eldridgeCoast`, then the stores rehydrate so the
 * dashboard renders the roster immediately.
 *
 * Idempotent, and it never resurrects deletions: the guard is the workspace's
 * existence. If the workspace is present the seed is skipped (so deleting an
 * individual member and re-opening does not bring it back). If the user deletes
 * the whole workspace, re-opening it spawns a fresh copy.
 */

import { useEntityStore } from '../../stores/entityStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { atomicWrite } from '../db'
import type { AtomicWriteOp } from '../db'
import { STORE_NAMES } from '../db/stores'
import {
  ELDRIDGE_CRAWLERS,
  ELDRIDGE_MECHS,
  ELDRIDGE_PILOTS,
  ELDRIDGE_SOFT_LINKS,
  ELDRIDGE_WORKSPACE,
  ELDRIDGE_WORKSPACE_ID,
} from './eldridgeCoast'

/** Whether the Eldridge Coast workspace already exists in the in-memory store. */
export function isEldridgeCoastSeeded(): boolean {
  return useWorkspaceStore
    .getState()
    .list()
    .some((w) => w.id === ELDRIDGE_WORKSPACE_ID)
}

/**
 * Spawn the Eldridge Coast roster into this browser once, on first visit. No-op
 * if the workspace already exists. Deterministic ids make the single
 * transaction safe to re-run (a double-click overwrites rather than duplicates).
 */
export async function ensureEldridgeCoastSeeded(): Promise<void> {
  await useWorkspaceStore.getState().hydrate()
  if (isEldridgeCoastSeeded()) return

  const put = (storeName: string, record: { id: string }): AtomicWriteOp => ({
    op: 'put',
    storeName,
    record,
  })

  await atomicWrite([
    put(STORE_NAMES.workspaces, ELDRIDGE_WORKSPACE),
    ...ELDRIDGE_PILOTS.map((r) => put(STORE_NAMES.pilots, r)),
    ...ELDRIDGE_MECHS.map((r) => put(STORE_NAMES.mechs, r)),
    ...ELDRIDGE_CRAWLERS.map((r) => put(STORE_NAMES.crawlers, r)),
    ...ELDRIDGE_SOFT_LINKS.map((r) => put(STORE_NAMES.softLinks, r)),
  ])

  // Reflect the newly-written rows in memory so the dashboard renders them.
  await useWorkspaceStore.getState().rehydrate()
  await Promise.all(
    (['pilot', 'mech', 'crawler', 'softLink'] as const).map((t) =>
      useEntityStore.getState().rehydrate(t)
    )
  )
}
