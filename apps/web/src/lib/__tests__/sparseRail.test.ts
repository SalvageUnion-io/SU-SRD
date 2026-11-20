import { describe, expect, test } from 'bun:test'
import type { RefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { isSparse, sparseRailFor } from '../sparseRail'

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
    expect(rail.list).toBe('Traits')
    expect(rail.previous?.name).toBeTruthy()
  })

  test('a keyword nothing names has no users, and keeps its neighbours', () => {
    const scrip = find('keywords', 'corporate-scrip')
    expect(isSparse(scrip)).toBe(true)
    const rail = sparseRailFor('keywords', scrip)
    expect(rail.usedBy).toEqual([])
    expect(rail.next?.name).toBeTruthy()
  })
})
