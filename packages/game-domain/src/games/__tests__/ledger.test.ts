import { describe, expect, test } from 'bun:test'
import type { Faction, Ledger } from '../../schemas/ledger'
import {
  completeJob,
  dealCount,
  EMPTY_LEDGER,
  factionOf,
  readLedger,
  removeFaction,
  removeJob,
  setJobState,
  upsertFaction,
  upsertJob,
} from '../ledger'

const stefanus: Faction = { id: 'f1', name: 'Stefanus', standing: 'neutral', deal: false }
const vornaya: Faction = { id: 'f2', name: 'Vornaya', standing: 'friendly', deal: true }

const drones = { id: 'j1', name: 'Salvage the Drone Parts', factionId: 'f1', pay: 30, payTl: 1 }

function withJob(): Ledger {
  return upsertJob(upsertFaction(upsertFaction(EMPTY_LEDGER, stefanus), vornaya), drones)
}

describe('reading a stored ledger', () => {
  test('a missing or malformed body reads as empty', () => {
    expect(readLedger(undefined)).toEqual(EMPTY_LEDGER)
    expect(readLedger({ factions: 'no' })).toEqual(EMPTY_LEDGER)
  })

  test('a valid one reads as itself', () => {
    expect(readLedger(withJob())).toEqual(withJob())
  })
})

describe('factions', () => {
  test('one is added, then replaced by its id', () => {
    const once = upsertFaction(EMPTY_LEDGER, stefanus)
    const again = upsertFaction(once, { ...stefanus, standing: 'hostile' })
    expect(again.factions).toEqual([{ ...stefanus, standing: 'hostile' }])
  })

  test('removing one leaves its jobs, offered by nobody', () => {
    const next = removeFaction(withJob(), 'f1')
    expect(next?.factions).toEqual([vornaya])
    expect(next?.jobs[0]?.factionId).toBeNull()
    expect(removeFaction(withJob(), 'nope')).toBeNull()
  })

  test('the deal income counts the factions with a deal', () => {
    expect(dealCount(withJob())).toBe(1)
    expect(dealCount(upsertFaction(withJob(), { ...stefanus, deal: true }))).toBe(2)
  })
})

describe('jobs', () => {
  test('a new job is open, and its faction is found', () => {
    const ledger = withJob()
    expect(ledger.jobs[0]?.state).toBe('open')
    expect(factionOf(ledger, drones)?.name).toBe('Stefanus')
  })

  test('a faction the ledger does not hold reads as nobody', () => {
    const ledger = upsertJob(EMPTY_LEDGER, { ...drones, factionId: 'gone' })
    expect(ledger.jobs[0]?.factionId).toBeNull()
  })

  test('rewriting the terms keeps the state', () => {
    const dropped = setJobState(withJob(), 'j1', 'dropped')
    const rewritten = upsertJob(dropped ?? EMPTY_LEDGER, { ...drones, pay: 40 })
    expect(rewritten.jobs[0]).toMatchObject({ pay: 40, state: 'dropped' })
  })

  test('completing pays once: a done job does not complete again', () => {
    const first = completeJob(withJob(), 'j1')
    expect(first?.job).toMatchObject({ pay: 30, payTl: 1, state: 'done' })
    expect(completeJob(first?.ledger ?? EMPTY_LEDGER, 'j1')).toBeNull()
  })

  test('a dropped job does not complete until it is opened again', () => {
    const dropped = setJobState(withJob(), 'j1', 'dropped') ?? EMPTY_LEDGER
    expect(completeJob(dropped, 'j1')).toBeNull()
    const reopened = setJobState(dropped, 'j1', 'open') ?? EMPTY_LEDGER
    expect(completeJob(reopened, 'j1')?.job.state).toBe('done')
  })

  test('a done job stays done', () => {
    const done = completeJob(withJob(), 'j1')?.ledger ?? EMPTY_LEDGER
    expect(setJobState(done, 'j1', 'open')).toBeNull()
  })

  test('removing one', () => {
    expect(removeJob(withJob(), 'j1')?.jobs).toEqual([])
    expect(removeJob(withJob(), 'nope')).toBeNull()
  })
})
