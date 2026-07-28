/**
 * The three storage modes (ADR-030 §1).
 *
 * ITUN can be in exactly one of three states, and **every store, hook, and
 * surface has to be legible in all three**. Getting this wrong is the single
 * most likely source of regressions in the accounts work, so the decision is
 * isolated here as a pure function with no React and no I/O — it can be
 * exhaustively tested, and there is one place to look when a surface
 * misbehaves.
 *
 * The distinction that matters most:
 *
 *   **Solo is not Disconnected.** Somebody who never signs in is not "offline";
 *   they are using the app exactly as it worked before accounts existed. They
 *   see no banner, and no write of theirs is ever refused. Only a user who
 *   opted into a Game can end up in `disconnected`, and the read-only cost is
 *   the honest price of having chosen a server of record for shared state.
 */

export const CONNECTION_MODES = ['solo', 'connected', 'disconnected'] as const

export type ConnectionMode = (typeof CONNECTION_MODES)[number]

export type ConnectionInputs = {
  /**
   * Whether a Convex deployment URL was compiled in (`VITE_CONVEX_URL`).
   *
   * False is a legitimate, supported build: CI, a contributor who has not run
   * `convex dev`, or a deliberately backend-free deployment. Such a build is
   * permanently Solo rather than broken — which is only true because anonymous
   * play is first-class (ADR-030 §1).
   */
  convexConfigured: boolean
  /** Whether an authenticated session exists. */
  signedIn: boolean
  /** Whether the browser believes it has a network connection. */
  online: boolean
}

/**
 * Resolve the current mode.
 *
 * Order is deliberate: configuration, then identity, then connectivity. A
 * signed-out user is Solo *whatever* the network is doing, because there is no
 * server-of-record relationship to lose.
 */
export function resolveConnectionMode(inputs: ConnectionInputs): ConnectionMode {
  if (!inputs.convexConfigured) return 'solo'
  if (!inputs.signedIn) return 'solo'
  return inputs.online ? 'connected' : 'disconnected'
}

/**
 * Whether writes are permitted right now.
 *
 * Disconnected blocks writes rather than queueing them (ADR-030 §1): an outbox
 * would reintroduce conflict resolution through the back door, which is the
 * thing choosing a server of record was meant to avoid. Solo writes are never
 * blocked — IndexedDB is that user's source of truth, not a cache.
 */
export function writesAllowed(mode: ConnectionMode): boolean {
  return mode !== 'disconnected'
}

/**
 * Whether the NOT CONNECTED banner should show.
 *
 * Only ever true in `disconnected`. Showing it in Solo would tell a person with
 * a perfectly working offline app that something is wrong.
 */
export function shouldWarnDisconnected(mode: ConnectionMode): boolean {
  return mode === 'disconnected'
}

/** Whether reads/writes should be routed to Convex rather than IndexedDB. */
export function usesServerOfRecord(mode: ConnectionMode): boolean {
  return mode === 'connected'
}
