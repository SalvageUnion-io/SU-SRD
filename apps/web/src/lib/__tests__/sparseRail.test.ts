import { describe, expect, test } from 'bun:test'
import type { RefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { relationsFor } from '../pageRelations'
import { isSparse, oneRelatedRules, sparseRailFor, tableRailFor } from '../sparseRail'

const find = (schema: 'traits' | 'keywords', slug: string) =>
  SalvageUnionReference.findAllIn(schema, () => true).find(
    (entity) => entity.name.toLowerCase().replace(/\s+/g, '-') === slug
  ) as RefEntity

describe('sparseRailFor', () => {
  test('Used by is every user, each with its kind, never a capped few', () => {
    const rail = sparseRailFor('traits', find('traits', 'hacking'))
    expect(rail.usedBy.length).toBe(22)
    expect(rail.usedBy.every((row) => row.kind.length > 0)).toBe(true)
    expect(rail.usedBy.map((row) => row.kind)).toContain('Equipment')
  })

  test('a keyword nothing names has no users', () => {
    const scrip = find('keywords', 'corporate-scrip')
    expect(isSparse(scrip)).toBe(true)
    const rail = sparseRailFor('keywords', scrip)
    expect(rail.usedBy).toEqual([])
  })
})

describe('oneRelatedRules', () => {
  test("a keyword's Page has one Related rules list: the rail's, the explaining guides first", () => {
    const heat = find('keywords', 'heat')
    const rail = sparseRailFor('keywords', heat)
    const relations = relationsFor('keywords', heat)
    const explained = relations.find((relation) => relation.key === 'guides')
    expect(explained?.rows.length).toBeGreaterThan(0)
    const one = oneRelatedRules(rail, relations)
    expect(one.relations.some((relation) => relation.key === 'guides')).toBe(false)
    const names = one.rail?.rules.map((rule) => rule.name) ?? []
    expect(names.slice(0, explained?.rows.length)).toEqual(
      explained?.rows.map((row) => row.name) ?? []
    )
    // Every rule once.
    expect(new Set(names).size).toBe(names.length)
    for (const rule of rail.rules) expect(names).toContain(rule.name)
  })

  test('a Page with no rail keeps its own list', () => {
    const relations = relationsFor('keywords', find('keywords', 'heat'))
    expect(oneRelatedRules(null, relations).relations).toBe(relations)
  })
})

describe('tableRailFor: a roll table links back to what uses it (r3 C4)', () => {
  const table = (name: string) =>
    SalvageUnionReference.findAllIn('roll-tables', (t) => t.name === name)[0] as RefEntity

  test('a system’s table lists the system, through the action that names the table', () => {
    const rail = tableRailFor(table('Ejection System'))
    expect(rail.usedBy).toContainEqual(
      expect.objectContaining({ name: 'Ejection System', kind: 'System' })
    )
  })

  test('a rules table lists the keyword and the guide whose words send a reader to it', () => {
    const rail = tableRailFor(table('Reactor Overload'))
    expect(rail.usedBy.map((row) => row.name)).toContain('Heat check')
    expect(rail.rules.length).toBeGreaterThan(0)
    // A table is never its own user, and no record is listed twice.
    const ids = rail.usedBy.map((row) => row.ref.id)
    expect(ids).not.toContain(table('Reactor Overload').id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('a table is named, never matched by a bare word: Shield is not every shield', () => {
    const rail = tableRailFor(table('Shield'))
    expect(rail.usedBy.length).toBeLessThan(6)
  })
})
