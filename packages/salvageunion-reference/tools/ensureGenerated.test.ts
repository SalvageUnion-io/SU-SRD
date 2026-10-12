import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { registry } from '../lib/schemas/registry.js'
import { ensureGenerated, inputsHash } from './ensureGenerated.js'

const PACKAGE_DIR = join(import.meta.dir, '..')

describe('ensureGenerated', () => {
  // The shared test preload already ran it, so the tree is current here.
  test('is a no-op when the stamp matches the inputs', () => {
    expect(ensureGenerated()).toBe(false)
  })

  test('the stamp records the inputs hash, then every output', () => {
    const [hash, ...outputs] = readFileSync(
      join(PACKAGE_DIR, 'lib/generated/.inputs.sha256'),
      'utf8'
    )
      .trimEnd()
      .split('\n')
    expect(hash).toBe(inputsHash())
    const schemas = readdirSync(join(PACKAGE_DIR, 'schemas')).filter((f) =>
      f.endsWith('.schema.json')
    )
    expect(outputs.filter((o) => o.startsWith('schemas/'))).toEqual(
      schemas.map((f) => `schemas/${f}`).sort()
    )
    expect(outputs.filter((o) => o.startsWith('lib/generated/'))).toHaveLength(4)
  })

  test('writes one JSON Schema per registry entry, and no orphans', () => {
    const schemas = readdirSync(join(PACKAGE_DIR, 'schemas'))
      .filter((f) => f.endsWith('.schema.json'))
      .sort()
    expect(schemas).toEqual(registry.map((e) => `${e.id}.schema.json`).sort())
  })
})
