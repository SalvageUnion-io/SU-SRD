#!/usr/bin/env bun
/**
 * Path-filter coverage — `bun run check:path-filters`.
 *
 * `ci.yml`'s `changes` job decides which heavy jobs run for a given diff. Every
 * build job is gated on one of its filter groups, and `CI Success` treats a
 * SKIPPED job as a pass — correctly, since a skipped job for an irrelevant area
 * must not wedge every docs PR. That combination means the filters are the only
 * thing standing between a diff and an unbuilt merge, and nothing checked them.
 *
 * ## The failure this exists to prevent
 *
 * `packages/observability` is a `workspace:*` dependency of all four apps, but
 * the `shared` anchor named only `packages/salvageunion-reference/**`. So a
 * change to observability matched `code` (via `packages/**`) and nothing else:
 * static-checks and test ran, while `build-srd`, `build-itun` and
 * `build-discord-bot` all skipped — taking with them the srd output-snapshot
 * gate, the `routeTree.gen.ts` staleness check and both Playwright tiers.
 *
 * This is the #731 shape that `ci.yml`'s own comment memorialises for
 * `SPECIAL_THANKS.md`: the gate was working, it was never asked. That one was
 * fixed by adding a path. Adding a path fixes one instance; asserting the
 * RELATIONSHIP fixes the class, which is what this does.
 *
 * ## The invariant
 *
 * For every app, each of its `workspace:*` dependencies must be covered by the
 * filter group that gates that app's build job. The dependency edges come from
 * the manifests and the groups come from `ci.yml`, so neither side is a list
 * maintained here — add a workspace dependency and this check tells you which
 * filter group needs it, before CI silently stops building.
 *
 * WHY A HAND-ROLLED PARSE AND NOT A YAML LIBRARY. Same trade
 * `tools/check-ci-aggregator.ts` documents: there is no YAML parser in this
 * repo's dependencies, and adding one to read one block out of one file whose
 * shape we control is not worth it. The parse below is narrow and hard-errors
 * rather than guessing — a guard that silently parsed zero groups would report
 * success while checking nothing, which is the failure it exists to prevent.
 *
 * Exit codes: 0 — every app's workspace dependencies are covered; 1 — a
 * dependency is uncovered, an app has no filter group and no stated exemption,
 * or `ci.yml` could not be read in the shape this check requires.
 *
 * Usage: bun run check:path-filters
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertScanFloor } from './lib/scanFloor'

const ROOT = join(import.meta.dir, '..')
const WORKFLOW = '.github/workflows/ci.yml'
const LABEL = 'check:path-filters'

class WorkflowShapeError extends Error {}

/**
 * Which filter group gates each app's build job.
 *
 * This mapping is a genuine translation — the group names do not match the
 * directory names (`apps/srd` is gated by `web`) — so it cannot be derived. It
 * is deliberately small, and an app missing from BOTH this map and the
 * exemptions below is a hard failure rather than a silent skip, which is the
 * whole point of the file.
 */
const APP_TO_FILTER: Record<string, string> = {
  itun: 'itun',
  srd: 'web',
  'discord-bot': 'bot',
  'su-assets': 'assets',
}

/**
 * Apps with no filter group, and why.
 *
 * An exemption must carry a reason and an exit condition. This is not a place
 * to park an app that is merely inconvenient to gate.
 */
const NO_FILTER_GROUP: Record<string, string> = {
  // Empty, and that is the point: `su-assets` was the entry here when this
  // check landed, exempted because it had no build job for a filter to gate.
  // It has one now (`build-su-assets`), so the exemption went with it — which
  // is what an exemption carrying an exit condition is supposed to do.
}

type Manifest = {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function readManifest(rel: string): Manifest {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as Manifest
}

/** Workspace package name -> its directory, discovered rather than listed. */
function discoverWorkspaces(): Map<string, string> {
  const byName = new Map<string, string>()
  for (const dir of ['apps', 'packages']) {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const rel = `${dir}/${entry.name}/package.json`
      if (!existsSync(join(ROOT, rel))) continue
      const name = readManifest(rel).name
      if (name) byName.set(name, `${dir}/${entry.name}`)
    }
  }
  return byName
}

/**
 * The `filters: |` block of the `changes` job, as group name -> patterns.
 *
 * Resolves the `&shared` / `*shared` anchor by hand: an aliased entry expands
 * to every pattern of the anchored group, which is exactly what
 * `dorny/paths-filter` does with it.
 */
function parseFilters(source: string): Map<string, string[]> {
  const lines = source.split('\n')

  const filtersAt = lines.findIndex((line) => /^\s*filters:\s*\|\s*(#.*)?$/.test(line))
  if (filtersAt === -1) {
    throw new WorkflowShapeError(`no \`filters: |\` block found in ${WORKFLOW}.`)
  }

  const blockIndent = (lines[filtersAt] ?? '').search(/\S/)
  const groups = new Map<string, string[]>()
  const anchors = new Map<string, string>()
  let current: string | null = null
  let groupIndent: number | null = null

  for (let i = filtersAt + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.trim() === '' || /^\s*#/.test(line)) continue

    const indent = line.search(/\S/)
    if (indent <= blockIndent) break

    // `name:` or `name: &anchor`
    const header = line.match(/^\s*([A-Za-z0-9_-]+):\s*(?:&([A-Za-z0-9_-]+))?\s*(#.*)?$/)
    if (header && (groupIndent === null || indent === groupIndent)) {
      groupIndent = indent
      current = header[1] as string
      groups.set(current, [])
      if (header[2]) anchors.set(header[2], current)
      continue
    }

    const alias = line.match(/^\s*-\s*\*([A-Za-z0-9_-]+)\s*(#.*)?$/)
    if (alias && current) {
      const target = anchors.get(alias[1] as string)
      if (!target) {
        throw new WorkflowShapeError(
          `filter group \`${current}\` aliases unknown anchor \`*${alias[1]}\`.`
        )
      }
      groups.get(current)?.push(...(groups.get(target) ?? []))
      continue
    }

    const entry = line.match(/^\s*-\s*'([^']+)'\s*(#.*)?$/)
    if (entry && current) {
      groups.get(current)?.push(entry[1] as string)
    }
  }

  if (groups.size === 0) {
    throw new WorkflowShapeError(
      `parsed zero filter groups from ${WORKFLOW}; the block shape changed.`
    )
  }
  return groups
}

/** Does any pattern in `patterns` match files under `dir`? */
function covers(patterns: string[], dir: string): boolean {
  return patterns.some((pattern) => {
    const prefix = pattern.replace(/\/\*\*\/\*$/, '').replace(/\/\*\*$/, '')
    if (prefix === pattern) return false // not a directory glob
    if (prefix === dir) return true
    // A broader glob such as `packages/**` covers `packages/observability`.
    return dir.startsWith(`${prefix}/`)
  })
}

const workspaces = discoverWorkspaces()
const filters = parseFilters(readFileSync(join(ROOT, WORKFLOW), 'utf8'))

const apps = readdirSync(join(ROOT, 'apps'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(ROOT, 'apps', e.name, 'package.json')))
  .map((e) => e.name)
  .sort()

assertScanFloor(`${LABEL} (apps)`, apps.length, 3)
assertScanFloor(`${LABEL} (filter groups)`, filters.size, 4)

const problems: string[] = []
let checked = 0

for (const app of apps) {
  const exemption = NO_FILTER_GROUP[app]
  const group = APP_TO_FILTER[app]

  if (!group) {
    if (!exemption) {
      problems.push(
        `apps/${app} has no entry in APP_TO_FILTER and no stated exemption.\n` +
          `    Every app must either be gated by a filter group or carry a reason it is not.`
      )
    }
    continue
  }

  const patterns = filters.get(group)
  if (!patterns) {
    problems.push(
      `apps/${app} maps to filter group \`${group}\`, which does not exist in ${WORKFLOW}.`
    )
    continue
  }

  const manifest = readManifest(`apps/${app}/package.json`)
  const deps = { ...manifest.dependencies, ...manifest.devDependencies }

  for (const [name, range] of Object.entries(deps)) {
    if (!range.startsWith('workspace:')) continue
    const dir = workspaces.get(name)
    if (!dir) {
      problems.push(
        `apps/${app} depends on \`${name}\` as a workspace, but no workspace declares that name.`
      )
      continue
    }
    checked++
    if (!covers(patterns, dir)) {
      problems.push(
        `apps/${app} depends on \`${name}\` (${dir}) but filter group \`${group}\` does not cover it.\n` +
          `    A change to ${dir}/ would skip that app's build job while CI still reported green.\n` +
          `    Fix: add '${dir}/**' to \`${group}\` in ${WORKFLOW}, or to the \`shared\` anchor if\n` +
          `    more than one app depends on it.`
      )
    }
  }
}

assertScanFloor(`${LABEL} (workspace dependency edges)`, checked, 5)

if (problems.length > 0) {
  console.error(`\n✗ ${LABEL}: ${problems.length} problem(s).\n`)
  for (const problem of problems) console.error(`  • ${problem}\n`)
  console.error(
    '  `CI Success` treats a skipped job as a pass, so an uncovered dependency does\n' +
      '  not fail CI — it merges with the build job never having run. That is the\n' +
      '  #731 failure shape, and it is why this check exists.\n'
  )
  process.exit(1)
}

const exempted = Object.keys(NO_FILTER_GROUP).filter((app) => apps.includes(app))
console.log(
  `✓ path filters: ${checked} workspace dependency edge(s) across ${apps.length - exempted.length} gated app(s) ` +
    `are covered by their filter groups${exempted.length > 0 ? ` (${exempted.join(', ')} exempt)` : ''}.`
)
