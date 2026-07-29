import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
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
 * Mirror a local write to the server of record, addressed by **app id**.
 *
 * An earlier attempt at this could not work: Convex mints its own `_id`, so a
 * client holding only its local UUID had nothing to address a row by. Creates
 * mirrored fine and edits silently no-opped — a mirror that looks synced and
 * is not. The fix is the indexed `appId` column, which lets one cheap lookup
 * stand in for a mapping table.
 *
 * Three properties that matter:
 *
 *  - **Upsert, not update.** An entity built while Solo has no server row until
 *    the account is claimed, so a missing row means "create it" rather than
 *    "fail". That is what makes the mirror converge instead of dropping the
 *    first edit after a claim.
 *  - **Fire-and-forget.** The local write already succeeded and is what the UI
 *    reads. A mirror failure must not roll it back or block the caller, so this
 *    returns void and swallows into a console warning.
 *  - **Only in `remote`.** In Solo there is no server to mirror to, and in
 *    Disconnected the write never got this far (`requireWritableBackend`).
 */
export async function mirrorWrite(
  type: 'pilot' | 'mech',
  op:
    | { kind: 'upsert'; appId: string; gameId: string | null; body: unknown }
    | { kind: 'delete'; appId: string }
): Promise<void> {
  if (selectBackend() !== 'remote' || convexClient === null) return

  const table = type === 'pilot' ? 'pilots' : 'mechs'
  try {
    if (op.kind === 'upsert') {
      await convexClient.mutation(api.entities.upsertByAppId, {
        table,
        appId: op.appId,
        gameId: op.gameId === null ? null : (op.gameId as Id<'games'>),
        body: op.body,
      })
    } else {
      await convexClient.mutation(api.entities.removeByAppId, { table, appId: op.appId })
    }
  } catch (err) {
    // Never surfaced as a failed user action: the local write stands.
    console.warn('[itun] failed to mirror write to the server of record', err)
  }
}

/**
 * Mirror a local **crawler** write. Separate from `mirrorWrite` because the
 * crawler's server contract is genuinely a different one, not a variant.
 *
 * Three differences, each of them a rule rather than an implementation detail:
 *
 *  - **Updates merge per field, they do not replace.** The crawler is communal
 *    and contended during Downtime, so this sends the *patch* rather than the
 *    whole body — two members editing scrap and cargo in the same minute both
 *    land (ADR-030 §5).
 *  - **There is no upsert.** Raising a crawler is the table runner's act, so a
 *    create is a create (`createCrawler`, which the server refuses for a
 *    player) and an edit can never quietly become one.
 *  - **Only inside a Game.** A shelved or Solo crawler has no server row and
 *    nothing to merge into.
 *
 * Fire-and-forget like the ownable mirror: the local write already succeeded
 * and is what the UI reads. A refusal here means the local copy is ahead of a
 * Game that did not accept it — see the known-gaps note in
 * `docs/architecture/accounts-and-games.md`.
 */
export async function mirrorCrawlerWrite(
  op:
    | { kind: 'create'; appId: string; gameId: string; body: unknown }
    | { kind: 'patch'; appId: string; patch: unknown }
    | { kind: 'delete'; appId: string }
): Promise<void> {
  if (selectBackend() !== 'remote' || convexClient === null) return

  try {
    if (op.kind === 'create') {
      await convexClient.mutation(api.entities.createCrawler, {
        gameId: op.gameId as Id<'games'>,
        appId: op.appId,
        body: op.body,
      })
    } else if (op.kind === 'patch') {
      await convexClient.mutation(api.entities.patchCrawlerByAppId, {
        appId: op.appId,
        patch: op.patch,
      })
    } else {
      await convexClient.mutation(api.entities.removeCrawlerByAppId, { appId: op.appId })
    }
  } catch (err) {
    console.warn('[itun] failed to mirror crawler write to the server of record', err)
  }
}

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
