import { describe, expect, test } from 'bun:test'
import type { RefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { relationsFor } from '../pageRelations'
import { isSparse, oneRelatedRules, sparseRailFor } from '../sparseRail'

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
