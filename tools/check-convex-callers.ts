#!/usr/bin/env bun
/**
 * check-convex-callers — every PUBLIC Convex function must have a caller.
 *
 * A public `query` / `mutation` / `action` in `apps/itun/convex/` is reachable
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
 * `internalQuery` / `internalMutation` / `internalAction` are not public and
 * are not checked. Neither are `httpAction`s, which are reachable through the
 * router in `http.ts` rather than through `api`, nor `auth.ts`, whose exports
 * are produced by `convexAuth()` and called by the auth library by name.
 *
 * Known limit: a public function is recognised by its builder's NAME —
 * `query(`, `mutation(` or `action(` directly after `export const x =`. One
 * built through a differently named custom builder would be missed, so keep
 * public builders under those three names (as `model/entities` does).
 *
 * If a public function is genuinely meant to be called from outside this repo,
 * list it in `ALLOWED_WITHOUT_CALLER` with the reason. That list is empty on
 * purpose.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const CONVEX_DIR = join(ROOT, 'apps/itun/convex')

/** Directories whose non-test sources count as callers. */
const CALLER_DIRS = [join(ROOT, 'apps/itun/src'), join(ROOT, 'apps/discord-bot/src')]

/** `module:name` → why it has no caller in this repo. */
const ALLOWED_WITHOUT_CALLER: Readonly<Record<string, string>> = {}

/** Modules whose exports are not ordinary builder calls. See the header. */
const SKIPPED_MODULES = new Set(['auth', 'http', 'schema', 'auth.config'])

function walk(dir: string, keep: (path: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '_generated' || entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, keep, out)
    else if (keep(full)) out.push(full)
  }
  return out
}

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
 * `source` with its comments blanked, so a function named only in a doc
 * comment ("see `api.games.rename`") does not count as calling it. Line
 * comments need a non-`:` before the `//` so a URL inside a string survives.
 */
export function withoutComments(source: string): string {
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

/** Public functions with no reference and no allowance. */
export function uncalled(
  defined: Iterable<string>,
  referenced: ReadonlySet<string>,
  allowed: Readonly<Record<string, string>> = ALLOWED_WITHOUT_CALLER
): string[] {
  return [...defined].filter((fn) => !referenced.has(fn) && !(fn in allowed)).sort()
}

function isTest(path: string): boolean {
  return /[\\/]__tests__[\\/]/.test(path) || /\.test\.tsx?$/.test(path)
}

function main(): void {
  const defined: string[] = []
  const modules = walk(CONVEX_DIR, (p) => p.endsWith('.ts') && !p.endsWith('.d.ts'))
  for (const file of modules) {
    const module = relative(CONVEX_DIR, file).replace(/\.ts$/, '')
    // Nested modules (`model/*`) are helpers; a public function there would be
    // `api["model/x"]`, which nothing in this repo uses and this would miss.
    if (SKIPPED_MODULES.has(module)) continue
    for (const name of publicFunctionsIn(readFileSync(file, 'utf-8'))) {
      defined.push(`${module}:${name}`)
    }
  }

  const referenced = new Set<string>()
  for (const dir of CALLER_DIRS) {
    for (const file of walk(dir, (p) => /\.tsx?$/.test(p) && !isTest(p))) {
      for (const ref of referencesIn(readFileSync(file, 'utf-8'))) referenced.add(ref)
    }
  }

  const stale = Object.keys(ALLOWED_WITHOUT_CALLER).filter((fn) => !defined.includes(fn))
  const missing = uncalled(defined, referenced)

  if (missing.length > 0 || stale.length > 0) {
    if (missing.length > 0) {
      console.error('✗ Public Convex functions with no caller in the client or the bot:')
      for (const fn of missing) console.error(`    ${fn.replace(':', '.')}`)
      console.error(
        '  → Delete it, make it internal, or call it. A public function nobody calls is\n' +
          '    reachable surface that nothing exercises. If something outside this repo\n' +
          '    calls it, list it in ALLOWED_WITHOUT_CALLER in tools/check-convex-callers.ts\n' +
          '    with the reason.'
      )
    }
    for (const fn of stale) {
      console.error(`✗ ALLOWED_WITHOUT_CALLER lists ${fn}, which no longer exists — remove it.`)
    }
    process.exit(1)
  }

  console.log(`✓ Convex callers: all ${defined.length} public functions have a caller.`)
}

if (import.meta.main) main()
