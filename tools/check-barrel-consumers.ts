#!/usr/bin/env bun
/**
 * check-barrel-consumers — component-lib exports what the apps render, and
 * holds no app's own compositions.
 *
 * `docs/ARCHITECTURE.md#component-lib` says code only one app renders lives in
 * that app. Audit 4 (#1168) found that rule was prose that nothing enforced:
 * roughly half the barrel was rendered by one app, and the wizard shell, the
 * sheet edit controls, the masthead and its menu, the roster row and the about
 * page all sat in the library although only ITUN renders them.
 *
 * A single consumer is not wrong by itself. A design-system primitive (an
 * Atom, a Container, a Foundations page) is the library's to own however many
 * apps render it today. What belongs in the app is a COMPOSITION only that app
 * renders: a product surface assembled from those primitives. The catalog
 * already files every public component under one of those groups (its
 * co-located story's meta title, held to the taxonomy by
 * `packages/component-lib/src/story-coverage.test.ts`), so this check reads
 * the group from there rather than keeping a second list.
 *
 * Fails:
 *   1. an export that no app's shipped source imports (a test or story does
 *      not count): unexport it, or delete it;
 *   2. an export only one app reaches whose co-located story files it under
 *      `Compositions/`: move it into `apps/<app>/src/components/`;
 *   3. a single-app export with no co-located story to classify it (a helper,
 *      a hook) that `SINGLE_APP` does not list with a reason;
 *   4. a `SINGLE_APP` entry that no longer names a storyless single-app export.
 *
 * "Reaches" is transitive. An app reaches an export when it imports any export
 * whose module graph inside the library contains that export's module: srd
 * imports `ReferenceEntityCard`, which renders `Card`, so srd reaches `Card`
 * though it never names it. The apps are every workspace whose manifest
 * depends on `component-lib`; their `src/` and `ssg/` trees are scanned.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { assertScanFloor } from './lib/scanFloor'

const ROOT = join(import.meta.dir, '..')
const LIB_SRC = join(ROOT, 'packages/component-lib/src')
const BARREL = join(LIB_SRC, 'index.ts')

/** Source trees of a consuming workspace that ship. */
const APP_SOURCE_DIRS = ['src', 'ssg']

/** Story groups whose members the library owns, whoever renders them. */
const PRIMITIVE_GROUPS = new Set(['Atoms', 'Containers', 'Foundations'])

/**
 * Storyless exports one app reaches, and why each is the library's. Only an
 * export with no co-located story belongs here: a component is classified by
 * its story's group, never by an entry in this list.
 */
const SINGLE_APP: Readonly<Record<string, string>> = {
  heatDangerFrom:
    "the pip index where a heat track turns red: the input to `VitalGauge`'s `danger` prop",
  linesFromBreakdown:
    "turns the rules package's `StatBreakdown` into the `ProvenanceLine[]` that `VitalGauge` and `StatProvenance` render (ADR-029)",
  summarizeBreakdown: "the one-line text form of the same ledger, for `Stat`'s `hoverText`",
  navigateControl:
    "the `ReferenceEntityControl` preset for the card shells' `controls` overlay, carrying the library's detail icon",
  useChassisPatternConfig:
    'entity display system: returns the generic override props a chassis pattern hands `ReferenceEntityCard`',
  resolveEntityPageMeta:
    'entity display system: what an entity page\'s chapter band and foot band say, resolved from the card\'s own seam, header and footer helpers (`presentation="page"`)',
  EntityPageMeta: 'the shape `resolveEntityPageMeta` returns',
  buildCatalogSections:
    "binds the library's catalog categories and tile colours (`catalogColors`) to the reference ORM, for ITUN's SRD Explorer",
}

export type BarrelExport = { name: string; module: string }

export type ExportVerdict =
  | { kind: 'unused'; name: string }
  | { kind: 'composition'; name: string; app: string; module: string; title: string }
  | { kind: 'unclassified'; name: string; app: string; module: string }

/** Library story files by path: meta title, modules imported, names imported. */
export type StoryIndex = ReadonlyMap<
  string,
  { title: string | null; imports: readonly string[]; names: readonly string[] }
>

/** `source` with comments blanked, so a name in prose is not an import. */
export function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** The bindings of one `{ a, type b, c as d }` list; `exported` picks `d` over `c`. */
function bindings(list: string, { exported }: { exported: boolean }): string[] {
  return list
    .split(',')
    .map((part) => part.trim().replace(/^type\s+/, ''))
    .filter((part) => part.length > 0)
    .map((part) => {
      const [name = '', alias] = part.split(/\s+as\s+/)
      return (exported ? (alias ?? name) : name).trim()
    })
}

/**
 * The barrel's public names and the relative module each comes from:
 * `export { A, type B, C as D } from './x'` and `export * as ns from './y'`.
 */
export function parseBarrel(raw: string): Array<{ name: string; specifier: string }> {
  const source = withoutComments(raw)
  const out: Array<{ name: string; specifier: string }> = []
  for (const m of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'(\.[^']+)'/g)) {
    const specifier = m[2] ?? ''
    for (const name of bindings(m[1] ?? '', { exported: true })) out.push({ name, specifier })
  }
  for (const m of source.matchAll(/export\s+\*\s+as\s+(\w+)\s+from\s+'(\.[^']+)'/g)) {
    if (m[1] && m[2]) out.push({ name: m[1], specifier: m[2] })
  }
  return out
}

/** Names a module imports from the `component-lib` root (not its subpaths). */
export function namesImportedFromLib(raw: string): string[] {
  const source = withoutComments(raw)
  return [...source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'component-lib'/g)].flatMap(
    (m) => bindings(m[1] ?? '', { exported: false })
  )
}

/** Names a module binds from relative `import { … }` statements. */
export function namesImportedRelatively(raw: string): string[] {
  const source = withoutComments(raw)
  return [...source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'\.[^']*'/g)].flatMap((m) =>
    bindings(m[1] ?? '', { exported: false })
  )
}

/** Relative specifiers a module imports or re-exports. */
export function relativeSpecifiers(raw: string): string[] {
  const source = withoutComments(raw)
  return [...source.matchAll(/(?:from|import)\s*'(\.[^']+)'/g)]
    .map((m) => m[1])
    .filter((s): s is string => s !== undefined)
}

/** The default-export meta `title:` of a story file, or null. */
export function metaTitle(source: string): string | null {
  const at = source.indexOf('export default')
  if (at === -1) return null
  return source.slice(at).match(/title:\s*(['"])([^'"]*)\1/)?.[2] ?? null
}

/**
 * The co-located story that classifies an export: a story in its module's
 * directory that imports the module, or the export by name (a sibling module
 * may re-export it), preferring one named for the export, then for the module.
 */
export function storyFor(
  exp: BarrelExport,
  stories: StoryIndex
): { file: string; title: string } | null {
  const candidates = [...stories.entries()]
    .filter(
      ([file, s]) =>
        dirname(file) === dirname(exp.module) &&
        (s.imports.includes(exp.module) || s.names.includes(exp.name))
    )
    .flatMap(([file, s]) => (s.title ? [{ file, title: s.title }] : []))
    .sort((a, b) => a.file.localeCompare(b.file))
  const base = (f: string) => basename(f, '.stories.tsx').toLowerCase()
  const moduleBase = basename(exp.module)
    .replace(/\.tsx?$/, '')
    .toLowerCase()
  return (
    candidates.find((c) => base(c.file) === exp.name.toLowerCase()) ??
    candidates.find((c) => base(c.file) === moduleBase) ??
    candidates[0] ??
    null
  )
}

/**
 * The failing verdicts, given which apps reach each export (transitively) and
 * which import it by name, plus the `allowed` entries that have gone stale.
 */
export function judge(
  exports: readonly BarrelExport[],
  reach: ReadonlyMap<string, ReadonlySet<string>>,
  direct: ReadonlyMap<string, ReadonlySet<string>>,
  stories: StoryIndex,
  allowed: Readonly<Record<string, string>> = SINGLE_APP
): { verdicts: ExportVerdict[]; stale: string[] } {
  const verdicts: ExportVerdict[] = []
  const storylessSingle = new Set<string>()
  for (const exp of exports) {
    if ((direct.get(exp.name)?.size ?? 0) === 0) {
      verdicts.push({ kind: 'unused', name: exp.name })
      continue
    }
    const apps = [...(reach.get(exp.name) ?? [])]
    if (apps.length !== 1) continue
    const app = apps[0] ?? ''
    const story = storyFor(exp, stories)
    if (story) {
      if (!PRIMITIVE_GROUPS.has(story.title.split('/')[0] ?? '')) {
        verdicts.push({
          kind: 'composition',
          name: exp.name,
          app,
          module: exp.module,
          title: story.title,
        })
      }
      continue
    }
    storylessSingle.add(exp.name)
    if (!(exp.name in allowed)) {
      verdicts.push({ kind: 'unclassified', name: exp.name, app, module: exp.module })
    }
  }
  const stale = Object.keys(allowed)
    .filter((name) => !storylessSingle.has(name))
    .sort()
  return { verdicts, stale }
}

function resolveModule(fromFile: string, specifier: string): string | null {
  const base = resolve(dirname(fromFile), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

function walk(dir: string, keep: (path: string) => boolean, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, keep, out)
    else if (keep(full)) out.push(full)
  }
  return out
}

const isShippedSource = (path: string) =>
  /\.tsx?$/.test(path) && !/[\\/]__tests__[\\/]/.test(path) && !/\.(test|stories)\.tsx?$/.test(path)

/** Every workspace whose manifest depends on component-lib. */
function consumingWorkspaces(): string[] {
  const found: string[] = []
  for (const group of ['apps', 'packages']) {
    for (const entry of readdirSync(join(ROOT, group))) {
      const manifest = join(ROOT, group, entry, 'package.json')
      if (entry === 'component-lib' || !existsSync(manifest)) continue
      const pkg = JSON.parse(readFileSync(manifest, 'utf-8')) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      if ('component-lib' in { ...pkg.dependencies, ...pkg.devDependencies }) {
        found.push(`${group}/${entry}`)
      }
    }
  }
  return found.sort()
}

export type Census = {
  exports: BarrelExport[]
  /** Export name → apps that reach it through the library's import graph. */
  reach: Map<string, Set<string>>
  /** Export name → apps whose shipped source imports it by name. */
  direct: Map<string, Set<string>>
  stories: StoryIndex
  workspaces: string[]
  /** App source files read. */
  scanned: number
}

/** Read the barrel, the library's import graph, the apps' imports and the stories. */
export function census(): Census {
  const rel = (p: string) => relative(ROOT, p)
  const exports: BarrelExport[] = parseBarrel(readFileSync(BARREL, 'utf-8')).map((e) => {
    const module = resolveModule(BARREL, e.specifier)
    if (!module) throw new Error(`index.ts re-exports ${e.name} from ${e.specifier}: not found`)
    return { name: e.name, module: rel(module) }
  })

  // The library's shipped import graph: module → the modules it imports.
  const deps = new Map<string, string[]>()
  for (const file of walk(LIB_SRC, isShippedSource)) {
    const targets = relativeSpecifiers(readFileSync(file, 'utf-8'))
      .map((s) => resolveModule(file, s))
      .filter((t): t is string => t !== null)
      .map(rel)
    deps.set(rel(file), targets)
  }
  const closure = (start: string): Set<string> => {
    const seen = new Set<string>()
    const stack = [start]
    for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
      if (seen.has(next)) continue
      seen.add(next)
      stack.push(...(deps.get(next) ?? []))
    }
    return seen
  }
  const exportsByModule = new Map<string, string[]>()
  const moduleOf = new Map<string, string>()
  for (const e of exports) {
    exportsByModule.set(e.module, [...(exportsByModule.get(e.module) ?? []), e.name])
    moduleOf.set(e.name, e.module)
  }

  const workspaces = consumingWorkspaces()
  const reach = new Map(exports.map((e) => [e.name, new Set<string>()]))
  const direct = new Map(exports.map((e) => [e.name, new Set<string>()]))
  let scanned = 0
  for (const workspace of workspaces) {
    const app = basename(workspace)
    for (const dir of APP_SOURCE_DIRS) {
      for (const file of walk(join(ROOT, workspace, dir), isShippedSource)) {
        scanned++
        for (const name of namesImportedFromLib(readFileSync(file, 'utf-8'))) {
          const module = moduleOf.get(name)
          if (!module) continue
          direct.get(name)?.add(app)
          for (const reached of closure(module)) {
            for (const n of exportsByModule.get(reached) ?? []) reach.get(n)?.add(app)
          }
        }
      }
    }
  }

  const stories = new Map<string, { title: string | null; imports: string[]; names: string[] }>()
  for (const file of walk(LIB_SRC, (p) => p.endsWith('.stories.tsx'))) {
    const source = readFileSync(file, 'utf-8')
    stories.set(rel(file), {
      title: metaTitle(source),
      imports: relativeSpecifiers(source)
        .map((s) => resolveModule(file, s))
        .filter((t): t is string => t !== null)
        .map(rel),
      names: namesImportedRelatively(source),
    })
  }

  return { exports, reach, direct, stories, workspaces, scanned }
}

/** A failing verdict as the two lines the gate prints: what is wrong, and the fix. */
export function explain(v: ExportVerdict): [string, string] {
  if (v.kind === 'unused') {
    return [
      `✗ ${v.name}: no app's shipped source imports it (tests and stories do not count).`,
      '  → Unexport it from packages/component-lib/src/index.ts, or delete it.',
    ]
  }
  if (v.kind === 'composition') {
    return [
      `✗ ${v.name} (${v.module}): only ${v.app} renders it, and its story files it under '${v.title}'.`,
      `  → Move it, its story and its tests into apps/${v.app}/src/components/: a composition one app renders is that app's.`,
    ]
  }
  return [
    `✗ ${v.name} (${v.module}): only ${v.app} reaches it, and no co-located story classifies it.`,
    `  → Move it into apps/${v.app}/src/, or list it in SINGLE_APP in tools/check-barrel-consumers.ts with why the library owns it.`,
  ]
}

function main(): void {
  const { exports, reach, direct, stories, workspaces, scanned } = census()
  assertScanFloor('barrel-consumers (barrel exports)', exports.length, 60)
  assertScanFloor('barrel-consumers (consuming workspaces)', workspaces.length, 2)
  assertScanFloor('barrel-consumers (app source files)', scanned, 270)

  const { verdicts, stale } = judge(exports, reach, direct, stories)
  for (const v of verdicts) console.error(explain(v).join('\n'))
  for (const name of stale) {
    console.error(
      `✗ SINGLE_APP lists ${name}, which is no longer a storyless single-app export: remove it.`
    )
  }
  if (verdicts.length > 0 || stale.length > 0) process.exit(1)

  const single = exports.filter((e) => reach.get(e.name)?.size === 1).length
  console.log(
    `✓ barrel consumers: ${exports.length} exports, ${workspaces.length} consuming workspaces (${scanned} files); ${single} single-app, none an app's composition.`
  )
}

if (import.meta.main) main()
