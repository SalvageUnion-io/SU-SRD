/**
 * Unit tests for the catalog-choice resolver — the Armament Bay's Weapons
 * System pick (any Mech System dealing SP damage, of the crawler's Tech Level
 * or lower) and the shortlist vs schema-only distinction.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from '../index.js'
import type { SURefObjectChoice } from '../types/index.js'
import { isSchemaOnlyCatalogChoice, resolveCatalogChoiceEntities } from './choiceCatalog.js'
import { isWeaponSystem } from './crawlerSystems.js'

const armamentBayChoice: SURefObjectChoice = {
  id: 'armament-bay-weapon',
  name: 'Armament Bay Weapons System',
  source: { kind: 'catalog', schema: ['systems'], filter: { damageType: 'SP' } },
}

const shortlistChoice: SURefObjectChoice = {
  id: 'weapon-type',
  name: 'Weapon Type',
  source: { kind: 'catalog', schema: ['traits'], entities: ['ballistic', 'energy'] },
}

describe('resolveCatalogChoiceEntities — Armament Bay Weapons System', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('resolves exactly the Weapons Systems (SP damage)', () => {
    const resolved = resolveCatalogChoiceEntities(armamentBayChoice)
    const expected = SalvageUnionReference.Systems.all().filter(isWeaponSystem)
    expect(resolved.length).toBe(expected.length)
    expect(resolved.length).toBeGreaterThan(0)
    // every resolved entity is a weapon system
    for (const e of resolved) {
      expect(isWeaponSystem(e as never)).toBe(true)
    }
  })

  test('caps to the crawler Tech Level or lower', () => {
    const capped = resolveCatalogChoiceEntities(armamentBayChoice, { techLevel: 2 })
    expect(capped.length).toBeGreaterThan(0)
    for (const e of capped) {
      const tl = (e as { techLevel?: unknown }).techLevel
      if (typeof tl === 'number') expect(tl).toBeLessThanOrEqual(2)
    }
    // a lower cap yields no more systems than a higher one
    const capped4 = resolveCatalogChoiceEntities(armamentBayChoice, { techLevel: 4 })
    expect(capped.length).toBeLessThanOrEqual(capped4.length)
  })

  test('is a schema-only catalog (renders as an entity listing)', () => {
    expect(isSchemaOnlyCatalogChoice(armamentBayChoice)).toBe(true)
  })

  test('orders the listing by Tech Level then name (non-numeric last)', () => {
    const resolved = resolveCatalogChoiceEntities(armamentBayChoice)
    const rank = (e: unknown): number => {
      const tl = (e as { techLevel?: unknown }).techLevel
      return typeof tl === 'number' ? tl : Number.POSITIVE_INFINITY
    }
    for (let i = 1; i < resolved.length; i++) {
      expect(rank(resolved[i - 1])).toBeLessThanOrEqual(rank(resolved[i]))
    }
  })
})

describe('resolveCatalogChoiceEntities — shortlist catalog', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('resolves only the named shortlist entities', () => {
    const resolved = resolveCatalogChoiceEntities(shortlistChoice)
    const names = resolved.map((e) => e.name).sort()
    expect(names).toEqual(['ballistic', 'energy'])
  })

  test('is NOT a schema-only catalog (renders as an option grid)', () => {
    expect(isSchemaOnlyCatalogChoice(shortlistChoice)).toBe(false)
  })
})

describe('resolveCatalogChoiceEntities — non-catalog', () => {
  test('returns [] for a text choice', () => {
    const textChoice: SURefObjectChoice = {
      id: 't',
      name: 'Name',
      source: { kind: 'text' },
    }
    expect(resolveCatalogChoiceEntities(textChoice)).toEqual([])
    expect(isSchemaOnlyCatalogChoice(textChoice)).toBe(false)
  })
})
