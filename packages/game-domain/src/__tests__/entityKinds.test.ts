import { describe, expect, test } from 'bun:test'
import { BOT_OP_NAMES, BOT_PATH_PREFIX } from '../botWire'
import {
  cockpitPath,
  ENTITY_KINDS,
  gamePath,
  isEntityKind,
  isSheetKind,
  kindOf,
  mediatePath,
  publicPath,
  sheetPath,
  TABLE_OF_KIND,
} from '../entityKinds'

describe('kinds and tables', () => {
  test('every kind maps to its table and back', () => {
    for (const kind of ENTITY_KINDS) {
      expect(kindOf(TABLE_OF_KIND[kind])).toBe(kind)
    }
  })

  test('a kind is one of the four, never an inherited key', () => {
    expect(isEntityKind('npc')).toBe(true)
    expect(isEntityKind('pattern')).toBe(false)
    expect(isEntityKind('toString')).toBe(false)
  })

  test('a sheet kind is one a player fields: never an NPC', () => {
    expect(isSheetKind('crawler')).toBe(true)
    expect(isSheetKind('npc')).toBe(false)
    expect(isSheetKind('toString')).toBe(false)
  })
})

describe('app addresses', () => {
  test('the live sheet, the public page, the Game and its Cockpits', () => {
    expect(sheetPath('mech', 'm1')).toBe('/mechs/m1')
    expect(sheetPath('npc', 'n1')).toBe('/npcs/n1')
    expect(publicPath('npc', 'n1')).toBe('/p/npc/n1')
    expect(publicPath('pattern', 'pat-1')).toBe('/p/pattern/pat-1')
    expect(gamePath('g1')).toBe('/play/games/g1')
    expect(mediatePath('g1')).toBe('/play/games/g1/mediate')
    expect(cockpitPath('p1')).toBe('/play/pilots/p1')
  })

  test('an id is one path segment', () => {
    expect(sheetPath('pilot', 'a/b c')).toBe('/pilots/a%2Fb%20c')
    expect(cockpitPath('a/b')).toBe('/play/pilots/a%2Fb')
  })
})

describe('the bot door', () => {
  test('each op is a path under the prefix', () => {
    expect(BOT_OP_NAMES.map((op) => `${BOT_PATH_PREFIX}${op}`)).toContain('/bot/sheet')
  })
})
