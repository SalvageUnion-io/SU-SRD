/**
 * A repo-wide gate must prove it looked at every workspace, not just at *a* tree.
 *
 * ## Why this exists, and why `assertScanFloor` is not enough
 *
 * `tools/lib/scanFloor.ts` catches a scanned directory that was RENAMED, MOVED
 * or DELETED — the count collapses and the floor trips. It is structurally
 * blind to the opposite failure: a workspace that was never in the list at all.
 * Adding a workspace only makes the count go UP, so the floor is satisfied
 * while the new surface is silently unguarded. Its own docstring says as much:
 * a catastrophe detector, not a coverage target.
 *
 * That blind spot has already cost this repo once, and the incident is worth
 * restating because it is the exact shape this helper exists to prevent.
 * `tools/check-observability.ts` stayed green across the entire Cloudflare
 * cutover while all three production Workers reported to nothing but
 * `console.error` — because the checker had no notion of a Worker. A guard that
 * does not know about a surface cannot fail for it.
 *
 * At the time of writing the same pattern survived in four more places:
 * `check-design-tokens` (SCAN_DIRS), `check-architecture` (INCLUDE_GLOBS),
 * `check-styling-ownership` (APP_DIRS) and `coverage-report` (WORKSPACES) all
 * predate `apps/su-assets` and `packages/observability`, and all four silently
 * omitted them.
 *
 * ## The contract
 *
 * Every directory under `apps/` and `packages/` that carries a `package.json`
 * must either be covered by the caller's scan set, or appear in `exemptions`
 * WITH A STATED REASON. There is deliberately no third option and no silent
 * default: an unrecognised workspace is a hard failure, so adding a fifth app
 * fails every adopting gate until someone decides, in writing, whether it
 * belongs.
 *
 * An exemption is a decision, not a snooze button. Prefer scanning the
 * workspace — most of these gates cost milliseconds per directory. Reach for an
 * exemption only when the gate genuinely cannot apply (a Worker with no UI has
 * no design tokens to check), and say that in the reason.
 */

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')

/** Every workspace directory, discovered rather than listed. */
export function discoverWorkspaceDirs(): string[] {
  const found: string[] = []
  for (const dir of ['apps', 'packages']) {
    const base = join(ROOT, dir)
    if (!existsSync(base)) continue
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (existsSync(join(base, entry.name, 'package.json'))) found.push(`${dir}/${entry.name}`)
    }
  }
  return found.sort()
}

/**
 * Assert that `scanned` reaches every workspace, or that the gaps are declared.
 *
 * `scanned` holds repo-relative paths — directories or globs, as the calling
 * gate happens to express them. A workspace counts as covered when some entry
 * is that workspace directory or sits beneath it, so `apps/srd/src` and
 * `apps/srd/src/**\/*.tsx` both cover `apps/srd`.
 */
export function assertCoversWorkspaces(
  label: string,
  scanned: readonly string[],
  exemptions: Readonly<Record<string, string>> = {}
): void {
  const workspaces = discoverWorkspaceDirs()

  if (workspaces.length === 0) {
    console.error(`\n✗ ${label}: found no workspaces under apps/ or packages/.`)
    console.error(
      '  This check could not read the repo layout, so its result would be meaningless.\n'
    )
    process.exit(1)
  }

  const normalised = scanned.map((entry) => entry.replace(/\/\*\*.*$/, '').replace(/\/$/, ''))
  const uncovered = workspaces.filter(
    (ws) => !normalised.some((entry) => entry === ws || entry.startsWith(`${ws}/`))
  )

  const undeclared = uncovered.filter((ws) => !(ws in exemptions))
  const stale = Object.keys(exemptions).filter((ws) => !uncovered.includes(ws))

  if (undeclared.length === 0 && stale.length === 0) return

  console.error(`\n✗ ${label}: workspace coverage is not accounted for.\n`)

  for (const ws of undeclared) {
    console.error(
      `  • ${ws} is not scanned by this gate and has no stated exemption.\n` +
        `    Either add it to the scan set, or add it to this gate's exemption map with\n` +
        `    a reason the gate cannot apply to it. A workspace the gate cannot see is a\n` +
        `    workspace it can never fail for.\n`
    )
  }

  for (const ws of stale) {
    console.error(
      `  • ${ws} carries an exemption but IS now covered by the scan set.\n` +
        `    Remove the exemption — a stale one hides the next real gap behind it.\n`
    )
  }

  process.exit(1)
}
