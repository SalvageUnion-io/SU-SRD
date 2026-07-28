import { createContext, useContext } from 'react'

import type { ConnectionMode } from './connectionMode'

/**
 * The connection context and its consumer hook.
 *
 * Split out from `ConnectionProvider.tsx` because that file exports React
 * components, and a module that exports both components and non-components
 * breaks Fast Refresh (Biome's `useComponentExportOnlyModules`). The provider
 * imports from here; consumers import `useConnection` from here too.
 */

export type ConnectionState = {
  mode: ConnectionMode
  /** False only while signed in and offline — see ADR-030 §1. */
  canWrite: boolean
  /** True only in `disconnected`; never in Solo. */
  showDisconnectedWarning: boolean
}

/**
 * The default is Solo, and that is load-bearing rather than arbitrary: a
 * component rendered outside any provider (a test, a story, a stray subtree)
 * should behave like the fully-local pre-accounts app, never like a broken
 * connected one. Defaulting to `disconnected` would make such a component
 * silently refuse writes.
 */
export const SOLO_STATE: ConnectionState = {
  mode: 'solo',
  canWrite: true,
  showDisconnectedWarning: false,
}

export const ConnectionContext = createContext<ConnectionState>(SOLO_STATE)

/** The current storage mode and what it permits. */
export function useConnection(): ConnectionState {
  return useContext(ConnectionContext)
}
