import { describe, expect, test } from 'bun:test'
import type { Encounter, EncounterOpponent } from '../../schemas/encounter'
import { instanceName, runningFrom, trayNpcsFor } from '../encounters'

const NOW = '2026-10-22T00:00:00.000Z'

const raider: EncounterOpponent = {
  id: 'o1',
  refSchema: 'npcs',
  refSlug: 'raider',
  refName: 'Raider',
  name: 'Raider',
  maxHp: 3,
  statKind: 'hp',
}

describe('naming an instance', () => {
  test('a free name is kept, a taken one numbered from 2', () => {
    expect(instanceName('Raider', [])).toBe('Raider')
    expect(instanceName('Raider', ['Raider'])).toBe('Raider 2')
    expect(instanceName('Raider', ['Raider', 'Raider 2'])).toBe('Raider 3')
  })
})

describe('the tray NPCs an encounter fields', () => {
  test('each at full HP, with no conditions, and no encounter id', () => {
    const [npc] = trayNpcsFor([raider], [], NOW)
    expect(npc).toEqual({
      refSchema: 'npcs',
      refSlug: 'raider',
      refName: 'Raider',
      name: 'Raider',
      maxHp: 3,
      statKind: 'hp',
      schemaVersion: 1,
      currentHp: 3,
      conditions: [],
      createdAt: NOW,
      updatedAt: NOW,
    })
  })

  test('named apart from the tray and from each other', () => {
    const names = trayNpcsFor([raider, { ...raider, id: 'o2' }], ['Raider'], NOW).map((n) => n.name)
    expect(names).toEqual(['Raider 2', 'Raider 3'])
  })
})

describe('what a Game keeps of a running encounter', () => {
  test('its name, a copy of its tables, its notes, and when it started', () => {
    const encounter: Encounter = {
      id: 'enc-1',
      schemaVersion: 1,
      name: 'Ambush',
      opposition: [raider],
      tables: ['Morale'],
      notes: 'Behind the crusher.',
      createdAt: NOW,
      updatedAt: NOW,
    }
    const running = runningFrom(encounter, NOW)
    expect(running).toEqual({
      encounterId: 'enc-1',
      name: 'Ambush',
      tables: ['Morale'],
      notes: 'Behind the crusher.',
      startedAt: NOW,
    })
    expect(running.tables).not.toBe(encounter.tables)
  })
})
