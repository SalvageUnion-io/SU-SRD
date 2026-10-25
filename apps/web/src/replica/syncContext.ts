import { createContext, useContext } from 'react'
import type { SyncStatus } from './sync'

/**
 * The sync status as the tree reads it (`SyncProvider`). Split from the
 * provider so the module exporting components exports nothing else.
 */
export type SyncState = {
  status: SyncStatus
  /**
   * Whether a write goes up now: `live` and not outdated. A surface that
   * offers an edit consults this, so no control looks live and then throws.
   */
  canWrite: boolean
  /**
   * Whether the player's own pilot, mech or NPC takes an edit now: live, or
   * offline, where it waits in the outbox. `canWrite` when left out.
   */
  canEditOwn?: boolean
  /** Below the backend's build floor: read-only until the tab reloads. */
  outdated: boolean
}

/**
 * Outside any provider (a component test) a tree reads as signed out, with
 * `canWrite` true so an editable surface renders without the auth layer. It
 * grants nothing: the replica refuses a write unless the status is `live`, so
 * a test that writes sets that (`signedInReplica()`).
 */
export const SIGNED_OUT: SyncState = { status: 'signedOut', canWrite: true, outdated: false }

export const SyncContext = createContext<SyncState>(SIGNED_OUT)

/** The sync status and what it permits. */
export function useSync(): SyncState {
  return useContext(SyncContext)
}
