/**
 * The committed data is already in its parsed form (audit PK-04).
 *
 * `preload()` is trusted by default: it installs each data file as loaded,
 * WITHOUT running it through `z.array(schema).parse`. That is only equivalent
 * to the validating load it replaced if parsing would change nothing — no
 * `.default()` left to fill, no unknown key for a non-strict object to strip,
 * no transform to apply. This test is the proof, per schema, and the reason
 * the trusted path is safe to be the default. (That the two load paths then
 * install identical rows end to end is asserted in `preload.test.ts`, the one
 * suite allowed to drive `preload()` itself.)
 *
 * When it fails, the data file is missing a value its schema would default
 * (write the default into the file — `catalog-categories.json` spells out
 * `"flat": false` for exactly this reason) or the schema gained a transform
 * (then the transform belongs in the data, or that schema cannot take the
 * trusted path). Do not "fix" it by turning validation back on everywhere.
 */
import { describe, expect, test } from 'bun:test'
import { dataLoaders } from './generated/modelFactoryRegistry.generated.js'
import { zodSchemaMap } from './generated/zodSchemaMap.generated.js'
import { z } from './zod.js'

const schemaIds = Object.keys(dataLoaders)

describe('committed data is parse-stable', () => {
  test.each(schemaIds)('%s: a Zod parse returns the file unchanged', async (id) => {
    const loader = dataLoaders[id]
    const schema = zodSchemaMap[id]
    if (!loader || !schema) throw new Error(`registry is missing ${id}`)
    const raw = await loader()
    const parsed = z.array(schema).parse(raw)
    // toStrictEqual: an `undefined`-valued key a default would add, or a key
    // a strip would drop, both count as a difference. It does NOT compare key
    // order, and the two orders differ (file order vs schema order) — so
    // "unchanged" here means same keys and values, not byte-identical.
    expect(parsed).toStrictEqual(raw)
  })
})
