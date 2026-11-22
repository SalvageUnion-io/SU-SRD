import { describe, expect, test } from 'bun:test'
import type { Encounter, EncounterOpponent } from 'game-domain/schemas/encounter'
import {
  ENCOUNTER_MAX_NAME,
  ENCOUNTER_MAX_OPPOSITION,
  ENCOUNTER_MAX_TABLES,
} from 'game-domain/schemas/encounter'
import { encounterLine, trayChoiceLabel } from '../../../play/mediator/runEncounter.model'
import {
  blankEncounter,
  duplicateOpponent,
  encounterCopy,
  encounterHref,
  encountersFielding,
  hasRoomFor,
  opponentAsTray,
  opponentFrom,
  opponentNote,
  oppositionWith,
  pinTable,
  redesignedOpposition,
  restoredOpponent,
  unpinTable,
  withoutDesign,
} from '../encounter.model'

const NOW = '2026-10-22T00:00:00.000Z'

const band: EncounterOpponent = {
  id: 'o1',
  refSchema: 'squads',
  refSlug: 'raider-band',
  name: 'Raider Band',
  maxHp: 6,
  statKind: 'hp',
}

const ambush: Encounter = {
  id: 'enc-1',
  schemaVersion: 1,
  name: 'Ambush',
  opposition: [band],
  tables: ['Morale'],
  notes: 'Behind the crusher.',
  createdAt: NOW,
  updatedAt: NOW,
}

describe('an encounter on the shelf', () => {
  test('opens at its own page', () => {
    expect(encounterHref('enc-1')).toBe('/encounters/enc-1')
  })

  test('starts blank', () => {
    expect(blankEncounter()).toEqual({
      schemaVersion: 1,
      name: 'New encounter',
      opposition: [],
      tables: [],
      notes: '',
    })
  })

  test('a copy keeps everything but its id, stamps and name, which still fits', () => {
    const copy = encounterCopy(ambush, ['Ambush'])
    expect(copy).toMatchObject({ opposition: [band], tables: ['Morale'], notes: ambush.notes })
    expect(copy).not.toHaveProperty('id')
    expect(copy.name).toBe('Ambush 2')
    const long = encounterCopy({ ...ambush, name: 'X'.repeat(ENCOUNTER_MAX_NAME) })
    expect(long.name.length).toBeLessThanOrEqual(ENCOUNTER_MAX_NAME)
  })
})

describe('its opposition', () => {
  test('keeps a picked NPC without its live state', () => {
    const opponent = opponentFrom(
      {
        ...band,
        schemaVersion: 1,
        refPattern: 'Ambush Pattern',
        currentHp: 2,
        conditions: ['Prone'],
        createdAt: NOW,
        updatedAt: NOW,
      },
      'o9'
    )
    expect(opponent).toEqual({ ...band, id: 'o9', refPattern: 'Ambush Pattern' })
  })

  test('reads as a tray row at full HP', () => {
    expect(opponentAsTray(band)).toMatchObject({ name: 'Raider Band', currentHp: 6, maxHp: 6 })
  })

  test('has room up to its limit', () => {
    expect(hasRoomFor({ opposition: [] })).toBe(true)
    expect(hasRoomFor({ opposition: Array(ENCOUNTER_MAX_OPPOSITION).fill(band) })).toBe(false)
  })
})

describe('its tables', () => {
  test('pin once, last, and only while there is room', () => {
    expect(pinTable(['Morale'], 'Reaction Roll')).toEqual(['Morale', 'Reaction Roll'])
    expect(pinTable(['Morale'], 'Morale')).toEqual(['Morale'])
    const full = Array.from({ length: ENCOUNTER_MAX_TABLES }, (_, i) => `T${i}`)
    expect(pinTable(full, 'Morale')).toEqual(full)
  })

  test('unpin the one named', () => {
    expect(unpinTable(['Morale', 'Area Salvage'], 'Morale')).toEqual(['Area Salvage'])
  })
})

describe('running one from Play', () => {
  test('its line counts what it brings', () => {
    expect(encounterLine(ambush)).toBe('1 opposition · 1 table')
    expect(encounterLine({ opposition: [], tables: ['A', 'B'] })).toBe('0 opposition · 2 tables')
  })

  test('the clear-first choice names what it removes', () => {
    expect(trayChoiceLabel(1)).toBe('Clear it first (removes 1 unit on the field)')
    expect(trayChoiceLabel(3)).toBe('Clear it first (removes 3 units on the field)')
  })
})

describe('what a row is, beside its name (MD-18)', () => {
  const row = (extra: Partial<EncounterOpponent>): EncounterOpponent => ({ ...band, ...extra })

  test('a plain NPC under its own name has nothing to add', () => {
    expect(
      opponentNote(row({ refSchema: 'npcs', refSlug: 'raider', name: 'Raider' }))
    ).toBeUndefined()
  })

  test('a renamed unit keeps its kind and what it was drawn from', () => {
    expect(
      opponentNote(
        row({
          refSchema: 'bio-titans',
          refSlug: 'scylla',
          name: 'The Relay Lurker',
          statKind: 'sp',
        })
      )
    ).toBe('Bio-Titan · Scylla')
    expect(opponentNote(row({ refSchema: 'npcs', refSlug: 'raider', name: 'Vex' }))).toBe(
      'NPC · Raider'
    )
  })

  // MD-18, MD2-15: a design keeps the kind it was built from.
  test('a design built from a Bio-Titan says so; one built from an NPC has nothing to add', () => {
    const built = { npcId: 'n1', name: 'The Relay Lurker', actions: [], traits: [] }
    expect(
      opponentNote(
        row({
          refSchema: 'npcs',
          refSlug: '',
          name: 'The Relay Lurker',
          statKind: 'sp',
          built: { ...built, kind: 'bio-titans' },
        })
      )
    ).toBe('Bio-Titan')
    expect(
      opponentNote(row({ refSchema: 'npcs', refSlug: '', name: 'The Relay Lurker', built }))
    ).toBeUndefined()
  })

  test('a mech named after its pattern says its chassis', () => {
    expect(
      opponentNote(
        row({ refSchema: 'chassis', refSlug: 'mule', refPattern: 'hauler', name: 'Hauler' })
      )
    ).toBe('Mech · Mule')
  })

  test('a unit under its own name still says its kind', () => {
    expect(opponentNote(band)).toBe('Squad')
  })
})

describe('Make a copy of a row (MD-27)', () => {
  test('the copy follows its source, named apart, in the same group', () => {
    const grouped = { ...band, groupId: 'g' }
    const next = duplicateOpponent({ opposition: [grouped, { ...band, id: 'o2' }] }, 'o1', 'new')
    expect(next.map((o) => [o.id, o.name, o.groupId])).toEqual([
      ['o1', 'Raider Band', 'g'],
      ['new', 'Raider Band 2', 'g'],
      ['o2', 'Raider Band', undefined],
    ])
  })

  test('a full encounter, or a row that is gone, changes nothing', () => {
    const full = Array.from({ length: ENCOUNTER_MAX_OPPOSITION }, (_, i) => ({
      ...band,
      id: `o${i}`,
    }))
    expect(duplicateOpponent({ opposition: full }, 'o1', 'new')).toHaveLength(
      ENCOUNTER_MAX_OPPOSITION
    )
    expect(duplicateOpponent({ opposition: [band] }, 'nope', 'new')).toEqual([band])
  })
})

describe('a Reference denizen added from its page', () => {
  test('joins the opposition at full strength, named apart; a full encounter takes none', async () => {
    const { SalvageUnionReference } = await import('salvageunion-reference')
    const squad = SalvageUnionReference.Squads.all()[0]
    if (!squad) throw new Error('no squad')
    const next = oppositionWith(ambush, 'squads', squad, 'o2', NOW)
    expect(next).toHaveLength(2)
    expect(next?.[1]).toMatchObject({ id: 'o2', refSchema: 'squads', name: squad.name })
    const full = { opposition: Array.from({ length: ENCOUNTER_MAX_OPPOSITION }, () => band) }
    expect(oppositionWith(full, 'squads', squad, 'o3', NOW)).toBeNull()
  })
})

// MD2-03: a redesign reaches every encounter that fields the design.
describe('redesignedOpposition', () => {
  const built = { npcId: 'n1', name: 'Captain Vex', actions: ['rifle'], traits: [] }
  const vex: EncounterOpponent = {
    id: 'o-vex',
    refSchema: 'npcs',
    refSlug: '',
    name: 'Captain Vex',
    maxHp: 6,
    statKind: 'hp',
    built,
  }
  const design = {
    built: { ...built, name: 'Warlord Vex', actions: ['rifle', 'pistol'] },
    maxHp: 12,
    statKind: 'hp' as const,
  }

  test('each opponent drawn from it takes the new stat block, and the new name it went by', () => {
    const second = { ...vex, id: 'o-vex-2', name: 'Captain Vex 2', groupId: 'g1' }
    const next = redesignedOpposition([band, vex, second], 'n1', design)
    expect(next?.[0]).toBe(band)
    expect(next?.[1]).toEqual({ ...vex, ...design, name: 'Warlord Vex' })
    // One the Mediator named apart keeps its name and its group.
    expect(next?.[2]).toEqual({ ...second, ...design })
  })

  test('an encounter that fields none of it, or already has it, is left alone', () => {
    expect(redesignedOpposition([band], 'n1', design)).toBeNull()
    expect(
      redesignedOpposition([{ ...vex, ...design, name: 'Warlord Vex' }], 'n1', design)
    ).toBeNull()
  })
})

// MD2-20: Remove's Undo.
describe('restoredOpponent', () => {
  const o = (id: string, groupId?: string) =>
    ({ id, name: id, ...(groupId ? { groupId } : {}) }) as unknown as EncounterOpponent

  test('puts it back where it stood, once, and alone when its group has gone', () => {
    const rest = [o('a'), o('c')]
    expect(restoredOpponent({ opposition: rest }, o('b'), 1).map((x) => x.id)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(restoredOpponent({ opposition: [o('a'), o('b')] }, o('b'), 0)).toHaveLength(2)
    const kept = restoredOpponent(
      { opposition: rest, groups: [{ id: 'g', name: 'G', wave: 1 }] },
      o('b', 'g'),
      9
    )
    expect(kept[2]).toMatchObject({ id: 'b', groupId: 'g' })
    expect(restoredOpponent({ opposition: rest }, o('b', 'gone'), 0)[0]).not.toHaveProperty(
      'groupId'
    )
  })
})

// MD3-08: a deleted NPC stayed in every encounter that fielded it.
describe('deleting a design', () => {
  const built = { npcId: 'n1', name: 'Warlord Vex', actions: [], traits: [] }
  const vex: EncounterOpponent = {
    id: 'o-vex',
    refSchema: 'npcs',
    refSlug: '',
    name: 'Warlord Vex',
    maxHp: 6,
    statKind: 'hp',
    built,
  }
  const relay = { ...ambush, id: 'enc-2', name: 'The Relay', opposition: [band, vex] }
  const gap = {
    ...ambush,
    id: 'enc-3',
    name: 'The Gap',
    opposition: [vex, { ...vex, id: 'o-vex-2', name: 'Red Leader' }],
  }

  test('the encounters that field it are named, each once, in their order', () => {
    expect(encountersFielding([ambush, relay, gap], 'n1').map((e) => e.name)).toEqual([
      'The Relay',
      'The Gap',
    ])
    expect(encountersFielding([ambush, relay], 'n2')).toEqual([])
  })

  test('it leaves an encounter, under whatever name it went by; the rest stay', () => {
    expect(withoutDesign(relay.opposition, 'n1')).toEqual([band])
    expect(withoutDesign(gap.opposition, 'n1')).toEqual([])
    // An encounter that fields none of it is not written.
    expect(withoutDesign(ambush.opposition, 'n1')).toBeNull()
  })
})
