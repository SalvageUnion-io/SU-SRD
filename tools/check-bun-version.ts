#!/usr/bin/env bun

/**
 * Bun-version drift check.
 *
 * `.bun-version` is the single source of truth for the Bun this repo builds and
 * tests on. This fails `bun run check` whenever a surface disagrees with it.
 *
 * ## What changed when Netlify was deleted, and why this file survived
 *
 * It used to check three `netlify.toml` files, each of which pinned
 * `BUN_VERSION` independently — and they HAD drifted, with CI testing 1.3.10
 * while ITUN production built on 1.3.14. su-assets was worse: it carried no pin
 * at all and silently built on whatever Netlify's default happened to be, which
 * is why "the file exists but carries no pin" fails as `(missing)` rather than
 * being skipped.
 *
 * All three files are now gone. That left this guard asserting one thing — the
 * root `bun-types` devDependency — while printing a cheerful
 * `0 Netlify site(s)`: a check that passes by having nothing left to check,
 * which is the failure mode this repo has shipped before and written down.
 *
 * So it was repointed rather than deleted. The claim its old docstring made —
 * *"builds run in GitHub Actions, which reads `.bun-version` via setup-bun, so
 * CI cannot drift by construction"* — is true only while every workflow
 * actually uses that composite action. That is now the thing asserted.
 *
 * ## The two surfaces
 *
 *   - **`bun-types`** in the root manifest. It must track `.bun-version`
 *     exactly; `bunfig.toml` even excludes it from `minimumReleaseAge` for that
 *     reason.
 *   - **Every workflow's Bun setup.** A job that pins a version inline instead
 *     of using `./.github/actions/setup-bun` is exactly the drift the old
 *     Netlify check existed to catch, relocated to where builds now happen.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const expected = readFileSync(join(root, '.bun-version'), 'utf-8').trim()

const failures: string[] = []

// ---------------------------------------------------------------------------
// Surface 1 — bun-types must track .bun-version exactly.
// ---------------------------------------------------------------------------

const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as {
  devDependencies?: Record<string, string>
}
const bunTypes = rootPkg.devDependencies?.['bun-types']

if (!bunTypes) {
  failures.push('root package.json declares no bun-types')
} else if (bunTypes.replace(/^[^0-9]*/, '') !== expected) {
  failures.push(`root bun-types = ${bunTypes}, expected ${expected}`)
}

// ---------------------------------------------------------------------------
// Surface 2 — no workflow may pin Bun by hand.
//
// The composite action reads `.bun-version` via `bun-version-file`, so a job
// using it cannot drift. A job that writes `bun-version: 1.2.3` instead CAN,
// and would do it silently — CI would simply test a Bun nothing else uses.
// ---------------------------------------------------------------------------

const WORKFLOW_DIR = join(root, '.github', 'workflows')
const SETUP_BUN_ACTION = './.github/actions/setup-bun'
/** `bun-version: 1.2.3` — a literal pin. `bun-version-file:` is fine and is not matched. */
const INLINE_PIN = /^\s*bun-version:\s*["']?(\d[^"'\s]*)/gm

const workflows = existsSync(WORKFLOW_DIR)
  ? readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  : []

if (workflows.length === 0) {
  // Refusing to pass by absence: no workflows means this half asserted nothing,
  // and silence would read exactly like success.
  failures.push('no workflow files found — this check would pass by doing nothing')
}

let usingComposite = 0

for (const file of workflows) {
  const contents = readFileSync(join(WORKFLOW_DIR, file), 'utf-8')
  if (contents.includes(SETUP_BUN_ACTION)) usingComposite += 1

  for (const match of contents.matchAll(INLINE_PIN)) {
    const pinned = match[1]
    if (pinned !== expected) {
      failures.push(
        `.github/workflows/${file} pins bun-version ${pinned}, expected ${expected} — ` +
          `use ${SETUP_BUN_ACTION}, which reads .bun-version.`
      )
    } else {
      failures.push(
        `.github/workflows/${file} pins bun-version by hand. It happens to match today, ` +
          `but it will not track .bun-version — use ${SETUP_BUN_ACTION}.`
      )
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ Bun version drift:\n${failures.map((f) => `    ${f}`).join('\n')}`)
  console.error(`\n  .bun-version says ${expected}. Update the surface, not this file.`)
  process.exit(1)
}

console.log(
  `✓ Bun ${expected} — bun-types matches, ${workflows.length} workflow(s) checked, ` +
    `${usingComposite} using ${SETUP_BUN_ACTION}, none pinning by hand.`
)
