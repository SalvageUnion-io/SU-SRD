/**
 * Equivalence proof for `BaseModel.getByName` / `getBySlug`.
 *
 * These two indexes replaced ~20 linear `.find((e) => e.name === …)` scans, so
 * the bar is not "the indexes work" but "the indexes return the SAME row the
 * scan returned" — for every key in the real dataset, for absent keys, and for
 * the duplicate-name case where `Array.prototype.find` picks the first row.
 *
 * The disjointness test at the bottom is load-bearing for the callers that
 * collapsed `find((e) => e.id === ref || e.name === ref)` into
 * `getById(ref) ?? getByName(ref)`: the OR-scan answers with whichever row
 * comes FIRST in data order regardless of which field matched, while the
 * indexes consult ids before names. Those two orders can only disagree if some
 * id is also some other row's name or slug — which the dataset never does.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference, SchemaToModelMap } from './index.js'
import { BaseModel, type ModelWithMetadata } from './BaseModel.js'
import { nameToSlug } from './nameToSlug.js'

type Row = { id?: string; name?: string }

const allModels = (): Array<[string, ModelWithMetadata<Row>]> =>
  Object.entries(SchemaToModelMap).map(([schemaId, propName]) => [
    schemaId,
    (SalvageUnionReference as unknown as Record<string, ModelWithMetadata<Row>>)[
      propName
    ] as ModelWithMetadata<Row>,
  ])

describe('BaseModel name/slug indexes', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('getByName answers exactly what a linear name scan answers, for every name in every schema', () => {
    let checked = 0
    for (const [schemaId, model] of allModels()) {
      const rows = model.all()
      for (const row of rows) {
        if (typeof row.name !== 'string') continue
        const viaScan = rows.find((r) => r.name === row.name)
        const viaIndex = model.getByName(row.name)
        expect(viaIndex, `${schemaId} / ${row.name}`).toBe(viaScan)
        checked++
      }
    }
    // Guard against the whole loop silently doing nothing.
    expect(checked).toBeGreaterThan(500)
  })

  test('getBySlug answers exactly what a linear slug scan answers, for every name in every schema', () => {
    let checked = 0
    for (const [schemaId, model] of allModels()) {
      const rows = model.all()
      for (const row of rows) {
        if (typeof row.name !== 'string' || row.name === '') continue
        const slug = nameToSlug(row.name)
        const viaScan = rows.find((r) => typeof r.name === 'string' && nameToSlug(r.name) === slug)
        const viaIndex = model.getBySlug(slug)
        expect(viaIndex, `${schemaId} / ${slug}`).toBe(viaScan)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(500)
  })

  test('absent keys return undefined, not a stale or nearest match', () => {
    const model = SalvageUnionReference.Chassis
    expect(model.getByName('no such chassis name')).toBeUndefined()
    expect(model.getBySlug('no-such-chassis-slug')).toBeUndefined()
    expect(model.getByName('')).toBeUndefined()
    expect(model.getBySlug('')).toBeUndefined()
  })

  test('duplicate names resolve to the FIRST row, like Array.prototype.find', () => {
    const rows = [
      { id: 'a', name: 'Repeated' },
      { id: 'b', name: 'Repeated' },
      { id: 'c', name: 'Unique' },
    ]
    const model = new BaseModel(rows, 'test', 'Test')
    expect(model.getByName('Repeated')?.id).toBe('a')
    expect(model.getBySlug('repeated')?.id).toBe('a')
    expect(model.getByName('Unique')?.id).toBe('c')
    expect(model.getByName('Repeated')).toBe(rows.find((r) => r.name === 'Repeated') as never)
  })

  test('rows with no name, a non-string name, or an empty name are not addressable', () => {
    const model = new BaseModel(
      [
        { id: 'a' },
        { id: 'b', name: 42 as unknown as string },
        { id: 'c', name: '' },
        { id: 'd', name: 'Real' },
      ],
      'test',
      'Test'
    )
    expect(model.getByName('42')).toBeUndefined()
    // An empty name is indexed by exact name (matching `find(r => r.name === '')`)
    // but never claims the empty SLUG key, matching the old `!item.name` skip.
    expect(model.getByName('')?.id).toBe('c')
    expect(model.getBySlug('')).toBeUndefined()
    expect(model.getByName('Real')?.id).toBe('d')
  })

  /**
   * The callers that collapsed `find((e) => e.id === ref || e.name === ref)`
   * (and `resolveRefs`' single id+name+slug map) into
   * `getById(ref) ?? getByName(ref) ?? getBySlug(ref)` changed WHICH row wins a
   * key that more than one row can answer for: the scan/combined map answered
   * with whichever row came first in data order regardless of which field
   * matched, the indexes consult ids first.
   *
   * This asserts the two agree for every key of every schema, which is the
   * property those call sites actually rely on. (A blanket "ids are UUIDs, so
   * the key spaces are disjoint" claim is FALSE here — `catalog-categories`
   * ids are words like `pilot` and `guides` — hence checking the resolution
   * outcome rather than the premise.)
   */
  test('id-then-name-then-slug resolves identically to one combined first-writer-wins map', () => {
    let checkedKeys = 0
    for (const [schemaId, model] of allModels()) {
      // The pre-index implementation: one map, id then name then slug per row,
      // in data order, first writer wins.
      const combined = new Map<string, Row>()
      const claim = (key: string, row: Row) => {
        if (!combined.has(key)) combined.set(key, row)
      }
      for (const row of model.all()) {
        if (typeof row.id === 'string') claim(row.id, row)
        if (typeof row.name === 'string' && row.name !== '') {
          claim(row.name, row)
          claim(nameToSlug(row.name), row)
        }
      }

      for (const key of combined.keys()) {
        const viaIndexes = model.getById(key) ?? model.getByName(key) ?? model.getBySlug(key)
        expect(viaIndexes, `${schemaId} / ${key}`).toBe(combined.get(key) as never)
        checkedKeys++
      }
    }
    expect(checkedKeys).toBeGreaterThan(1500)
  })
})
