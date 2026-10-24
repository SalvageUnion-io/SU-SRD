import { describe, expect, test } from 'bun:test'
import type { Encounter, EncounterOpponent } from 'game-domain/schemas/encounter'
import {
  ENCOUNTER_MAX_GROUP_NAME,
  ENCOUNTER_MAX_GROUPS,
  EncounterSchema,
} from 'game-domain/schemas/encounter'
import {
  addGroup,
  groupName,
  groupsOf,
  hasRoomForGroup,
  moveToGroup,
  oppositionBlocks,
  removeGroup,
  renameGroup,
  setGroupWave,
  WAVES,
} from '../encounter.model'

const NOW = '2026-10-24T00:00:00.000Z'

const raider = (id: string, groupId?: string): EncounterOpponent => ({
  id,
  refSchema: 'npcs',
  refSlug: 'raider',
  refName: 'Raider',
  name: `Raider ${id}`,
  maxHp: 3,
  statKind: 'hp',
  ...(groupId === undefined ? {} : { groupId }),
})

const ambush: Encounter = {
  id: 'enc-1',
  schemaVersion: 1,
  name: 'Ambush at the Scrap Yard',
  opposition: [raider('a', 'band'), raider('b', 'band'), raider('c'), raider('d', 'snipers')],
  groups: [
    { id: 'snipers', name: 'Gantry snipers', wave: 2 },
    { id: 'band', name: 'Raider Band', wave: 1 },
  ],
  tables: [],
  notes: '',
  briefing: 'Smoke rises from the crusher.',
  createdAt: NOW,
  updatedAt: NOW,
}

describe("an encounter's groups", () => {
  test('one built before groups reads as none, and its shape still parses', () => {
    const { groups: _g, briefing: _b, ...old } = ambush
    const before = { ...old, opposition: [raider('c')] }
    expect(groupsOf(before as Encounter)).toEqual([])
    expect(EncounterSchema.safeParse(before).success).toBe(true)
  })

  test('parses with groups, waves and a briefing', () => {
    expect(EncounterSchema.safeParse(ambush).success).toBe(true)
  })

  test('an opponent can only join a group the encounter has', () => {
    const stray = { ...ambush, opposition: [raider('x', 'nobody')] }
    expect(EncounterSchema.safeParse(stray).success).toBe(false)
  })

  test('a group arrives in wave 1, 2 or 3', () => {
    expect(WAVES).toEqual([1, 2, 3])
    const late = { ...ambush, groups: [{ id: 'band', name: 'Raider Band', wave: 4 }] }
    expect(EncounterSchema.safeParse(late).success).toBe(false)
  })

  test('a new group comes last, with the encounter, until there is no room', () => {
    expect(addGroup(ambush, 'Scouts', 'g3').at(-1)).toEqual({ id: 'g3', name: 'Scouts', wave: 1 })
    const full = {
      groups: Array.from({ length: ENCOUNTER_MAX_GROUPS }, (_, i) => ({
        id: `g${i}`,
        name: `G${i}`,
        wave: 1,
      })),
    }
    expect(hasRoomForGroup(full)).toBe(false)
    expect(addGroup(full, 'One more', 'x')).toHaveLength(ENCOUNTER_MAX_GROUPS)
  })

  test('a typed name is trimmed and cut to fit', () => {
    expect(groupName('  Raider Band  ')).toBe('Raider Band')
    expect(groupName('x'.repeat(60))).toHaveLength(ENCOUNTER_MAX_GROUP_NAME)
    expect(groupName('   ')).toBe('')
  })

  test('renames and moves a group to another wave', () => {
    const groups = groupsOf(ambush)
    expect(renameGroup(groups, 'band', 'Crusher crew')[1]?.name).toBe('Crusher crew')
    expect(setGroupWave(groups, 'band', 3)[1]?.wave).toBe(3)
  })

  test('removing a group keeps its opponents, each fighting alone', () => {
    const after = removeGroup(ambush, 'band')
    expect(after.groups?.map((g) => g.id)).toEqual(['snipers'])
    expect(after.opposition.map((o) => o.groupId)).toEqual([
      undefined,
      undefined,
      undefined,
      'snipers',
    ])
    expect(EncounterSchema.safeParse({ ...ambush, ...after }).success).toBe(true)
  })

  test('moves an opponent into a group and back out', () => {
    expect(moveToGroup(ambush.opposition, 'c', 'band')[2]?.groupId).toBe('band')
    const out = moveToGroup(ambush.opposition, 'a', null)[0]
    expect(out).not.toHaveProperty('groupId')
  })

  test('lists those alone first, then the groups by wave', () => {
    const blocks = oppositionBlocks(ambush)
    expect(blocks.map((b) => b.group?.id ?? null)).toEqual([null, 'band', 'snipers'])
    expect(blocks.map((b) => b.opponents.map((o) => o.id))).toEqual([['c'], ['a', 'b'], ['d']])
  })

  test('with no groups, one block of everyone; with no one alone, none for them', () => {
    expect(oppositionBlocks({ opposition: [raider('c')] })).toEqual([
      { group: null, opponents: [raider('c')] },
    ])
    const allGrouped = { ...ambush, opposition: [raider('a', 'band')] }
    expect(oppositionBlocks(allGrouped)[0]?.group?.id).toBe('band')
  })
})
