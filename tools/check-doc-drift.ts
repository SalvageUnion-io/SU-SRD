#!/usr/bin/env bun

/**
 * Doc-drift guard (mechanical, narrow — 2 checks, not a general doc-linter).
 *
 * A prior campaign PR had to hand-fix docs/architecture/package-contracts.md
 * after its "Entry Points" JSON block silently fell out of sync with
 * packages/salvageunion-reference/package.json's real `exports` map (it was
 * missing the `./rules` and `./package.json` entries that had shipped after
 * the doc was written). This script extracts a fact from source and the
 * corresponding claim from docs and asserts they match, so that exact class
 * of drift fails CI instead of sitting unnoticed until the next audit.
 *
 * Checks:
 *
 *   1. package-contracts.md's "Entry Points" ```json block for
 *      salvageunion-reference must deep-equal the package's actual
 *      `package.json#exports` map.
 *   2. Every `lib/generated/*.generated.ts` file path referenced in
 *      docs/architecture/package-contracts.md, the package's own CLAUDE.md,
 *      and .claude/rules/package-development.md must exist on disk — catches
 *      the registry-codegen docs drifting from the actual generated-file
 *      layout (e.g. a generated file getting renamed/split/removed without
 *      the docs following).
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgDir = join(root, 'packages/salvageunion-reference')
const contractsDocPath = join(root, 'docs/architecture/package-contracts.md')

let failed = false

function fail(message: string): void {
  console.error(`✗ ${message}`)
  failed = true
}

// ---------------------------------------------------------------------------
// Check 1: Entry Points exports map matches package.json
// ---------------------------------------------------------------------------

function checkExportsMap(): void {
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf-8')) as {
    exports?: unknown
  }
  const actualExports = pkg.exports

  const doc = readFileSync(contractsDocPath, 'utf-8')
  const sectionMatch = doc.match(/### Entry Points\s*\n\s*```json\n([\s\S]*?)\n```/)

  if (!sectionMatch) {
    fail(
      `Could not find the "### Entry Points" \`\`\`json block in ` +
        `${relative(root, contractsDocPath)} — has the section been renamed or removed?`
    )
    return
  }

  let documentedExports: unknown
  try {
    documentedExports = JSON.parse(sectionMatch[1]!)
  } catch (err) {
    fail(
      `The "### Entry Points" \`\`\`json block in ${relative(root, contractsDocPath)} ` +
        `is not valid JSON: ${(err as Error).message}`
    )
    return
  }

  const actualStr = JSON.stringify(actualExports, null, 2)
  const documentedStr = JSON.stringify(documentedExports, null, 2)

  if (actualStr !== documentedStr) {
    fail(
      `${relative(root, contractsDocPath)}'s "Entry Points" block has drifted from ` +
        `packages/salvageunion-reference/package.json's actual "exports" map.\n\n` +
        `  package.json#exports:\n${actualStr
          .split('\n')
          .map((l) => `    ${l}`)
          .join('\n')}\n\n` +
        `  documented:\n${documentedStr
          .split('\n')
          .map((l) => `    ${l}`)
          .join('\n')}\n\n` +
        `  → update the doc's JSON block to match package.json exactly.`
    )
    return
  }

  console.log('✓ package-contracts.md "Entry Points" matches package.json#exports.')
}

// ---------------------------------------------------------------------------
// Check 2: every referenced lib/generated/*.generated.ts file exists
// ---------------------------------------------------------------------------

function checkGeneratedFileReferences(): void {
  const docsToScan = [
    'docs/architecture/package-contracts.md',
    'packages/salvageunion-reference/CLAUDE.md',
    '.claude/rules/package-development.md',
  ]

  const pattern = /lib\/generated\/[A-Za-z0-9_-]+\.generated\.ts/g
  const referenced = new Set<string>()

  for (const docPath of docsToScan) {
    const fullPath = join(root, docPath)
    if (!existsSync(fullPath)) continue
    const text = readFileSync(fullPath, 'utf-8')
    for (const match of text.matchAll(pattern)) {
      referenced.add(match[0])
    }
  }

  if (referenced.size === 0) {
    fail(
      'Expected at least one lib/generated/*.generated.ts reference across ' +
        `${docsToScan.join(', ')} — did the registry-codegen docs get rewritten ` +
        'to describe the generated files differently? Update this check to match.'
    )
    return
  }

  const missing = [...referenced].filter((rel) => !existsSync(join(pkgDir, rel)))

  if (missing.length > 0) {
    fail(
      `Docs reference generated file(s) that don't exist on disk (stale registry-codegen docs):\n` +
        missing.map((m) => `    packages/salvageunion-reference/${m}`).join('\n') +
        `\n  → run 'bun run build:package' if these should exist, or update the docs if the ` +
        `generated-file layout changed.`
    )
    return
  }

  console.log(
    `✓ All ${referenced.size} referenced lib/generated/*.generated.ts file(s) exist on disk.`
  )
}

checkExportsMap()
checkGeneratedFileReferences()

if (failed) {
  process.exit(1)
}
