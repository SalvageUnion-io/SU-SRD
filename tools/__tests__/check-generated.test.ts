import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { GENERATED_PATHS, GENERATORS, inputHash, parsePorcelain } from '../check-generated'

describe('check-generated', () => {
  test('a modified file and an untracked NEW file are both drift', () => {
    // The CI-10 gap: `git diff` alone never saw a generator emitting a new file.
    const drift = parsePorcelain(
      ' M packages/salvageunion-reference/schemas/a.json\n?? packages/salvageunion-reference/schemas/new.json\n'
    )
    expect(drift).toEqual({
      changed: ['packages/salvageunion-reference/schemas/a.json'],
      untracked: ['packages/salvageunion-reference/schemas/new.json'],
    })
  })

  test('the route tree is covered, not only the reference package', () => {
    expect(GENERATED_PATHS).toContain('apps/itun/src/routeTree.gen.ts')
  })

  test('the generators run in parallel, so each GENERATED_PATHS entry has exactly one writer', () => {
    const outputs = GENERATORS.flatMap((g) => g.outputs)
    expect([...outputs].sort()).toEqual([...GENERATED_PATHS].sort())
  })

  test('no generator reads another one’s output', () => {
    for (const gen of GENERATORS) {
      const others = GENERATORS.filter((g) => g !== gen).flatMap((g) => g.outputs)
      for (const input of gen.inputs) {
        for (const out of others) {
          expect(out === input || out.startsWith(`${input}/`) || input.startsWith(`${out}/`)).toBe(
            false
          )
        }
      }
    }
  })
})

describe('the cache key', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-generated-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  const write = (rel: string, content = 'v1') => {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), content)
  }
  // One file per input class, plus each generator's outputs.
  const FILES = [
    'package.json',
    'bun.lock',
    'biome.jsonc',
    'tools/check-generated.ts',
    'packages/salvageunion-reference/data/abilities.json',
    'packages/salvageunion-reference/tools/generateRegistry.ts',
    'packages/salvageunion-reference/lib/schemas/registry.ts',
    'packages/salvageunion-reference/lib/index.ts',
    'packages/salvageunion-reference/lib/generated/zodSchemaMap.generated.ts',
    'packages/salvageunion-reference/schemas/index.json',
    'apps/itun/src/routes/about.tsx',
    'apps/itun/routeTree.config.ts',
    'apps/itun/scripts/generate-route-tree.ts',
    'apps/itun/src/routeTree.gen.ts',
    'apps/su-assets/wrangler.jsonc',
    'apps/su-assets/src/worker.ts',
    'apps/su-assets/worker-configuration.d.ts',
    'apps/discord-bot/wrangler.jsonc',
    'apps/discord-bot/worker-configuration.d.ts',
    'node_modules/wrangler/package.json',
    'node_modules/zod/package.json',
    'node_modules/@tanstack/router-plugin/package.json',
  ]
  for (const f of FILES) write(f)
  const gen = (label: string) => {
    const g = GENERATORS.find((x) => x.label === label)
    if (!g) throw new Error(`no generator ${label}`)
    return g
  }
  const ref = gen('salvageunion-reference build')
  const routes = gen('itun route tree')
  const assets = gen('apps/su-assets worker types')
  const bot = gen('apps/discord-bot worker types')

  /** Touch `rel` and report which generators' keys moved. */
  const moved = (rel: string, content = `changed ${Math.random()}`) => {
    const before = GENERATORS.map((g) => inputHash(g, root))
    write(rel, content)
    return GENERATORS.filter((g, i) => inputHash(g, root) !== before[i]).map((g) => g.label)
  }
  const ALL = GENERATORS.map((g) => g.label)

  test('is stable while nothing changes', () => {
    for (const g of GENERATORS) expect(inputHash(g, root)).toBe(inputHash(g, root))
  })

  test.each([
    ['packages/salvageunion-reference/data/abilities.json', [ref.label]],
    ['packages/salvageunion-reference/data/new-entity.json', [ref.label]],
    ['packages/salvageunion-reference/tools/generateRegistry.ts', [ref.label]],
    ['packages/salvageunion-reference/lib/schemas/registry.ts', [ref.label]],
    ['packages/salvageunion-reference/schemas/index.json', [ref.label]],
    ['packages/salvageunion-reference/lib/generated/zodSchemaMap.generated.ts', [ref.label]],
    ['node_modules/zod/package.json', [ref.label]],
    ['apps/itun/src/routes/about.tsx', [routes.label]],
    ['apps/itun/src/routes/new-route.tsx', [routes.label]],
    ['apps/itun/routeTree.config.ts', [routes.label]],
    ['apps/itun/scripts/generate-route-tree.ts', [routes.label]],
    ['apps/itun/src/routeTree.gen.ts', [routes.label]],
    ['node_modules/@tanstack/router-plugin/package.json', [routes.label]],
    ['apps/su-assets/wrangler.jsonc', [assets.label]],
    ['apps/su-assets/.dev.vars', [assets.label]],
    ['apps/su-assets/src/worker.ts', [assets.label]],
    ['apps/su-assets/worker-configuration.d.ts', [assets.label]],
    ['apps/discord-bot/wrangler.jsonc', [bot.label]],
    ['apps/discord-bot/worker-configuration.d.ts', [bot.label]],
    ['node_modules/wrangler/package.json', [assets.label, bot.label]],
    ['bun.lock', ALL],
    ['package.json', ALL],
    ['biome.jsonc', ALL],
    ['tools/check-generated.ts', ALL],
  ])('touching %s invalidates exactly %p', (rel, expected) => {
    expect(moved(rel)).toEqual(expected)
  })

  test('a workspace’s own node_modules is not an input', () => {
    expect(moved('apps/su-assets/node_modules/some-dep/index.js')).toEqual([])
  })

  test('without outputs, a rewritten output does not move the key', () => {
    const before = inputHash(ref, root, false)
    write('packages/salvageunion-reference/schemas/index.json', 'regenerated')
    expect(inputHash(ref, root, false)).toBe(before)
  })
})
