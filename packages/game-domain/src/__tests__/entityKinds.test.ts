import { describe, expect, test } from 'bun:test'
import { BOT_OP_NAMES, BOT_PATH_PREFIX } from '../botWire'
import {
  ENTITY_KINDS,
  gamePath,
  isEntityKind,
  kindOf,
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
})

describe('app addresses', () => {
  test('the live sheet, the public page and the Game', () => {
    expect(sheetPath('mech', 'm1')).toBe('/sheet/mech/m1')
    expect(publicPath('npc', 'n1')).toBe('/p/npc/n1')
    expect(publicPath('pattern', 'pat-1')).toBe('/p/pattern/pat-1')
    expect(gamePath('g1')).toBe('/play/games/g1')
  })

  test('an id is one path segment', () => {
    expect(sheetPath('pilot', 'a/b c')).toBe('/sheet/pilot/a%2Fb%20c')
  })
})

describe('the bot door', () => {
  test('each op is a path under the prefix', () => {
    expect(BOT_OP_NAMES.map((op) => `${BOT_PATH_PREFIX}${op}`)).toContain('/bot/sheet')
  })
})
