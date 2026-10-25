/**
 * The account's op-less records, as the replica holds them: saved patterns,
 * the Mediator's NPC tray and their encounters (ADR-059). Each is a body
 * addressed by its own id, written whole and server first (`outbox.ts`), then
 * held; a refused write changes nothing here.
 *
 * `usePatterns(select)` and its siblings read in a component; `patterns.list()`
 * and the rest anywhere else.
 */

import type { Container } from 'game-domain/container'
import { containerOf, sameContainer } from 'game-domain/container'
import type { Encounter } from 'game-domain/schemas/encounter'
import type { EncounterNpc } from 'game-domain/schemas/encounterNpc'
import type { MechPattern } from 'game-domain/schemas/pattern'
import { useCallback, useSyncExternalStore } from 'react'
import { sendEncounter, sendPattern, sendTrayNpc } from './outbox'
import type { RecordKind } from './records'
import { prepareCreate, prepareUpdate, RECORD_KINDS } from './records'
import type { RowOf } from './replica'
import { drop, getView, hold, markArrived, row, setRows, subscribe, untilArrived } from './replica'
import { requireWritable } from './sync'

type RecordTable = 'mechPattern' | 'encounterNpc' | 'encounter'
type Send = (
  op: { kind: 'upsert'; record: { id: string } } | { kind: 'delete'; id: string }
) => Promise<void>

/** The reads and writes on one collection. */
type CollectionApi<T, Input> = {
  /** Resolves once the rows have arrived, or none are coming. */
  hydrate: () => Promise<void>
  /** The device's copy was read: the rows have arrived. */
  markArrived: () => void
  list: () => T[]
  get: (id: string) => T | null
  /** Sends, then holds. Zod errors propagate. */
  create: (input: Input) => Promise<T>
  update: (id: string, patch: Partial<T>) => Promise<T>
  delete: (id: string) => Promise<void>
  /** Hold a row the server sent: nothing is sent back. */
  adopt: (record: T) => Promise<T>
  /** Drop this tab's copy, never a server delete. */
  forget: (id: string) => Promise<void>
}

function collection<K extends RecordTable, Input>(table: K, send: Send) {
  type T = RowOf<K>
  // A generic K loses the table to record-type correlation
  // (microsoft/TypeScript#30581).
  const kind = RECORD_KINDS[table] as unknown as RecordKind<T>
  const name = kind.name as (typeof RECORD_KINDS)[K]['name']
  const list = (): T[] => getView()[name] as unknown as T[]
  const api: CollectionApi<T, Input> = {
    hydrate: () => untilArrived(table),
    markArrived: () => markArrived([table]),
    list,
    get: (id) => row(table, id),
    async create(input) {
      requireWritable()
      const record = prepareCreate(kind, input as object) as T
      await send({ kind: 'upsert', record: record as { id: string } })
      return hold(table, record)
    },
    async update(id, patch) {
      requireWritable()
      const updated = prepareUpdate(kind, row(table, id), id, patch) as T
      await send({ kind: 'upsert', record: updated as { id: string } })
      return hold(table, updated)
    },
    async delete(id) {
      requireWritable()
      await send({ kind: 'delete', id })
      drop(table, id)
    },
    async adopt(record) {
      return hold(table, kind.schema.parse(record) as T)
    },
    async forget(id) {
      drop(table, id)
    },
  }
  return api
}

/**
 * A collection's state for a selector: its rows under the collection's name,
 * whether they have arrived, and the api. Stable until the replica changes.
 */
function stateOf<K extends RecordTable, A extends object>(table: K, api: A) {
  type State = A & { [N in (typeof RECORD_KINDS)[K]['name']]: RowOf<K>[] } & { hydrated: boolean }
  const name = RECORD_KINDS[table].name
  let state: State | null = null
  let rows: unknown = null
  let arrived = false
  const current = (): State => {
    const view = getView()
    const nextRows = view[name]
    const nextArrived = view.hydrated[name]
    if (state === null || rows !== nextRows || arrived !== nextArrived) {
      rows = nextRows
      arrived = nextArrived
      state = Object.assign(Object.create(api) as A, {
        [name]: nextRows,
        hydrated: nextArrived,
      }) as State
    }
    return state
  }
  function useCollection(): State
  function useCollection<T>(select: (s: State) => T): T
  function useCollection<T>(select?: (s: State) => T): T | State {
    const read = useCallback(() => (select ? select(current()) : current()), [select])
    return useSyncExternalStore(subscribe, read, read)
  }
  useCollection.getState = current
  /** A test's seed: the rows and arrival as given, sent nowhere. */
  useCollection.setState = (partial: Partial<Record<string, unknown>>): void => {
    const rows = partial[name] as readonly { id: string }[] | undefined
    const flag = typeof partial.hydrated === 'boolean' ? partial.hydrated : undefined
    setRows(table, rows, flag)
  }
  return useCollection
}

/** create input: id, `createdAt` and `updatedAt` are minted (`prepareCreate`). */
export type MechPatternCreateInput = Omit<MechPattern, 'id' | 'createdAt' | 'updatedAt'>
export type EncounterNpcCreateInput = Omit<EncounterNpc, 'id' | 'createdAt' | 'updatedAt'>
export type EncounterCreateInput = Omit<Encounter, 'id' | 'createdAt' | 'updatedAt'>

/** Saved mech patterns. */
const patterns = collection<'mechPattern', MechPatternCreateInput>('mechPattern', sendPattern)
export const usePatterns = stateOf('mechPattern', patterns)

const trayApi = collection<'encounterNpc', EncounterNpcCreateInput>('encounterNpc', sendTrayNpc)

/** The Mediator's NPC tray: reference NPCs with live HP and SP. */
const tray = {
  ...trayApi,
  /** Tracked NPCs in one container; null = all. */
  listForContainer(container: Container | null): EncounterNpc[] {
    const all = trayApi.list()
    if (container === null) return all
    return all.filter((n) => sameContainer(containerOf(n), container))
  },
}
export const useTray = stateOf('encounterNpc', tray)

/** The Mediator's prepped encounters (ADR-059): shelf only, always the owner's. */
const encounters = collection<'encounter', EncounterCreateInput>('encounter', sendEncounter)
export const useEncounters = stateOf('encounter', encounters)
