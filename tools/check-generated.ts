#!/usr/bin/env bun
/**
 * Generated-file drift — `bun run check generated`.
 *
 * Several committed files are machine output: the static-accessor block in
 * the reference package's `lib/index.ts` (`bun run build:package`; its
 * `schemas/` and `lib/generated/` are gitignored build output, not checked
 * here), the Cantina's `src/routeTree.gen.ts`,
 * and the `worker-configuration.d.ts` that `wrangler types` writes for each of
 * the three Workers (`Env` from wrangler.jsonc, so a binding added there without
 * the types fails here). Each is regenerated here and then compared with what
 * is committed. A
 * stale one fails.
 *
 * The Worker files hold `Env` only (`--include-runtime=false`): the workerd
 * runtime globals come once from the `@cloudflare/workers-types` root
 * devDependency, listed in su-assets' and the bot's tsconfig `types`, instead
 * of a 16k-line copy per Worker. srd typechecks its Worker with the
 * DOM lib, which conflicts with that package, so its file is committed and
 * drift-checked but no tsconfig includes it; its `Env` stays hand-written. Bump it with `wrangler` — its peer range names the version
 * matching the workerd it bundles.
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
 *      - `bun apps/cantina/scripts/generate-route-tree.ts` — the router plugin's
 *        own generator with the Vite config's options, without a build;
 *      - `wrangler types --strict-vars=false --include-runtime=false` in
 *        each Worker app (not strict: the bot's tests sign with their own
 *        public key).
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
  closeSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

const ROOT = join(import.meta.dir, '..')

/** Every committed path a generator below writes. */
export const GENERATED_PATHS = [
  'packages/salvageunion-reference/lib/index.ts',
  'apps/cantina/src/routeTree.gen.ts',
  'apps/web/worker-configuration.d.ts',
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

/** The three Worker apps; the `workers` check holds them to one shape. */
export const WORKER_APPS = ['apps/web', 'apps/su-assets', 'apps/discord-bot'] as const

const workerTypes = (app: (typeof WORKER_APPS)[number]): GeneratorSpec => ({
  label: `${app} worker types`,
  cmd: ['bunx', 'wrangler', 'types', '--strict-vars=false', '--include-runtime=false'],
  cwd: app,
  outputs: [`${app}/worker-configuration.d.ts`],
  // What wrangler reads: wrangler.jsonc, the `.dev.vars`/`.env*` it takes
  // secret names from, and the main module it names. Not the whole app: srd
  // would re-run it on every UI edit.
  inputs: [
    `${app}/wrangler.jsonc`,
    `${app}/.dev.vars`,
    `${app}/.env`,
    `${app}/.env.local`,
    `${app}/src/worker/index.ts`,
    `${app}/worker-configuration.d.ts`,
  ],
  tools: ['wrangler'],
})

export const GENERATORS: GeneratorSpec[] = [
  {
    label: 'salvageunion-reference build',
    cmd: ['bun', 'run', 'build'],
    cwd: 'packages/salvageunion-reference',
    outputs: ['packages/salvageunion-reference/lib/index.ts'],
    // The whole package: data, lib (the registry and zod schemas), tools.
    inputs: ['packages/salvageunion-reference'],
    tools: ['zod', '@biomejs/biome'],
  },
  {
    label: 'cantina route tree',
    cmd: ['bun', 'scripts/generate-route-tree.ts'],
    cwd: 'apps/cantina',
    outputs: ['apps/cantina/src/routeTree.gen.ts'],
    inputs: [
      'apps/cantina/src/routes',
      'apps/cantina/routeTree.config.ts',
      'apps/cantina/scripts/generate-route-tree.ts',
      'apps/cantina/package.json',
    ],
    tools: ['@tanstack/router-plugin'],
  },
  ...WORKER_APPS.map(workerTypes),
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

/** Open `abs` read-only (a directory too, on Linux and macOS), or undefined if absent. */
function openIfPresent(abs: string): number | undefined {
  try {
    return openSync(abs, 'r')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
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
  // One handle for the check and the read, so the path can't change between.
  const fd = openIfPresent(abs)
  if (fd === undefined) {
    hash.update(`absent ${rel}\0`)
    return
  }
  let isDirectory: boolean
  try {
    isDirectory = fstatSync(fd).isDirectory()
    if (!isDirectory) {
      hash.update(`file ${rel}\0`)
      hash.update(readFileSync(fd))
      hash.update('\0')
    }
  } finally {
    closeSync(fd)
  }
  if (!isDirectory) return
  for (const name of readdirSync(abs).sort()) {
    if (name === 'node_modules') continue
    hashPath(hash, root, join(rel, name), skip)
  }
}

/** The installed copy of `pkg` as seen from `cwd`: its resolved path and manifest. */
function installedTool(root: string, cwd: string, pkg: string): string {
  for (let dir = join(root, cwd); ; dir = dirname(dir)) {
    const manifest = join(dir, 'node_modules', pkg, 'package.json')
    const fd = openIfPresent(manifest)
    if (fd !== undefined) {
      try {
        return `${realpathSync(manifest)}\0${readFileSync(fd, 'utf8')}`
      } finally {
        closeSync(fd)
      }
    }
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

function readCache(cacheFile: string): Record<string, string> {
  try {
    return JSON.parse(readFileSync(cacheFile, 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

async function run(
  cmd: string[],
  cwd: string,
  root = ROOT
): Promise<{ status: number; output: string }> {
  const proc = Bun.spawn(cmd, { cwd: join(root, cwd), stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, status] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { status, output: `${stdout}${stderr}` }
}

export type GeneratorResult = {
  gen: GeneratorSpec
  skipped: boolean
  status: number
  output: string
}

/**
 * Run `generators` at once, skipping each whose key matches `cacheFile`'s
 * record when `useCache`, and record the key of each clean run.
 */
export async function runGenerators(
  generators: GeneratorSpec[],
  {
    root = ROOT,
    cacheFile = join(ROOT, 'node_modules/.cache/check-generated.json'),
    useCache = true,
  } = {}
): Promise<GeneratorResult[]> {
  const cache = useCache ? readCache(cacheFile) : {}
  const results = await Promise.all(
    generators.map(async (gen): Promise<GeneratorResult> => {
      if (useCache && cache[gen.label] === inputHash(gen, root)) {
        return { gen, skipped: true, status: 0, output: '' }
      }
      const before = inputHash(gen, root, false)
      const r = await run(gen.cmd, gen.cwd, root)
      // Hashed after the run — the state in which a re-run is a no-op — and only
      // when no input moved while it ran (that output could be from the old one).
      if (r.status === 0 && inputHash(gen, root, false) === before) {
        cache[gen.label] = inputHash(gen, root)
      } else delete cache[gen.label]
      return { gen, skipped: false, ...r }
    })
  )
  try {
    mkdirSync(dirname(cacheFile), { recursive: true })
    writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)
  } catch {
    // A cache that can't be written only costs the next run its skip.
  }
  return results
}

/** What `main` regenerates and compares, and where; the defaults are the repo's. */
export type GeneratedOptions = {
  generators?: GeneratorSpec[]
  /** The paths `git status` must find unchanged after the run. */
  paths?: readonly string[]
  root?: string
  cacheFile?: string
  /** Off in CI, where every run starts cold. */
  ci?: boolean
  log?: (line: string) => void
  error?: (line: string) => void
}

/** Re-run every generator and compare the tree with git; returns the exit code. */
export async function main(
  argv: readonly string[] = process.argv,
  {
    generators = GENERATORS,
    paths = GENERATED_PATHS,
    root = ROOT,
    cacheFile = join(root, 'node_modules/.cache/check-generated.json'),
    ci = Boolean(process.env.CI),
    log = console.log,
    error = console.error,
  }: GeneratedOptions = {}
): Promise<number> {
  const results = await runGenerators(generators, {
    root,
    cacheFile,
    useCache: !ci && !argv.includes('--force'),
  })
  const failed = results.filter((r) => r.status !== 0)
  for (const r of failed) {
    error(`✗ generated files: the ${r.gen.label} generator failed (exit ${r.status})\n`)
    error(r.output)
  }
  if (failed.length > 0) return 1

  const status = await run(
    ['git', 'status', '--porcelain', '--untracked-files=all', '--', ...paths],
    '.',
    root
  )
  if (status.status !== 0) {
    error(`✗ generated files: git status failed\n${status.output}`)
    return 1
  }
  const { changed, untracked } = parsePorcelain(status.output)
  if (changed.length === 0 && untracked.length === 0) {
    const skipped = results.filter((r) => r.skipped).length
    log(
      `✓ generated files: ${generators.length - skipped} generators re-run` +
        (skipped > 0 ? ` (${skipped} skipped, inputs unchanged; --force re-runs)` : '') +
        `, ${paths.length} paths match what is committed`
    )
    return 0
  }
  error('✗ generated files are stale — the generators produced a different tree:\n')
  for (const p of changed) error(`    changed    ${p}`)
  for (const p of untracked) error(`    untracked  ${p}   (a new file nothing committed)`)
  error(
    '\n  They were regenerated in place just now; review the diff and commit it.\n' +
      '  Never hand-edit these — change the generator or its source instead.'
  )
  return 1
}

if (import.meta.main) process.exit(await main())
