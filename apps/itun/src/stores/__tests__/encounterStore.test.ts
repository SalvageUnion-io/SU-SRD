/**
 * encounterStore unit tests (design-review R-5).
 *
 * The store holds rows in memory only; it is reset in beforeEach/afterEach to
 * prevent inter-test state leakage.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { SHELF } from 'itun-domain/container'
import { FIXTURE_NOW } from '../../components/__tests__/fixtures'
import type { EncounterNpcCreateInput } from '../encounterStore'
import { useEncounterStore } from '../encounterStore'
import { resetStores } from './resetStores'
import { withSignedInBackend } from './signedInBackend'

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

const baseNpcInput: EncounterNpcCreateInput = {
  schemaVersion: 1,
  refSchema: 'npcs',
  refSlug: 'raider',
  refName: 'Raider',
  name: 'Raider',
  currentHp: 3,
  maxHp: 3,
  statKind: 'hp',
  conditions: [],
}

beforeEach(() => {
  resetStores()
})

afterEach(() => {
  resetStores()
})

describe('encounterStore — create', () => {
  test('creates a tracked NPC and returns it', async () => {
    const npc = await useEncounterStore.getState().create(baseNpcInput)
    expect(npc.id).toBeDefined()
    expect(npc.name).toBe('Raider')
    expect(npc.currentHp).toBe(3)
    expect(npc.createdAt).toBeDefined()
    expect(npc.updatedAt).toBeDefined()

    const list = useEncounterStore.getState().list()
    expect(list.length).toBe(1)
    expect(list[0]?.id).toBe(npc.id)
  })

  test('allows multiple instances of the same reference NPC', async () => {
    const store = useEncounterStore.getState()
    const first = await store.create(baseNpcInput)
    const second = await store.create({ ...baseNpcInput, name: 'Raider 2' })
    expect(first.id).not.toBe(second.id)
    expect(useEncounterStore.getState().list().length).toBe(2)
  })
})

describe('encounterStore — update', () => {
  test('patches HP, conditions, and the recorded Mediator roll', async () => {
    const npc = await useEncounterStore.getState().create(baseNpcInput)

    const updated = await useEncounterStore.getState().update(npc.id, {
      currentHp: 1,
      conditions: ['On Fire'],
      lastMediatorRoll: {
        table: 'morale',
        roll: 4,
        label: 'Retreat',
        value: 'The NPCs flee the fight.',
        rolledAt: FIXTURE_NOW,
      },
    })

    expect(updated.currentHp).toBe(1)
    expect(updated.conditions).toEqual(['On Fire'])
    expect(updated.lastMediatorRoll?.table).toBe('morale')

    const fromStore = useEncounterStore.getState().get(npc.id)
    expect(fromStore?.currentHp).toBe(1)
  })
})

describe('encounterStore — delete', () => {
  test('removes the tracked NPC from the store', async () => {
    const npc = await useEncounterStore.getState().create(baseNpcInput)
    await useEncounterStore.getState().delete(npc.id)

    expect(useEncounterStore.getState().list().length).toBe(0)
    expect(useEncounterStore.getState().get(npc.id)).toBeNull()
  })
})

describe('encounterStore — container scoping', () => {
  test('listForContainer filters by container; null returns all', async () => {
    const store = useEncounterStore.getState()
    await store.create({ ...baseNpcInput, gameId: 'game-1' })
    await store.create({ ...baseNpcInput, name: 'Wastelander', gameId: 'game-2' })
    await store.create({ ...baseNpcInput, name: 'Shelved', gameId: null })

    const state = useEncounterStore.getState()
    expect(state.listForContainer(null).length).toBe(3)
    expect(state.listForContainer({ kind: 'game', gameId: 'game-1' }).map((n) => n.name)).toEqual([
      'Raider',
    ])
    expect(state.listForContainer({ kind: 'game', gameId: 'game-2' }).map((n) => n.name)).toEqual([
      'Wastelander',
    ])
    expect(state.listForContainer(SHELF).map((n) => n.name)).toEqual(['Shelved'])
  })
})
