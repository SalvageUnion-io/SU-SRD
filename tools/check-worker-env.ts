#!/usr/bin/env bun
/**
 * Worker `Env` drift check — `bun run check:worker-env`.
 *
 * Each of the three Workers hand-writes its `Env` type (audit AP-12), and the
 * bindings it lists are a second copy of what that Worker's `wrangler.jsonc`
 * declares. Rename a binding in one and not the other and nothing fails: the
 * typecheck is happy with the stale name, the tests hand the Worker a fake
 * `env` with the stale name, and in production `env.NEW_NAME` is simply
 * `undefined` — which every one of these Workers deliberately treats as
 * "optional binding absent, degrade quietly". A renamed R2 bucket would turn
 * snapshot sharing off with a green build.
 *
 * ## Why not just use `wrangler types` as the Env
 *
 * The obvious fix is to generate `Env` and delete the hand-written copies. It
 * does not fit here, for two measured reasons:
 *
 *   - The generated interface types bindings with the workerd runtime types
 *     (`R2Bucket`, `Fetcher`, `RateLimit`, `ImagesBinding`, …). These Workers
 *     type their bindings STRUCTURALLY (`R2BucketLike`, `AssetBucket`) so the
 *     routing tests can pass small fakes — and itun's Worker is compiled under
 *     the DOM lib, where the workerd globals would collide.
 *   - It cannot see secrets. `SENTRY_DSN`, `DISCORD_TOKEN`, `ITUN_BOT_SECRET`
 *     are set with `wrangler secret put`, so they appear in no config file and
 *     the generated `Env` would omit them — a hand-written half is needed
 *     anyway.
 *
 * So wrangler stays the source of truth for the binding NAMES, and this check
 * holds each hand-written `Env` to it: every binding or var `wrangler types`
 * reports for a Worker must be declared on that Worker's exported `Env`. It
 * runs the real `wrangler types` (offline, a second or two each, in parallel)
 * rather than re-parsing `wrangler.jsonc`, so a binding kind this file has
 * never heard of is still covered.
 *
 * The reverse direction is not checked: `Env` legitimately declares secrets
 * and observability fields that no config file names.
 *
 * Usage: bun run check:worker-env
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { assertScanFloor } from './lib/scanFloor'

const ROOT = join(import.meta.dir, '..')
const LABEL = 'check:worker-env'

export type Worker = { app: string; configPath: string; mainPath: string }

/** Every app whose `wrangler.jsonc` names a `main` script — i.e. has a Worker. */
export function discoverWorkers(root: string = ROOT): Worker[] {
  const out: Worker[] = []
  for (const entry of readdirSync(join(root, 'apps'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const configPath = join(root, 'apps', entry.name, 'wrangler.jsonc')
    if (!existsSync(configPath)) continue
    const main = /^\s*"main"\s*:\s*"([^"]+)"/m.exec(readFileSync(configPath, 'utf8'))?.[1]
    if (!main) continue // srd: static assets, no Worker script.
    out.push({ app: entry.name, configPath, mainPath: join(root, 'apps', entry.name, main) })
  }
  return out.sort((a, b) => a.app.localeCompare(b.app))
}

/** The keys of the base interface `wrangler types --include-runtime=false` emits. */
export function bindingNames(generated: string): string[] {
  const body = /interface\s+__BaseEnv_\w+\s*\{([^}]*)\}/.exec(generated)?.[1]
  if (body === undefined) {
    throw new Error('wrangler types output has no `__BaseEnv_*` interface — its format changed')
  }
  return [...body.matchAll(/^\s*([A-Za-z_$][\w$]*)\??\s*:/gm)].map((m) => m[1] as string)
}

/**
 * The top-level property names of the object literal(s) in `export type Env =`.
 *
 * Brace-depth scan rather than a regex, so a documented property whose JSDoc or
 * nested type contains `{`/`}` does not end the literal early. Named types in
 * the intersection (`ObservabilityEnv & {…}`) are not expanded; they carry
 * secrets, which no config names.
 */
export function declaredEnvKeys(source: string): string[] | null {
  const start = /export\s+type\s+Env\s*=/.exec(source)
  if (!start) return null
  const keys: string[] = []
  let depth = 0
  let entered = false
  let line = ''
  for (let i = start.index + start[0].length; i < source.length; i += 1) {
    const ch = source[i] as string
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end === -1 ? source.length : end + 1
      continue
    }
    if (ch === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i)
      i = end === -1 ? source.length : end - 1
      continue
    }
    if (ch === ':' && depth === 1) {
      // A property name is recorded at its colon, not at the end of the line:
      // `ASSETS: { fetch(…) }` opens a nested literal before any newline.
      const key = /^\s*([A-Za-z_$][\w$]*)\??\s*$/.exec(line)?.[1]
      if (key) keys.push(key)
      line = ''
      continue
    }
    if (ch === '{') {
      depth += 1
      entered = true
      line = ''
      continue
    }
    if (ch === '}') {
      depth -= 1
      line = ''
      if (depth === 0) {
        // `& {…}` may follow; anything else ends the type.
        const rest = source.slice(i + 1).trimStart()
        if (!rest.startsWith('&')) break
      }
      continue
    }
    if (ch === '\n' || ch === ';') {
      if (depth === 0) {
        // Outside any literal: the type continues only through `&` or `{`.
        const rest = source.slice(i + 1).trimStart()
        const prev = source.slice(start.index, i).trimEnd()
        if (!prev.endsWith('&') && !prev.endsWith('=') && !/^[&{]/.test(rest)) break
      }
      line = ''
      continue
    }
    if (depth === 1) line += ch
  }
  return entered ? keys : []
}

async function generate(worker: Worker, outDir: string): Promise<string> {
  const out = join(outDir, `${worker.app}.d.ts`)
  const proc = Bun.spawn(['bunx', 'wrangler', 'types', '--include-runtime=false', out], {
    cwd: join(ROOT, 'apps', worker.app),
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const code = await proc.exited
  if (code !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`wrangler types failed for apps/${worker.app} (exit ${code}):\n${stderr}`)
  }
  return readFileSync(out, 'utf8')
}

async function main(): Promise<void> {
  const workers = discoverWorkers()
  assertScanFloor(`${LABEL} (Workers)`, workers.length, 3)

  const outDir = mkdtempSync(join(tmpdir(), 'worker-env-'))
  const problems: string[] = []
  try {
    const generated = await Promise.all(workers.map((w) => generate(w, outDir)))
    workers.forEach((worker, i) => {
      const main = relative(ROOT, worker.mainPath)
      const declared = declaredEnvKeys(readFileSync(worker.mainPath, 'utf8'))
      if (declared === null) {
        problems.push(`${main} exports no \`type Env\` — nothing to hold the bindings to`)
        return
      }
      for (const name of bindingNames(generated[i] as string)) {
        if (!declared.includes(name)) {
          problems.push(
            `${relative(ROOT, worker.configPath)} declares \`${name}\`, but \`Env\` in ${main} does not`
          )
        }
      }
    })
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }

  if (problems.length > 0) {
    console.error(`\n✗ ${LABEL}: ${problems.length} binding(s) missing from a hand-written Env.\n`)
    for (const problem of problems) console.error(`  • ${problem}`)
    console.error(
      '\n  A binding the config declares and `Env` does not is read as `undefined` in\n' +
        '  production, which these Workers treat as "optional, degrade quietly".\n' +
        '  Add it to `Env` (optional if the Worker must run without it), or fix the\n' +
        '  name in whichever of the two drifted.\n'
    )
    process.exit(1)
  }

  console.log(
    `✓ worker env: every wrangler binding is declared on its Worker's Env (${workers.map((w) => w.app).join(', ')})`
  )
}

if (import.meta.main) await main()
