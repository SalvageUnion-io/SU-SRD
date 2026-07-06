/**
 * Rich /su lookup embed tests.
 *
 * The load-bearing test is the exhaustive pass: EVERY entity in EVERY schema
 * goes through buildLookupEmbed and must yield a Discord-valid embed. We
 * can't see embeds in Discord, so this is what proves the formatter never
 * emits something Discord would reject — across all 27 schemas, not the
 * three we'd pick by hand.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import {
  SalvageUnionReference,
  getDataMaps,
  getSchemaCatalog,
  search,
} from 'salvageunion-reference'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'

import { buildLookupEmbed, type LookupEmbed } from '../lookupEmbed.js'

// Discord's hard limits (mirrors lookupEmbed.ts).
const LIMIT = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  fields: 25,
  footer: 2048,
  total: 6000,
}

function embedCharTotal(e: LookupEmbed): number {
  const fields = e.fields.reduce((n, f) => n + f.name.length + f.value.length, 0)
  return e.title.length + (e.description?.length ?? 0) + e.footer.length + fields
}

function assertValid(e: LookupEmbed, label: string): void {
  expect(e.title.length, `${label}: title`).toBeLessThanOrEqual(LIMIT.title)
  expect(e.description?.length ?? 0, `${label}: description`).toBeLessThanOrEqual(LIMIT.description)
  expect(e.fields.length, `${label}: field count`).toBeLessThanOrEqual(LIMIT.fields)
  expect(e.footer.length, `${label}: footer`).toBeLessThanOrEqual(LIMIT.footer)
  for (const f of e.fields) {
    expect(f.name.length, `${label}: field name "${f.name}"`).toBeLessThanOrEqual(LIMIT.fieldName)
    expect(f.value.length, `${label}: field value for "${f.name}"`).toBeLessThanOrEqual(
      LIMIT.fieldValue
    )
  }
  expect(embedCharTotal(e), `${label}: total chars`).toBeLessThanOrEqual(LIMIT.total)
}

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

describe('buildLookupEmbed — exhaustive validity across the whole dataset', () => {
  test('every entity in every non-meta schema yields a Discord-valid embed', () => {
    const schemas = getSchemaCatalog().schemas.filter((s) => !s.meta)
    const { dataMap } = getDataMaps()
    let checked = 0
    for (const schema of schemas) {
      const entities = (dataMap[schema.id] as SURefEntity[] | undefined) ?? []
      for (const entity of entities) {
        const embed = buildLookupEmbed(
          entity as SURefEntity & { schemaName?: SURefEnumSchemaName },
          schema.id as SURefEnumSchemaName
        )
        assertValid(embed, `${schema.id}/${entity.id}`)
        checked++
      }
    }
    // Guard against the loop silently checking nothing (accessor drift).
    expect(checked).toBeGreaterThan(800)
  })
})

describe('buildLookupEmbed — content depth', () => {
  test('a weapon system renders its action text, stats, and linked traits', () => {
    const gun = SalvageUnionReference.Systems.find((s) => s.name === '.50 Cal Machine Gun')
    expect(gun).toBeDefined()
    const e = buildLookupEmbed(
      { ...gun!, schemaName: 'systems' } as unknown as SURefEntity & {
        schemaName: SURefEnumSchemaName
      },
      'systems'
    )
    expect(e.title).toBe('.50 Cal Machine Gun')
    expect(e.url).toBe('https://salvageunion.io/schema/systems/item/50-cal-machine-gun')
    expect(e.fields[0]).toMatchObject({ name: 'Type' })
    // Action mechanical text is present (not just a summary).
    expect(e.description).toContain('Range:')
    expect(e.description).toContain('Damage:')
    // Traits link out to their glossary pages (nested-entity linking).
    expect(e.description).toContain('/schema/traits/item/')
    // Flavor content from the action is inlined.
    expect(e.description!.toLowerCase()).toContain('ballistic')
  })

  test('a keyword renders its glossary definition', () => {
    const [hit] = search({ query: 'cover', schemas: ['keywords'], limit: 1 })
    expect(hit).toBeDefined()
    const e = buildLookupEmbed(hit!.entity, 'keywords')
    expect(e.description && e.description.length).toBeGreaterThan(0)
    expect(e.fields[0]).toMatchObject({ name: 'Type', value: 'Keyword' })
  })

  test('a chassis renders its stat grid and links patterns without inlining them', () => {
    const goliath = SalvageUnionReference.Chassis.find((c) => c.name === 'Goliath')
    expect(goliath).toBeDefined()
    const e = buildLookupEmbed(
      { ...goliath!, schemaName: 'chassis' } as unknown as SURefEntity & {
        schemaName: SURefEnumSchemaName
      },
      'chassis'
    )
    const fieldNames = e.fields.map((f) => f.name)
    expect(fieldNames).toContain('Structure')
    expect(fieldNames).toContain('System Slots')
    // Goliath has 14+ community patterns — they're summarized, and the whole
    // thing still fits the budget (asserted by the exhaustive test too).
    expect(e.description).toContain('Patterns')
  })

  test('chassis ability text resolves [(CHASSIS)] to the chassis name', () => {
    // Every chassis with a [(CHASSIS)] placeholder in its ability text must
    // render the name, never the literal token (regression: PR #336 review).
    const chassis = (getDataMaps().dataMap['chassis'] as { name: string }[]) ?? []
    for (const c of chassis) {
      const e = buildLookupEmbed(
        { ...c, schemaName: 'chassis' } as unknown as SURefEntity & {
          schemaName: SURefEnumSchemaName
        },
        'chassis'
      )
      expect(e.description ?? '', `${c.name} leaks the placeholder`).not.toContain('[(CHASSIS)]')
    }
  })

  test('[[Trait]] references in body text become links, never literal brackets', () => {
    const overpower = SalvageUnionReference.Abilities.find((a) => a.name === 'Overpower')
    expect(overpower).toBeDefined()
    const e = buildLookupEmbed(
      { ...overpower!, schemaName: 'abilities' } as unknown as SURefEntity & {
        schemaName: SURefEnumSchemaName
      },
      'abilities'
    )
    // [[Vulnerable]] resolves to a masked link, and no raw bracket ref survives.
    expect(e.description).toContain(
      '[Vulnerable](https://salvageunion.io/schema/traits/item/vulnerable)'
    )
    expect(e.description).not.toContain('[[')
  })

  test('a standard roll-table inlines its full rows and keeps a roll hint', () => {
    const table = SalvageUnionReference.RollTables.all().find((t) => t.table.type === 'standard')!
    const e = buildLookupEmbed(
      { ...table, schemaName: 'roll-tables' } as unknown as SURefEntity & {
        schemaName: SURefEnumSchemaName
      },
      'roll-tables'
    )
    // The roll hint survives, and every d20 bucket is inlined as a row (backtick key).
    expect(e.description).toContain('/su roll')
    expect(e.description).toContain('`20`')
    expect(e.description).toContain('`11-19`')
    expect(e.description).toContain('`1`')
  })

  test('a columns roll-table inlines each column bucket as a field', () => {
    const table = SalvageUnionReference.RollTables.all().find((t) => t.table.type === 'columns')!
    const e = buildLookupEmbed(
      { ...table, schemaName: 'roll-tables' } as unknown as SURefEntity & {
        schemaName: SURefEnumSchemaName
      },
      'roll-tables'
    )
    const fieldNames = e.fields.map((f) => f.name)
    expect(fieldNames).toContain('Roll 1-4')
    expect(fieldNames).toContain('Roll 17-20')
    // The entries within a column are listed (1-20), not just linked out.
    const firstColumn = e.fields.find((f) => f.name === 'Roll 1-4')!
    expect(firstColumn.value).toContain('1.')
  })
})
