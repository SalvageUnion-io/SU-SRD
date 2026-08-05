/**
 * Generate the committed public-API surface report (`etc/*.api.d.ts`), which CI
 * diffs to make an API change a reviewable event rather than a silent one.
 *
 * The report is rooted at the package's PUBLIC ENTRY POINTS — the code entries
 * in `package.json#exports` — not at `lib/**\/*.ts`. A module no entry point can
 * reach has no public surface to gate, and rolling it up made the report a
 * whole-tree dump. `tsconfig.api.json` carries the same four roots in its
 * `files` array, and `assertEntryPointsMatch` below FAILS the build when the two
 * lists drift apart, so the report's scope can never quietly stop tracking what
 * the package actually exports.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

// Directory of this package (tools/ -> package root).
const packageDir = resolve(import.meta.dir, '..')
const apiDtsDir = join(packageDir, '.api-dts')
const apiDtsLibDir = join(apiDtsDir, 'lib')
const etcDir = join(packageDir, 'etc')
const outputPath = join(etcDir, 'salvageunion-reference.api.d.ts')

/**
 * The code entry points declared in `package.json#exports`, as package-relative
 * paths (`lib/index.ts`, …). Data/schema JSON globs and `./package.json` are not
 * code and carry no type surface, so they are skipped.
 */
function packageEntryPoints(): string[] {
  const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as {
    exports?: Record<string, unknown>
  }
  const out = new Set<string>()
  for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
    if (subpath.includes('*')) continue
    const types =
      target && typeof target === 'object'
        ? (target as Record<string, unknown>).types
        : typeof target === 'string'
          ? target
          : undefined
    if (typeof types !== 'string' || !types.endsWith('.ts')) continue
    out.add(types.replace(/^\.\//, ''))
  }
  return [...out].sort()
}

/**
 * The report's scope is only meaningful if `tsconfig.api.json`'s roots ARE the
 * package's public entry points. Adding an export to `package.json` without
 * adding it here would silently leave the new surface ungated.
 */
function assertEntryPointsMatch(): string[] {
  const entries = packageEntryPoints()
  const tsconfig = JSON.parse(readFileSync(join(packageDir, 'tsconfig.api.json'), 'utf8')) as {
    files?: string[]
  }
  const roots = [...(tsconfig.files ?? [])].sort()
  if (roots.join('\n') !== entries.join('\n')) {
    throw new Error(
      'tsconfig.api.json "files" has drifted from package.json "exports".\n' +
        `  package.json entry points: ${entries.join(', ') || '(none)'}\n` +
        `  tsconfig.api.json files:   ${roots.join(', ') || '(none)'}\n` +
        'Make them identical — the API report gates exactly the public entry points.'
    )
  }
  return entries
}

// Locate the TypeScript compiler by walking up from the package dir until a
// node_modules/typescript/bin/tsc is found.
//
// This uses the repo's real TypeScript (7.x), NOT the `typescript-classic`
// alias it used to reach for. Only the tsc *binary* is needed here — the
// program is driven entirely through `--project`, never the compiler API — and
// TS 7 emits byte-identical declarations for this project, so there was no
// reason to keep a second compiler alive for it. (`tools/check-architecture.ts`
// is a different story: it needs the classic compiler API, which TS 7 does not
// expose. See the note on `typescript-classic` in the root package.json.)
function findTsc(): string {
  let dir = packageDir
  while (true) {
    const candidate = join(dir, 'node_modules', 'typescript', 'bin', 'tsc')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`Could not locate node_modules/typescript/bin/tsc walking up from ${packageDir}`)
}

// Recursively collect every *.d.ts under a directory, excluding *.test.d.ts.
function collectDeclarations(root: string): string[] {
  const out: string[] = []
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith('.d.ts') && !entry.name.endsWith('.test.d.ts')) {
        out.push(full)
      }
    }
  }
  walk(root)
  return out
}

// The report's scope must be the package's public entry points — checked before
// anything is emitted, so a drifted scope fails loudly instead of quietly
// producing a report that gates the wrong thing.
const entryPoints = assertEntryPointsMatch()

// Fresh emit dir each run.
if (existsSync(apiDtsDir)) rmSync(apiDtsDir, { recursive: true, force: true })

const tsc = findTsc()
try {
  execFileSync(process.execPath, [tsc, '--project', 'tsconfig.api.json'], {
    cwd: packageDir,
    stdio: 'inherit',
  })
} catch {
  // TS6 still emits declarations even when unrelated files report errors.
  // Only treat this as fatal if no declarations were produced (checked below).
}

if (!existsSync(apiDtsLibDir)) {
  throw new Error(
    `Declaration emit produced no output at ${apiDtsLibDir} — cannot build API report.`
  )
}

const files = collectDeclarations(apiDtsLibDir)
if (files.length === 0) {
  throw new Error(`No .d.ts files found under ${apiDtsLibDir} — cannot build API report.`)
}

// Sort by relative-from-.api-dts path, raw string (locale-independent),
// normalizing separators so output is stable across platforms.
const entries = files
  .map((abs) => ({
    rel: relative(apiDtsDir, abs).split(sep).join('/'),
    abs,
  }))
  .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))

const sections = entries.map(
  (entry) => `// === ${entry.rel} ===\n${readFileSync(entry.abs, 'utf8')}`
)

// Name the roots in the report itself: a reviewer reading a diff needs to know
// what surface this file claims to describe without opening the tool.
const header =
  '// PUBLIC API SURFACE REPORT — generated by tools/generateApiReport.ts. Do not edit.\n' +
  '// Rooted at the code entry points in package.json#exports:\n' +
  entryPoints.map((e) => `//   ${e}\n`).join('') +
  '// Every section below is a declaration file reachable from one of those roots.\n'

if (!existsSync(etcDir)) mkdirSync(etcDir, { recursive: true })
writeFileSync(outputPath, header + sections.join('\n'))

// Clean up the temporary emit dir.
rmSync(apiDtsDir, { recursive: true, force: true })

console.log(
  `Wrote API surface report: ${entries.length} declaration files -> ${relative(packageDir, outputPath)}`
)
