/**
 * entityStore — Zustand store of the account's player entities, in memory: a
 * projection of the Convex subscriptions (ADR-034; there is no device cache).
 *
 * Hydration: rows arrive from the server (`ShelfSync`), and `hydrate(type)`
 * resolves once they have, or at once when none are coming
 * (`rowArrival.ts`). `list(type)` on a type not yet hydrated starts that wait
 * and returns what is held; later reads are synchronous.
 *
 * Server first: create/update/delete commit to Convex, then update the
 * in-memory state via Zustand's set(). A refused or failed write propagates
 * to the caller and changes nothing local.
 *
 * Multi-tab: there is no tab-to-tab channel. Each tab hears another tab's
 * writes through its own Convex subscription: `ShelfSync` adopts creates and
 * edits and forgets deletes, the latter only where `pruneRules.ts` lets
 * absence mean deletion. Crawler-bay edits go through updateCrawlerBay(),
 * which merges a single bay entry onto the record as held right now instead
 * of replacing the whole array from a caller's possibly-stale copy.
 *
 * Integrity: deleting a pilot/mech/crawler/NPC also prunes every
 * SoftLink whose `from` or `to` endpoint references it — no more orphaned
 * "Unknown pilot (id)" rows.
 *
 * Assignments (ADR-037): creating a SoftLink goes through the assignment
 * model — it is refused across containers and REPLACES the links it conflicts
 * with in one write — and moving an entity drops the links the move leaves
 * straddling two containers. The rules are `itun-domain/links/linkRules`, shared
 * with the server, which enforces the same ones.
 */

import { staleWriteOf } from 'itun-domain/connection/staleWrite'
import type { ContainerFields } from 'itun-domain/container'
import { containerOf, moveTo, sameContainer } from 'itun-domain/container'
import {
  CROSS_CONTAINER_REFUSAL,
  conflictingLinks,
  endsMatchType,
  sameLink,
} from 'itun-domain/links/linkRules'
import type { Crawler } from 'itun-domain/schemas/crawler'
import type { Mech } from 'itun-domain/schemas/mech'
import type { Npc } from 'itun-domain/schemas/npc'
import type { Pilot } from 'itun-domain/schemas/pilot'
import type { SoftLink } from 'itun-domain/schemas/softLink'
import { create } from 'zustand'
import { linksClearedByMove } from '../lib/links/clearedByMove'
import { LinkRefused } from '../lib/links/linkRefused'
import { captureException } from '../lib/observability'
import { getActiveContainer } from './activeContainerStore'
import {
  commitEntityWrite,
  commitSoftLink,
  commitTransfer,
  requireWritableBackend,
  StaleWriteRefused,
} from './entityBackend'
import type { ChangeMeta } from './entityChangeLog'
import { emitChangeLog } from './entityChangeLog'
import type { RecordKind } from './records'
import { parseServed, prepareCreate, prepareUpdate, RECORD_KINDS, upsertById } from './records'
import { untilRowsArrive } from './rowArrival'
import { noteVersion } from './serverVersions'
import type { CreateInput, EntityForType, EntityType } from './types'

// Re-exported: every surface imports the provenance tag type from the store.
export type { ChangeMeta } from './entityChangeLog'
// Re-exported so consumers can import the type alongside the store itself.
export type { EntityType }

type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

export type EntityState = {
  pilots: Pilot[]
  mechs: Mech[]
  crawlers: Crawler[]
  npcs: Npc[]
  softLinks: SoftLink[]
  hydrated: {
    pilots: boolean
    mechs: boolean
    crawlers: boolean
    npcs: boolean
    softLinks: boolean
  }

  /**
   * Resolves once the given type's rows have arrived from the server, or at
   * once when none are coming (`rowArrival.ts`). Idempotent.
   */
  hydrate: (type: EntityType) => Promise<void>

  /** `ShelfSync`: the server's first answer for these types is in. */
  markArrived: (types: readonly EntityType[]) => void

  /**
   * Sync list — returns the in-memory array.
   * Auto-triggers hydrate() if not yet hydrated; callers that need the
   * result immediately should await hydrate(type) before calling list().
   */
  list: <T extends EntityType>(type: T) => EntityForType<T>[]

  /** Sync get — returns the entity by id or null. */
  get: <T extends EntityType>(type: T, id: string) => EntityForType<T> | null

  /** Commits to the server, then updates in-memory state. Zod errors propagate. */
  create: <T extends EntityType>(type: T, input: CreateInput<T>) => Promise<EntityForType<T>>

  /**
   * Hold a row from the server of record under the id it already has
   * (ADR-030 §1).
   *
   * This is the *only* write path that does not commit to the server, and that
   * is the point rather than an optimisation: the record came from the server,
   * so echoing it would be a write nobody asked for — and for a crawler, whose
   * write is a field merge, a pointless round trip that could clobber an edit
   * a crewmate made between the read and the echo.
   *
   * It is also not a Change Log event. Nothing changed; a copy arrived.
   */
  adopt: <T extends EntityType>(type: T, record: EntityForType<T>) => Promise<EntityForType<T>>

  /**
   * Drop this browser's copy of an entity **without deleting it anywhere else**
   * — the exact inverse of `adopt`, and deliberately not `delete`.
   *
   * The case it exists for: you hand a character back to the crew. The entity
   * is not gone, it is simply no longer yours, and `delete` would ask the
   * server for a destruction it rightly refuses. Keeping the copy instead is worse
   * still — it leaves a live sheet whose every save is rejected, which is the
   * most confusing failure this app can produce.
   */
  forget: (type: EntityType, id: string) => Promise<void>

  /**
   * Merges patch, commits it, updates in-memory state, then appends a
   * Change Log entry per changed field (provenance, ADR-022). `meta` tags those
   * entries and is **required**: pick the constant for your surface from
   * `surfaceProvenance.ts` (`LIVE_SHEET_MANUAL`, `DASHBOARD_TXN`, …) rather than
   * writing the object inline. A default would defeat the point of declaring
   * provenance once per surface: an untagged call site would log as a hand edit
   * and nothing would say so.
   */
  update: <T extends EntityType>(
    type: T,
    id: string,
    patch: Partial<EntityForType<T>>,
    meta: ChangeMeta
  ) => Promise<EntityForType<T>>

  /**
   * Merges a patch into ONE crawler bay entry (matched by bayRef) on top of
   * the record as held right now — not a caller's copy of the whole array.
   * Throws when the crawler or the bay entry does not exist.
   */
  updateCrawlerBay: (
    crawlerId: string,
    bayRef: string,
    patch: Partial<Omit<CrawlerBayEntry, 'bayRef'>>,
    /**
     * Disambiguates when multiple entries share a bayRef: the entry at this
     * index is patched when its bayRef matches; otherwise the first bayRef
     * match wins.
     */
    index: number | undefined,
    /** Change Log provenance for the resulting update (ADR-022). Required. */
    meta: ChangeMeta
  ) => Promise<Crawler>

  /**
   * Deletes on the server and from in-memory state. Deleting a
   * pilot/mech/crawler also deletes every SoftLink referencing it.
   */
  delete: (type: EntityType, id: string) => Promise<void>

  /**
   * Cross-entity value transfer: validates every patch, commits all updates
   * and deletes to the server in ONE mutation (`entities.transfer`), then
   * applies them in ONE set() — all-or-nothing at both ends.
   * Use for flows that move value between entities — scrap-mech, cargo
   * stow/load, salvage hand-offs — where a partial write would duplicate or
   * destroy player data. Deletes cascade SoftLinks like delete().
   */
  transfer: (
    ops: {
      updates?: TransferUpdate[]
      deletes?: { type: EntityType; id: string }[]
    },
    /** Change Log provenance for every updated entity (ADR-022). Required. */
    meta: ChangeMeta
  ) => Promise<void>
}

/** One update inside a transfer() — the discriminant ties patch to type. */
type TransferUpdate = {
  [T in ContainedType]: { type: T; id: string; patch: Partial<EntityForType<T>> }
}[ContainedType]

/** The entity types a transfer writes: a link is drawn by `create`, not moved. */
type ContainedType = Exclude<EntityType, 'softLink'>

/** Maps EntityType discriminant to its Zustand state key. */
type StoreKey = 'pilots' | 'mechs' | 'crawlers' | 'npcs' | 'softLinks'

function storeKeyFor(type: EntityType): StoreKey {
  return `${type}s`
}

/**
 * Commit one record to the server of record, and throw if it refuses.
 *
 * It is **awaited before anything local is written**, so a refused write leaves
 * no trace on the device: the server, not the local store, is the source of
 * truth.
 *
 * Each type still dispatches differently, and each difference is a rule rather
 * than an implementation detail: a crawler sends its *patch* so a write from a
 * stale copy merges rather than undoing a field it did not touch (ADR-030 §5;
 * only the table runner writes a Game's crawler since ADR-038 §5), a pilot
 * or mech sends its whole body, and
 * a soft link is addressed by its endpoints because the server has no id for it.
 *
 * A pilot or mech body is refused when the server's row has moved past the
 * copy it was made from (`entities.upsertByAppId`). The refusal carries the
 * server's row, which is adopted here before the write fails — so the sheet
 * shows what the other device saved, and the player re-applies their change on
 * top of it rather than over it.
 */
async function commitWrite(
  type: EntityType,
  record: { id: string; gameId?: string | null },
  patch?: object
): Promise<void> {
  if (type === 'softLink') {
    await commitSoftLink('upsert', record as unknown as SoftLink)
    return
  }

  const gameId = record.gameId ?? null
  if (type === 'crawler') {
    await commitEntityWrite('crawler', {
      kind: patch === undefined ? 'upsert' : 'patch',
      appId: record.id,
      gameId,
      body: record,
      patch: patch ?? {},
    } as Parameters<typeof commitEntityWrite>[1])
    return
  }

  try {
    await commitEntityWrite(type, {
      kind: 'upsert',
      appId: record.id,
      gameId,
      body: record,
    })
  } catch (err) {
    throw await refusalOf(err, () => ({ type, id: record.id }))
  }
}

/**
 * What a refused commit throws. A stale-write refusal carries the server's
 * pilot or mech row, which is adopted first, so the sheet shows what the other
 * device saved and the player re-applies their change on top of it rather than
 * over it; `rowOf` names the refused record from the body's id. Any other
 * refusal is thrown as it came.
 */
async function refusalOf(
  err: unknown,
  rowOf: (bodyId: string | undefined) => { type: EntityType; id: string } | undefined
): Promise<unknown> {
  const stale = staleWriteOf(err)
  if (stale === null) return err
  try {
    const row = rowOf((stale.body as { id?: string } | null)?.id)
    if (row !== undefined) {
      await useEntityStore.getState().adopt(row.type, stale.body as never)
      noteVersion(row.id, stale.updatedAt)
    }
  } catch (adoptErr) {
    // The refusal still stands and is still shown; only the refresh failed,
    // and `ShelfSync` brings the row down on its next emission regardless.
    captureException(adoptErr)
  }
  return new StaleWriteRefused(stale.message, { cause: err })
}

/** The schema and stamps of one entity type's records. */
function kindOf<T extends EntityType>(type: T): RecordKind<EntityForType<T>> {
  // Single correlated-union assertion: TS cannot carry the runtime
  // discriminant↔record-type invariant through the map lookup for a
  // generic T (microsoft/TypeScript#30581).
  return RECORD_KINDS[type] as unknown as RecordKind<EntityForType<T>>
}

/** `links` without the ones touching any of `ids`: an entity's links go with it. */
function withoutLinksTo(links: readonly SoftLink[], ids: ReadonlySet<string>): SoftLink[] {
  return links.filter((l) => !ids.has(l.from?.id) && !ids.has(l.to?.id))
}

/**
 * Stamp a brand-new build with the current container so it belongs somewhere
 * (ADR-030 §2 — an entity is always in exactly one Game or on the Shelf).
 *
 * Applies to pilots/mechs/crawlers only; SoftLinks carry no container. An
 * input that already decided its own container is left untouched so it isn't
 * clobbered — and "already decided" includes an explicit `gameId: null`,
 * because null *is* the Shelf rather than an absence (see itun-domain/src/container.ts).
 * Testing for `undefined` rather than nullishness is what keeps a deliberate
 * shelving from being overwritten by whatever container happens to be open.
 */
function withActiveContainer<T extends EntityType>(type: T, input: CreateInput<T>): CreateInput<T> {
  if (type === 'softLink') return input
  const rec = input as { gameId?: string | null }
  if (rec.gameId !== undefined) return input
  return { ...input, ...moveTo(getActiveContainer()) } as CreateInput<T>
}

/**
 * Draw a link through the assignment model (ADR-037). `create('softLink')`.
 *
 * Three rules, checked here first so a refusal costs no round trip, and again
 * on the server, which is the authority:
 *
 *  - the type must match its ends (`mech → crawler` is `mech-to-crawler`);
 *  - both ends must be in the same container, when this browser holds both —
 *    when it does not, the server decides alone;
 *  - the link REPLACES every link it conflicts with (a pilot crews one
 *    crawler; a pilot and a mech fly one another). The server replaces in the
 *    same mutation that draws it, and this mirrors that in one local write.
 *
 * Drawing a link that already exists is not a second record: the server write
 * is idempotent by endpoints, and the existing local record is returned.
 */
async function createSoftLink(
  get: () => EntityState,
  set: (fn: (state: EntityState) => Partial<EntityState>) => void,
  input: CreateInput<'softLink'>
): Promise<SoftLink> {
  if (!endsMatchType(input)) {
    throw new Error(`A ${input.type} link cannot join ${input.from.type} → ${input.to.type}`)
  }
  const state = get()
  const fromEntity = state.get(input.from.type, input.from.id)
  const toEntity = state.get(input.to.type, input.to.id)
  if (
    fromEntity !== null &&
    toEntity !== null &&
    !sameContainer(containerOf(fromEntity), containerOf(toEntity))
  ) {
    throw new LinkRefused(CROSS_CONTAINER_REFUSAL)
  }

  const record = prepareCreate(RECORD_KINDS.softLink, input)
  await commitSoftLink('upsert', record)

  // Read AFTER the commit: the server may already have sent this link down
  // (`WiringSync`) while it was in flight, and the replace must see that too.
  const current = get().softLinks
  const present = current.find((l) => sameLink(l, input)) ?? null
  const replaced = conflictingLinks(current, input)
  const replacedIds = new Set(replaced.map((l) => l.id))

  set((s) => ({
    softLinks: [
      ...(present === null ? [record] : []),
      ...s.softLinks.filter((l) => !replacedIds.has(l.id)),
    ],
  }))
  return present ?? record
}

/**
 * Drop this browser's copies of the links a move has broken.
 *
 * Local only: the server prunes the same links in the mutation that moved the
 * row (`pruneLinksAcrossContainers`), so there is nothing to commit. A link
 * whose other end this browser does not hold is dropped too — it cannot be
 * shown to share the new container, and `WiringSync` brings it back if the
 * server kept it.
 */
function pruneLinksAfterMove(
  get: () => EntityState,
  set: (fn: (state: EntityState) => Partial<EntityState>) => void,
  moved: { type: Exclude<EntityType, 'softLink'>; id: string; gameId?: string | null }
): void {
  // The same read a move's confirm makes (`assignmentsClearedByMove`), so what
  // the dialog named is what goes.
  const broken = linksClearedByMove(get(), moved, containerOf(moved))
  if (broken.length === 0) return
  const brokenIds = new Set(broken.map((l) => l.id))
  set((s) => ({ softLinks: s.softLinks.filter((l) => !brokenIds.has(l.id)) }))
}

export const useEntityStore = create<EntityState>((set, get, api) => ({
  pilots: [],
  mechs: [],
  crawlers: [],
  npcs: [],
  softLinks: [],
  hydrated: {
    pilots: false,
    mechs: false,
    crawlers: false,
    npcs: false,
    softLinks: false,
  },

  async hydrate(type) {
    const key = storeKeyFor(type)
    if (get().hydrated[key]) return
    await untilRowsArrive(() => get().hydrated[key], api.subscribe)
    get().markArrived([type])
  },

  markArrived(types) {
    const keys = types.map(storeKeyFor).filter((key) => !get().hydrated[key])
    if (keys.length === 0) return
    set((state) => ({
      hydrated: { ...state.hydrated, ...Object.fromEntries(keys.map((key) => [key, true])) },
    }))
  },

  list<T extends EntityType>(type: T): EntityForType<T>[] {
    const key = storeKeyFor(type)
    const state = get()
    if (!state.hydrated[key]) {
      // Fire-and-forget — callers that need a fresh result should await hydrate first.
      void get().hydrate(type)
    }
    return state[key] as EntityForType<T>[]
  },

  get<T extends EntityType>(type: T, id: string): EntityForType<T> | null {
    const key = storeKeyFor(type)
    const state = get()
    if (!state.hydrated[key]) {
      void get().hydrate(type)
    }
    const arr = state[key] as EntityForType<T>[]
    return arr.find((e) => e.id === id) ?? null
  },

  async create<T extends EntityType>(type: T, input: CreateInput<T>): Promise<EntityForType<T>> {
    const key = storeKeyFor(type)
    // Refuses rather than degrading when the server of record is unreachable
    // (ADR-030 §1): a signed-in user offline is read-only, not silently
    // writing to a local copy that would fork against the server.
    requireWritableBackend()

    // A link is an assignment, with rules of its own (ADR-037).
    if (type === 'softLink') {
      return (await createSoftLink(get, set, input as CreateInput<'softLink'>)) as EntityForType<T>
    }

    // Build the record, commit it, and only then hold it. With Convex as the
    // source of truth, a record the server refused does not exist, so it must
    // not appear here either. `commitWrite` throws on refusal and this deliberately does
    // not catch — the caller's write failed, and every caller already handles
    // that path for `WritesBlockedOffline`.
    const record = prepareCreate(kindOf(type), withActiveContainer(type, input))
    await commitWrite(type, record)

    set((state) => ({
      [key]: [record, ...(state[key] as EntityForType<T>[])],
    }))
    return record
  },

  async adopt<T extends EntityType>(type: T, record: EntityForType<T>): Promise<EntityForType<T>> {
    const key = storeKeyFor(type)
    // Deliberately no `requireWritableBackend()`: holding a server row is not a
    // user write.
    const held = parseServed(kindOf(type), record)
    set((state) => ({ [key]: upsertById(state[key] as EntityForType<T>[], held) }))
    return held
  },

  async forget(type, id) {
    const key = storeKeyFor(type)
    if (type === 'softLink') {
      // A link has no links of its own to cascade. `WiringSync` forgets the
      // ones the server no longer holds through here.
      set((state) => ({ softLinks: state.softLinks.filter((l) => l.id !== id) }))
      return
    }
    // Local only, and cascading like `delete` does: a SoftLink pointing at an
    // entity this tab no longer holds would render as a broken cross-link.
    set((state) => ({
      [key]: (state[key] as { id: string }[]).filter((e) => e.id !== id),
      softLinks: withoutLinksTo(state.softLinks, new Set([id])),
    }))
  },

  async update<T extends EntityType>(
    type: T,
    id: string,
    patch: Partial<EntityForType<T>>,
    meta: ChangeMeta
  ): Promise<EntityForType<T>> {
    const key = storeKeyFor(type)
    // Capture the before-image BEFORE the write so the Change Log can diff it.
    const before = get().get(type, id)
    requireWritableBackend()

    // Same order as `create`: merge and validate, commit, then hold. A
    // refused edit leaves the local record exactly as it was.
    const updated = prepareUpdate(kindOf(type), before, id, patch)
    await commitWrite(type, updated, patch)

    set((state) => ({
      [key]: (state[key] as EntityForType<T>[]).map((e) => (e.id === id ? updated : e)),
    }))
    // A move takes along only the links whose other end is already where it is
    // going (ADR-037) — the server pruned the rest in the same commit.
    if (type !== 'softLink' && before !== null) {
      const moved = updated as ContainerFields
      if (!sameContainer(containerOf(before as ContainerFields), containerOf(moved))) {
        pruneLinksAfterMove(get, set, {
          type: type as Exclude<EntityType, 'softLink'>,
          id,
          gameId: moved.gameId,
        })
      }
    }
    // Provenance (ADR-022): one entry per changed field, at this one chokepoint.
    emitChangeLog(type, id, patch, before, updated, meta)
    return updated
  },

  async transfer(ops, meta) {
    const updates = ops.updates ?? []
    const deletes = ops.deletes ?? []
    if (updates.length === 0 && deletes.length === 0) return

    // Same refusal as create()/update(), and for a stronger reason: a transfer
    // moves value BETWEEN entities (cargo stow/load, a scrap hand-off), so a
    // Disconnected write here would fork not one record against the server but
    // the balance between two — and the crawler is usually one end of it.
    // Deliberately before the before-images, so a refused transfer touches
    // nothing at all.
    requireWritableBackend()

    // Capture before-images BEFORE the write, exactly as update() does, so the
    // Change Log can diff them in step 4. Without this, cross-entity moves
    // (cargo stow/load, scrap hand-offs) would mutate entities with no
    // provenance at all — a hole in ADR-022's "every mutation is logged" chokepoint
    // guarantee, since transfer() bypasses update().
    const withBefore = updates.map((u) => ({ ...u, before: get().get(u.type, u.id) }))

    // Step 1 — validate everything BEFORE changing anything. prepareUpdate
    // merges + strict-parses without writing, so a Zod failure on any patch
    // aborts the whole transfer with nothing changed.
    const prepared = withBefore.map((u) => ({
      type: u.type,
      id: u.id,
      patch: u.patch,
      before: u.before,
      record: prepareUpdate(
        kindOf(u.type) as RecordKind<{ id: string }>,
        u.before as { id: string } | null,
        u.id,
        u.patch
      ),
    }))

    // Step 2 — commit the whole transfer to the server BEFORE changing anything,
    // as ONE mutation (`entities.transfer`). A transfer moves value BETWEEN
    // entities, so a half-applied one is not a stale record but a wrong
    // balance: a stow that lands on the mech and is refused on the crawler
    // loses the lot, a load duplicates it. The mutation is one transaction, so
    // a refusal on any record leaves every server row as it was, and throwing
    // here leaves this tab untouched too. Links are read before the local
    // delete, because the server addresses a link by its endpoints.
    try {
      await commitTransfer(
        prepared.map((pu) => ({
          type: pu.type,
          record: pu.record as { id: string; gameId?: string | null },
          patch: pu.patch,
        })),
        deletes.map((d) =>
          d.type === 'softLink'
            ? { type: 'softLink' as const, link: get().get('softLink', d.id) }
            : { type: d.type, id: d.id }
        )
      )
    } catch (err) {
      throw await refusalOf(err, (bodyId) =>
        prepared.find((pu) => pu.type !== 'crawler' && pu.id === bodyId)
      )
    }

    // Step 3 — apply it in one set(), mirroring update()/delete(): deleting an
    // entity takes its links with it.
    const deletedByKey = new Map<StoreKey, Set<string>>()
    for (const d of deletes) {
      const key = storeKeyFor(d.type)
      deletedByKey.set(key, (deletedByKey.get(key) ?? new Set()).add(d.id))
    }
    const goneEntities = new Set(deletes.filter((d) => d.type !== 'softLink').map((d) => d.id))
    set((state) => {
      const next: Partial<Record<StoreKey, unknown[]>> = {}
      for (const pu of prepared) {
        const key = storeKeyFor(pu.type)
        const base = (next[key] ?? state[key]) as { id: string }[]
        next[key] = base.map((e) => (e.id === pu.record.id ? pu.record : e))
      }
      for (const [key, ids] of deletedByKey) {
        const base = (next[key] ?? state[key]) as { id: string }[]
        next[key] = base.filter((e) => !ids.has(e.id))
      }
      if (goneEntities.size > 0) {
        next.softLinks = withoutLinksTo(
          (next.softLinks ?? state.softLinks) as SoftLink[],
          goneEntities
        )
      }
      return next as Partial<EntityState>
    })

    // Step 4 — provenance (ADR-022), as update() emits it. One entry per
    // changed field per updated entity. Deletes are not logged: the per-entity
    // log goes with the entity.
    for (const pu of prepared) {
      emitChangeLog(
        pu.type,
        pu.id,
        pu.patch,
        pu.before,
        pu.record as EntityForType<typeof pu.type>,
        meta
      )
    }
  },

  async updateCrawlerBay(crawlerId, bayRef, patch, index, meta) {
    // Read the record as held right now, not the caller's copy, so the merge
    // lands on the latest bays.
    const fresh = get().get('crawler', crawlerId)
    if (fresh === null) {
      throw new Error(`[itun-store] Cannot update bay: crawler id="${crawlerId}" not found`)
    }
    const bays = fresh.crawlerBays ?? []
    const targetIndex =
      index !== undefined && bays[index]?.bayRef === bayRef
        ? index
        : bays.findIndex((b) => b.bayRef === bayRef)
    if (targetIndex === -1) {
      throw new Error(
        `[itun-store] Cannot update bay: bayRef="${bayRef}" not found on crawler "${crawlerId}"`
      )
    }
    const next = bays.map((b, i) => (i === targetIndex ? { ...b, ...patch, bayRef } : b))
    return get().update('crawler', crawlerId, { crawlerBays: next }, meta)
  },

  async delete(type, id) {
    const key = storeKeyFor(type)
    requireWritableBackend()

    // Commit the delete FIRST, and read the record before doing so: a link is
    // addressed on the server by its endpoints, and once the row is gone there
    // is nothing left to name it by.
    //
    // Awaited rather than fired off, like every other write now. Scrapping a
    // crawler is the table runner's act and the server refuses anyone else — a
    // refusal that only warned would delete the crew's home locally while it
    // stayed alive for everyone else at the table.
    if (type === 'softLink') {
      await commitSoftLink('delete', get().get('softLink', id))
    } else {
      const existing = get().get(type, id)
      await commitEntityWrite(type, {
        kind: 'delete',
        appId: id,
        gameId: existing?.gameId ?? null,
      })
    }

    // Cascade: deleting an entity prunes its SoftLinks, in
    // the same set() as the entity, so no orphaned link is ever shown.
    if (type !== 'softLink') {
      // Commit the cascaded link deletes BEFORE the local delete, and read
      // them first: a link is addressed on the server by its endpoints, so once
      // the local delete has run there is nothing left to name them by. This
      // is the same ordering `delete()` already uses for the entity itself,
      // one line above.
      //
      // A link left alive on the server would come straight back down through
      // `WiringSync`. The server cascades its own side too (`pruneLinksOfRow`);
      // this keeps the two in step for the link ids only this browser holds.
      for (const link of get().list('softLink')) {
        if (link.from?.id !== id && link.to?.id !== id) continue
        // A crew assignment is the crawler writer's to unwire (ADR-044), so the
        // NPC's owner deleting it leaves that link to the server's own cascade
        // (`pruneLinksOfRow`), which runs in the same mutation as the delete.
        if (link.type === 'npc-to-crawler' && link.from.id === id) continue
        await commitSoftLink('delete', link)
      }

      set((state) => ({
        [key]: (state[key] as { id: string }[]).filter((e) => e.id !== id),
        softLinks: withoutLinksTo(state.softLinks, new Set([id])),
      }))
      return
    }

    set((state) => ({
      [key]: (state[key] as { id: string }[]).filter((e) => e.id !== id),
    }))
  },
}))
