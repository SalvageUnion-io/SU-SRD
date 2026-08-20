/**
 * entityStore — Zustand store wrapping the Wave 1 db/ CRUD layer.
 *
 * Hydration strategy: lazy auto-hydration.
 * When list(type) is called and that type is not yet hydrated, hydrate(type)
 * is triggered automatically (returning a Promise the caller can await if they
 * need the result synchronously). This is more ergonomic than throwing "not
 * hydrated" because callers do not need to pre-call hydrate before every read.
 * Subsequent calls after hydration return the in-memory array synchronously
 * (no extra db round-trip).
 *
 * Write-through: create/update/delete persist to IndexedDB first. On success
 * the in-memory state is updated atomically via Zustand's set(). On failure
 * the db error propagates to the caller; in-memory state is not mutated.
 *
 * Multi-tab (plan 2.7): every successful write publishes the affected object
 * store via lib/db/broadcast; writes made by OTHER tabs invalidate this tab's
 * cache (already-hydrated stores are re-read from IndexedDB). Crawler-bay
 * edits go through updateCrawlerBay(), which merges a single bay entry onto
 * the freshest persisted record instead of replacing the whole array from a
 * possibly-stale in-memory copy.
 *
 * Integrity (plan 2.7): deleting a pilot/mech/crawler also prunes every
 * SoftLink whose `from` or `to` endpoint references it — no more orphaned
 * "Unknown pilot (id)" rows.
 */

import { create } from 'zustand'
import { recordDataWrite } from '../lib/backupNudge'
import { moveTo } from '../lib/container'
import { publishStoreChange, subscribeStoreChanges } from '../lib/db/broadcast'
import * as db from '../lib/db/index'
import type { StoreName } from '../lib/db/stores'
import { STORE_NAMES } from '../lib/db/stores'
import type { ChangeLogKind } from '../lib/schemas/changeLog'
import type { Crawler } from '../lib/schemas/crawler'
import type { Mech } from '../lib/schemas/mech'
import type { Pilot } from '../lib/schemas/pilot'
import type { SoftLink } from '../lib/schemas/softLink'
import { getActiveContainer } from './activeContainerStore'
import {
  mirrorCrawlerWrite,
  mirrorSoftLinkWrite,
  mirrorWrite,
  requireWritableBackend,
} from './entityBackend'
import type { CreateInput, EntityForType, EntityType } from './types'

// Re-exported so consumers can import the type alongside the store itself.
export type { EntityType }

type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

export type EntityState = {
  pilots: Pilot[]
  mechs: Mech[]
  crawlers: Crawler[]
  softLinks: SoftLink[]
  hydrated: {
    pilots: boolean
    mechs: boolean
    crawlers: boolean
    softLinks: boolean
  }

  /**
   * Loads all records of the given type from IndexedDB into in-memory state.
   * Idempotent: subsequent calls when already hydrated are no-ops.
   */
  hydrate: (type: EntityType) => Promise<void>

  /**
   * Re-reads the given type from IndexedDB even when already hydrated.
   * Used for cross-tab invalidation; no-op when the type was never hydrated
   * (lazy hydration will read fresh data anyway).
   */
  rehydrate: (type: EntityType) => Promise<void>

  /**
   * Sync list — returns the in-memory array.
   * Auto-triggers hydrate() if not yet hydrated; callers that need the
   * result immediately should await hydrate(type) before calling list().
   */
  list: <T extends EntityType>(type: T) => EntityForType<T>[]

  /** Sync get — returns the entity by id or null. */
  get: <T extends EntityType>(type: T, id: string) => EntityForType<T> | null

  /** Persists to db then updates in-memory state. Zod errors propagate. */
  create: <T extends EntityType>(type: T, input: CreateInput<T>) => Promise<EntityForType<T>>

  /**
   * Cache a row from the server of record under the id it already has
   * (ADR-030 §1 — IndexedDB is the warm cache once you are signed in).
   *
   * This is the *only* write path that does not mirror back, and that is the
   * point rather than an optimisation: the record came from the server, so
   * echoing it would be a write nobody asked for — and for a crawler, whose
   * mirror is a field merge, a pointless round trip that could clobber an edit
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
   * is not gone, it is simply no longer yours, and `delete` would try to mirror
   * a destruction the server rightly refuses. Keeping the copy instead is worse
   * still — it leaves a live sheet whose every save is rejected, which is the
   * most confusing failure this app can produce.
   */
  forget: (type: EntityType, id: string) => Promise<void>

  /**
   * Merges patch, persists to db, updates in-memory state, then appends a
   * Change Log entry per changed field (provenance, ADR-022). `meta` tags those
   * entries and is **required**: pick the constant for your surface from
   * `surfaceProvenance.ts` (`LIVE_SHEET_MANUAL`, `DASHBOARD_TXN`, …) rather than
   * writing the object inline. It used to be optional with a `manual`/`unknown`
   * default, which quietly defeated the whole point of declaring provenance once
   * per surface — an untagged call site logged as a hand edit and nothing said so.
   */
  update: <T extends EntityType>(
    type: T,
    id: string,
    patch: Partial<EntityForType<T>>,
    meta: ChangeMeta
  ) => Promise<EntityForType<T>>

  /**
   * Merges a patch into ONE crawler bay entry (matched by bayRef) on top of
   * the freshest persisted record — concurrent edits to different bays from
   * different tabs no longer clobber each other's whole-array writes.
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
   * Deletes from db and removes from in-memory state. Deleting a
   * pilot/mech/crawler also deletes every SoftLink referencing it.
   */
  delete: (type: EntityType, id: string) => Promise<void>

  /**
   * Cross-entity value transfer: validates every patch, then commits all
   * updates and deletes in ONE IndexedDB transaction (all-or-nothing). Use
   * for flows that move value between entities — scrap-mech, cargo
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
export type TransferUpdate = {
  [T in EntityType]: { type: T; id: string; patch: Partial<EntityForType<T>> }
}[EntityType]

/**
 * Provenance tags for a Change Log entry (ADR-022).
 *
 * Both fields are required, and so is the parameter that carries them. The
 * earlier all-optional shape meant a forgotten tag was not a compile error but a
 * Change Log line reading `manual` / `unknown` — indistinguishable from a real
 * hand edit, and invisible until somebody read the drawer and disbelieved it.
 * Declare the tag once per surface in `surfaceProvenance.ts` and pass the
 * constant.
 */
export type ChangeMeta = {
  kind: ChangeLogKind
  source: string
}

/** Structural equality via JSON — entity fields are Zod-parsed, so key order is stable. */
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * The fields a patch actually changed: for each key in `patch`, compare the
 * before-image against the persisted result and keep only the ones that moved.
 * `before` is null when the entity was not in memory at write time (the entry's
 * `before` is then undefined — best-effort provenance, see ADR-022).
 */
function changedFields<T extends EntityType>(
  patch: Partial<EntityForType<T>>,
  before: EntityForType<T> | null,
  after: EntityForType<T>
): Array<{ field: string; before: unknown; after: unknown }> {
  const beforeRec = (before ?? {}) as Record<string, unknown>
  const afterRec = after as Record<string, unknown>
  const changes: Array<{ field: string; before: unknown; after: unknown }> = []
  for (const field of Object.keys(patch)) {
    const prev = before === null ? undefined : beforeRec[field]
    const next = afterRec[field]
    if (!jsonEqual(prev, next)) changes.push({ field, before: prev, after: next })
  }
  return changes
}

/**
 * The single Change Log chokepoint (ADR-022): every entityStore.update appends
 * one entry per changed field here. Failure to log never fails the write — the
 * entity is already persisted, so a lost log line is warned, not thrown.
 */
async function emitChangeLog<T extends EntityType>(
  type: T,
  id: string,
  patch: Partial<EntityForType<T>>,
  before: EntityForType<T> | null,
  after: EntityForType<T>,
  meta: ChangeMeta
): Promise<void> {
  try {
    const changes = changedFields(patch, before, after)
    if (changes.length === 0) return
    const ts = Date.now()
    const { kind, source } = meta
    await db.changeLog.append(
      changes.map((c) => ({
        entityType: type,
        entityId: id,
        ts,
        kind,
        field: c.field,
        before: c.before,
        after: c.after,
        source,
      }))
    )
  } catch (err) {
    console.warn('[itun-store] change-log append failed', err)
  }
}

/** Maps EntityType discriminant to its db accessor and Zustand state key. */
type StoreKey = 'pilots' | 'mechs' | 'crawlers' | 'softLinks'

function storeKeyFor(type: EntityType): StoreKey {
  return `${type}s`
}

/**
 * The db accessor surface entityStore needs, expressed against EntityForType
 * so call sites keep the discriminant↔record-type link without `as any`
 * adapters (gap 36).
 */
type DbStoreApi<T extends EntityType> = {
  list: () => Promise<EntityForType<T>[]>
  get: (id: string) => Promise<EntityForType<T> | null>
  create: (input: CreateInput<T>) => Promise<EntityForType<T>>
  update: (id: string, patch: Partial<EntityForType<T>>) => Promise<EntityForType<T>>
  prepareUpdate: (id: string, patch: Partial<EntityForType<T>>) => Promise<EntityForType<T>>
  put: (record: EntityForType<T>) => Promise<EntityForType<T>>
  delete: (id: string) => Promise<void>
}

const DB_STORES: { [K in EntityType]: DbStoreApi<K> } = {
  pilot: db.pilots,
  mech: db.mechs,
  crawler: db.crawlers,
  softLink: db.softLinks,
}

/**
 * Mirror a just-persisted record to the server of record.
 *
 * Pilots and mechs upsert their whole body; the crawler takes the other path
 * (`mirrorCrawlerWrite`) because it is communal — its edits merge per field and
 * only its table runner may raise or scrap one; a SoftLink takes a third
 * (`mirrorSoftLinkWrite`) because it is addressed by its endpoints rather than
 * by an id. Fire-and-forget by design: the local write is what the UI reads, so
 * a mirror failure must not undo it.
 *
 * `patch` is passed on an update so a crawler mirrors the *changed fields*
 * rather than its whole body; sending everything would turn a merge back into
 * last-write-wins and lose whatever a crewmate changed in the same minute.
 *
 * SoftLinks used to be excluded here as "derived". They are not, once a Game is
 * involved — `listForGame` reads them back, so an unmirrored link meant the
 * crew's view of who crews what froze at claim time. See `mirrorSoftLinkWrite`.
 */
function mirrorEntityWrite(
  type: EntityType,
  record: { id: string; gameId?: string | null },
  patch?: object
): void {
  if (type === 'softLink') {
    mirrorSoftLink('upsert', record as unknown as SoftLink)
    return
  }
  if (type === 'crawler') {
    // A shelf crawler used to be dropped here — "no server row to merge into",
    // which was true while `crawlers.gameId` was non-nullable. It is nullable
    // now, so a shelved crawler has a real row like everything else and this
    // mirrors it. Skipping was the one place the local store held data the
    // server had never heard of, which is exactly the local-only state the
    // offline story forbids: IndexedDB reflects Convex, it is not a second
    // source of truth.
    const gameId = record.gameId ?? null
    if (patch === undefined) {
      void mirrorCrawlerWrite({ kind: 'create', appId: record.id, gameId, body: record })
      return
    }
    void mirrorCrawlerWrite({ kind: 'patch', appId: record.id, patch })
    return
  }
  if (type !== 'pilot' && type !== 'mech') return
  void mirrorWrite(type, {
    kind: 'upsert',
    appId: record.id,
    gameId: record.gameId ?? null,
    body: record,
  })
}

/**
 * Send one link's endpoints up, in whichever direction.
 *
 * Split out because a link is mirrored from two places that hold it in
 * different shapes — `mirrorEntityWrite` gets the freshly persisted record,
 * while `delete` has to read the record back *before* removing it, since the
 * endpoints are the only address the server has for it.
 *
 * Guarded rather than assumed: a link whose endpoints did not survive a
 * salvage-tolerant read has nothing to address, and sending a half link would
 * fail validation server-side for no benefit.
 */
function mirrorSoftLink(kind: 'upsert' | 'delete', link: SoftLink | null): void {
  if (link === null) return
  if (link.from?.id === undefined || link.to?.id === undefined) return
  void mirrorSoftLinkWrite({ kind, from: link.from, to: link.to, type: link.type })
}

function dbStoreFor<T extends EntityType>(type: T): DbStoreApi<T> {
  // Single correlated-union assertion: TS cannot carry the runtime
  // discriminant↔record-type invariant through the map lookup for a
  // generic T (microsoft/TypeScript#30581).
  return DB_STORES[type] as DbStoreApi<T>
}

/** Object-store name for broadcast messages. */
function broadcastNameFor(type: EntityType): StoreName {
  switch (type) {
    case 'pilot':
      return STORE_NAMES.pilots
    case 'mech':
      return STORE_NAMES.mechs
    case 'crawler':
      return STORE_NAMES.crawlers
    case 'softLink':
      return STORE_NAMES.softLinks
  }
}

function afterWrite(type: EntityType): void {
  publishStoreChange(broadcastNameFor(type))
  recordDataWrite()
}

/**
 * Stamp a brand-new build with the current container so it belongs somewhere
 * (ADR-030 §2 — an entity is always in exactly one Game or on the Shelf).
 *
 * Applies to pilots/mechs/crawlers only; SoftLinks carry no container. An
 * input that already decided its own container is left untouched so it isn't
 * clobbered — and "already decided" includes an explicit `gameId: null`,
 * because null *is* the Shelf rather than an absence (see lib/container.ts).
 * Testing for `undefined` rather than nullishness is what keeps a deliberate
 * shelving from being overwritten by whatever container happens to be open.
 */
function withActiveContainer<T extends EntityType>(type: T, input: CreateInput<T>): CreateInput<T> {
  if (type === 'softLink') return input
  const rec = input as { gameId?: string | null }
  if (rec.gameId !== undefined) return input
  return { ...input, ...moveTo(getActiveContainer()) } as CreateInput<T>
}

export const useEntityStore = create<EntityState>((set, get) => ({
  pilots: [],
  mechs: [],
  crawlers: [],
  softLinks: [],
  hydrated: {
    pilots: false,
    mechs: false,
    crawlers: false,
    softLinks: false,
  },

  async hydrate(type) {
    const key = storeKeyFor(type)
    if (get().hydrated[key]) return
    await get().rehydrate(type)
  },

  async rehydrate(type) {
    const key = storeKeyFor(type)
    const records = await dbStoreFor(type).list()
    set((state) => ({
      [key]: records,
      hydrated: { ...state.hydrated, [key]: true },
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
    const record = await dbStoreFor(type).create(withActiveContainer(type, input))
    mirrorEntityWrite(type, record)
    set((state) => ({
      [key]: [record, ...(state[key] as EntityForType<T>[])],
    }))
    afterWrite(type)
    return record
  },

  async adopt<T extends EntityType>(type: T, record: EntityForType<T>): Promise<EntityForType<T>> {
    const key = storeKeyFor(type)
    // Deliberately no `requireWritableBackend()`: filling the cache is not a
    // user write. A Disconnected reader must still be able to open what they
    // already pulled down, and refusing here would make going offline lose
    // access to a sheet rather than merely making it read-only.
    const cached = await dbStoreFor(type).put(record)
    set((state) => {
      const list = state[key] as EntityForType<T>[]
      const exists = list.some((e) => e.id === cached.id)
      return {
        [key]: exists ? list.map((e) => (e.id === cached.id ? cached : e)) : [cached, ...list],
      }
    })
    publishStoreChange(broadcastNameFor(type))
    return cached
  },

  async forget(type, id) {
    const key = storeKeyFor(type)
    // Local only, and cascading like `delete` does: a SoftLink pointing at an
    // entity this browser no longer holds would render as a broken cross-link.
    const prunedIds = await db.deleteEntityWithSoftLinks(broadcastNameFor(type), id)
    if (prunedIds.length > 0) {
      const pruned = new Set(prunedIds)
      set((state) => ({ softLinks: state.softLinks.filter((l) => !pruned.has(l.id)) }))
      publishStoreChange(STORE_NAMES.softLinks)
    }
    set((state) => ({
      [key]: (state[key] as { id: string }[]).filter((e) => e.id !== id),
    }))
    publishStoreChange(broadcastNameFor(type))
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
    const updated = await dbStoreFor(type).update(id, patch)
    mirrorEntityWrite(type, updated, patch)
    set((state) => ({
      [key]: (state[key] as EntityForType<T>[]).map((e) => (e.id === id ? updated : e)),
    }))
    afterWrite(type)
    // Provenance (ADR-022): one entry per changed field, at this one chokepoint.
    // Deliberately awaited (not fire-and-forget): the ~1ms IDB append is
    // negligible for a local-first app, and awaiting guarantees the log is
    // consistent the moment update() resolves — a reader that opens the Change
    // Log right after an edit sees the entry, and tests stay deterministic.
    await emitChangeLog(type, id, patch, before, updated, meta)
    return updated
  },

  async transfer(ops, meta) {
    const updates = ops.updates ?? []
    const deletes = ops.deletes ?? []
    if (updates.length === 0 && deletes.length === 0) return

    // Same refusal as create()/update(), and for a stronger reason: a transfer
    // moves value BETWEEN entities (cargo stow/load, a scrap hand-off), so a
    // Disconnected write here would fork not one record against the server but
    // the balance between two — the communal crawler most of all (ADR-030 §5).
    // Deliberately before the before-images, so a refused transfer touches
    // nothing at all.
    requireWritableBackend()

    // Capture before-images BEFORE the write, exactly as update() does, so the
    // Change Log can diff them in phase 4. Without this, cross-entity moves
    // (cargo stow/load, scrap hand-offs) mutated entities with no provenance at
    // all — the one hole in ADR-022's "every mutation is logged" chokepoint
    // guarantee, since transfer() bypasses update().
    const withBefore = updates.map((u) => ({ ...u, before: get().get(u.type, u.id) }))

    // Phase 1 — validate everything BEFORE touching disk. prepareUpdate
    // merges + strict-parses without writing, so a Zod failure on any patch
    // aborts the whole transfer with nothing changed.
    const prepared = await Promise.all(
      withBefore.map(async (u) => ({
        type: u.type,
        id: u.id,
        patch: u.patch,
        before: u.before,
        record: await (
          dbStoreFor(u.type).prepareUpdate as (id: string, patch: object) => Promise<{ id: string }>
        )(u.id, u.patch),
      }))
    )

    // Phase 2 — one IDB transaction for every put and delete.
    const prunedIds = await db.atomicWrite([
      ...prepared.map((pu) => ({
        op: 'put' as const,
        storeName: broadcastNameFor(pu.type),
        record: pu.record,
      })),
      ...deletes.map((d) => ({
        op: 'delete' as const,
        storeName: broadcastNameFor(d.type),
        id: d.id,
        pruneSoftLinks: d.type !== 'softLink',
      })),
    ])

    // Phase 2b — mirror to the server of record, exactly as update() does, and
    // only once the atomic write above has actually landed. Per update rather
    // than per transfer because the dispatch differs by type: a crawler sends
    // its patch so contended Downtime edits merge, a pilot/mech upserts its
    // whole body (see mirrorEntityWrite).
    //
    // This was the more serious half of the gap. Cargo stow/load moves value
    // between a mech and the communal Game crawler (ADR-030 §5); without this
    // the local copy said the scrap had moved and the server never heard, so
    // the rest of the table kept seeing the old balance.
    //
    // No mirror for `deletes`: no production caller passes any today, so
    // wiring one would be untested speculation rather than coverage.
    for (const pu of prepared) {
      mirrorEntityWrite(pu.type, pu.record as { id: string; gameId?: string | null }, pu.patch)
    }

    // Phase 3 — sync in-memory state + broadcasts, mirroring update()/delete().
    const deletedByKey = new Map<StoreKey, Set<string>>()
    for (const d of deletes) {
      const key = storeKeyFor(d.type)
      deletedByKey.set(key, (deletedByKey.get(key) ?? new Set()).add(d.id))
    }
    const pruned = new Set(prunedIds)
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
      if (pruned.size > 0) {
        const base = (next.softLinks ?? state.softLinks) as { id: string }[]
        next.softLinks = base.filter((l) => !pruned.has(l.id))
      }
      return next as Partial<EntityState>
    })
    const touched = new Set<EntityType>([
      ...prepared.map((pu) => pu.type),
      ...deletes.map((d) => d.type),
    ])
    for (const type of touched) afterWrite(type)
    if (pruned.size > 0 && !touched.has('softLink')) {
      publishStoreChange(STORE_NAMES.softLinks)
    }

    // Phase 4 — provenance (ADR-022), mirroring update()'s awaited emit. One
    // entry per changed field per updated entity. Deletes are not logged: the
    // per-entity log goes with the entity.
    for (const pu of prepared) {
      await emitChangeLog(
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
    // Read the freshest persisted record — NOT the in-memory copy — so two
    // tabs editing different bays merge instead of clobbering (plan 2.7).
    const fresh = await db.crawlers.get(crawlerId)
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
    // Read BEFORE the delete: a link is addressed on the server by its
    // endpoints, and after the row is gone there is nothing left to name it by.
    if (type === 'softLink') mirrorSoftLink('delete', get().get('softLink', id))
    if (type === 'pilot' || type === 'mech') void mirrorWrite(type, { kind: 'delete', appId: id })
    // Scrapping a crawler is the table runner's act; the server refuses anyone
    // else, which is why this mirrors rather than deleting only locally.
    if (type === 'crawler' && get().get('crawler', id)?.gameId != null) {
      void mirrorCrawlerWrite({ kind: 'delete', appId: id })
    }

    // Cascade: deleting an entity prunes its SoftLinks (plan 2.7, gap 9).
    // The entity delete and its link pruning run in a single IDB transaction
    // (deleteEntityWithSoftLinks) so a crash/error can never leave orphaned
    // links or a half-applied delete — it is all-or-nothing on disk.
    if (type !== 'softLink') {
      const prunedIds = await db.deleteEntityWithSoftLinks(broadcastNameFor(type), id)
      if (prunedIds.length > 0) {
        const pruned = new Set(prunedIds)
        set((state) => ({
          softLinks: state.softLinks.filter((l) => !pruned.has(l.id)),
        }))
        publishStoreChange(STORE_NAMES.softLinks)
      }
      set((state) => ({
        [key]: (state[key] as { id: string }[]).filter((e) => e.id !== id),
      }))
      afterWrite(type)
      return
    }

    await dbStoreFor(type).delete(id)
    set((state) => ({
      [key]: (state[key] as { id: string }[]).filter((e) => e.id !== id),
    }))
    afterWrite(type)
  },
}))

// ---------------------------------------------------------------------------
// Cross-tab invalidation: when ANOTHER tab announces a write to one of our
// object stores, re-read it from IndexedDB (only if this tab already holds a
// hydrated copy — otherwise lazy hydration will fetch fresh data on demand).
// ---------------------------------------------------------------------------
const BROADCAST_TO_TYPE: Partial<Record<StoreName, EntityType>> = {
  [STORE_NAMES.pilots]: 'pilot',
  [STORE_NAMES.mechs]: 'mech',
  [STORE_NAMES.crawlers]: 'crawler',
  [STORE_NAMES.softLinks]: 'softLink',
}

subscribeStoreChanges((storeName) => {
  const type = BROADCAST_TO_TYPE[storeName]
  if (type === undefined) return
  const state = useEntityStore.getState()
  if (!state.hydrated[storeKeyFor(type)]) return
  void state.rehydrate(type)
})
