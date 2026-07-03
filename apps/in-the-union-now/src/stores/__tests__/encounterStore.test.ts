/**
 * encounterStore unit tests (design-review R-5).
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml. The store is reset in
 * beforeEach/afterEach to prevent inter-test state leakage.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { _clearAllStores, _resetDbSingleton } from '../../lib/db/index'
import type { EncounterNpcCreateInput } from '../encounterStore'
import { useEncounterStore } from '../encounterStore'

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

function resetStore(): void {
  useEncounterStore.setState({ encounterNpcs: [], hydrated: false })
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetStore()
})

afterEach(async () => {
  await _clearAllStores()
  resetStore()
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
    expect(list[0]!.id).toBe(npc.id)
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
        rolledAt: new Date().toISOString(),
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
  test('removes the tracked NPC from memory and disk', async () => {
    const npc = await useEncounterStore.getState().create(baseNpcInput)
    await useEncounterStore.getState().delete(npc.id)

    expect(useEncounterStore.getState().list().length).toBe(0)

    // Fresh hydration from IndexedDB confirms the delete persisted.
    resetStore()
    await useEncounterStore.getState().hydrate()
    expect(useEncounterStore.getState().list().length).toBe(0)
  })
})

describe('encounterStore — hydration persistence', () => {
  test('records survive a reset + rehydrate (reload semantics)', async () => {
    await useEncounterStore.getState().create(baseNpcInput)

    resetStore()
    expect(useEncounterStore.getState().encounterNpcs.length).toBe(0)

    await useEncounterStore.getState().hydrate()
    const list = useEncounterStore.getState().list()
    expect(list.length).toBe(1)
    expect(list[0]!.refSlug).toBe('raider')
  })
})

describe('encounterStore — workspace scoping', () => {
  test('listForWorkspace filters by workspaceId; null returns all', async () => {
    const store = useEncounterStore.getState()
    await store.create({ ...baseNpcInput, workspaceId: 'ws-1' })
    await store.create({ ...baseNpcInput, name: 'Wastelander', workspaceId: 'ws-2' })
    await store.create({ ...baseNpcInput, name: 'Unassigned' })

    const state = useEncounterStore.getState()
    expect(state.listForWorkspace(null).length).toBe(3)
    expect(state.listForWorkspace('ws-1').map((n) => n.name)).toEqual(['Raider'])
    expect(state.listForWorkspace('ws-2').map((n) => n.name)).toEqual(['Wastelander'])
  })
})
