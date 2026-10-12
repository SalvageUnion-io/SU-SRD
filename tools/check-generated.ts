#!/usr/bin/env bun
/**
 * Generated-file drift — `bun run check generated`.
 *
 * Several committed files are machine output: the reference package's JSON
 * schemas, catalog and registry (`bun run build:package`), the VS Code
 * schema map, ITUN's `src/routeTree.gen.ts`, and the `worker-configuration.d.ts`
 * that `wrangler types` writes for su-assets and the bot (their `Env` comes from
 * wrangler.jsonc, so a binding added there without the code knowing fails
 * here). Each is regenerated here and then compared with what is committed. A
 * stale one fails.
 *
 * ## Why one tool
 *
 * CI, lefthook and `bun run check` all run this file, so one question gets one
 * answer everywhere: a `git diff` alone would pass a generator that emits a NEW
 * file, so untracked files count too, and the route tree is regenerated without
 * a full Vite build so pre-push can afford it.
 *
 * ## What it does
 *
 *   1. Runs the GENERATORS below at once — they write disjoint paths and none
 *      reads another's output (the test pins the disjointness):
 *      - `bun run build` in packages/salvageunion-reference (every generator);
 *      - `bun apps/itun/scripts/generate-route-tree.ts` — the router plugin's
 *        own generator with the Vite config's options, without a build;
 *      - `wrangler types --strict-vars=false` in su-assets and discord-bot (not
 *        strict: the bot's tests sign with their own public key).
 *   2. Fails on any tracked change OR untracked file under GENERATED_PATHS.
 *
 * It WRITES those files — that is how the diff is produced — so it must run
 * before anything that reads them (`tools/check.ts` runs it first, alone).
 *
 * ## The local cache
 *
 * Off CI, a generator is skipped when a hash of everything that can change its
 * output matches the hash recorded after its last run: its `inputs` (the
 * generator sources, the data, wrangler.jsonc, route files — whole directories
 * where unsure), its own outputs (so a hand edit re-runs it), the lockfile,
 * the installed versions of the tools it shells out to, the Bun version and
 * this file. A wrong hit would pass a stale tree, so when in doubt an input
 * goes in. The record lives in the gitignored `node_modules/.cache/`; step 2
 * always runs. CI (`CI` set) and `--force` run every generator.
 *
 * Usage: bun tools/check-generated.ts [--force]
 */

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

const ROOT = join(import.meta.dir, '..')

/** Every committed path a generator below writes. */
export const GENERATED_PATHS = [
  'packages/salvageunion-reference/schemas',
  'packages/salvageunion-reference/lib/generated',
  'packages/salvageunion-reference/lib/index.ts',
  'apps/itun/src/routeTree.gen.ts',
  'apps/su-assets/worker-configuration.d.ts',
  'apps/discord-bot/worker-configuration.d.ts',
] as const

export type GeneratorSpec = {
  label: string
  cmd: string[]
  cwd: string
  /** The GENERATED_PATHS entries it writes — no two generators share one. */
  outputs: (typeof GENERATED_PATHS)[number][]
  /** Repo-relative files or directories it reads. Missing ones hash as absent. */
  inputs: string[]
  /** Installed packages whose version can change its output. */
  tools: string[]
}

/** Read by every generator: the dependency graph, and Biome's formatting. */
const SHARED_INPUTS = [
  'package.json',
  'bun.lock',
  'bunfig.toml',
  'biome.jsonc',
  'tools/check-generated.ts',
]

const workerTypes = (app: 'apps/su-assets' | 'apps/discord-bot'): GeneratorSpec => ({
  label: `${app} worker types`,
  cmd: ['bunx', 'wrangler', 'types', '--strict-vars=false'],
  cwd: app,
  outputs: [`${app}/worker-configuration.d.ts`],
  // The whole app: wrangler.jsonc, the `.dev.vars`/`.env*` it reads secret
  // names from, and the main module it names.
  inputs: [app],
  tools: ['wrangler'],
})

export const GENERATORS: GeneratorSpec[] = [
  {
    label: 'salvageunion-reference build',
    cmd: ['bun', 'run', 'build'],
    cwd: 'packages/salvageunion-reference',
    outputs: [
      'packages/salvageunion-reference/schemas',
      'packages/salvageunion-reference/lib/generated',
      'packages/salvageunion-reference/lib/index.ts',
    ],
    // The whole package: data, lib (the registry and zod schemas), tools.
    inputs: ['packages/salvageunion-reference'],
    tools: ['zod', '@biomejs/biome'],
  },
  {
    label: 'itun route tree',
    cmd: ['bun', 'scripts/generate-route-tree.ts'],
    cwd: 'apps/itun',
    outputs: ['apps/itun/src/routeTree.gen.ts'],
    inputs: [
      'apps/itun/src/routes',
      'apps/itun/routeTree.config.ts',
      'apps/itun/scripts/generate-route-tree.ts',
      'apps/itun/package.json',
      'apps/itun/tsr.config.json',
    ],
    tools: ['@tanstack/router-plugin'],
  },
  workerTypes('apps/su-assets'),
  workerTypes('apps/discord-bot'),
]

export type Drift = { changed: string[]; untracked: string[] }

/** Parse `git status --porcelain` output into changed and untracked paths. */
export function parsePorcelain(output: string): Drift {
  const changed: string[] = []
  const untracked: string[] = []
  for (const line of output.split('\n')) {
    if (line.length < 4) continue
    const path = line.slice(3)
    if (line.startsWith('??')) untracked.push(path)
    else changed.push(path)
  }
  return { changed, untracked }
}

/** Feed a file or directory (recursively, sorted, minus node_modules) into `hash`. */
function hashPath(
  hash: ReturnType<typeof createHash>,
  root: string,
  rel: string,
  skip: ReadonlySet<string>
): void {
  if (skip.has(rel)) return
  const abs = join(root, rel)
  if (!existsSync(abs)) {
    hash.update(`absent ${rel}\0`)
    return
  }
  if (!statSync(abs).isDirectory()) {
    hash.update(`file ${rel}\0`)
    hash.update(readFileSync(abs))
    hash.update('\0')
    return
  }
  for (const name of readdirSync(abs).sort()) {
    if (name === 'node_modules') continue
    hashPath(hash, root, join(rel, name), skip)
  }
}

/** The installed copy of `pkg` as seen from `cwd`: its resolved path and manifest. */
function installedTool(root: string, cwd: string, pkg: string): string {
  for (let dir = join(root, cwd); ; dir = dirname(dir)) {
    const manifest = join(dir, 'node_modules', pkg, 'package.json')
    if (existsSync(manifest)) return `${realpathSync(manifest)}\0${readFileSync(manifest, 'utf8')}`
    if (dir === root || dir === dirname(dir)) return `missing ${pkg}`
  }
}

/**
 * Hash everything that can change `gen`'s output — its outputs too, unless
 * `withOutputs` is false (comparing the inputs across a run that rewrites them).
 */
export function inputHash(gen: GeneratorSpec, root = ROOT, withOutputs = true): string {
  const hash = createHash('sha256')
  hash.update(`bun ${Bun.version}\0${gen.cmd.join(' ')}\0${gen.cwd}\0`)
  for (const pkg of gen.tools) hash.update(`${installedTool(root, gen.cwd, pkg)}\0`)
  const skip = new Set<string>(withOutputs ? [] : gen.outputs)
  for (const rel of [...SHARED_INPUTS, ...gen.inputs]) hashPath(hash, root, rel, skip)
  if (withOutputs) for (const rel of gen.outputs) hashPath(hash, root, rel, skip)
  return hash.digest('hex')
}

const CACHE_FILE = join(ROOT, 'node_modules/.cache/check-generated.json')

function readCache(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

async function run(cmd: string[], cwd: string): Promise<{ status: number; output: string }> {
  const proc = Bun.spawn(cmd, { cwd: join(ROOT, cwd), stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, status] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { status, output: `${stdout}${stderr}` }
}

async function main(): Promise<void> {
  const useCache = !process.env.CI && !process.argv.includes('--force')
  const cache = useCache ? readCache() : {}
  const results = await Promise.all(
    GENERATORS.map(async (gen) => {
      if (useCache && cache[gen.label] === inputHash(gen))
        return { gen, skipped: true, status: 0, output: '' }
      const before = inputHash(gen, ROOT, false)
      const r = await run(gen.cmd, gen.cwd)
      // Hashed after the run — the state in which a re-run is a no-op — and only
      // when no input moved while it ran (that output could be from the old one).
      if (r.status === 0 && inputHash(gen, ROOT, false) === before) {
        cache[gen.label] = inputHash(gen)
      } else delete cache[gen.label]
      return { gen, skipped: false, ...r }
    })
  )
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true })
    writeFileSync(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`)
  } catch {
    // A cache that can't be written only costs the next run its skip.
  }
  const failed = results.filter((r) => r.status !== 0)
  for (const r of failed) {
    console.error(`✗ generated files: the ${r.gen.label} generator failed (exit ${r.status})\n`)
    console.error(r.output)
  }
  if (failed.length > 0) process.exit(1)

  const status = await run(
    ['git', 'status', '--porcelain', '--untracked-files=all', '--', ...GENERATED_PATHS],
    '.'
  )
  if (status.status !== 0) {
    console.error(`✗ generated files: git status failed\n${status.output}`)
    process.exit(1)
  }
  const { changed, untracked } = parsePorcelain(status.output)
  if (changed.length === 0 && untracked.length === 0) {
    const skipped = results.filter((r) => r.skipped).length
    console.log(
      `✓ generated files: ${GENERATORS.length - skipped} generators re-run` +
        (skipped > 0 ? ` (${skipped} skipped, inputs unchanged; --force re-runs)` : '') +
        `, ${GENERATED_PATHS.length} paths match what is committed`
    )
    return
  }
  console.error('✗ generated files are stale — the generators produced a different tree:\n')
  for (const p of changed) console.error(`    changed    ${p}`)
  for (const p of untracked) console.error(`    untracked  ${p}   (a new file nothing committed)`)
  console.error(
    '\n  They were regenerated in place just now; review the diff and commit it.\n' +
      '  Never hand-edit these — change the generator or its source instead.'
  )
  process.exit(1)
}

if (import.meta.main) await main()
