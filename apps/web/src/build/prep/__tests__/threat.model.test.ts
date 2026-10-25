import { describe, expect, test } from 'bun:test'
import type { Encounter, EncounterOpponent } from 'game-domain/schemas/encounter'
import { spoilsOf, techSpread, threatRead } from '../threat.model'

const NOW = '2026-10-25T00:00:00.000Z'

const opponent = (
  id: string,
  refSchema: EncounterOpponent['refSchema'],
  refSlug: string,
  maxHp: number,
  extra: Partial<EncounterOpponent> = {}
): EncounterOpponent => ({
  id,
  refSchema,
  refSlug,
  refName: refSlug,
  name: id,
  maxHp,
  statKind: refSchema === 'npcs' ? 'hp' : 'sp',
  ...extra,
})

const encounter = (opposition: EncounterOpponent[], groups: Encounter['groups'] = []) =>
  ({
    id: 'e',
    schemaVersion: 1,
    name: 'E',
    opposition,
    groups,
    tables: [],
    notes: '',
    createdAt: NOW,
    updatedAt: NOW,
  }) as Encounter

describe('threatRead (Core Book p.255)', () => {
  test('counts who meets the Pilots, the Tech Levels and total SP and HP', () => {
    const read = threatRead(
      encounter(
        [
          opponent('mule', 'chassis', 'mule', 10),
          opponent('tank', 'vehicles', 'tank', 12),
          opponent('raider', 'npcs', 'raider', 3, { groupId: 'later' }),
        ],
        [{ id: 'later', name: 'Later', wave: 2 }]
      ),
      { size: 4, techLevel: 1 }
    )
    expect(read).toMatchObject({
      first: 2,
      heldBack: 1,
      techLevels: { low: 1, high: 3 },
      sp: 22,
      hp: 3,
      outnumbered: 'opposition',
      tech: 'higher',
    })
  })

  test('the crew is outnumbered by more in the first wave; level Tech reads as neither', () => {
    const many = ['a', 'b', 'c'].map((id) => opponent(id, 'chassis', 'mule', 10))
    expect(threatRead(encounter(many), { size: 2, techLevel: 1 })).toMatchObject({
      outnumbered: 'crew',
      tech: null,
    })
    expect(threatRead(encounter(many), { size: 3, techLevel: 2 })).toMatchObject({
      outnumbered: null,
      tech: 'lower',
    })
  })

  test('no Tech Level when nothing fielded has one', () => {
    const read = threatRead(encounter([opponent('r', 'npcs', 'raider', 3)]), {
      size: 4,
      techLevel: 1,
    })
    expect(read.techLevels).toBeNull()
    expect(read.tech).toBeNull()
  })

  test('techSpread reads one level or a range', () => {
    expect(techSpread({ low: 2, high: 2 })).toBe('2')
    expect(techSpread({ low: 1, high: 3 })).toBe('1–3')
  })
})

describe('spoilsOf (Core Book p.246, 269)', () => {
  test("a Mech drawn as a pattern lists its Chassis and that pattern's loadout", () => {
    const [spoil] = spoilsOf(
      encounter([opponent('m', 'chassis', 'mule', 10, { refPattern: 'hauler' })])
    )
    expect(spoil?.kind).toBe('mech')
    if (spoil?.kind !== 'mech') return
    expect(spoil.chassis).toEqual({ name: 'Mule', techLevel: 1, salvageValue: 7 })
    expect(spoil.systems).toContain('.50 Cal Machine Gun')
    expect(spoil.modules).toContain('Comms Module')
  })

  test("a Mech drawn as a saved pattern lists that pattern's loadout", () => {
    const [spoil] = spoilsOf(
      encounter([
        opponent('m', 'chassis', 'mule', 10, {
          userPattern: { name: 'Mine', systems: ['floodlights'], modules: [] },
        }),
      ])
    )
    expect(spoil?.kind === 'mech' && spoil.systems).toEqual(['Floodlights'])
  })

  test('a bare Chassis has no loadout; a Vehicle scraps for its Salvage Value', () => {
    const [mech, tank] = spoilsOf(
      encounter([opponent('m', 'chassis', 'mule', 10), opponent('t', 'vehicles', 'tank', 12)])
    )
    expect(mech).toMatchObject({ kind: 'mech', systems: [], modules: [] })
    expect(tank).toMatchObject({ kind: 'scrap', salvageValue: 4, techLevel: 3 })
  })

  test('those the data gives nothing to salvage are left out', () => {
    expect(spoilsOf(encounter([opponent('r', 'npcs', 'raider', 3)]))).toEqual([])
  })
})
