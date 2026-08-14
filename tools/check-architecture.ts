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
// This file is now its ONLY consumer — `generateApiReport.ts`, the other one,
// moved to the repo's TypeScript 7 because it only ever needed the `tsc` binary.
//
// This tool cannot follow, and the reason is structural rather than a pending
// chore. TypeScript 7's `typescript` package exports `./lib/version.cjs` as `.`,
// so the default export carries no compiler at all (`ts.createProgram` and
// friends are `undefined`). What it does ship is a new, explicitly-unstable API:
//   - `typescript/unstable/ast` has the enums and every `isXxx` predicate this
//     file uses — but NOT `createSourceFile` or `forEachChild`.
//   - `typescript/unstable/sync` is Project/Snapshot-based (`API`, `Project`,
//     `NodeHandle`). There is no "parse this one file and walk it" entry point.
// Porting therefore means rewriting a fast, standalone, per-file AST walk as a
// project load against an API whose own module path says `unstable`. Checked
// against typescript@7.0.2, not assumed. Revisit when that API stabilises.
import ts from 'typescript-classic'
import { assertScanFloor } from './lib/scanFloor'

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

type Violation = { file: string; line: number; snippet: string; rule: RuleId }

type RuleId = 'module-scope-orm' | 'inline-pool-default'

/**
 * "An unset pool means FULL" — the rule `resolvePool` / `resolveGauge` own
 * (salvageunion-reference/lib/rules/derivedStats.ts).
 *
 * It was written out at ~36 sites in ITUN and once more in the Discord bot,
 * with no shared definition anywhere: `Math.min(pilot.currentHP ?? maxHP, maxHP)`
 * for a pool, `?? 0` for Heat, which inverts. One missed `?? max` renders a
 * healthy pilot at 0 HP; one wrong default puts a cold mech at its Heat
 * Capacity. Nothing failed when they disagreed.
 *
 * The tell is `?? ` applied directly to a `current*` property: the resolvers
 * take the raw value, so a correct call site has no `??` at all. Detected on
 * the AST rather than by regex so a line break or a comment cannot hide it.
 *
 * Biome would be the natural home, but `noRestrictedSyntax` does not exist in
 * the pinned version (2.5.x) — checked, not assumed: it rejects the key
 * outright and `biome explain` reports "Unrecognized option". This tool already
 * walks every file's AST, so the rule lives here instead.
 */
const POOL_FIELD = /^current[A-Z]/

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
          rule: 'module-scope-orm',
        })
      }
    }

    // `<something>.currentX ?? <fallback>` — the inlined pool rule.
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
      ts.isPropertyAccessExpression(node.left) &&
      POOL_FIELD.test(node.left.name.text) &&
      // A STRING fallback is a display decision, not the pool rule: `?? '—'`
      // deliberately renders "unknown" rather than resolving to a number, which
      // is a legitimate thing for a projection-fed readout to do. Only a
      // numeric/computed fallback is the rule being inlined.
      !ts.isStringLiteral(node.right) &&
      !ts.isNoSubstitutionTemplateLiteral(node.right)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      violations.push({
        file: relative(root, filePath),
        line: line + 1,
        snippet: node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 100),
        rule: 'inline-pool-default',
      })
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

/**
 * Catastrophe floor for the five globs in `collectFiles`. 584 files today; a
 * renamed app or package directory is what this catches. See tools/lib/scanFloor.ts.
 */
const SCAN_FLOOR = 400

const RULE_EXPLANATION: Record<RuleId, string> = {
  'module-scope-orm':
    'These execute at import time, before preload() has run, and will throw\n' +
    '  "Schema not loaded" the instant the module is imported.\n' +
    "  Move the call inside a function, hook, or effect that runs after the app's\n" +
    '  preload bootstrap — see docs/architecture/package-contracts.md, "Module-Scope ORM Call Risk".',
  'inline-pool-default':
    'This inlines the "an unset pool means FULL" rule instead of using it.\n' +
    "  Use resolvePool(entity.currentX, maxX) from 'salvageunion-reference/rules' —\n" +
    '  or resolveGauge for Heat, which defaults to EMPTY, not full. Both take the raw\n' +
    '  `current*` value, so a correct call site has no `??` at all.\n\n' +
    '  Written out per-site, this is one keystroke from rendering an undamaged pilot\n' +
    '  at 0 HP, or a cold mech at its Heat Capacity — and nothing fails when two\n' +
    '  surfaces disagree about which.',
}

const RULE_HEADLINE: Record<RuleId, string> = {
  'module-scope-orm': 'module-scope SalvageUnionReference call(s)',
  'inline-pool-default': 'inlined pool/gauge default(s)',
}

async function main() {
  const files = await collectFiles()
  assertScanFloor('architecture', files.length, SCAN_FLOOR)
  const violations = files.flatMap(checkFile)

  if (violations.length > 0) {
    for (const rule of Object.keys(RULE_HEADLINE) as RuleId[]) {
      const hits = violations.filter((v) => v.rule === rule)
      if (hits.length === 0) continue
      console.error(`✗ Found ${hits.length} ${RULE_HEADLINE[rule]}:\n`)
      for (const v of hits) {
        console.error(`  ${v.file}:${v.line}`)
        console.error(`    ${v.snippet}`)
      }
      console.error(`\n  ${RULE_EXPLANATION[rule]}\n`)
    }
    process.exit(1)
  }

  console.log(
    `✓ No module-scope ORM calls, no inlined pool defaults (${files.length} files checked).`
  )
}

main()
