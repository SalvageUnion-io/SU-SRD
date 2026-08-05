import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { ConnectionMode } from '../lib/connection/connectionMode'
import {
  isSettlingConnection,
  resolveConnectionMode,
  usesServerOfRecord,
} from '../lib/connection/connectionMode'
import { convexClient } from '../lib/connection/convexClient'
import { captureException } from '../lib/observability'

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
type AuthState = {
  signedIn: boolean
  online: boolean
  /**
   * Whether the auth layer has finished deciding. Optional so a caller that
   * predates the handshake fix keeps its meaning, and defaulted to `true`
   * because the *absence* of a push is a build with no auth layer at all
   * (`convexConfigured` is then false and the mode is Solo regardless).
   */
  authSettled?: boolean
}

/**
 * Read once per write rather than subscribed — the store is not a component.
 *
 * The initial value has to be one that cannot block a Solo build's writes, and
 * `authSettled: true` is that value: with no Convex URL compiled in,
 * `selectBackend` short-circuits to Solo before this is consulted, and with one
 * compiled in `ConnectionProvider` pushes the real value on mount.
 */
let authState: AuthState = { signedIn: false, online: true, authSettled: true }

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
/** The mode the store layer currently believes it is in. */
function currentMode(): ConnectionMode {
  return resolveConnectionMode({
    convexConfigured: convexClient !== null,
    authSettled: authState.authSettled ?? true,
    signedIn: authState.signedIn,
    online: authState.online,
  })
}

export function selectBackend(): BackendKind {
  const mode = currentMode()
  if (mode === 'solo') return 'local'
  if (usesServerOfRecord(mode)) return 'remote'
  // `connecting` lands here alongside `disconnected`, and deliberately: writing
  // locally before the handshake resolves is exactly the silent fork this
  // module exists to prevent.
  return 'blocked'
}

/**
 * Why a write was refused. Two states, two different things to say to a player:
 * one is a condition they have to wait out, the other resolves by itself in a
 * moment and only needs "try that again".
 */
export type BlockedWriteReason = 'offline' | 'settling'

/**
 * Thrown when a write is attempted while the server of record is unreachable.
 *
 * The message is user-facing copy, not a developer string: it is what the
 * refusal toast shows, so it says the consequence rather than the condition.
 * The class name is kept (rather than renamed for the settling case) because
 * call sites narrow on it with `instanceof`.
 */
export class WritesBlockedOffline extends Error {
  readonly reason: BlockedWriteReason

  constructor(reason: BlockedWriteReason = 'offline') {
    super(
      reason === 'settling'
        ? 'Still signing in — that change was not saved. Try again in a moment.'
        : 'Not connected — your games are read-only until the connection returns'
    )
    this.name = 'WritesBlockedOffline'
    this.reason = reason
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
    // Never surfaced as a failed user action: the local write stands. But
    // "don't interrupt the user" is not a reason to hide it from operators —
    // a mirror failure means IndexedDB has diverged from Convex, the declared
    // server of record (ADR-030), and a console line in one player's browser
    // is not a signal anyone will ever see.
    console.warn('[itun] failed to mirror write to the server of record', err)
    captureException(err, { source: 'mirrorWrite', type, op: op.kind })
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
    // See mirrorWrite: swallowed for the user, reported to operators.
    console.warn('[itun] failed to mirror crawler write to the server of record', err)
    captureException(err, { source: 'mirrorCrawlerWrite', op: op.kind })
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
  if (backend === 'blocked') {
    throw new WritesBlockedOffline(isSettlingConnection(currentMode()) ? 'settling' : 'offline')
  }
  return backend
}
