#!/usr/bin/env bun
/**
 * check-convex-parity — guards the seam where the client and the Convex
 * backend are deployed by two different mechanisms and can silently diverge.
 *
 * ITUN ships one artifact from two halves. The client is a static bundle
 * Netlify builds and publishes; the backend is schema + functions that
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
 * this tool exists to change: **nothing failed.** Netlify was green, the site
 * served the current commit, and the only trace was a Convex deployment log
 * stream nobody tails. A green build is not evidence that the backend moved.
 *
 * Two halves, checked at the two different places they break:
 *
 *   STATIC (default; runs in `validate:all`, so every PR)
 *     Cheap, hermetic, no network, no credentials. Asserts the one thing the
 *     repo can own by itself: that `apps/itun/netlify.toml` still refuses a
 *     production build with no `CONVEX_DEPLOY_KEY`. That guard is what turns
 *     the original failure from silent into fatal, and a guard nothing checks
 *     is a guard that gets deleted in a cleanup six months from now.
 *
 *   LIVE (`--live`; runs nightly)
 *     The half CI structurally cannot know: what is actually deployed. Asks
 *     the deployment for its function list and asserts every function this
 *     repo defines is present on it. This is the direction that matters — a
 *     backend BEHIND the client is what breaks players, because the client
 *     calls things that are not there.
 *
 * Usage:
 *   bun tools/check-convex-parity.ts           # static guard (CI, every PR)
 *   bun tools/check-convex-parity.ts --live    # deployed truth (nightly)
 *
 * Live mode needs credentials, and takes them either way round:
 *   - `CONVEX_DEPLOY_KEY` set (CI) — `convex function-spec` targets that key's
 *     own deployment, so no name is needed and none can be wrong.
 *   - otherwise (a laptop) the Convex CLI's own device credentials, against
 *     `CONVEX_PARITY_DEPLOYMENT` — defaulting to production, which is the one
 *     whose drift has consequences.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(import.meta.dir, '..')
const CONVEX_DIR = join(REPO_ROOT, 'apps/itun/convex')
const NETLIFY_TOML = join(REPO_ROOT, 'apps/itun/netlify.toml')

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
// Static: the netlify.toml guard is still there
// ---------------------------------------------------------------------------

/**
 * Assert the production build cannot fall back to a Solo build.
 *
 * Deliberately three separate assertions rather than one match of the whole
 * command string. The command is a shell one-liner that will be edited again,
 * and a single brittle equality would fail on every unrelated edit — which
 * trains people to update the expectation without reading it. These three ask
 * for the *properties* instead: it deploys the backend, it knows what context
 * it is in, and an absent key in production is fatal.
 */
function checkStatic(): void {
  if (!existsSync(NETLIFY_TOML)) {
    fail(`apps/itun/netlify.toml is missing — the production deploy guard lives there`)
    return
  }

  const toml = readFileSync(NETLIFY_TOML, 'utf8')
  const commandLine = toml.split('\n').find((line) => line.trimStart().startsWith('command ='))

  if (commandLine === undefined) {
    fail(`apps/itun/netlify.toml has no [build] command`)
    return
  }

  if (!commandLine.includes('convex deploy')) {
    fail(
      `apps/itun/netlify.toml's build command no longer runs \`convex deploy\`, so the\n` +
        `      backend would never be pushed by a deploy at all`
    )
  }

  const guardsProductionContext =
    commandLine.includes('"$CONTEXT" = "production"') && commandLine.includes('exit 1')
  const testsForAbsentKey = commandLine.includes('-z "$CONVEX_DEPLOY_KEY"')

  if (!guardsProductionContext || !testsForAbsentKey) {
    fail(
      `apps/itun/netlify.toml no longer fails a production build that has no\n` +
        `      CONVEX_DEPLOY_KEY. Without that guard an absent key silently takes the\n` +
        `      Solo branch: the build goes green and ships a client against a backend\n` +
        `      nobody pushed. Restore the leading guard in the [build] command.`
    )
    return
  }

  console.log('  [netlify.toml] production build fails when CONVEX_DEPLOY_KEY is absent')
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

  for (const entry of readdirSync(CONVEX_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue
    // Not function modules: the schema, the auth provider config, and the
    // generated directory (which `withFileTypes` already excludes as a dir).
    if (entry.name === 'schema.ts' || entry.name === 'auth.config.ts') continue

    const moduleName = entry.name.replace(/\.ts$/, '')
    const source = readFileSync(join(CONVEX_DIR, entry.name), 'utf8')
    const pattern = new RegExp(`^export const (\\w+) = (?:${REGISTRARS.join('|')})\\(`, 'gm')

    for (const match of source.matchAll(pattern)) {
      defined.add(`${moduleName}.js:${match[1]}`)
    }
  }

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

const live = process.argv.includes('--live')

console.log(
  live
    ? 'Checking what the Convex deployment actually serves…'
    : 'Checking the Convex production-deploy guard…'
)

if (live) checkLive()
else checkStatic()

if (failures.length > 0) {
  console.error(`\n✗ convex ${live ? 'parity' : 'deploy guard'} failed:\n${failures.join('\n')}\n`)
  process.exit(1)
}

console.log(`✓ convex ${live ? 'parity' : 'deploy guard'} OK`)
