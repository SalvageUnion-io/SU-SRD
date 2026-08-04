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
 *
 * And a fourth state that is *not* one of the three, which is why it is named:
 *
 *   **Connecting is not Solo.** While Convex is still completing its initial
 *   auth handshake nobody knows yet whether there is a session. Collapsing that
 *   window into Solo is what made it dangerous: writes went to IndexedDB and
 *   the mirror early-returned, so a crawler edit made in the first few hundred
 *   milliseconds after load was persisted locally and never sent — permanently,
 *   because the crawler mirror is a field patch that is never resent. Naming the
 *   window means writes are refused for it instead of silently forked.
 */

export const CONNECTION_MODES = ['solo', 'connecting', 'connected', 'disconnected'] as const

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
  /**
   * Whether the auth layer has finished deciding (`!isLoading && !isRefreshing`
   * from `useConvexAuth`).
   *
   * `signedIn` is meaningless until this is true: Convex reports
   * `isAuthenticated: false` for the whole initial handshake, which is
   * indistinguishable from a signed-out user by that flag alone. This input is
   * what makes the two distinguishable.
   *
   * Only the *initial* handshake is covered, and that is the whole of the
   * problem: Convex documents `isRefreshing` as only ever true while
   * `isAuthenticated` is also true, so routine token rotation never drops the
   * app out of `connected`.
   */
  authSettled: boolean
  /** Whether an authenticated session exists. */
  signedIn: boolean
  /** Whether the browser believes it has a network connection. */
  online: boolean
}

/**
 * Resolve the current mode.
 *
 * Order is deliberate: configuration, then settling, then identity, then
 * connectivity. A signed-out user is Solo *whatever* the network is doing,
 * because there is no server-of-record relationship to lose — but only once we
 * know they are signed out, which is what the settling check comes before
 * identity to establish.
 *
 * The `convexConfigured` gate stays first so a build with no `VITE_CONVEX_URL`
 * is permanently Solo and can never reach `connecting`: CI and a fresh checkout
 * have no auth layer to wait for.
 */
export function resolveConnectionMode(inputs: ConnectionInputs): ConnectionMode {
  if (!inputs.convexConfigured) return 'solo'
  if (!inputs.authSettled) return 'connecting'
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
 *
 * `connecting` blocks too, for a different reason: not "the server said no" but
 * "we do not yet know which store this belongs in". A write let through in that
 * window lands locally and is never mirrored.
 */
export function writesAllowed(mode: ConnectionMode): boolean {
  return mode !== 'disconnected' && mode !== 'connecting'
}

/**
 * Whether the NOT CONNECTED banner should show.
 *
 * Only ever true in `disconnected`. Showing it in Solo would tell a person with
 * a perfectly working offline app that something is wrong — and showing it for
 * the sub-second `connecting` handshake would flash a failure banner on every
 * single load, which is the same lie with a shorter fuse.
 */
export function shouldWarnDisconnected(mode: ConnectionMode): boolean {
  return mode === 'disconnected'
}

/**
 * Whether the app is still working out which mode it is in.
 *
 * Separate from `shouldWarnDisconnected` on purpose: this window wants a quiet
 * "signing in…" notice, not an alarm.
 */
export function isSettlingConnection(mode: ConnectionMode): boolean {
  return mode === 'connecting'
}

/** Whether reads/writes should be routed to Convex rather than IndexedDB. */
export function usesServerOfRecord(mode: ConnectionMode): boolean {
  return mode === 'connected'
}
