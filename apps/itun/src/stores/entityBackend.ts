import { convexClient } from '../lib/connection/convexClient'
import { resolveConnectionMode, usesServerOfRecord } from '../lib/connection/connectionMode'

/**
 * Where entity writes actually go (ADR-030 §1).
 *
 * `entityStore` reaches its persistence through one indirection —
 * `dbStoreFor(type)` — so swapping the backend is a matter of changing what
 * that returns rather than rewriting the store. The store's public API, its
 * in-memory cache, its lazy hydration and its broadcast behaviour are all
 * untouched by this file.
 *
 * ## Solo remains the default, structurally
 *
 * `selectBackend` returns the **local** backend unless the app is genuinely
 * Connected. Not signed in, no Convex URL compiled in, offline — all resolve to
 * local. That ordering is deliberate: the failure mode of getting it wrong in
 * the other direction is a Solo user's writes silently going nowhere, which is
 * the single worst outcome in this whole migration.
 *
 * ## Disconnected does not fall back to local
 *
 * A signed-in user who loses connectivity is **read-only** (D14), not
 * quietly-writing-to-IndexedDB. Falling back would fork their data against the
 * server of record and reintroduce, by accident, the conflict resolution the
 * server-of-record decision exists to avoid. Callers check `canWrite` before
 * offering the affordance; this module refuses if they do not.
 */

/** Signed-in state as far as this module is concerned. */
type AuthState = { signedIn: boolean; online: boolean }

/** Read once per write rather than subscribed — the store is not a component. */
let authState: AuthState = { signedIn: false, online: true }

/**
 * Publish the current auth/connectivity state to the store layer.
 *
 * The store cannot call React hooks, so `ConnectionProvider` pushes the mode in
 * rather than the store pulling it out. One writer, one direction.
 */
export function setEntityBackendAuthState(next: AuthState): void {
  authState = next
}

export type BackendKind = 'local' | 'remote' | 'blocked'

/**
 * Which backend a write should use right now.
 *
 * Exported for tests and for surfaces that want to explain themselves — a
 * button that would be `blocked` should say why rather than fail on click.
 */
export function selectBackend(): BackendKind {
  const mode = resolveConnectionMode({
    convexConfigured: convexClient !== null,
    signedIn: authState.signedIn,
    online: authState.online,
  })
  if (mode === 'solo') return 'local'
  if (usesServerOfRecord(mode)) return 'remote'
  return 'blocked'
}

/** Thrown when a write is attempted while the server of record is unreachable. */
export class WritesBlockedOffline extends Error {
  constructor() {
    super('Not connected — your games are read-only until the connection returns')
    this.name = 'WritesBlockedOffline'
  }
}

/**
 * ## Why there is no write-mirroring here yet
 *
 * The obvious next step — write locally, then mirror the same change to Convex
 * — does not work, and it is worth writing down so nobody rediscovers it the
 * hard way. Local records are keyed by an app-level `id` (a UUID minted by
 * `crud.ts`); Convex rows are keyed by its own `_id`. A create can be mirrored
 * because it needs no prior key, but an **update or delete has nothing to
 * address**: there is no id map between the two, so the mirror would either
 * silently no-op or need a lookup-by-body on every write.
 *
 * A mirror that works for creates and quietly fails for edits is worse than no
 * mirror, because it looks synced. The real cutover is the one ADR-030
 * describes — when Connected, Convex IS the source of truth and the store
 * reads from a reactive subscription rather than from IndexedDB — and that
 * needs the id mapping (or app-id-as-primary-key on the Convex side) decided
 * first. This module deliberately ships only the part that is sound.
 */

/**
 * Guard a write against the current mode.
 *
 * Called by the store before it touches persistence. Returns the backend to
 * use; throws rather than silently degrading when the answer is "you cannot
 * write right now".
 */
export function requireWritableBackend(): Exclude<BackendKind, 'blocked'> {
  const backend = selectBackend()
  if (backend === 'blocked') throw new WritesBlockedOffline()
  return backend
}
