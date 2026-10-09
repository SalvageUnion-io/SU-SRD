import type { FunctionArgs } from 'convex/server'
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
import type { EntityRef } from '../lib/schemas/entity'
import type { SoftLink } from '../lib/schemas/softLink'
import { knownVersion, noteVersion } from './serverVersions'

/**
 * Where entity writes actually go (ADR-030 §1).
 *
 * `entityStore` reaches its persistence through one indirection —
 * `dbStoreFor(type)` — so swapping the backend is a matter of changing what
 * that returns rather than rewriting the store. The store's public API, its
 * in-memory cache and its lazy hydration are untouched by this file.
 *
 * ## There are exactly three answers, and one of them is "nowhere"
 *
 * `remote` when the app is genuinely Connected, `signedOut` when it is
 * anonymous, and `blocked` while it is Disconnected, still completing the
 * auth handshake, or running a build older than the backend's floor
 * (`outdated`, `lib/connection/buildFloor.ts`). There is no fourth case.
 *
 * `signedOut` is read-only and reads nothing: there is no anonymous store at
 * all (`readableRows`). Signed out, ITUN shows reference and nothing of a
 * player's own (ADR-034 decision 1, as amended).
 *
 * There used to be: `local`, the durable IndexedDB backend an anonymous visitor
 * got in any build that did not set `VITE_REQUIRE_ACCOUNT`. Production always
 * set it, so `local` only ever ran in CI, `bun run dev` and the e2e suite —
 * which meant the suite spent its effort proving a storage mode no player could
 * reach, and had to force the flag off to do it. It was retired along with the
 * flag, and the durable path the tests
 * exercise is the signed-in one (`src/stores/__tests__/signedInBackend.ts`
 * for unit tests, the `TestAuthBridge` seam for e2e).
 *
 * ## Disconnected does not fall back to IndexedDB
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
  /**
   * Whether a Convex deployment is compiled in. Defaults to the real answer
   * (`convexClient !== null`); `ConnectionProvider` never sets it.
   *
   * It exists for the unit tests. With `local` retired, the only durable
   * backend is `remote`, and the test build has no `VITE_CONVEX_URL` — so
   * without this there would be no way to exercise the IndexedDB cache a
   * signed-in player writes through. Setting it `true` with no client is
   * "signed in, with every server commit a no-op", which is exactly what the
   * `convexClient === null` early returns below already do. See
   * `src/stores/__tests__/signedInBackend.ts`, the one caller.
   */
  convexConfigured?: boolean
  /**
   * Whether this bundle is older than the backend's build floor (`build.floor`).
   * An outdated tab may call a function the backend no longer has, so it is
   * read-only until it reloads onto the new build. Optional, defaulting to
   * false: only `ConnectionProvider`'s floor subscription ever sets it.
   */
  outdated?: boolean
}

/**
 * Read once per write rather than subscribed — the store is not a component.
 *
 * The initial value is anonymous and settled, which resolves to `signedOut`: with
 * no Convex URL compiled in, `selectBackend` short-circuits to Solo before this
 * is consulted, and with one compiled in `ConnectionProvider` pushes the real
 * value on mount.
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

export type BackendKind = 'remote' | 'blocked' | 'signedOut'

/** The mode the store layer currently believes it is in. */
function currentMode(): ConnectionMode {
  return resolveConnectionMode({
    convexConfigured: authState.convexConfigured ?? convexClient !== null,
    authSettled: authState.authSettled ?? true,
    signedIn: authState.signedIn,
    online: authState.online,
  })
}

/**
 * The backend rule, as a pure function of the connection mode.
 *
 * Split out from `selectBackend` for the same reason `resolveConnectionMode` is
 * a pure function beside `useConnection`: the rule is the part worth testing,
 * and every mode can be driven here without a Convex client.
 *
 * Anonymous (`solo`) is `signedOut` unconditionally
 * ([ADR-034](../../../../docs/ARCHITECTURE.md#adr-034)
 * decision 1). There is no build flag and no exemption for a browser that
 * already holds rows (ADR-035): the cache is never read signed out.
 */
export function backendForMode(mode: ConnectionMode): BackendKind {
  if (mode === 'solo') return 'signedOut'
  if (usesServerOfRecord(mode)) return 'remote'
  // `connecting` lands here alongside `disconnected`, and deliberately: writing
  // anywhere before the handshake resolves is exactly the silent fork this
  // module exists to prevent.
  return 'blocked'
}

/**
 * Which backend a write should use right now.
 *
 * Exported for tests and for surfaces that want to explain themselves — a
 * button that would be `blocked` should say why rather than fail on click.
 */
export function selectBackend(): BackendKind {
  const backend = backendForMode(currentMode())
  return backend === 'remote' && authState.outdated === true ? 'blocked' : backend
}

/**
 * Why a write was refused. Four states, four different things to say to a
 * player: one is a condition they have to wait out, one resolves by itself in a
 * moment and only needs "try that again", one needs them to sign in, and one
 * is this tab running a build the backend has moved past — it reloads itself.
 */
export type BlockedWriteReason = 'offline' | 'settling' | 'signedOut' | 'outdated'

const BLOCKED_WRITE_COPY: Record<BlockedWriteReason, string> = {
  settling: 'Still signing in — that change was not saved. Try again in a moment.',
  offline: 'Not connected — your games are read-only until the connection returns',
  signedOut: 'Sign in to build and edit — nothing is saved without an account.',
  outdated: 'ITUN has been updated — that change was not saved. Reloading onto the new version.',
}

/**
 * Thrown when a write is attempted while the server of record is unreachable,
 * or by a visitor who is not signed in.
 *
 * The message is user-facing copy, not a developer string: it is what the
 * refusal toast shows, so it says the consequence rather than the condition.
 * The class name is kept (rather than renamed for the settling case) because
 * call sites narrow on it with `instanceof`.
 */
export class WritesBlockedOffline extends Error {
  readonly reason: BlockedWriteReason

  constructor(reason: BlockedWriteReason = 'offline') {
    super(BLOCKED_WRITE_COPY[reason])
    this.name = 'WritesBlockedOffline'
    this.reason = reason
  }
}

/**
 * Thrown when the server refused a pilot or mech write because the row had
 * moved past the copy it was made against (`entities.upsertByAppId`).
 *
 * By the time this is thrown the store has already adopted the server's row,
 * so the sheet shows the latest version; the message asks the player to make
 * the change again on top of it. Like `WritesBlockedOffline`, the message is
 * the toast (`lib/runWrite.ts`).
 */
export class StaleWriteRefused extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StaleWriteRefused'
  }
}

/**
 * The `patchCrawlerByAppId` args for a crawler field patch.
 *
 * A key patched to `undefined` is a CLEAR — the ↺ revert of a pinned Max SP is
 * `{ maxSpOverride: undefined }` — but the Convex client drops undefined object
 * fields when it serialises the args, so on the wire that patch was `{}` and
 * the server kept the pin. Each cleared key is named in `unset` instead.
 */
export function crawlerPatchArgs(
  appId: string,
  patch: unknown
): { appId: string; patch: unknown; unset?: string[] } {
  const unset = Object.entries((patch ?? {}) as Record<string, unknown>)
    .filter(([, value]) => value === undefined)
    .map(([key]) => key)
  return { appId, patch, ...(unset.length > 0 ? { unset } : {}) }
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
 * Returns immediately unless the backend is `remote`. An anonymous session has
 * no server to commit to, and must keep working.
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
      // A container change is its own mutation: it writes the row's `gameId`,
      // the body's and `ownerId` together, and only the table runner may make
      // it (ADR-037). The field patch below never carries one — the server
      // strips it — which is how a "moved" crawler used to stay put.
      const { gameId, ...fields } = (op.patch ?? {}) as Record<string, unknown>
      if (op.patch !== null && typeof op.patch === 'object' && 'gameId' in op.patch) {
        await convexClient.mutation(api.entities.moveCrawler, {
          appId: op.appId,
          gameId: (gameId ?? null) as Id<'games'> | null,
        })
      }
      if (Object.keys(fields).length === 0) return
      // Still a field-level patch rather than a whole-body replace, so a write
      // from a stale copy never undoes a field it did not touch. Only the table
      // runner writes a Game's crawler now (ADR-038 §5); the merge stays.
      await convexClient.mutation(
        api.entities.patchCrawlerByAppId,
        crawlerPatchArgs(op.appId, fields)
      )
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
  // The version this browser last saw goes with the body, and the server
  // refuses the write if its row has moved on — a whole-body write from a stale
  // copy would undo another device's edit (`staleWrite.ts`). The answer is the
  // row's new version, which is what the next write is made against.
  const { updatedAt } = await convexClient.mutation(api.entities.upsertByAppId, {
    table,
    appId: op.appId,
    gameId: op.gameId === null ? null : (op.gameId as Id<'games'>),
    body: op.body,
    expectedUpdatedAt: knownVersion(op.appId) ?? null,
  })
  noteVersion(op.appId, updatedAt)
}

/**
 * Mirror a batch of Change Log rows to the server of record, which is the only
 * copy of the log there is (`changeLog.forEntity` is what the drawer reads).
 *
 * Never throws, and its callers do not await it: the log is provenance ABOUT a
 * write that has already happened and been committed, and failing the user's
 * edit because its audit row did not land would trade a real write for a
 * record of one. A failure is reported here, once, under one fingerprint —
 * not by each caller, which filed one fault as an issue per call site.
 *
 * A side that is `undefined` (a field set for the first time, or cleared) is
 * dropped by the Convex client on the wire; `appendChangeLog` stores it as
 * `null`.
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

  try {
    await convexClient.mutation(api.changeLog.appendChangeLog, {
      entries: entries.map((e) => ({
        ...e,
        gameId: e.gameId === null ? null : (e.gameId as Id<'games'>),
      })),
    })
  } catch (err) {
    captureException(err, undefined, { fingerprint: ['convex', 'changeLog:appendChangeLog'] })
  }
}

/**
 * Mirror one saved-pattern write.
 *
 * Addressed by the id inside the body rather than by an `appId` column, because
 * `mechPatterns` has none and needs none — a pattern's own id already is its app
 * id, which makes the upsert idempotent.
 *
 * Same early return as every other commit here: in an anonymous session there
 * is no server of record to reach, and this is a no-op rather than an error.
 */
export async function commitPatternWrite(
  op: { kind: 'upsert'; record: { id: string } } | { kind: 'delete'; id: string }
): Promise<void> {
  if (selectBackend() !== 'remote' || convexClient === null) return

  if (op.kind === 'delete') {
    await convexClient.mutation(api.shelf.removeMechPattern, { patternId: op.id })
    return
  }
  await convexClient.mutation(api.shelf.upsertMechPattern, { body: op.record })
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
    await convexClient.mutation(api.shelf.removeEncounterNpc, { npcId: op.id })
    return
  }
  await convexClient.mutation(api.shelf.upsertEncounterNpc, { body: op.record })
}

/**
 * Write one soft link, and fail if it does not land.
 *
 * Addressed by its endpoints because the server has no `appId` column for links
 * and needs none — `from.id`/`to.id` already are app ids. That also makes it
 * naturally idempotent, so a repeated write is a no-op rather than a duplicate
 * wire.
 */
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

/** One record a transfer writes: the validated record, and the patch that made it. */
export type TransferWrite = {
  type: EntityRef['type']
  record: { id: string; gameId?: string | null }
  patch: object
}

/**
 * One record a transfer removes. A link is named by its endpoints, so it is
 * read before the local delete leaves nothing to name it by.
 */
export type TransferRemoval =
  | { type: EntityRef['type']; id: string }
  | { type: 'softLink'; link: SoftLink | null }

type TransferArgs = FunctionArgs<typeof api.entities.transfer>

/**
 * The `entities.transfer` args for a transfer: each record in the shape its
 * own mutation takes — a pilot or mech whole body with the version it was
 * made against, a crawler field patch (and its move, when the patch carries
 * `gameId`), a link by its endpoints.
 */
export function transferArgs(
  writes: readonly TransferWrite[],
  removals: readonly TransferRemoval[]
): TransferArgs {
  return {
    updates: writes.map(({ type, record, patch }) => {
      if (type === 'crawler') {
        const move =
          'gameId' in patch
            ? {
                gameId: ((patch as { gameId?: string | null }).gameId ??
                  null) as Id<'games'> | null,
              }
            : {}
        return { table: 'crawlers' as const, ...crawlerPatchArgs(record.id, patch), ...move }
      }
      return {
        table: type === 'pilot' ? ('pilots' as const) : ('mechs' as const),
        appId: record.id,
        gameId: (record.gameId ?? null) as Id<'games'> | null,
        body: record,
        expectedUpdatedAt: knownVersion(record.id) ?? null,
      }
    }),
    deletes: removals.flatMap((removal): TransferArgs['deletes'] => {
      if (removal.type !== 'softLink') {
        const table = { pilot: 'pilots', mech: 'mechs', crawler: 'crawlers' } as const
        return [{ table: table[removal.type], appId: removal.id }]
      }
      const { link } = removal
      // Half a link has nothing to address — see `commitSoftLink`.
      if (link?.from?.id === undefined || link.to?.id === undefined) return []
      return [{ table: 'softLinks' as const, from: link.from, to: link.to, type: link.type }]
    }),
  }
}

/**
 * Commit a cross-entity transfer (`entityStore.transfer`) as ONE mutation,
 * and fail if it does not land.
 *
 * `entities.transfer` is a single Convex transaction, so the server holds
 * either every record of a stow, a load or a scrap hand-off, or none of them:
 * a refusal on any record — a crawler only the table runner may write, a
 * stale pilot or mech body — leaves every row as it was.
 */
export async function commitTransfer(
  writes: readonly TransferWrite[],
  removals: readonly TransferRemoval[]
): Promise<void> {
  if (selectBackend() !== 'remote' || convexClient === null) return
  const { versions } = await convexClient.mutation(
    api.entities.transfer,
    transferArgs(writes, removals)
  )
  for (const { appId, updatedAt } of versions) noteVersion(appId, updatedAt)
}

/**
 * Guard a write against the current mode.
 *
 * Called by the store before it touches persistence. Returns the backend to
 * use; throws rather than silently degrading when the answer is "you cannot
 * write right now".
 *
 * `signedOut` is refused too: signed out, ITUN is read-only
 * ([ADR-034](../../../../docs/ARCHITECTURE.md#adr-034) decision 1, as amended).
 * Anonymous building used to be allowed and simply not kept, which lost the
 * work to any reload — a deploy's forced one included.
 */
export function requireWritableBackend(): 'remote' {
  const backend = selectBackend()
  if (backend === 'signedOut') throw new WritesBlockedOffline('signedOut')
  if (backend === 'blocked') {
    if (authState.outdated === true) throw new WritesBlockedOffline('outdated')
    throw new WritesBlockedOffline(isSettlingConnection(currentMode()) ? 'settling' : 'offline')
  }
  return backend
}

/**
 * The rows a store may show: its IndexedDB cache signed in (or blocked, where
 * the cache is what a Disconnected reader still opens), and **nothing** signed
 * out.
 *
 * The one read rule for every player-entity store. Signed out there is no
 * anonymous store to read — nothing can be built without an account — and the
 * cache must not stand in for one: it may still hold the last account's rows.
 * Resolved per call, like `selectBackend`, so a sign-in is seen on the next
 * read.
 */
export async function readableRows<T>(cache: { list: () => Promise<T[]> }): Promise<T[]> {
  if (selectBackend() === 'signedOut') return []
  return cache.list()
}
