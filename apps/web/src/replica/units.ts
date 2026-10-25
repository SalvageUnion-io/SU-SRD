/**
 * units — the account's pilots, mechs, crawlers, NPCs and their links, as the
 * replica holds them, and every write to them.
 *
 * Reads are the replica's (`replica.ts`): `useUnits(select)` in a component,
 * `units.get` / `units.list` anywhere else. `hydrate(type)` resolves once the
 * type's rows have arrived, or at once when none are coming.
 *
 * Server first: create, update, delete and transfer send to the server
 * (`outbox.ts`), then hold the result. A refused or failed write propagates to
 * the caller and changes nothing here. A change to a unit is an op (ADR-063):
 * only the fields that moved, made against the `headSeq` the replica holds.
 *
 * Integrity: deleting a unit drops every link whose end it is. Assignments
 * (ADR-037): drawing a link is refused across containers and REPLACES the
 * links it conflicts with; moving a unit drops the links the move leaves
 * straddling two containers. The rules are `game-domain/links/linkRules`,
 * shared with the server, which enforces the same ones.
 */

import type { ContainerFields } from 'game-domain/container'
import { containerOf, moveTo, SHELF, sameContainer } from 'game-domain/container'
import {
  CROSS_CONTAINER_REFUSAL,
  conflictingLinks,
  endsMatchType,
  sameLink,
} from 'game-domain/links/linkRules'
import type { OpInput } from 'game-domain/ops/applyOp'
import { diffBodies } from 'game-domain/ops/applyOp'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { useCallback, useSyncExternalStore } from 'react'
import { staleWriteOf } from '../../convex/model/staleWrite'
import { linksClearedByMove } from '../lib/links/clearedByMove'
import { LinkRefused } from '../lib/links/linkRefused'
import { captureException } from '../lib/observability'
import type { Applied } from './outbox'
import { sendLink, sendOp, sendRow, sendTransfer } from './outbox'
import type { ChangeMeta } from './provenance'
import type { RecordKind } from './records'
import { prepareCreate, prepareUpdate, RECORD_KINDS } from './records'
import type { ReplicaView } from './replica'
import {
  drop,
  dropAll,
  getView,
  headSeqOf,
  hold,
  holdAll,
  markArrived,
  row,
  setRows,
  subscribe,
  TABLE_OF_NAME,
  untilArrived,
} from './replica'
import { requireWritable, StaleWriteRefused } from './sync'
import type { CreateInput, EntityForType, EntityType } from './types'

export type { ChangeMeta } from './provenance'
export type { EntityType }

type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]
type UnitType = Exclude<EntityType, 'softLink'>

/** One update inside a transfer: the discriminant ties patch to type. */
type TransferUpdate = {
  [T in UnitType]: { type: T; id: string; patch: Partial<EntityForType<T>> }
}[UnitType]

/** The reads and writes on the account's units. */
export type UnitsApi = {
  /** Resolves once the type's rows have arrived, or none are coming. */
  hydrate: (type: EntityType) => Promise<void>
  /** The device's copy was read: these types have arrived. */
  markArrived: (types: readonly EntityType[]) => void
  /** Every held row of a type. */
  list: <T extends EntityType>(type: T) => EntityForType<T>[]
  /** One held row, or null. */
  get: <T extends EntityType>(type: T, id: string) => EntityForType<T> | null
  /** Sends the new row, then holds it. Zod errors propagate. */
  create: <T extends EntityType>(type: T, input: CreateInput<T>) => Promise<EntityForType<T>>
  /**
   * Hold a row the server sent, under the id it has (ADR-030 §1): not a user
   * write, so nothing is sent and nothing is logged.
   */
  adopt: <T extends EntityType>(type: T, record: EntityForType<T>) => Promise<EntityForType<T>>
  /**
   * Drop this tab's copy without deleting it anywhere else: a unit handed back
   * to the crew is not gone, only no longer yours.
   */
  forget: (type: EntityType, id: string) => Promise<void>
  /**
   * Merges the patch, sends it as an op tagged with `meta` (the surface's
   * constant from `provenance.ts`; required, so an untagged write cannot log as
   * a hand edit), then holds the result.
   */
  update: <T extends EntityType>(
    type: T,
    id: string,
    patch: Partial<EntityForType<T>>,
    meta: ChangeMeta
  ) => Promise<EntityForType<T>>
  /**
   * Merges a patch into ONE crawler bay entry (matched by `bayRef`, or the
   * entry at `index` when its `bayRef` matches) on the record as held now,
   * not a caller's copy of the whole array.
   */
  updateCrawlerBay: (
    crawlerId: string,
    bayRef: string,
    patch: Partial<Omit<CrawlerBayEntry, 'bayRef'>>,
    index: number | undefined,
    meta: ChangeMeta
  ) => Promise<Crawler>
  /** Deletes on the server, then here; a unit's links go with it. */
  delete: (type: EntityType, id: string) => Promise<void>
  /**
   * Moves value between units (scrap, cargo stow and load) as ONE batch of
   * ops and deletes, all or none at both ends.
   */
  transfer: (
    ops: { updates?: TransferUpdate[]; deletes?: { type: EntityType; id: string }[] },
    meta: ChangeMeta
  ) => Promise<void>
}

type UnitNames = 'pilots' | 'mechs' | 'crawlers' | 'npcs' | 'softLinks'

/** What `useUnits` selects from: the unit tables, whether each has arrived, and the api. */
export type UnitsState = Pick<ReplicaView, UnitNames> & {
  readonly hydrated: { readonly [N in UnitNames]: boolean }
} & UnitsApi

function kindOf<T extends EntityType>(type: T): RecordKind<EntityForType<T>> {
  // TS cannot carry the discriminant to record-type invariant through the map
  // lookup for a generic T (microsoft/TypeScript#30581).
  return RECORD_KINDS[type] as unknown as RecordKind<EntityForType<T>>
}

const listOf = <T extends EntityType>(type: T): EntityForType<T>[] =>
  getView()[RECORD_KINDS[type].name] as unknown as EntityForType<T>[]

/** Holds what the server answered for a unit, so its next op is made against it. */
function holdApplied<T extends EntityType>(
  type: T,
  record: EntityForType<T>,
  applied: Applied | undefined
): EntityForType<T> {
  return hold(type, record as never, applied) as EntityForType<T>
}

/**
 * Send a new row, and throw if the server refuses. A link is addressed by its
 * endpoints, because the server has no id for it.
 */
async function sendCreate(
  type: EntityType,
  record: { id: string; gameId?: string | null }
): Promise<Applied | undefined> {
  if (type === 'softLink') {
    await sendLink('upsert', record as unknown as SoftLink)
    return undefined
  }
  return sendRow(type, {
    kind: 'upsert',
    appId: record.id,
    gameId: record.gameId ?? null,
    body: record,
  })
}

/**
 * The op that takes a unit from the copy held to `updated` (ADR-063): only the
 * fields that moved, made against the copy's `headSeq`, tagged with the
 * surface's provenance. `move` is a crawler's new container, which
 * `moveCrawler` writes rather than the op.
 */
function opOf(
  type: EntityType,
  id: string,
  before: object,
  updated: object,
  patch: object,
  meta: ChangeMeta
): { op: OpInput; move?: string | null } {
  const { patch: changed, unset } = diffBodies(
    before as Record<string, unknown>,
    updated as Record<string, unknown>
  )
  const op: OpInput = {
    id: crypto.randomUUID(),
    unitId: id,
    baseSeq: headSeqOf(type, id) ?? null,
    at: Date.now(),
    kind: meta.kind,
    source: meta.source,
    patch: changed,
    ...(unset.length === 0 ? {} : { unset }),
  }
  if (type !== 'crawler' || !('gameId' in patch)) return { op }
  delete changed.gameId
  return { op, move: (patch as { gameId?: string | null }).gameId ?? null }
}

/**
 * What a refused send throws. A stale-write refusal carries the server's row,
 * which is held first, so the sheet shows what the other device saved and the
 * player re-applies their change on top of it rather than over it; `rowOf`
 * names the refused record from the body's id. Any other refusal is thrown as
 * it came.
 */
function refusalOf(
  err: unknown,
  rowOf: (bodyId: string | undefined) => { type: EntityType; id: string } | undefined
): unknown {
  const stale = staleWriteOf(err)
  if (stale === null) return err
  try {
    const refused = rowOf((stale.body as { id?: string } | null)?.id)
    if (refused !== undefined) {
      const served = kindOf(refused.type).schema.parse(stale.body)
      hold(refused.type, served as never, { version: stale.updatedAt, headSeq: stale.headSeq })
    }
  } catch (holdErr) {
    // The refusal still stands and is still shown; only the refresh failed,
    // and the feed brings the row down on its next answer regardless.
    captureException(holdErr)
  }
  return new StaleWriteRefused(stale.message, { cause: err })
}

/**
 * Stamp a new build with its container (ADR-030 §2): an input that names its
 * Game keeps it (the wizard's `?game=<id>`), any other lands in the Training
 * Bay. Links carry no container.
 */
function withContainer<T extends EntityType>(type: T, input: CreateInput<T>): CreateInput<T> {
  if (type === 'softLink') return input
  if ((input as { gameId?: string | null }).gameId !== undefined) return input
  return { ...input, ...moveTo(SHELF) } as CreateInput<T>
}

/**
 * Draw a link through the assignment model (ADR-037). Checked here first so a
 * refusal costs no round trip, and again on the server, which is the
 * authority: the type must match its ends, both ends must share a container
 * when this tab holds both, and the link REPLACES the links it conflicts with.
 * Drawing one that exists returns the one held.
 */
async function createSoftLink(input: CreateInput<'softLink'>): Promise<SoftLink> {
  if (!endsMatchType(input)) {
    throw new Error(`A ${input.type} link cannot join ${input.from.type} → ${input.to.type}`)
  }
  const fromEntity = units.get(input.from.type, input.from.id)
  const toEntity = units.get(input.to.type, input.to.id)
  if (
    fromEntity !== null &&
    toEntity !== null &&
    !sameContainer(containerOf(fromEntity), containerOf(toEntity))
  ) {
    throw new LinkRefused(CROSS_CONTAINER_REFUSAL)
  }

  const record = prepareCreate(RECORD_KINDS.softLink, input)
  await sendLink('upsert', record)

  // Read AFTER the send: the feed may already have brought this link down
  // while it was in flight, and the replace must see that too.
  const current = listOf('softLink')
  const present = current.find((l) => sameLink(l, input)) ?? null
  const replaced = conflictingLinks(current, input)
  dropAll(replaced.map((l) => ({ table: 'softLink' as const, id: l.id })))
  if (present !== null) return present
  return hold('softLink', record)
}

export const units: UnitsApi = {
  hydrate: (type) => untilArrived(type).then(() => markArrived([type])),

  markArrived,

  list: listOf,

  get: (type, id) => row(type, id) as never,

  async create<T extends EntityType>(type: T, input: CreateInput<T>) {
    // Refuses rather than degrading when the server is out of reach (ADR-030
    // §1): offline a player's own edits wait for the outbox.
    requireWritable()
    if (type === 'softLink') {
      return (await createSoftLink(input as CreateInput<'softLink'>)) as EntityForType<T>
    }
    // Build, send, and only then hold: a record the server refused does not
    // exist, so it must not appear here either.
    const record = prepareCreate(kindOf(type), withContainer(type, input))
    return holdApplied(type, record, await sendCreate(type, record))
  },

  async adopt(type, record) {
    return hold(type, kindOf(type).schema.parse(record) as never) as never
  },

  async forget(type, id) {
    drop(type, id)
  },

  async update<T extends EntityType>(
    type: T,
    id: string,
    patch: Partial<EntityForType<T>>,
    meta: ChangeMeta
  ) {
    const before = units.get(type, id)
    requireWritable()

    // Merge and validate, send, then hold: a refused edit leaves the held
    // record exactly as it was.
    const updated = prepareUpdate(kindOf(type), before, id, patch)
    let applied: Applied | undefined
    if (type === 'softLink') {
      await sendLink('upsert', updated as unknown as SoftLink)
    } else if (before !== null) {
      const { op, move } = opOf(type, id, before, updated, patch, meta)
      try {
        applied = await sendOp(type, (updated as ContainerFields).gameId ?? null, op, move)
      } catch (err) {
        throw refusalOf(err, () => ({ type, id }))
      }
    }
    holdApplied(type, updated, applied)

    // A move takes along only the links whose other end is already where it
    // is going (ADR-037); the server pruned the rest in the same send.
    if (type !== 'softLink' && before !== null) {
      const moved = updated as ContainerFields
      if (!sameContainer(containerOf(before as ContainerFields), containerOf(moved))) {
        const broken = linksClearedByMove(
          getView(),
          { type: type as UnitType, id },
          containerOf(moved)
        )
        dropAll(broken.map((l) => ({ table: 'softLink' as const, id: l.id })))
      }
    }
    return updated
  },

  async transfer(ops, meta) {
    const updates = ops.updates ?? []
    const deletes = ops.deletes ?? []
    if (updates.length === 0 && deletes.length === 0) return

    // Refused before anything is read: a transfer moves value BETWEEN units,
    // so a write that could not go up would fork the balance between two.
    requireWritable()

    // Validate everything before changing anything: a Zod failure on any
    // patch aborts the whole transfer.
    const prepared = updates.map((u) => {
      const before = units.get(u.type, u.id)
      return {
        ...u,
        before,
        record: prepareUpdate(
          kindOf(u.type) as RecordKind<{ id: string }>,
          before as { id: string } | null,
          u.id,
          u.patch
        ),
      }
    })

    // Send the whole transfer as ONE batch, all or none on the server: a stow
    // that landed on the mech and was refused on the crawler would lose the
    // lot. Links are read before they are dropped here, because the server
    // addresses a link by its endpoints.
    let applied: ReadonlyMap<string, Applied>
    try {
      applied = await sendTransfer(
        prepared.map((pu) => ({
          unit: pu.type,
          gameId: (pu.record as ContainerFields).gameId ?? null,
          ...opOf(pu.type, pu.id, pu.before as object, pu.record, pu.patch, meta),
        })),
        deletes.map((d) =>
          d.type === 'softLink'
            ? { type: 'softLink' as const, link: units.get('softLink', d.id) }
            : { type: d.type, id: d.id }
        )
      )
    } catch (err) {
      throw refusalOf(err, (bodyId) => prepared.find((pu) => pu.id === bodyId))
    }

    // Hold it as one change; deleting a unit takes its links with it.
    holdAll(
      prepared.map((pu) => ({
        table: pu.type,
        row: pu.record,
        ...(applied.get(pu.id) ?? {}),
      })),
      deletes.map((d) => ({ table: d.type, id: d.id }))
    )
  },

  async updateCrawlerBay(crawlerId, bayRef, patch, index, meta) {
    const fresh = units.get('crawler', crawlerId)
    if (fresh === null) {
      throw new Error(`[replica] Cannot update bay: crawler id="${crawlerId}" not found`)
    }
    const bays = fresh.crawlerBays ?? []
    const targetIndex =
      index !== undefined && bays[index]?.bayRef === bayRef
        ? index
        : bays.findIndex((b) => b.bayRef === bayRef)
    if (targetIndex === -1) {
      throw new Error(
        `[replica] Cannot update bay: bayRef="${bayRef}" not found on crawler "${crawlerId}"`
      )
    }
    const next = bays.map((b, i) => (i === targetIndex ? { ...b, ...patch, bayRef } : b))
    return units.update('crawler', crawlerId, { crawlerBays: next }, meta)
  },

  async delete(type, id) {
    requireWritable()
    // Read before sending: a link is addressed by its endpoints, and once the
    // row is gone there is nothing left to name it by.
    if (type === 'softLink') {
      await sendLink('delete', units.get('softLink', id))
      drop('softLink', id)
      return
    }
    const existing = units.get(type, id)
    await sendRow(type, { kind: 'delete', appId: id, gameId: existing?.gameId ?? null })
    // The server cascades its own side (`pruneLinksOfRow`); this sends the
    // deletes for the links only this tab holds, before dropping them here.
    for (const link of listOf('softLink')) {
      if (link.from?.id !== id && link.to?.id !== id) continue
      // A crew assignment is the crawler writer's to unwire (ADR-044): the
      // server's own cascade removes it with the NPC.
      if (link.type === 'npc-to-crawler' && link.from.id === id) continue
      await sendLink('delete', link)
    }
    drop(type, id)
  },
}

/** `units` with the replica's view, for a selector to read both. */
function unitsState(): UnitsState {
  return Object.assign(Object.create(units) as UnitsApi, getView()) as UnitsState
}

let state: UnitsState | null = null
let stateOf: ReplicaView | null = null

/** The state as one object, stable until the replica changes. */
function currentState(): UnitsState {
  const view = getView()
  if (state === null || stateOf !== view) {
    state = unitsState()
    stateOf = view
  }
  return state
}

/**
 * Read the units through a selector; re-renders only when what it returns
 * changes. `useUnits.getState()` is the same object outside React.
 */
export function useUnits(): UnitsState
export function useUnits<T>(select: (s: UnitsState) => T): T
export function useUnits<T>(select?: (s: UnitsState) => T): T | UnitsState {
  const read = useCallback(() => (select ? select(currentState()) : currentState()), [select])
  return useSyncExternalStore(subscribe, read, read)
}
useUnits.getState = currentState

/**
 * Put rows straight into the replica, sent nowhere: a test's seed. Each key is
 * a collection (`pilots`, …) or `hydrated`, as the state reads.
 */
useUnits.setState = (
  partial: Partial<Record<string, unknown>> | ((s: UnitsState) => Partial<Record<string, unknown>>)
): void => {
  seed(typeof partial === 'function' ? partial(currentState()) : partial)
}

/**
 * A units store: the shape `useUnits` has, so a sheet can be handed another
 * one (a crewmate's, read-only, `readOnlySheetStore.model.ts`).
 */
export type UnitsStore = {
  (): UnitsState
  <T>(select: (s: UnitsState) => T): T
  getState: () => UnitsState
}

/** Seed collections and arrival by their view names, as `setState` takes them. */
function seed(partial: Partial<Record<string, unknown>>): void {
  const hydrated = (partial.hydrated ?? {}) as Partial<Record<string, boolean>>
  for (const [name, table] of Object.entries(TABLE_OF_NAME)) {
    const rows = partial[name] as readonly { id: string }[] | undefined
    const flag = typeof partial.hydrated === 'boolean' ? undefined : hydrated[name]
    if (rows !== undefined || flag !== undefined) setRows(table, rows, flag)
  }
}
