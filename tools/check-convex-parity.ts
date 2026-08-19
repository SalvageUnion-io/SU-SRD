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
 * Where the same guard lives once the build moves into GitHub Actions
 * (ADR-033 §4). Named here BEFORE that workflow exists, deliberately: the
 * property this tool protects must not have a window in which nothing asserts
 * it, so the path is fixed in advance and the workflow has to satisfy it rather
 * than this check being retrofitted afterwards.
 */
const CF_DEPLOY_WORKFLOW = join(REPO_ROOT, '.github/workflows/deploy-cloudflare.yml')

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
  const hasNetlify = existsSync(NETLIFY_TOML)
  const hasWorkflow = existsSync(CF_DEPLOY_WORKFLOW)

  // Neither source present is the one state that must never pass. During the
  // cutover BOTH may be present, and each is checked on its own terms; after
  // it, only the workflow remains. "Nothing asserts the guard" is the hole.
  if (!hasNetlify && !hasWorkflow) {
    fail(
      `no build definition carries the Convex deploy guard — expected either\n` +
        `      apps/itun/netlify.toml or .github/workflows/deploy-cloudflare.yml.\n` +
        `      Without one, a production deploy can ship a client against a backend\n` +
        `      nobody pushed, exactly as it did from 2026-08-06 to 2026-08-10.`
    )
    return
  }

  if (hasNetlify) checkNetlifyBuildGuard()
  if (hasWorkflow) checkWorkflowBuildGuard()
}

/**
 * The GitHub Actions form of the same three properties.
 *
 * Asserted on properties rather than an exact step, for the reason the Netlify
 * version documents at length: a workflow will be edited again, and a brittle
 * equality trains people to update the expectation without reading it.
 */
function checkWorkflowBuildGuard(): void {
  // Comments are stripped BEFORE any of these checks, and that is not tidiness.
  // The first version of this function matched the raw file, so the workflow's
  // own explanatory comment — "`convex deploy --cmd` pushes schema and
  // functions…" — satisfied the `convex deploy` assertion all by itself.
  // Deleting the actual command still passed.
  //
  // A guard that can be satisfied by prose about the guard is not a guard. This
  // was caught by the test that deletes the command from the real workflow;
  // without that test the weakness would have shipped looking green.
  //
  // Line-level stripping rather than a YAML parse: the checks below are all
  // "does this token appear in something executable", and a full parse would be
  // a second dependency for a tool that has to stay cheap enough to run on
  // every PR.
  const yaml = readFileSync(CF_DEPLOY_WORKFLOW, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')

  if (!yaml.includes('convex deploy')) {
    fail(
      `.github/workflows/deploy-cloudflare.yml no longer runs \`convex deploy\`, so\n` +
        `      the backend would never be pushed by a deploy at all`
    )
  }

  const namesTheKey = yaml.includes('CONVEX_DEPLOY_KEY')
  const canFail = yaml.includes('exit 1')

  if (!namesTheKey || !canFail) {
    fail(
      `.github/workflows/deploy-cloudflare.yml no longer fails a production deploy\n` +
        `      that has no CONVEX_DEPLOY_KEY. Without that guard an absent key ships a\n` +
        `      current client against a stale backend and nothing goes red.`
    )
    return
  }

  console.log('  [deploy-cloudflare.yml] production deploy fails when CONVEX_DEPLOY_KEY is absent')
}

function checkNetlifyBuildGuard(): void {
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
