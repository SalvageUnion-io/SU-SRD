import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { GeneratorSpec } from '../check-generated'
import {
  GENERATED_PATHS,
  GENERATORS,
  inputHash,
  main,
  parsePorcelain,
  runGenerators,
} from '../check-generated'
import { captured } from './fixtureTree'

describe('check-generated', () => {
  test('a modified file and an untracked NEW file are both drift', () => {
    // The gap: `git diff` alone never saw a generator emitting a new file.
    const drift = parsePorcelain(
      ' M packages/salvageunion-reference/schemas/a.json\n?? packages/salvageunion-reference/schemas/new.json\n'
    )
    expect(drift).toEqual({
      changed: ['packages/salvageunion-reference/schemas/a.json'],
      untracked: ['packages/salvageunion-reference/schemas/new.json'],
    })
  })

  test('the route tree is covered, not only the reference package', () => {
    expect(GENERATED_PATHS).toContain('apps/cantina/src/routeTree.gen.ts')
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
    'apps/cantina/src/routes/settings.tsx',
    'apps/cantina/routeTree.config.ts',
    'apps/cantina/scripts/generate-route-tree.ts',
    'apps/cantina/src/routeTree.gen.ts',
    'apps/su-assets/wrangler.jsonc',
    'apps/su-assets/src/worker/index.ts',
    'apps/su-assets/worker-configuration.d.ts',
    'apps/discord-bot/wrangler.jsonc',
    'apps/discord-bot/worker-configuration.d.ts',
    'apps/cantina/wrangler.jsonc',
    'apps/cantina/src/worker/index.ts',
    'apps/cantina/worker-configuration.d.ts',
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
  const routes = gen('cantina route tree')
  const assets = gen('apps/su-assets worker types')
  const bot = gen('apps/discord-bot worker types')
  const srd = gen('apps/srd worker types')
  const cantina = gen('apps/cantina worker types')

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
    ['apps/cantina/src/routes/settings.tsx', [routes.label]],
    ['apps/cantina/src/routes/new-route.tsx', [routes.label]],
    ['apps/cantina/routeTree.config.ts', [routes.label]],
    ['apps/cantina/scripts/generate-route-tree.ts', [routes.label]],
    ['apps/cantina/src/routeTree.gen.ts', [routes.label]],
    ['node_modules/@tanstack/router-plugin/package.json', [routes.label]],
    ['apps/su-assets/wrangler.jsonc', [assets.label]],
    ['apps/su-assets/.dev.vars', [assets.label]],
    ['apps/su-assets/src/worker/index.ts', [assets.label]],
    ['apps/su-assets/worker-configuration.d.ts', [assets.label]],
    ['apps/discord-bot/wrangler.jsonc', [bot.label]],
    ['apps/discord-bot/worker-configuration.d.ts', [bot.label]],
    ['apps/cantina/wrangler.jsonc', [cantina.label]],
    ['apps/cantina/.env.local', [cantina.label]],
    ['apps/cantina/src/worker/index.ts', [cantina.label]],
    ['apps/cantina/worker-configuration.d.ts', [cantina.label]],
    ['apps/srd/wrangler.jsonc', [srd.label]],
    ['apps/srd/worker-configuration.d.ts', [srd.label]],
    ['apps/cantina/src/main.tsx', []],
    ['node_modules/wrangler/package.json', [srd.label, cantina.label, assets.label, bot.label]],
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
    write('packages/salvageunion-reference/lib/index.ts', 'regenerated')
    expect(inputHash(ref, root, false)).toBe(before)
  })
})

describe('the cache key on an unreadable input', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-generated-unreadable-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  test('throws rather than hashing it as absent', () => {
    // `blocker` is a file, so `blocker/inner` fails with ENOTDIR, not ENOENT: a
    // path that exists but cannot be read must not pass for "unchanged".
    writeFileSync(join(root, 'blocker'), 'x')
    const spec: GeneratorSpec = {
      label: 'fixture',
      cmd: ['true'],
      cwd: '.',
      outputs: [],
      inputs: ['blocker/inner'],
      tools: [],
    }
    expect(() => inputHash(spec, root)).toThrow(/ENOTDIR/)
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

describe('main', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-generated-main-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))
  // Strip a hook's GIT_DIR and friends, or git would act on the real repo.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')))
  const git = (...args: string[]) =>
    Bun.spawnSync(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: root,
      env,
    })
  git('init', '--quiet')
  writeFileSync(join(root, 'in.txt'), 'v1')
  writeFileSync(join(root, 'out.txt'), 'v1')
  git('add', '-A')
  git('commit', '--quiet', '--no-gpg-sign', '-m', 'init')

  const gen = (label: string, script: string): GeneratorSpec => ({
    label,
    cmd: ['sh', '-c', script],
    cwd: '.',
    outputs: ['out.txt'] as unknown as GeneratorSpec['outputs'],
    inputs: ['in.txt'],
    tools: [],
  })
  const go = async (generators: GeneratorSpec[], argv: string[] = [], ci = false) => {
    const io = captured()
    const code = await main(argv, {
      generators,
      paths: ['out.txt', 'new'],
      root,
      cacheFile: join(root, 'node_modules/.cache/gen.json'),
      ci,
      ...io,
    })
    return { code, ...io }
  }

  test('passes when the generators reproduce what is committed, then skips on the cache', async () => {
    const copy = gen('copy', 'cat in.txt > out.txt')
    expect(await go([copy])).toMatchObject({
      code: 0,
      out: ['✓ generated files: 1 generators re-run, 2 paths match what is committed'],
    })
    expect((await go([copy])).out).toEqual([
      '✓ generated files: 0 generators re-run (1 skipped, inputs unchanged; --force re-runs), 2 paths match what is committed',
    ])
    expect((await go([copy], ['--force'])).out[0]).toContain('1 generators re-run,')
  })

  test('a failing generator fails with its exit and output', async () => {
    const r = await go([gen('broken', 'echo no tool >&2; exit 4')], [], true)
    expect(r.code).toBe(1)
    expect(r.err).toEqual([
      '✗ generated files: the broken generator failed (exit 4)\n',
      'no tool\n',
    ])
  })

  test('a changed and a new output fail as stale, listing each', async () => {
    const r = await go(
      [gen('drift', 'echo v2 > out.txt; mkdir -p new; echo x > new/file.txt')],
      [],
      true
    )
    expect(r.code).toBe(1)
    expect(r.err).toEqual([
      '✗ generated files are stale — the generators produced a different tree:\n',
      '    changed    out.txt',
      '    untracked  new/file.txt   (a new file nothing committed)',
      '\n  They were regenerated in place just now; review the diff and commit it.\n  Never hand-edit these — change the generator or its source instead.',
    ])
  })

  test('a git status that fails is reported, not read as clean', async () => {
    const io = captured()
    const outside = mkdtempSync(join(tmpdir(), 'check-generated-nogit-'))
    try {
      const code = await main([], { generators: [], paths: ['x'], root: outside, ci: true, ...io })
      expect(code).toBe(1)
      expect(io.err[0]).toStartWith('✗ generated files: git status failed\n')
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })
})
