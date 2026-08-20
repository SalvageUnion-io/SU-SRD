#!/usr/bin/env bun
/**
 * check-action-pinning — every third-party GitHub Action must be SHA-pinned.
 *
 * This repo already refuses dependency versions published less than three days
 * ago (`bunfig.toml`'s `minimumReleaseAge`), on the stated reasoning that a
 * grouped Dependabot PR is reviewed by glancing at version numbers and nobody
 * reads tarballs. That control covers npm and stops at the workflow file.
 *
 * Meanwhile `oven-sh/setup-bun@v2` — a mutable tag on a third-party repo —
 * installed the toolchain in all eleven CI jobs, and `release-please-action@v5`
 * ran with `contents: write`, `pull-requests: write` AND a PAT whose scopes are
 * not bounded by the workflow's `permissions:` block. Retagging either one is
 * arbitrary code execution in this repo's runners. Exactly one of the four
 * third-party actions was pinned, and it was the lowest-privilege of them, so
 * the reasoning had been applied once rather than adopted.
 *
 * The gap got sharper with ADR-033: `deploy-cloudflare.yml` reaches the same
 * unpinned composite while holding CLOUDFLARE_API_TOKEN, CONVEX_DEPLOY_KEY and
 * SENTRY_AUTH_TOKEN — a mutable third-party tag standing directly in front of
 * production deploy credentials.
 *
 * A tag is a pointer. A SHA is the artifact. Dependabot updates SHA pins
 * natively (`github-actions` ecosystem), so this costs nothing ongoing.
 *
 * FIRST-PARTY actions are exempt: `actions/*` and `github/*` are published by
 * GitHub itself from the same trust boundary that runs the workflow, and
 * pinning them buys nothing against an attacker who already controls that. This
 * is the conventional line, and drawing it here keeps the rule enforceable
 * rather than aspirational — a rule that flags 25 `actions/checkout@v7` lines
 * gets switched off.
 *
 * Usage: bun tools/check-action-pinning.ts
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Owners published by GitHub itself; a mutable tag here is not a third-party risk. */
const FIRST_PARTY_OWNERS = new Set(['actions', 'github'])

/** A 40-character hex commit SHA — the only acceptable pin. */
const SHA_PIN = /^[0-9a-f]{40}$/

type Unpinned = {
  file: string
  line: number
  ref: string
}

/**
 * Every workflow plus every composite action.
 *
 * Composite actions are the half that is easy to miss and was in fact missed:
 * `.github/actions/setup-bun/action.yml` is where `oven-sh/setup-bun` actually
 * lives, so a scan of `workflows/` alone reports a clean tree while the action
 * that installs the toolchain for every job is unpinned. A workflow's `uses:`
 * of a LOCAL composite (`./.github/actions/...`) is not itself a finding — but
 * whatever that composite uses is.
 */
function workflowFiles(root: string): string[] {
  const files: string[] = []

  const workflowDir = join(root, '.github', 'workflows')
  for (const name of readdirSync(workflowDir)) {
    if (name.endsWith('.yml') || name.endsWith('.yaml')) {
      files.push(join('.github', 'workflows', name))
    }
  }

  const actionsDir = join(root, '.github', 'actions')
  for (const entry of readdirSync(actionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    for (const name of readdirSync(join(actionsDir, entry.name))) {
      if (name === 'action.yml' || name === 'action.yaml') {
        files.push(join('.github', 'actions', entry.name, name))
      }
    }
  }

  return files.sort()
}

/**
 * Pull every `bunx <tool>` invocation out of one file.
 *
 * A bare `bunx wrangler` resolves whatever npm published most recently, at the
 * moment it runs. `deploy-cloudflare.yml` did that four times in the job
 * holding CLOUDFLARE_API_TOKEN, CONVEX_DEPLOY_KEY and SENTRY_AUTH_TOKEN, while
 * three `wrangler.jsonc` files asserted "this repo's wrangler (4.108)" — a
 * claim nothing made true.
 *
 * `bunx convex deploy` in the same file is CORRECT and must keep passing: it
 * resolves the pinned `convex` from `apps/itun/package.json` because the step
 * sets a `working-directory` inside that workspace. So the rule is not "every
 * bunx must carry an @version" — it is that a tool with no local manifest entry
 * must. `LOCALLY_RESOLVED` records which those are.
 */
const LOCALLY_RESOLVED = new Set(['convex', 'lefthook', 'playwright', 'biome'])

function bunxCalls(contents: string): { line: number; tool: string }[] {
  const found: { line: number; tool: string }[] = []
  contents.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (line.startsWith('#')) return
    for (const m of line.matchAll(/\bbunx\s+(?:--[\w-]+\s+)*([@\w./-]+)/g)) {
      const tool = m[1]
      if (tool !== undefined) found.push({ line: i + 1, tool })
    }
  })
  return found
}

/** `wrangler@4.108.0` is pinned; `wrangler` is not. A scoped name keeps its leading @. */
function bunxIsPinned(tool: string): boolean {
  const at = tool.lastIndexOf('@')
  return at > 0
}

function bunxBaseName(tool: string): string {
  const at = tool.lastIndexOf('@')
  return at > 0 ? tool.slice(0, at) : tool
}

/**
 * Pull every `uses:` reference out of one file.
 *
 * Comment lines are stripped first. These workflows explain themselves at
 * length and mention action names in prose; a scan that counted commentary
 * would report findings nobody can fix, and — worse — could be satisfied by a
 * comment after the real reference was deleted.
 */
function usesRefs(contents: string): { line: number; ref: string }[] {
  const found: { line: number; ref: string }[] = []
  contents.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (line.startsWith('#')) return
    const match = line.match(/^-?\s*uses:\s*(\S+)/)
    const ref = match?.[1]
    if (ref !== undefined) found.push({ line: i + 1, ref })
  })
  return found
}

function isThirdParty(ref: string): boolean {
  // `./.github/actions/x` — a local composite in this repo, not a supply chain.
  if (ref.startsWith('./') || ref.startsWith('.\\')) return false
  // `docker://…` is a different mechanism with its own digest story.
  if (ref.startsWith('docker://')) return false
  const owner = ref.split('/')[0] ?? ''
  return !FIRST_PARTY_OWNERS.has(owner)
}

function refPin(ref: string): string {
  const at = ref.lastIndexOf('@')
  return at === -1 ? '' : ref.slice(at + 1)
}

function main(): void {
  const root = process.cwd()
  const unpinned: Unpinned[] = []
  const unpinnedTools: Unpinned[] = []
  let thirdPartyCount = 0
  let bunxCount = 0
  let scanned = 0

  for (const file of workflowFiles(root)) {
    scanned += 1
    const contents = readFileSync(join(root, file), 'utf8')
    for (const { line, ref } of usesRefs(contents)) {
      if (!isThirdParty(ref)) continue
      thirdPartyCount += 1
      if (!SHA_PIN.test(refPin(ref))) unpinned.push({ file, line, ref })
    }
    for (const { line, tool } of bunxCalls(contents)) {
      if (LOCALLY_RESOLVED.has(bunxBaseName(tool))) continue
      bunxCount += 1
      if (!bunxIsPinned(tool)) unpinnedTools.push({ file, line, ref: `bunx ${tool}` })
    }
  }

  // Scan floor. Without one this check passes loudest when it is most broken:
  // rename `.github/workflows` and it would report a clean tree having read
  // nothing. `tools/lib/scanFloor.ts` exists because four other gates in this
  // repo had the same hole. The floor is deliberately well below the real count
  // so it asserts "the scan happened" rather than freezing today's inventory.
  if (scanned < 5) {
    console.error(
      `✗ action pinning: only ${scanned} workflow file(s) scanned — expected at least 5. ` +
        `The scan is not reaching .github/; a pass here would mean nothing.`
    )
    process.exit(1)
  }

  if (unpinnedTools.length > 0) {
    console.error('\n✗ a `bunx` tool with no local manifest entry must carry an exact version:\n')
    for (const { file, line, ref } of unpinnedTools) {
      console.error(`  ${file}:${line}  ${ref}`)
    }
    console.error(
      `\n  Unpinned, this resolves whatever npm published most recently — in a job\n` +
        `  that holds this repo's deploy credentials. Write it as \`bunx tool@X.Y.Z\`,\n` +
        `  or add the tool to the manifest so bunx resolves it from the lockfile.\n`
    )
    process.exit(1)
  }

  if (unpinned.length > 0) {
    console.error('\n✗ third-party actions must be pinned to a full commit SHA:\n')
    for (const { file, line, ref } of unpinned) {
      console.error(`  ${file}:${line}  ${ref}`)
    }
    console.error(
      `\n  A tag is a mutable pointer: whoever controls that repo can retarget it, and\n` +
        `  these run in jobs holding this repo's credentials. Resolve each to a commit:\n\n` +
        `    gh api repos/<owner>/<repo>/git/ref/tags/<tag> --jq '.object.sha'\n\n` +
        `  then write it as \`<owner>/<repo>@<sha> # <version>\`. Dependabot updates SHA\n` +
        `  pins natively, so this costs nothing to keep current.\n`
    )
    process.exit(1)
  }

  console.log(
    `✓ supply-chain pinning: ${thirdPartyCount} third-party action reference(s) SHA-pinned ` +
      `and ${bunxCount} bunx tool invocation(s) version-pinned across ${scanned} workflow file(s).`
  )
}

main()
