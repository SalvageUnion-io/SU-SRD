import { describe, expect, test } from 'bun:test'
import { getEntitySchemas, getModel, SalvageUnionReference } from 'salvageunion-reference'
import {
  bandFillFor,
  buildChapters,
  CONTENTS,
  chapterForSchema,
  listingBandFillFor,
} from '../chapters'
import { listingEntries } from '../listingEntries'

/**
 * The SRD's chapters (board 06): the index the home page prints, the nav
 * drawer freezes and every listing and entity page's band and trail read.
 */
describe('buildChapters', () => {
  const chapters = buildChapters()

  test('the book’s five chapters, in its order, each in its colour', () => {
    expect(chapters.map((c) => [c.title, c.tone])).toEqual([
      ['Pilot Bay', 'pilot'],
      ['Mech Workshop', 'mech'],
      ['Union Crawler', 'crawler'],
      ['Denizens of the Wasteland', 'adversary'],
      ['Rules & Reference', 'rules'],
    ])
  })

  test('every catalogued schema is in exactly one chapter, so nothing drops off the index', () => {
    const catalogued = SalvageUnionReference.CatalogCategories.all().flatMap((c) => c.schemas)
    const indexed = chapters.flatMap((c) => c.rows.map((row) => row.schemaId))
    expect([...indexed].sort()).toEqual([...new Set(catalogued)].sort())
    expect(new Set(indexed).size).toBe(indexed.length)
  })

  test('counts are what each listing lists, and a chapter’s total is its rows’ sum', () => {
    const counts = new Map(
      getEntitySchemas().map((s) => [
        s.id,
        listingEntries(s.id, getModel(s.id)?.all() ?? []).length,
      ])
    )
    // The roll tables count only their top-level tables; every other listing
    // counts every entry of its schema.
    expect(counts.get('roll-tables')).toBeLessThan(SalvageUnionReference.RollTables.all().length)
    for (const schema of getEntitySchemas())
      if (schema.id !== 'roll-tables') expect(counts.get(schema.id)).toBe(schema.itemCount)
    for (const chapter of chapters) {
      for (const row of chapter.rows) expect(row.count).toBe(counts.get(row.schemaId) ?? -1)
      expect(chapter.total).toBe(chapter.rows.reduce((sum, row) => sum + row.count, 0))
    }
  })

  test('Rules & Reference leads with what a table reaches for: guides, then roll tables', () => {
    const rules = chapters.find((c) => c.id === 'rules-reference')
    expect(rules?.rows.slice(0, 2).map((row) => row.schemaId)).toEqual(['guides', 'roll-tables'])
  })

  test('rows link to their listing; chapters to their anchor on Contents', () => {
    const mech = chapters.find((c) => c.id === 'mech-workshop')
    expect(mech?.href).toBe('/#mech-workshop')
    expect(mech?.rows[0]?.href).toBe('/chassis/')
  })
})

describe('chapterForSchema', () => {
  test('a schema wears its chapter’s band', () => {
    expect(chapterForSchema('chassis').tone).toBe('mech')
    expect(chapterForSchema('abilities').title).toBe('Pilot Bay')
    expect(chapterForSchema('npcs').tone).toBe('adversary')
    expect(chapterForSchema('roll-tables').title).toBe('Rules & Reference')
    expect(chapterForSchema('guides').tone).toBe('rules')
  })

  test('a schema no chapter gathers falls back to Contents', () => {
    expect(chapterForSchema('actions')).toEqual(CONTENTS)
  })
})

describe('listingBandFillFor', () => {
  test('the systems and modules indexes wear TL1 blue; every other listing its chapter', () => {
    expect(listingBandFillFor('systems')).toEqual({ band: 'var(--color-tl-1)' })
    expect(listingBandFillFor('modules')).toEqual({ band: 'var(--color-tl-1)' })
    expect(listingBandFillFor('drones')).toEqual({ band: 'var(--color-tl-1)' })
    expect(listingBandFillFor('chassis')).toBeUndefined()
    expect(listingBandFillFor('equipment')).toBeUndefined()
  })
})

describe('bandFillFor', () => {
  const systemAt = (techLevel: number | 'B' | 'N') => {
    const system = SalvageUnionReference.Systems.all().find((s) => s.techLevel === techLevel)
    if (!system) throw new Error(`no system at tech level ${techLevel}`)
    return system
  }

  test('a system or module show page wears its tech level’s blue, head and foot (§3.8)', () => {
    expect(bandFillFor('systems', systemAt(1))).toEqual({ band: 'var(--color-tl-1)' })
    expect(bandFillFor('systems', systemAt(6))?.band).toBe('var(--color-tl-6)')
    expect(bandFillFor('systems', systemAt('B'))?.band).toBe('var(--color-tl-b)')
    const module = SalvageUnionReference.Modules.all().find((m) => m.techLevel === 2)
    if (!module) throw new Error('no module at tech level 2')
    expect(bandFillFor('modules', module)?.band).toBe('var(--color-tl-2)')
  })

  test('equipment, drones and vehicles wear their tech level’s band, as their cards do', () => {
    const equipment = SalvageUnionReference.Equipment.all().find((e) => e.techLevel === 1)
    const drone = SalvageUnionReference.Drones.all().find((e) => e.techLevel === 5)
    const vehicle = SalvageUnionReference.Vehicles.all()[0]
    if (!equipment || !drone || !vehicle) throw new Error('fixtures missing')
    expect(bandFillFor('equipment', equipment)).toEqual({ band: 'var(--color-tl-1)' })
    expect(bandFillFor('drones', drone)).toEqual({ band: 'var(--color-tl-5)' })
    expect(bandFillFor('vehicles', vehicle)?.band).toMatch(/^var\(--color-tl-/)
  })

  test('a Hybrid Class wears its brown; a Core class and a chassis their chapter’s', () => {
    const classes = SalvageUnionReference.Classes.all()
    const hybrid = classes.find((c) => 'hybrid' in c && c.hybrid === true)
    const core = classes.find((c) => !('hybrid' in c && c.hybrid === true))
    const chassis = SalvageUnionReference.Chassis.all()[0]
    if (!hybrid || !core || !chassis) throw new Error('fixtures missing')
    expect(bandFillFor('classes', hybrid)).toEqual({ band: 'var(--color-class-hybrid)' })
    expect(bandFillFor('classes', core)).toBeUndefined()
    expect(bandFillFor('chassis', chassis)).toBeUndefined()
    expect(bandFillFor('not-a-schema', chassis)).toBeUndefined()
  })

  test('tech level 3 wears its own blue: the foot is the band’s colour, no deeper shade', () => {
    expect(bandFillFor('systems', systemAt(3))).toEqual({ band: 'var(--color-tl-3)' })
  })

  test('an ability’s show page wears its tier’s colour, as its Compact does on the index', () => {
    const inTree = (tree: string) => {
      const ability = SalvageUnionReference.Abilities.all().find((a) => a.tree === tree)
      if (!ability) throw new Error(`no ability in ${tree}`)
      return ability
    }
    expect(bandFillFor('abilities', inTree('Hacking'))).toBeUndefined()
    expect(bandFillFor('abilities', inTree('Advanced Hacking'))?.band).toBe(
      'var(--color-tier-hybrid)'
    )
    expect(bandFillFor('abilities', inTree('Cyborg'))?.band).toBe('var(--color-tier-hybrid)')
    expect(bandFillFor('abilities', inTree('Legendary Hacker'))).toEqual({
      band: 'var(--color-crawler-band)',
    })
  })

  test('every other show page wears its chapter’s band', () => {
    const [chassis] = SalvageUnionReference.Chassis.all()
    if (!chassis) throw new Error('fixtures missing')
    expect(bandFillFor('chassis', chassis)).toBeUndefined()
  })
})
