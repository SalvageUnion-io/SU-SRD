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
  /**
   * False while signed in and offline, and while the initial auth handshake is
   * still in flight — see ADR-030 §1.
   *
   * Surfaces that offer an edit affordance must consult this. Not doing so is
   * how a Disconnected user ended up with a fully live-looking sheet whose every
   * control threw `WritesBlockedOffline` into an unhandled rejection.
   */
  canWrite: boolean
  /** True only in `disconnected`; never in Solo, never while `settling`. */
  showDisconnectedWarning: boolean
  /**
   * True only during the initial auth handshake.
   *
   * Distinguishes "we cannot write because the server said no" from "we cannot
   * write yet because we do not know who you are" — the same refusal, but one
   * resolves itself in a moment and should not be dressed as a failure.
   */
  settling: boolean
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
  settling: false,
}

export const ConnectionContext = createContext<ConnectionState>(SOLO_STATE)

/** The current storage mode and what it permits. */
export function useConnection(): ConnectionState {
  return useContext(ConnectionContext)
}
