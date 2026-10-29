import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { registry } from '../../lib/schemas/registry'
import { ensureGenerated, inputFiles, inputsHash } from '../ensureGenerated'

const PACKAGE_DIR = join(import.meta.dir, '../..')

/** Every file a generator reaches through relative imports, except what it generates. */
function generatorImports(): string[] {
  const seen = new Set<string>()
  const queue = ['generateRegistry.ts', 'generateJsonSchemas.ts', 'generateDocs.ts'].map((f) =>
    join(PACKAGE_DIR, 'tools', f)
  )
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    // Generated templates spell their own imports inside strings; only a
    // statement at the start of a line is the generator's.
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(
      /^import [^'\n]*'(\.{1,2}\/[^']+)'/gm
    )) {
      const target = resolve(dirname(file), spec as string)
      if (target.includes('/lib/generated/')) continue
      queue.push(existsSync(`${target}.ts`) ? `${target}.ts` : join(target, 'index.ts'))
    }
  }
  return [...seen]
}

describe('ensureGenerated', () => {
  test("the stamp's inputs cover every file the generators import", () => {
    const inputs = new Set(inputFiles())
    const missing = generatorImports().filter((file) => !inputs.has(file))
    expect(missing.map((file) => file.slice(PACKAGE_DIR.length + 1))).toEqual([])
  })

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
    const onDisk = (dir: string) =>
      readdirSync(join(PACKAGE_DIR, dir))
        .filter((f) => !f.startsWith('.'))
        .map((f) => `${dir}/${f}`)
    expect(outputs).toEqual([...onDisk('lib/generated'), ...onDisk('schemas')].sort())
    expect(outputs).toContain('schemas/index.json')
    // Four registry modules, plus one list projection per entry that asks.
    expect(outputs.filter((o) => o.startsWith('lib/generated/'))).toHaveLength(
      4 + registry.filter((e) => e.listProjection).length
    )
  })

  test("the catalog marks exactly the registry's `meta` entries", () => {
    const catalog = JSON.parse(readFileSync(join(PACKAGE_DIR, 'schemas/index.json'), 'utf8')) as {
      schemas: { id: string; meta?: boolean }[]
    }
    expect(catalog.schemas.filter((s) => s.meta).map((s) => s.id)).toEqual(
      registry
        .filter((e) => e.meta)
        .map((e) => e.id)
        .sort()
    )
  })

  test('writes one JSON Schema per registry entry, and no orphans', () => {
    const schemas = readdirSync(join(PACKAGE_DIR, 'schemas'))
      .filter((f) => f.endsWith('.schema.json'))
      .sort()
    expect(schemas).toEqual(registry.map((e) => `${e.id}.schema.json`).sort())
  })
})
