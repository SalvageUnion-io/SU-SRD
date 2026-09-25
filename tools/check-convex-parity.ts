#!/usr/bin/env bun
/**
 * check-convex-parity — guards the seam where the client and the Convex
 * backend are deployed by two different mechanisms and can silently diverge.
 *
 * ITUN ships one artifact from two halves. The client is a static bundle
 * `deploy-cloudflare.yml` builds and publishes with wrangler; the backend is schema + functions that
 * `convex deploy` pushes to a Convex deployment. Both come from the same
 * commit, but only by convention — nothing structurally ties them, and when
 * they came apart nothing noticed:
 *
 *   Production ran a four-day-stale backend from 2026-08-06 to 2026-08-10.
 *   The published client called `entities:upsertSoftLink`, which did not exist
 *   server-side, so every soft-link write (pilot ↔ mech ↔ crawler assignment)
 *   failed outright. `byAppId` was still the pre-#705 version that throws on a
 *   duplicate `appId`, so mirrored pilot and mech writes died too — with the
 *   redacted `Server Error` string, while every surface kept rendering them as
 *   saved. 39 failures in one evening.
 *
 * What made it invisible is worth stating plainly, because it is the thing
 * this tool exists to change: **nothing failed.** The build was green, the site
 * served the current commit, and the only trace was a Convex deployment log
 * stream nobody tails. A green build is not evidence that the backend moved.
 *
 * This is the LIVE half: the thing CI structurally cannot know, namely what is
 * actually deployed. It asks the deployment for its function list and asserts
 * every function this repo defines is present on it. That is the direction
 * that matters — a backend BEHIND the client is what breaks players, because
 * the client calls things that are not there. It runs nightly.
 *
 * The STATIC half — that `.github/workflows/deploy-cloudflare.yml` still runs
 * `convex deploy` and refuses a production deploy with no `CONVEX_DEPLOY_KEY` —
 * is hermetic, so it runs on every PR as the `convex-guard` check in
 * `tools/check-workflows.ts`.
 *
 * Usage: bun run check:convex-parity:live
 *
 * It needs credentials, and takes them either way round:
 *   - `CONVEX_DEPLOY_KEY` set (CI) — `convex function-spec` targets that key's
 *     own deployment, so no name is needed and none can be wrong.
 *   - otherwise (a laptop) the Convex CLI's own device credentials, against
 *     `CONVEX_PARITY_DEPLOYMENT` — defaulting to production, which is the one
 *     whose drift has consequences.
 */

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(import.meta.dir, '..')
const CONVEX_DIR = join(REPO_ROOT, 'apps/itun/convex')

/**
 * The deployment whose staleness costs something. Overridable because this is
 * the only environment-specific string in the tool, and pinning it in a repo
 * that documents its deployments elsewhere would be a second place to update.
 */
const DEFAULT_DEPLOYMENT = process.env.CONVEX_PARITY_DEPLOYMENT ?? 'alex-jarvis:suref-itun:prod'

const failures: string[] = []
function fail(message: string): void {
  failures.push(`  ✗ ${message}`)
}

// ---------------------------------------------------------------------------
// Live: everything this repo defines is actually deployed
// ---------------------------------------------------------------------------

/** The Convex wrappers that register a callable function under a module path. */
const REGISTRARS = [
  'query',
  'mutation',
  'action',
  'internalQuery',
  'internalMutation',
  'internalAction',
] as const

/**
 * Every function this repo defines, as the `module.js:name` the deployment
 * reports.
 *
 * Regex rather than the TypeScript AST on purpose: the question is "which
 * names are registered", the registration is a flat `export const X = Y(` at
 * the top level by convention across all of `convex/`, and a parser here would
 * be a second build step for a check that has to stay cheap enough to run on
 * every PR.
 *
 * What it deliberately does NOT see: `convex/auth.ts`'s destructured
 * `export const { signIn, signOut, ... } = convexAuth(...)`. Those come from a
 * library, not from us, so they are correctly outside the set of things we can
 * assert we deployed — they surface as deployment-only extras below.
 */
function functionsDefinedInRepo(): Set<string> {
  const defined = new Set<string>()
  const pattern = new RegExp(`^export const (\\w+) = (?:${REGISTRARS.join('|')})\\(`, 'gm')

  /**
   * Walks nested directories, because Convex modules do. `convex/games/list.ts`
   * is the module `games/list`, and a non-recursive scan would simply not see
   * it — the parity check would go green while that function sat undeployed,
   * which is precisely the failure it exists to catch. `convex/model/` holds
   * only helpers today, so this changes nothing now and stops the check from
   * silently narrowing the first time the backend grows a subdirectory.
   */
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      // Convex ignores anything under a leading-underscore name, which is how
      // `_generated` stays out of the module namespace.
      if (entry.name.startsWith('_')) continue

      if (entry.isDirectory()) {
        walk(join(dir, entry.name), `${prefix}${entry.name}/`)
        continue
      }

      if (!entry.name.endsWith('.ts')) continue
      // Not function modules: the schema and the auth provider config.
      if (prefix === '' && (entry.name === 'schema.ts' || entry.name === 'auth.config.ts')) continue

      const moduleName = `${prefix}${entry.name.replace(/\.ts$/, '')}`
      const source = readFileSync(join(dir, entry.name), 'utf8')

      for (const match of source.matchAll(pattern)) {
        defined.add(`${moduleName}.js:${match[1]}`)
      }
    }
  }

  walk(CONVEX_DIR, '')
  return defined
}

/** What the deployment says it is serving right now. */
function functionsOnDeployment(): Set<string> {
  // With a deploy key the CLI resolves its own target; without one it needs to
  // be told which deployment, and uses the operator's device credentials.
  const args = ['convex', 'function-spec']
  if (!process.env.CONVEX_DEPLOY_KEY) args.push('--deployment', DEFAULT_DEPLOYMENT)

  const raw = execFileSync('bunx', args, {
    cwd: join(REPO_ROOT, 'apps/itun'),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  })

  const spec = JSON.parse(raw) as {
    url: string
    functions: Array<{ identifier?: string; functionType: string; path?: string }>
  }
  console.log(`  [deployment] ${spec.url}`)

  // HTTP actions are a different surface and carry `path`/`method` instead of a
  // module identifier — they are mounted on an `httpRouter` in `http.ts` rather
  // than exported through a registrar, so there is nothing on the repo side to
  // compare them against here. Dropped rather than folded in, because mapping
  // them all to a missing `identifier` collapses every route to one `undefined`
  // entry, which reads like a bug in the deployment.
  const identifiers = spec.functions
    .map((fn) => fn.identifier)
    .filter((id): id is string => id !== undefined)

  return new Set(identifiers)
}

function checkLive(): void {
  const defined = functionsDefinedInRepo()
  const deployed = functionsOnDeployment()

  const missing = [...defined].filter((fn) => !deployed.has(fn)).sort()
  const extra = [...deployed].filter((fn) => !defined.has(fn)).sort()

  if (missing.length > 0) {
    fail(
      `${missing.length} function(s) exist in apps/itun/convex but NOT on the deployment.\n` +
        `      The backend is behind the client: anything the published bundle calls here\n` +
        `      fails with a redacted "Server Error" while the UI renders it as saved.\n` +
        `      Push it: cd apps/itun && bunx convex deploy\n` +
        missing.map((fn) => `        - ${fn}`).join('\n')
    )
  } else {
    console.log(`  [parity] all ${defined.size} repo-defined functions are deployed`)
  }

  // Informational, never fatal. Some entries here are legitimate — the
  // `auth.js:*` functions come from `convexAuth()` rather than from a
  // registration this tool can see. But a name we deleted and the deployment
  // still serves is real staleness in the other direction, and worth printing
  // so it is at least visible: `bot.js:*` lingered here for days.
  if (extra.length > 0) {
    console.log(`  [parity] ${extra.length} deployed function(s) not defined in this checkout:`)
    for (const fn of extra) console.log(`        · ${fn}`)
  }
}

// ---------------------------------------------------------------------------

console.log('Checking what the Convex deployment actually serves…')
checkLive()

if (failures.length > 0) {
  console.error(`\n✗ convex parity failed:\n${failures.join('\n')}\n`)
  process.exit(1)
}

console.log('✓ convex parity OK')
