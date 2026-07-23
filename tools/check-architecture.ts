#!/usr/bin/env bun

/**
 * Guards the "no module-scope SalvageUnionReference accessor calls"
 * invariant described in docs/architecture/package-contracts.md under
 * "Module-Scope ORM Call Risk": calling a model accessor (e.g.
 * `SalvageUnionReference.Chassis.all()`) or a generic data accessor (e.g.
 * `.get()`, `.search()`) at module/import time — before any consumer has had
 * a chance to call `preload()` — throws "Schema not loaded" and takes the
 * whole module down with a stack trace far from the real cause.
 *
 * Why this is a script and not a Biome GritQL plugin rule: Biome 2.5.3
 * ships a GritQL-based plugin system, and its simple snippet patterns work
 * for single-level member calls (`console.log($msg)` matches and can be
 * scope-restricted). But this rule needs two things GritQL's snippet syntax
 * could not be made to do here:
 *
 *   1. Match a *two-level* member-call chain — `SalvageUnionReference.
 *      Chassis.all($$$)`. Empirically, `` `a.b.c($$$args)` `` never matched
 *      even the most literal three-identifier call chain in this Biome
 *      version, while `` `a.b($$$args)` `` matched fine. This isn't
 *      documented as a known limitation anywhere; it's a finding from
 *      direct testing (see PR description for the repro).
 *   2. Exclude matches nested inside a function body. GritQL supports a
 *      `not within <pattern>` combinator in principle, but a
 *      `` not within `function $_($$$) { $$$ }` `` guard did not exclude a
 *      `console.log` call actually nested inside a `function ok() { ... }`
 *      in local testing — it fired on both the module-scope and the
 *      function-scoped call, i.e. the ancestor pattern never matched the
 *      real `FunctionDeclaration` node it was meant to describe.
 *
 * Both problems are exactly the kind of static-scope-analysis question a
 * real AST walk answers precisely, so this script uses the TypeScript
 * compiler API (already a repo devDependency) to walk each file's AST once
 * and flag any `SalvageUnionReference.*` accessor call with no
 * function-like ancestor between it and the top of the file.
 *
 * Exemptions (see inline comments below for the specific rationale on each):
 *   - `.preload()` / `.isLoaded()` — the lifecycle bootstrap methods the
 *     whole preload contract exists to call eagerly at module scope
 *     (apps/srd/src/lib/gameData.ts, apps/discord-bot/src/index.ts).
 *   - `**\/*.stories.tsx` — Ladle fixtures deliberately read accessors at
 *     module top level; safe because Ladle only evaluates a story's module
 *     after `.ladle/components.tsx`'s `PreloadGate` resolves, since Ladle
 *     dynamically imports each story chunk lazily. Documented in that
 *     file's own comment.
 *   - `**\/*.test.ts(x)`, `**\/__tests__\/**`, `**\/e2e\/**` — test files run
 *     after each package's bunfig `preload` script (see
 *     package-contracts.md, "Test Preload Setup"), so module-scope access is
 *     already safe by construction there.
 *   - `**\/test\/**` — the bunfig preload bootstrap files themselves (e.g.
 *     `test/preload-reference.ts`) intentionally call `preload()` at module
 *     scope; already covered by the lifecycle exemption above, but excluded
 *     wholesale since that directory only ever contains bootstrap code.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
// `typescript-classic` is an npm alias for typescript@6 (see root package.json).
// TypeScript 7's package no longer exposes the classic compiler API this tool
// walks (`ts.createSourceFile`, `ts.ScriptTarget`, `ts.isFunctionDeclaration`,
// `ts.forEachChild`, …) — they are all undefined on the TS7 default export — so
// this AST-walking tool stays on the TS6 API until it's migrated. The rest of
// the monorepo type-checks on TS7.
import ts from 'typescript-classic'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const INCLUDE_GLOBS = [
  'apps/itun/src/**/*.{ts,tsx}',
  'apps/srd/src/**/*.{ts,tsx}',
  'apps/discord-bot/src/**/*.ts',
  'packages/component-lib/src/**/*.{ts,tsx}',
  'packages/salvageunion-reference/lib/**/*.ts',
]

const EXCLUDE_PATTERNS: RegExp[] = [
  /\.test\.tsx?$/,
  /\.stories\.tsx$/,
  /(^|\/)__tests__\//,
  /(^|\/)test\//,
  /(^|\/)e2e\//,
  /(^|\/)generated\//,
]

// The lifecycle bootstrap methods themselves — calling these at module scope
// is the documented, correct way to eagerly bootstrap data loading, not the
// anti-pattern this check guards against.
const LIFECYCLE_EXEMPT = new Set(['preload', 'isLoaded'])

type Violation = { file: string; line: number; snippet: string }

function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  )
}

/** True if `callee` is `SalvageUnionReference.<x>(...)` or
 * `SalvageUnionReference.<Model>.<method>(...)`. */
function isSalvageUnionReferenceAccessorCallee(callee: ts.Expression): boolean {
  if (!ts.isPropertyAccessExpression(callee)) return false

  // Single level: SalvageUnionReference.<method>(...)
  if (ts.isIdentifier(callee.expression) && callee.expression.text === 'SalvageUnionReference') {
    return !LIFECYCLE_EXEMPT.has(callee.name.text)
  }

  // Two level: SalvageUnionReference.<Model>.<method>(...)
  const inner = callee.expression
  if (
    ts.isPropertyAccessExpression(inner) &&
    ts.isIdentifier(inner.expression) &&
    inner.expression.text === 'SalvageUnionReference'
  ) {
    return true
  }

  return false
}

function checkFile(filePath: string): Violation[] {
  const text = readFileSync(filePath, 'utf-8')
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const violations: Violation[] = []

  function visit(node: ts.Node, insideFunction: boolean) {
    if (ts.isCallExpression(node) && !insideFunction) {
      if (isSalvageUnionReferenceAccessorCallee(node.expression)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        violations.push({
          file: relative(root, filePath),
          line: line + 1,
          snippet: node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 100),
        })
      }
    }

    const nextInsideFunction = insideFunction || isFunctionLike(node)
    ts.forEachChild(node, (child) => visit(child, nextInsideFunction))
  }

  visit(sourceFile, false)
  return violations
}

async function collectFiles(): Promise<string[]> {
  const files = new Set<string>()
  for (const pattern of INCLUDE_GLOBS) {
    const glob = new Bun.Glob(pattern)
    for await (const file of glob.scan({ cwd: root, absolute: true })) {
      const rel = relative(root, file)
      if (EXCLUDE_PATTERNS.some((p) => p.test(rel))) continue
      files.add(file)
    }
  }
  return [...files]
}

async function main() {
  const files = await collectFiles()
  const violations = files.flatMap(checkFile)

  if (violations.length > 0) {
    console.error(`✗ Found ${violations.length} module-scope SalvageUnionReference call(s):\n`)
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}`)
      console.error(`    ${v.snippet}`)
    }
    console.error(
      '\n  These execute at import time, before preload() has run, and will throw ' +
        '"Schema not loaded" the instant the module is imported.\n' +
        "  Move the call inside a function, hook, or effect that runs after the app's " +
        'preload bootstrap — see docs/architecture/package-contracts.md, "Module-Scope ORM Call Risk".'
    )
    process.exit(1)
  }

  console.log(
    `✓ No module-scope SalvageUnionReference accessor calls (${files.length} files checked).`
  )
}

main()
