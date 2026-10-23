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
  encounterCopy,
  encounterHref,
  hasRoomFor,
  opponentAsTray,
  opponentFrom,
  pinTable,
  unpinTable,
} from '../encounter.model'

const NOW = '2026-10-22T00:00:00.000Z'

const band: EncounterOpponent = {
  id: 'o1',
  refSchema: 'squads',
  refSlug: 'raider-band',
  refName: 'Raider Band',
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
    const copy = encounterCopy(ambush)
    expect(copy).toMatchObject({ opposition: [band], tables: ['Morale'], notes: ambush.notes })
    expect(copy).not.toHaveProperty('id')
    expect(copy.name).not.toBe('Ambush')
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
    expect(trayChoiceLabel(1)).toBe('Clear it first (removes 1 NPC on the tray)')
    expect(trayChoiceLabel(3)).toBe('Clear it first (removes 3 NPCs on the tray)')
  })
})
