import { describe, expect, test } from 'bun:test'
import type { Encounter, EncounterOpponent } from '../../schemas/encounter'
import {
  heldGroups,
  heldWaves,
  instanceName,
  runningFrom,
  splitWaves,
  trayNpcsFor,
} from '../encounters'

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

  test("a group is the encounter's; the tray NPC does not carry it", () => {
    const [npc] = trayNpcsFor([{ ...raider, groupId: 'band' }], [], NOW)
    expect(npc).not.toHaveProperty('groupId')
  })

  test("given the encounter's groups, a grouped opponent carries its group by name", () => {
    const groups = [{ id: 'band', name: 'Raider Band', wave: 1 }]
    const [grouped, alone] = trayNpcsFor(
      [
        { ...raider, groupId: 'band' },
        { ...raider, id: 'o2' },
      ],
      [],
      NOW,
      groups
    )
    expect(grouped?.group).toEqual({ id: 'band', name: 'Raider Band' })
    expect(alone).not.toHaveProperty('group')
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

  test('its briefing, trimmed, when it has one', () => {
    const encounter: Encounter = {
      id: 'enc-1',
      schemaVersion: 1,
      name: 'Ambush',
      opposition: [],
      tables: [],
      notes: '',
      briefing: '  Smoke rises from the crusher.  ',
      createdAt: NOW,
      updatedAt: NOW,
    }
    expect(runningFrom(encounter, NOW).briefing).toBe('Smoke rises from the crusher.')
    expect(runningFrom({ ...encounter, briefing: '   ' }, NOW)).not.toHaveProperty('briefing')
  })
})

describe('waves (ADR-059 §5)', () => {
  const groups = [
    { id: 'band', name: 'Raider Band', wave: 1 },
    { id: 'snipers', name: 'Gantry snipers', wave: 2 },
    { id: 'ace', name: 'The Ace', wave: 3 },
  ]
  const encounter: Encounter = {
    id: 'enc-1',
    schemaVersion: 1,
    name: 'Ambush',
    opposition: [
      { ...raider, groupId: 'band' },
      { ...raider, id: 'o2' },
      { ...raider, id: 'o3', groupId: 'snipers' },
      { ...raider, id: 'o4', groupId: 'ace' },
    ],
    groups,
    tables: [],
    notes: '',
    createdAt: NOW,
    updatedAt: NOW,
  }

  test('the first wave is those alone and in wave 1 groups; the rest are held', () => {
    const { first, held } = splitWaves(encounter)
    expect(first.map((o) => o.id)).toEqual(['o1', 'o2'])
    expect(held.map((o) => o.id)).toEqual(['o3', 'o4'])
  })

  test('the running encounter keeps its groups and the held, only when asked', () => {
    const { held } = splitWaves(encounter)
    const running = runningFrom(encounter, NOW, { held })
    expect(running.groups).toEqual(groups)
    expect(running.held?.map((o) => o.id)).toEqual(['o3', 'o4'])
    expect(runningFrom(encounter, NOW)).not.toHaveProperty('held')
    expect(runningFrom(encounter, NOW, { held: [] })).not.toHaveProperty('held')
  })

  test('the waves still to come, earliest first, and the groups each brings', () => {
    const running = runningFrom(encounter, NOW, splitWaves(encounter))
    expect(heldWaves(running)).toEqual([2, 3])
    expect(heldGroups(running, 2)).toEqual(['Gantry snipers'])
    expect(heldGroups(null, 2)).toEqual([])
    expect(heldWaves({})).toEqual([])
  })
})
