import { describe, expect, test } from 'bun:test'
import {
  extractStaticEntitySummary,
  getDisplayName,
  getEntitySchemas,
  getHybridClasses,
  getModel,
  getReferenceEntityData,
  getUniqueSources,
  getUniqueTechLevels,
  getUniqueTrees,
  normalizeSchemaName,
  resolveActivationCurrency,
  resolveGrantedEntities,
} from './helpers.js'
import type { SURefEntity } from './index.js'
import { SalvageUnionReference } from './index.js'

/**
 * The read layer both apps go through: schema lookup, grant resolution, facet
 * extraction, and the static summary the SRD's no-JS and crawler rendering is
 * built from. `helpers.test.ts` next door covers the crawler-mutation helpers.
 *
 * Most of this runs against the real dataset on purpose. These functions are
 * shape-tolerance over data that changes, so a test built entirely from
 * hand-made objects would keep passing while the shipped data broke them.
 */

describe('schema names', () => {
  test('a known schema gets its display name', () => {
    expect(getDisplayName('chassis')).toBe('Chassis')
  })

  test('an unknown schema falls back to the name rather than to blank', () => {
    // Better a raw slug on screen than an empty heading.
    expect(getDisplayName('not-a-schema' as never)).toBe('not-a-schema')
  })

  test('every class alias normalises onto the one unified schema', () => {
    // Six spellings reach this from data, routes and older links; all six are
    // the same schema, and a miss yields no model at all.
    for (const alias of [
      'classes-core',
      'classes.core',
      'classes-advanced',
      'classes.advanced',
      'classes-hybrid',
      'classes.hybrid',
    ]) {
      expect(normalizeSchemaName(alias)).toBe('classes')
    }
  })

  test('a name that is already canonical is left alone', () => {
    expect(normalizeSchemaName('chassis')).toBe('chassis')
  })

  test('getModel resolves through the alias', () => {
    expect(getModel('classes-core')).toBe(getModel('classes'))
    expect(getModel('chassis')?.all().length).toBeGreaterThan(0)
  })

  test('an unknown schema yields undefined rather than throwing', () => {
    expect(getModel('not-a-schema')).toBeUndefined()
  })

  test('the entity schema list excludes meta schemas', () => {
    const schemas = getEntitySchemas()
    expect(schemas.length).toBeGreaterThan(0)
    expect(schemas.every((s) => !s.meta)).toBe(true)
  })
})

describe('grants', () => {
  test('an entity with no grants resolves to nothing', () => {
    const [chassis] = SalvageUnionReference.Chassis.all()
    expect(resolveGrantedEntities(chassis as SURefEntity)).toEqual([])
  })

  test('granted entities resolve to real records, and `choice` grants are skipped', () => {
    // A `choice` grant names no single entity — it is a prompt resolved
    // elsewhere — so walking it here would invent a null.
    const granters = SalvageUnionReference.Abilities.all().filter(
      (a) => 'grants' in a && Array.isArray(a.grants) && a.grants.length > 0
    )
    expect(granters.length).toBeGreaterThan(0)

    for (const granter of granters) {
      const resolved = resolveGrantedEntities(granter as SURefEntity)
      // Never a hole: unresolvable grants are dropped, not returned as null.
      expect(resolved.every((e) => e != null && typeof e.id === 'string')).toBe(true)
      const nonChoice = (granter.grants ?? []).filter((g) => g.schema !== 'choice')
      expect(resolved.length).toBeLessThanOrEqual(nonChoice.length)
    }
  })
})

describe('classes', () => {
  test('hybrid classes are exactly those flagged hybrid', () => {
    const hybrids = getHybridClasses()
    expect(hybrids.length).toBeGreaterThan(0)
    expect(hybrids.every((c) => c.hybrid === true)).toBe(true)
  })
})

describe('activation currency', () => {
  test('mech-level sources cost EP', () => {
    for (const schema of ['chassis', 'systems', 'modules'] as const) {
      expect(resolveActivationCurrency(schema)).toBe('EP')
    }
  })

  test('everything else costs AP', () => {
    expect(resolveActivationCurrency('abilities')).toBe('AP')
    expect(resolveActivationCurrency('actions')).toBe('AP')
    expect(resolveActivationCurrency(undefined)).toBe('AP')
  })

  test('a variable cost is XP, and beats the schema', () => {
    // Variable-cost abilities are paid in XP wherever they sit — including on
    // a mech-level source, which would otherwise read as EP.
    expect(resolveActivationCurrency('abilities', true)).toBe('XP')
    expect(resolveActivationCurrency('chassis', true)).toBe('XP')
  })
})

describe('facets', () => {
  test('tech levels come back unique and in game order: numbers, then B, then N', () => {
    const entities = [
      { id: 'a', techLevel: 3 },
      { id: 'b', techLevel: 1 },
      { id: 'c', techLevel: 'N' },
      { id: 'd', techLevel: 'B' },
      { id: 'e', techLevel: 1 },
      { id: 'f' },
    ] as unknown as SURefEntity[]
    expect(getUniqueTechLevels(entities)).toEqual([1, 3, 'B', 'N'])
  })

  test('no tech levels at all yields an empty list', () => {
    expect(getUniqueTechLevels([{ id: 'a' } as unknown as SURefEntity])).toEqual([])
  })

  test('the Workshop Manual sorts first, the rest alphabetically', () => {
    // The core book is what every other source is read against, so it leads
    // the facet regardless of alphabet.
    const entities = [
      { id: 'a', source: 'Zephyr Expansion' },
      { id: 'b', source: 'Salvage Union Workshop Manual' },
      { id: 'c', source: 'Alpha Expansion' },
    ] as unknown as SURefEntity[]
    expect(getUniqueSources(entities)).toEqual([
      'Salvage Union Workshop Manual',
      'Alpha Expansion',
      'Zephyr Expansion',
    ])
  })

  test('without the core book the rest are simply alphabetical', () => {
    const entities = [
      { id: 'a', source: 'Zephyr' },
      { id: 'b', source: 'Alpha' },
    ] as unknown as SURefEntity[]
    expect(getUniqueSources(entities)).toEqual(['Alpha', 'Zephyr'])
  })

  test('trees are unique, sorted, and entities without one are skipped', () => {
    const entities = [
      { id: 'a', tree: 'Gunner' },
      { id: 'b', tree: 'Ace' },
      { id: 'c', tree: 'Gunner' },
      { id: 'd' },
    ] as unknown as SURefEntity[]
    expect(getUniqueTrees(entities)).toEqual(['Ace', 'Gunner'])
  })

  test('the real ability set produces real, sorted trees', () => {
    const trees = getUniqueTrees(SalvageUnionReference.Abilities.all() as SURefEntity[])
    expect(trees.length).toBeGreaterThan(0)
    expect(trees).toEqual([...trees].sort())
  })
})

describe('display data', () => {
  test('every shipped chassis yields an id, a name and a slug', () => {
    // The three fields every consumer indexes and links on. A blank name here
    // is an unclickable card.
    for (const chassis of SalvageUnionReference.Chassis.all()) {
      const data = getReferenceEntityData(chassis as SURefEntity)
      expect(data.id).toBe(chassis.id)
      expect(data.name.length).toBeGreaterThan(0)
      expect(data.slug.length).toBeGreaterThan(0)
    }
  })

  test('a nameless entity falls back to its id rather than to blank', () => {
    const data = getReferenceEntityData({ id: 'orphan' } as unknown as SURefEntity)
    expect(data.name).toBe('orphan')
    expect(data.description).toBeUndefined()
    expect(data.techLevel).toBeUndefined()
  })
})

describe('the static summary the SRD indexes on', () => {
  test('a chassis contributes its numeric stats, labelled', () => {
    const chassis = SalvageUnionReference.Chassis.all()[0] as SURefEntity
    const summary = extractStaticEntitySummary(chassis)

    expect(summary.name.length).toBeGreaterThan(0)
    const labels = summary.stats.map((s) => s.label)
    expect(labels).toContain('Structure Points')
    expect(labels).toContain('Energy Points')
    expect(labels).toContain('Tech Level')
  })

  test('paragraph blocks are collected and non-paragraph blocks are not', () => {
    const summary = extractStaticEntitySummary({
      id: 'x',
      name: 'X',
      content: [
        { type: 'paragraph', value: 'first' },
        { value: 'untyped counts as prose' },
        { type: 'table', value: 'not prose' },
        { type: 'paragraph', value: 42 },
        null,
      ],
    } as unknown as SURefEntity)

    expect(summary.contentParagraphs).toEqual(['first', 'untyped counts as prose'])
  })

  test('range and damage are flattened into readable values', () => {
    const summary = extractStaticEntitySummary({
      id: 'w',
      name: 'W',
      range: ['Close', 'Medium'],
      damage: { amount: 3, damageType: 'Kinetic' },
    } as unknown as SURefEntity)

    const byLabel = Object.fromEntries(summary.stats.map((s) => [s.label, s.value]))
    expect(byLabel.Range).toBe('Close, Medium')
    expect(byLabel.Damage).toBe('3 Kinetic')
  })

  test('trait names are collected, and malformed traits are skipped', () => {
    const summary = extractStaticEntitySummary({
      id: 't',
      name: 'T',
      traits: [{ type: 'reliable' }, { value: 'no type' }, null, 'bare string'],
    } as unknown as SURefEntity)
    expect(summary.traits).toEqual(['reliable'])
  })

  test("a guide's steps become named sections carrying their prose", () => {
    // Without this a guide indexes as its title and one intro paragraph — the
    // pages holding the game's procedures were the ones with almost no text.
    const guides = SalvageUnionReference.Guides.all()
    const withSteps = guides.filter((g) => Array.isArray(g.steps) && g.steps.length > 0)
    expect(withSteps.length).toBeGreaterThan(0)

    for (const guide of withSteps) {
      const summary = extractStaticEntitySummary(guide as SURefEntity)
      expect(summary.sections.length).toBe(guide.steps?.length ?? 0)
      expect(summary.sections.every((s) => s.name.length > 0)).toBe(true)
    }

    const totalProse = withSteps
      .map((g) => extractStaticEntitySummary(g as SURefEntity))
      .flatMap((s) => s.sections.flatMap((sec) => sec.paragraphs))
      .join('').length
    expect(totalProse).toBeGreaterThan(1000)
  })

  test('a malformed step is skipped rather than producing a nameless section', () => {
    const summary = extractStaticEntitySummary({
      id: 'g',
      name: 'G',
      steps: [
        { name: 'One', content: [{ type: 'paragraph', value: 'do this' }] },
        { content: [{ type: 'paragraph', value: 'nameless' }] },
        null,
        { name: 'Three' },
      ],
    } as unknown as SURefEntity)

    expect(summary.sections).toEqual([
      { name: 'One', paragraphs: ['do this'] },
      { name: 'Three', paragraphs: [] },
    ])
  })

  test('an entity with nothing to say yields empty collections, never undefined', () => {
    // Consumers map over all four without guarding.
    const summary = extractStaticEntitySummary({ id: 'bare' } as unknown as SURefEntity)
    expect(summary.name).toBe('bare')
    expect(summary.contentParagraphs).toEqual([])
    expect(summary.stats).toEqual([])
    expect(summary.traits).toEqual([])
    expect(summary.sections).toEqual([])
  })
})
