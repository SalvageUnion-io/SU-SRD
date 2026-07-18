import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

// Directory of this package (tools/ -> package root).
const packageDir = resolve(import.meta.dir, '..')
const apiDtsDir = join(packageDir, '.api-dts')
const apiDtsLibDir = join(apiDtsDir, 'lib')
const etcDir = join(packageDir, 'etc')
const outputPath = join(etcDir, 'salvageunion-reference.api.d.ts')

// Locate the TypeScript 6 ("typescript-classic") compiler by walking up from
// the package dir until a node_modules/typescript-classic/bin/tsc is found.
function findTsc(): string {
  let dir = packageDir
  while (true) {
    const candidate = join(dir, 'node_modules', 'typescript-classic', 'bin', 'tsc')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(
    `Could not locate node_modules/typescript-classic/bin/tsc walking up from ${packageDir}`
  )
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

if (!existsSync(etcDir)) mkdirSync(etcDir, { recursive: true })
writeFileSync(outputPath, sections.join('\n'))

// Clean up the temporary emit dir.
rmSync(apiDtsDir, { recursive: true, force: true })

console.log(
  `Wrote API surface report: ${entries.length} declaration files -> ${relative(packageDir, outputPath)}`
)
