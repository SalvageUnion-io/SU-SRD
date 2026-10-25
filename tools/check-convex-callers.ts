#!/usr/bin/env bun
/**
 * check-convex-callers — every PUBLIC Convex function must have a caller.
 *
 * A public `query` / `mutation` / `action` in `apps/web/convex/` is reachable
 * by anybody holding the deployment URL, which is shipped in the client bundle.
 * So a public function that no client calls is not harmless dead code: it is
 * attack surface that nothing exercises, whose authorization nobody watches
 * because no screen depends on it.
 *
 * knip cannot see this. It treats every `convex/*.ts` as an entry point (Convex
 * loads them by convention, not by import), so an export there is never
 * "unused" as far as it knows. Eight such functions had accumulated when this
 * check was written — `entities.create` / `update`, `crew.readEntity`,
 * `games.rename` / `transferOrganizer`, `mediator.updateNpc`,
 * `ownership.assign` / `leaveGame` — each with tests and none with a caller.
 *
 * The check: collect the public functions each module exports, collect every
 * `api.<module>.<name>` (and `makeFunctionReference('<module>:<name>')`)
 * reference in shipped client code, and fail on any public function with none.
 * Tests do not count as callers — a function that only a test calls is exactly
 * the case this exists to catch.
 *
 * An `internalQuery` / `internalMutation` / `internalAction` is not attack
 * surface, but one nothing calls is still dead code knip cannot see, for the
 * same reason. So each must be referenced as `internal.<module>.<name>` from
 * non-test code in `convex/` (a cron, the bot's op table, another function) or
 * the client, unless its doc comment carries `@operator`: a one-off run by hand
 * from the dashboard, deleted once it has run.
 *
 * Neither check covers `httpAction`s, which are reachable through the router in
 * `http.ts` rather than through `api`.
 *
 * Known limit: a public function is recognised by its builder's NAME —
 * `query(`, `mutation(` or `action(` directly after `export const x =`. One
 * built through a differently named custom builder would be missed, so keep
 * public builders under those three names (as `model/entities` does).
 *
 * A RE-EXPORT of a public function is a public function too: Convex registers
 * every export of a module, so `export { claimLocal } from './claim'` in
 * `entities.ts` would make `entities:claimLocal` callable by anyone. The check
 * follows `export { … } from './x'` and `export * from './x'` to sibling
 * modules and counts each re-exported public function under the re-exporting
 * module's name — otherwise a re-export would be reachable surface this check
 * could not see.
 *
 * It also checks the committed `convex/_generated/api.d.ts` registers exactly
 * the modules on disk. `tsc` does not catch that drift: the root tsconfig sets
 * `skipLibCheck`, so an `api.d.ts` importing a deleted module still typechecks,
 * and a module it never registered is invisible until something calls it.
 * Argument and return types inside a registered module are not covered;
 * regenerating (`bunx convex dev`) stays the source of truth.
 */

import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { walk } from 'gates/lib/walk'

const ROOT = join(import.meta.dir, '..')

/** The deployment's modules, under the repo root. */
const convexDir = (root: string) => join(root, 'apps/web/convex')

/**
 * Where callers live: the client's non-test sources. The bot reaches
 * Convex over HTTP (`botHttp.ts`), never through `api`.
 */
const callerDirs = (root: string) => [join(root, 'apps/web/src')]

/** Where internal functions' callers live: the client and the deployment itself. */
const internalCallerDirs = (root: string) => [...callerDirs(root), convexDir(root)]

/** Modules whose exports are not ordinary builder calls. See the header. */
const SKIPPED_MODULES = new Set(['http', 'schema', 'auth.config'])

/** Files Convex does not register as function modules: the data model and provider config. */
const NOT_MODULES = new Set(['schema', 'auth.config'])

/** Codegen output is not source a caller or a module lives in. */
const SKIP_DIRS = new Set(['node_modules', '_generated'])

/**
 * The public functions one module's source exports, by name.
 *
 * Matches `export const name = query(` / `mutation(` / `action(` — the
 * builders a module may import from `_generated/server` or, for mutations,
 * from `model/entities` (which wraps them with triggers). Internal builders
 * are prefixed `internal` and so never match.
 */
export function publicFunctionsIn(source: string): string[] {
  return [...source.matchAll(/^export const (\w+) = (?:query|mutation|action)\(/gm)]
    .map((m) => m[1])
    .filter((name): name is string => name !== undefined)
}

/**
 * The internal functions one module's source exports, by name, without those
 * whose doc comment is tagged `@operator` (run by hand, so nothing calls them).
 */
export function internalFunctionsIn(source: string): string[] {
  const pattern =
    /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/)?\s*^export const (\w+) = internal(?:Query|Mutation|Action)\(/gm
  return [...source.matchAll(pattern)]
    .filter((m) => !/@operator\b/.test(m[1] ?? ''))
    .map((m) => m[2])
    .filter((name): name is string => name !== undefined)
}

/**
 * Sibling-module re-exports in one module's source: `export { a, b as c } from
 * './x'` yields `{ from: 'x', names: [['a', 'a'], ['b', 'c']] }` (source name,
 * exported name); `export * from './x'` yields `names: '*'`. Type-only
 * re-exports register nothing and are skipped.
 */
export function reExportsIn(
  raw: string
): Array<{ from: string; names: Array<[string, string]> | '*' }> {
  const source = withoutComments(raw)
  const out: Array<{ from: string; names: Array<[string, string]> | '*' }> = []
  for (const m of source.matchAll(/^export\s*\{([^}]*)\}\s*from\s*['"]\.\/([\w/]+)['"]/gm)) {
    const names = (m[1] ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && !part.startsWith('type '))
      .map((part): [string, string] => {
        const [name = '', alias] = part.split(/\s+as\s+/)
        return [name, alias ?? name]
      })
    if (m[2] !== undefined) out.push({ from: m[2], names })
  }
  for (const m of source.matchAll(/^export\s*\*\s*from\s*['"]\.\/([\w/]+)['"]/gm)) {
    if (m[1] !== undefined) out.push({ from: m[1], names: '*' })
  }
  return out
}

/**
 * `source` with its comments blanked, so a function named only in a doc
 * comment ("see `api.games.rename`") does not count as calling it. Line
 * comments need a non-`:` before the `//` so a URL inside a string survives.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Every `module:name` a caller's source references, outside comments. */
export function referencesIn(raw: string): Set<string> {
  const source = withoutComments(raw)
  const refs = new Set<string>()
  for (const m of source.matchAll(/\bapi\.(\w+)\.(\w+)/g)) refs.add(`${m[1]}:${m[2]}`)
  for (const m of source.matchAll(/makeFunctionReference(?:<[^>]*>)?\(\s*['"](\w+):(\w+)['"]/g)) {
    refs.add(`${m[1]}:${m[2]}`)
  }
  return refs
}

/** Every `module:name` an `internal.<module>.<name>` reference names, outside comments. */
export function internalReferencesIn(raw: string): Set<string> {
  const refs = new Set<string>()
  for (const m of withoutComments(raw).matchAll(/\binternal\.(\w+)\.(\w+)/g)) {
    refs.add(`${m[1]}:${m[2]}`)
  }
  return refs
}

/** Functions with no reference. */
export function uncalled(defined: Iterable<string>, referenced: ReadonlySet<string>): string[] {
  return [...defined].filter((fn) => !referenced.has(fn)).sort()
}

/** Every module `api.d.ts` registers — each is `import type * as X from "../<path>.js"`. */
export function registeredModules(api: string): Set<string> {
  return new Set(
    [...api.matchAll(/import type \* as [\w$]+ from ["']\.\.\/(.+?)\.js["']/g)]
      .map((m) => m[1])
      .filter((p): p is string => p !== undefined)
  )
}

/** Modules on disk that `api.d.ts` does not register, and registered ones that are gone. */
export function codegenDrift(
  onDisk: ReadonlySet<string>,
  registered: ReadonlySet<string>
): { missing: string[]; extra: string[] } {
  return {
    missing: [...onDisk].filter((m) => !registered.has(m)).sort(),
    extra: [...registered].filter((m) => !onDisk.has(m)).sort(),
  }
}

function isTest(path: string): boolean {
  return /[\\/]__tests__[\\/]/.test(path) || /\.test\.tsx?$/.test(path)
}

/** Run the gate over the repo at `root`; returns the exit code. */
export function main(root = ROOT, log = console.log, error = console.error): number {
  const CONVEX_DIR = convexDir(root)
  const defined: string[] = []
  const definedInternal: string[] = []
  const modules = walk(CONVEX_DIR, (p) => p.endsWith('.ts') && !p.endsWith('.d.ts'), SKIP_DIRS)
  const sources = new Map<string, string>()
  const ownPublic = new Map<string, string[]>()
  const onDisk = new Set<string>()
  for (const file of modules) {
    const module = relative(CONVEX_DIR, file).replace(/\.ts$/, '')
    if (!NOT_MODULES.has(module)) onDisk.add(module)
    // Nested modules (`model/*`) are helpers; a public function there would be
    // `api["model/x"]`, which nothing in this repo uses and this would miss.
    if (SKIPPED_MODULES.has(module)) continue
    const source = readFileSync(file, 'utf-8')
    sources.set(module, source)
    ownPublic.set(module, publicFunctionsIn(source))
  }
  for (const [module, source] of sources) {
    for (const name of ownPublic.get(module) ?? []) defined.push(`${module}:${name}`)
    for (const name of internalFunctionsIn(source)) definedInternal.push(`${module}:${name}`)
    for (const { from, names } of reExportsIn(source)) {
      const targetPublic = ownPublic.get(from) ?? []
      const pairs: Array<[string, string]> =
        names === '*' ? targetPublic.map((n): [string, string] => [n, n]) : names
      for (const [name, alias] of pairs) {
        if (targetPublic.includes(name)) defined.push(`${module}:${alias}`)
      }
    }
  }

  const referenced = new Set<string>()
  for (const dir of callerDirs(root)) {
    for (const file of walk(dir, (p) => /\.tsx?$/.test(p) && !isTest(p), SKIP_DIRS)) {
      for (const ref of referencesIn(readFileSync(file, 'utf-8'))) referenced.add(ref)
    }
  }

  const referencedInternal = new Set<string>()
  for (const dir of internalCallerDirs(root)) {
    for (const file of walk(dir, (p) => /\.tsx?$/.test(p) && !isTest(p), SKIP_DIRS)) {
      for (const ref of internalReferencesIn(readFileSync(file, 'utf-8'))) {
        referencedInternal.add(ref)
      }
    }
  }

  const missing = uncalled(defined, referenced)
  const missingInternal = uncalled(definedInternal, referencedInternal)
  const drift = codegenDrift(
    onDisk,
    registeredModules(readFileSync(join(CONVEX_DIR, '_generated/api.d.ts'), 'utf-8'))
  )
  const drifted = drift.missing.length > 0 || drift.extra.length > 0

  if (missing.length > 0 || missingInternal.length > 0 || drifted) {
    if (drifted) {
      error('✗ Convex codegen drift — apps/web/convex/_generated/api.d.ts is stale.')
      for (const m of drift.missing) {
        error(`    convex/${m}.ts exists on disk but is NOT registered in api.d.ts`)
      }
      for (const m of drift.extra) {
        error(`    api.d.ts registers convex/${m}.ts, which no longer exists`)
      }
      error(
        '  → Regenerate with `bunx convex dev` (needs a CONVEX_DEPLOYMENT); never hand-edit\n' +
          '    convex/_generated/.'
      )
    }
    if (missing.length > 0) {
      error('✗ Public Convex functions with no caller in the client:')
      for (const fn of missing) error(`    ${fn.replace(':', '.')}`)
      error(
        '  → Delete it, make it internal, or call it. A public function nobody calls is\n' +
          '    reachable surface that nothing exercises.'
      )
    }
    if (missingInternal.length > 0) {
      error('✗ Internal Convex functions nothing calls:')
      for (const fn of missingInternal) error(`    ${fn.replace(':', '.')}`)
      error(
        '  → Delete it, or tag its doc comment `@operator` if it is a one-off run by hand\n' +
          '    from the dashboard (and delete it once it has run).'
      )
    }
    return 1
  }

  log(
    `✓ Convex callers: all ${defined.length} public functions have a caller, ` +
      `all ${definedInternal.length} internal functions are called, and api.d.ts registers all ${onDisk.size} modules.`
  )
  return 0
}

if (import.meta.main) process.exit(main())
