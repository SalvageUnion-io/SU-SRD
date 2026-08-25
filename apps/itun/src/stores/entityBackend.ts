import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { ConnectionMode } from '../lib/connection/connectionMode'
import {
  isSettlingConnection,
  resolveConnectionMode,
  usesServerOfRecord,
} from '../lib/connection/connectionMode'
import { convexClient } from '../lib/connection/convexClient'
import type { LegacyProbeState } from '../lib/db/legacyLocalData'
import { legacyLocalDataState } from '../lib/db/legacyLocalData'
import type { EntityRef } from '../lib/schemas/entity'
import type { SoftLink } from '../lib/schemas/softLink'

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

export type BackendKind = 'local' | 'remote' | 'blocked' | 'memory'

/**
 * Whether this build requires an account to persist anything
 * ([ADR-034](../../../../docs/adrs/ADR-034-account-required-persistence.md)
 * decision 1).
 *
 * **The code default stays OFF; production opts in.** `apps/itun/.env.production`
 * sets this to `true`, and Vite loads that file only for a production build — so
 * the shipped app requires an account while tests, dev and a fresh checkout do
 * not.
 *
 * That split is deliberate and was arrived at the hard way. Defaulting to ON
 * when the variable is *unset* flips every environment that never sets it —
 * CI, the test runner, a contributor's first `bun run dev`. Measured: twelve
 * wizard, chooser and starter-set tests failed, all of them correctly, because
 * they assert Solo durability and the flip removes it. A flag whose safe value
 * depends on remembering to set it is the wrong way round; the deploy is the
 * thing that should have to say so out loud.
 *
 * To exercise the gate locally: `VITE_REQUIRE_ACCOUNT=true bun run dev:itun`.
 *
 * **It is not the only condition.** `backendForMode` also asks whether this
 * browser holds a legacy roster, because sending an existing Solo user to the
 * memory backend would make their pilots unreachable — see
 * `lib/db/legacyLocalData.ts` for why that guard exists and which way it fails.
 *
 * Read once at module scope like every other `import.meta.env` flag here. A
 * build-time switch rather than a runtime one is deliberate: "does this build
 * require an account" must not be able to change under a running session, which
 * would strand work in a store the app had stopped reading.
 */
export const accountRequired = import.meta.env.VITE_REQUIRE_ACCOUNT === 'true'

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

/**
 * The backend rule, as a pure function of its inputs.
 *
 * Split out from `selectBackend` for the same reason `resolveConnectionMode` is
 * a pure function beside `useConnection`: the rule is the part worth testing,
 * and it is otherwise reachable only through a module-scope
 * `import.meta.env` read that a test cannot vary. The wrapper below supplies the
 * real inputs; this is what the tests drive.
 */
export function backendForMode(
  mode: ConnectionMode,
  requireAccount: boolean,
  legacy: LegacyProbeState = 'unknown'
): BackendKind {
  // Anonymous, in a build that requires an account, in a browser with no roster
  // of its own: nothing durable. Checked BEFORE the Solo branch, because Solo is
  // exactly the state this replaces — testing it after would make the flag dead
  // code.
  //
  // `legacy === 'absent'` rather than `!== 'present'` is the load-bearing part.
  // While the probe is still running the answer is `unknown`, and an unknown
  // must not send an existing user's writes to a Map that dies with the tab.
  // The stricter test resolves that window toward the branch that cannot lose
  // work; `legacyLocalData.ts` explains why that asymmetry is the right one.
  if (mode === 'solo' && requireAccount && legacy === 'absent') return 'memory'
  if (mode === 'solo') return 'local'
  if (usesServerOfRecord(mode)) return 'remote'
  // `connecting` lands here alongside `disconnected`, and deliberately: writing
  // locally before the handshake resolves is exactly the silent fork this
  // module exists to prevent.
  return 'blocked'
}

export function selectBackend(): BackendKind {
  return backendForMode(currentMode(), accountRequired, legacyLocalDataState())
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
 * Write one entity to the server of record, and **fail if it does not land**.
 *
 * ## This replaced a mirror, and the difference is the whole of ADR-034
 *
 * The predecessors — `mirrorWrite`, `mirrorCrawlerWrite`, `mirrorSoftLinkWrite`
 * — were **fire-and-forget by design**, and correctly so at the time: the local
 * write had already succeeded and was what the UI read, so a server refusal
 * could not be allowed to roll it back. They also **upserted rather than
 * updated**, because an entity built while Solo had no server row until the
 * account was claimed.
 *
 * Both properties describe a world where the local store is authoritative.
 * ADR-034 ends that world. A cache cannot legitimately be ahead of its source,
 * so a write the server refused **did not happen**, and the only honest thing to
 * do is say so — which means awaiting it and letting it throw.
 *
 * The failure mode being removed is not hypothetical. `byAppId` resolves a
 * duplicate to the oldest row and warns rather than throwing, precisely because
 * a throw inside a fire-and-forget mirror was invisible to the player: the
 * write never reached the server while every surface kept rendering it as saved.
 * That is how an evening of play went missing.
 *
 * ## No-ops off the server of record
 *
 * Returns immediately unless the backend is `remote`. An anonymous session — in
 * memory, or in the legacy local backend during the migration window — has no
 * server to commit to, and must keep working.
 */
export async function commitEntityWrite(
  type: EntityRef['type'] | 'softLink',
  op:
    | { kind: 'upsert'; appId: string; gameId: string | null; body: unknown }
    | { kind: 'patch'; appId: string; gameId: string | null; body: unknown; patch: unknown }
    | { kind: 'delete'; appId: string; gameId: string | null }
): Promise<void> {
  if (selectBackend() !== 'remote' || convexClient === null) return

  if (type === 'softLink') {
    // Links are addressed by their endpoints rather than by an id, so they take
    // a different call shape — see `commitSoftLink`.
    return
  }

  if (type === 'crawler') {
    if (op.kind === 'delete') {
      await convexClient.mutation(api.entities.removeCrawlerByAppId, { appId: op.appId })
      return
    }
    if (op.kind === 'patch') {
      // Still a field-level patch rather than a whole-body replace: the crawler
      // is communal and contended during Downtime, so two members editing scrap
      // and cargo in the same minute must both land (ADR-030 §5). That rule
      // survives the demotion untouched.
      await convexClient.mutation(api.entities.patchCrawlerByAppId, {
        appId: op.appId,
        patch: op.patch,
      })
      return
    }
    await convexClient.mutation(api.entities.createCrawler, {
      gameId: op.gameId as Id<'games'> | null,
      appId: op.appId,
      body: op.body,
    })
    return
  }

  const table = type === 'pilot' ? 'pilots' : 'mechs'
  if (op.kind === 'delete') {
    await convexClient.mutation(api.entities.removeByAppId, { table, appId: op.appId })
    return
  }
  await convexClient.mutation(api.entities.upsertByAppId, {
    table,
    appId: op.appId,
    gameId: op.gameId === null ? null : (op.gameId as Id<'games'>),
    body: op.body,
  })
}

/**
 * Write one soft link, and fail if it does not land.
 *
 * Addressed by its endpoints because the server has no `appId` column for links
 * and needs none — `from.id`/`to.id` already are app ids. That also makes it
 * naturally idempotent, so a repeated write is a no-op rather than a duplicate
 * wire.
 */
/**
 * Mirror a batch of Change Log rows.
 *
 * The log is ADR-030's "spine of this feature", and it was two disconnected
 * spines: the client appended only to IndexedDB while the server table was
 * written only by `ownership`, `proposals` and `botClient`. Each drawer showed
 * half the history, and clearing site data destroyed the client half because
 * Convex held no copy of it.
 *
 * Deliberately NOT awaited by its caller, unlike every other commit in this
 * file. The log is provenance ABOUT a write that has already happened and been
 * committed; failing the user's edit because its audit row did not land would
 * trade a real write for a record of one. It reports and moves on — which is
 * the fire-and-forget shape ADR-034 removed everywhere else, kept here only
 * because the thing at risk is the annotation rather than the data.
 */
export async function commitChangeLog(
  entries: readonly {
    gameId: string | null
    entityType: 'pilot' | 'mech' | 'crawler' | 'softLink' | 'game'
    entityId: string
    ts: number
    kind: 'transaction' | 'override' | 'manual'
    field: string
    before: unknown
    after: unknown
    source: string
  }[]
): Promise<void> {
  if (selectBackend() !== 'remote' || convexClient === null) return
  if (entries.length === 0) return

  await convexClient.mutation(api.entities.appendChangeLog, {
    entries: entries.map((e) => ({
      ...e,
      gameId: e.gameId === null ? null : (e.gameId as Id<'games'>),
    })),
  })
}

/**
 * Mirror one saved-pattern write.
 *
 * Addressed by the id inside the body rather than by an `appId` column, because
 * `mechPatterns` has none and needs none — a pattern's own id already is its app
 * id, which makes the upsert idempotent.
 *
 * Same early return as every other commit here: in Solo or anonymous mode there
 * is no server of record to reach, and this is a no-op rather than an error.
 */
export async function commitPatternWrite(
  op: { kind: 'upsert'; record: { id: string } } | { kind: 'delete'; id: string }
): Promise<void> {
  if (selectBackend() !== 'remote' || convexClient === null) return

  if (op.kind === 'delete') {
    await convexClient.mutation(api.entities.removeMechPattern, { patternId: op.id })
    return
  }
  await convexClient.mutation(api.entities.upsertMechPattern, { body: op.record })
}

/**
 * Mirror one shelf-NPC write.
 *
 * Shelf only. A tray inside a Game belongs to the table rather than to a member
 * and is reached through `mediator.*` by the Mediator's role; this store holds
 * the personal tray, which is the one that had no server write at all.
 */
export async function commitNpcWrite(
  op: { kind: 'upsert'; record: { id: string } } | { kind: 'delete'; id: string }
): Promise<void> {
  if (selectBackend() !== 'remote' || convexClient === null) return

  if (op.kind === 'delete') {
    await convexClient.mutation(api.entities.removeEncounterNpc, { npcId: op.id })
    return
  }
  await convexClient.mutation(api.entities.upsertEncounterNpc, { body: op.record })
}

export async function commitSoftLink(
  kind: 'upsert' | 'delete',
  link: SoftLink | null
): Promise<void> {
  if (selectBackend() !== 'remote' || convexClient === null) return
  if (link === null) return
  // A link whose endpoints did not survive a salvage-tolerant read has nothing
  // to address, and half a link fails validation server-side for no benefit.
  if (link.from?.id === undefined || link.to?.id === undefined) return

  const args = { from: link.from, to: link.to, type: link.type }
  if (kind === 'upsert') {
    await convexClient.mutation(api.entities.upsertSoftLink, args)
  } else {
    await convexClient.mutation(api.entities.removeSoftLink, args)
  }
}

/**
 * Guard a write against the current mode.
 *
 * Called by the store before it touches persistence. Returns the backend to
 * use; throws rather than silently degrading when the answer is "you cannot
 * write right now".
 *
 * `memory` passes: an anonymous build is a legitimate write, it just does not
 * outlive the tab. Refusing here would make the app read-only for a visitor,
 * which is the opposite of what ADR-034 decision 1 asks for — the account is
 * required to *keep* work, never to do it.
 */
export function requireWritableBackend(): Exclude<BackendKind, 'blocked'> {
  const backend = selectBackend()
  if (backend === 'blocked') {
    throw new WritesBlockedOffline(isSettlingConnection(currentMode()) ? 'settling' : 'offline')
  }
  return backend
}
