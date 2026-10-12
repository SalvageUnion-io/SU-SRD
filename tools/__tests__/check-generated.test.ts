import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { GeneratorSpec } from '../check-generated'
import {
  GENERATED_PATHS,
  GENERATORS,
  inputHash,
  parsePorcelain,
  runGenerators,
} from '../check-generated'

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
    'apps/su-assets/src/worker/index.ts',
    'apps/su-assets/worker-configuration.d.ts',
    'apps/discord-bot/wrangler.jsonc',
    'apps/discord-bot/worker-configuration.d.ts',
    'apps/itun/wrangler.jsonc',
    'apps/itun/src/worker/index.ts',
    'apps/itun/worker-configuration.d.ts',
    'apps/srd/wrangler.jsonc',
    'apps/srd/worker-configuration.d.ts',
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
  const srd = gen('apps/srd worker types')
  const itun = gen('apps/itun worker types')

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
    ['apps/su-assets/src/worker/index.ts', [assets.label]],
    ['apps/su-assets/worker-configuration.d.ts', [assets.label]],
    ['apps/discord-bot/wrangler.jsonc', [bot.label]],
    ['apps/discord-bot/worker-configuration.d.ts', [bot.label]],
    ['apps/itun/wrangler.jsonc', [itun.label]],
    ['apps/itun/.env.local', [itun.label]],
    ['apps/itun/src/worker/index.ts', [itun.label]],
    ['apps/itun/worker-configuration.d.ts', [itun.label]],
    ['apps/srd/wrangler.jsonc', [srd.label]],
    ['apps/srd/worker-configuration.d.ts', [srd.label]],
    ['apps/itun/src/main.tsx', []],
    ['node_modules/wrangler/package.json', [srd.label, itun.label, assets.label, bot.label]],
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

describe('runGenerators', () => {
  const root = mkdtempSync(join(tmpdir(), 'run-generators-'))
  const cacheFile = join(root, 'cache/check-generated.json')
  afterAll(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(join(root, 'in.txt'), 'v1')

  // Appends a line per run to runs.log, so a skip is visible as no new line.
  const spec = (label: string, script: string): GeneratorSpec => ({
    label,
    cmd: ['sh', '-c', script],
    cwd: '.',
    outputs: ['out.txt'] as unknown as GeneratorSpec['outputs'],
    inputs: ['in.txt'],
    tools: [],
  })
  const counting = spec('counting', 'cat in.txt > out.txt && echo run >> runs.log')
  const runs = () => readFileSync(join(root, 'runs.log'), 'utf8').split('\n').length - 1
  const go = (gens: GeneratorSpec[], useCache = true) =>
    runGenerators(gens, { root, cacheFile, useCache })

  test('runs, then skips while nothing changed, then re-runs on an input change', async () => {
    expect((await go([counting]))[0]?.skipped).toBe(false)
    expect(runs()).toBe(1)
    expect((await go([counting]))[0]?.skipped).toBe(true)
    expect(runs()).toBe(1)
    writeFileSync(join(root, 'in.txt'), 'v2')
    expect((await go([counting]))[0]?.skipped).toBe(false)
    expect(runs()).toBe(2)
  })

  test('a hand edit to an output re-runs it', async () => {
    writeFileSync(join(root, 'out.txt'), 'hand-edited')
    expect((await go([counting]))[0]?.skipped).toBe(false)
    expect(readFileSync(join(root, 'out.txt'), 'utf8')).toBe('v2')
  })

  test('without the cache (CI, --force) it always runs', async () => {
    const before = runs()
    expect((await go([counting], false))[0]?.skipped).toBe(false)
    expect(runs()).toBe(before + 1)
  })

  test('a failed run reports its exit and output and is never recorded', async () => {
    const failing = spec('failing', 'echo broke >&2; exit 3')
    for (let i = 0; i < 2; i++) {
      const [r] = await go([failing])
      expect(r).toMatchObject({ skipped: false, status: 3, output: 'broke\n' })
    }
    expect(JSON.parse(readFileSync(cacheFile, 'utf8'))).not.toHaveProperty('failing')
  })

  test('an input that moves during the run is not recorded', async () => {
    const racing = spec('racing', 'echo moved >> in.txt')
    await go([racing])
    expect(JSON.parse(readFileSync(cacheFile, 'utf8'))).not.toHaveProperty('racing')
  })

  test('an unreadable cache is a miss, not a crash', async () => {
    writeFileSync(cacheFile, 'not json')
    const before = runs()
    expect((await go([counting]))[0]?.skipped).toBe(false)
    expect(runs()).toBe(before + 1)
  })
})
