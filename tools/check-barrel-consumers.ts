#!/usr/bin/env bun
/**
 * check-barrel-consumers — the UI library (`apps/web/src/ui`) exports what the apps render, and
 * holds no app's own compositions.
 *
 * `docs/ARCHITECTURE.md#component-lib` says code only one app renders lives in
 * that app. Audit 4 found that rule was prose that nothing enforced:
 * roughly half the barrel was rendered by one app, and the wizard shell, the
 * sheet edit controls, the masthead and its menu, the roster row and the about
 * page all sat in the library although only the Cantina renders them.
 *
 * A single consumer is not wrong by itself. A design-system primitive (an
 * Atom, a Container, a Foundations page) is the library's to own however many
 * apps render it today. What belongs in the app is a COMPOSITION only that app
 * renders: a product surface assembled from those primitives. The library
 * already files every public component under one of those groups by the
 * directory it sits in (`components/atoms/`, `components/containers/`,
 * `components/compositions/`), so this check reads the group from there
 * rather than keeping a second list.
 *
 * Fails:
 *   1. a component only one app reaches that sits under
 *      `components/compositions/`: move it into the app's `src/components/`;
 *   2. a single-app export no group directory classifies (a helper, a hook,
 *      a `.ts` module) that `SINGLE_APP` does not list with a reason;
 *   3. a `SINGLE_APP` entry that no longer names an unclassified single-app export.
 *
 * An export nothing imports at all is knip's to report (`includeEntryExports`,
 * docs/ARCHITECTURE.md#dead-code), not this check's: one owner per finding.
 *
 * "Reaches" is transitive. An app reaches an export when it imports any export
 * whose module graph inside the library contains that export's module: srd
 * imports `ReferenceEntityCard`, whose `Card` rail renders `ControlButtons`,
 * so srd reaches `ControlButtons` though it never names it. The apps are
 * `apps/web`'s srd and Cantina; its `src/` (outside `src/ui`) and `ssg/` trees
 * are scanned.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { assertScanFloor } from 'gates/lib/scanFloor'
import { walk } from 'gates/lib/walk'

const ROOT = join(import.meta.dir, '..')
const LIB_SRC = join(ROOT, 'apps/web/src/ui')
const BARREL = join(LIB_SRC, 'index.ts')

/** Source trees of a consuming workspace that ship. */
const APP_SOURCE_DIRS = ['src', 'ssg']

/**
 * `apps/web` holds two apps: the Cantina under `src/cantina/`, srd around it.
 * Each counts as its own consumer, so a composition only one of them renders
 * still belongs to that one.
 */
const CANTINA_SRC = 'apps/web/src/cantina/'

/** The app a consuming source file belongs to. */
export function appOf(workspace: string, file: string): string {
  return file.startsWith(CANTINA_SRC) ? 'cantina' : basename(workspace)
}

/** Where an app's own source lives. */
const appSrc = (app: string) => (app === 'cantina' ? CANTINA_SRC : `apps/${app}/src/`)

/**
 * The library directories that file a component under a group, relative to
 * `apps/web/src/ui/`. `markdownSection/` is a container that sits
 * beside `components/` because both apps' markdown rendering imports it.
 */
const GROUP_DIRS: ReadonlyArray<readonly [dir: string, group: string]> = [
  ['components/atoms/', 'Atoms'],
  ['components/containers/', 'Containers'],
  ['components/compositions/', 'Compositions'],
  ['markdownSection/', 'Containers'],
]

/** Groups whose members the library owns, whoever renders them. */
const PRIMITIVE_GROUPS = new Set(['Atoms', 'Containers'])

/**
 * Unclassified exports one app reaches, and why each is the library's. Only an
 * export no group directory classifies belongs here: a component is
 * classified by its directory's group, never by an entry in this list.
 */
const SINGLE_APP: Readonly<Record<string, string>> = {
  InfoCutout:
    "the Row's container block (art column, cut-out band, paper body) for a panel that is not a listed entity: one block shape, owned where the entity forms own it",
  heatDangerFrom:
    "the pip index where a heat track turns red: the input to `VitalGauge`'s `danger` prop",
  linesFromBreakdown:
    "turns the rules package's `StatBreakdown` into the `ProvenanceLine[]` that `VitalGauge` and `StatProvenance` render (ADR-029)",
  summarizeBreakdown: "the one-line text form of the same ledger, for `Stat`'s `hoverText`",
  navigateControl:
    "the `ReferenceEntityControl` preset for the card shells' `controls` overlay, carrying the library's detail icon",
  buildCatalogSections:
    "binds the library's catalog categories and tile colours (`catalogColors`) to the reference ORM, for the Cantina's SRD Explorer",
  useDetailModal:
    'the reference card shells\' "View details" control (modal, or a link out under `EntityDetailLinkProvider`)',
  ogCardForEntity:
    "a reference entity's `OgCard` props, read through the entity card's own internal tone, stat, cost and provenance helpers so the link preview says what the card says (issue 1280)",
}

export type BarrelExport = { name: string; module: string }

export type ExportVerdict =
  | { kind: 'composition'; name: string; app: string; module: string; group: string }
  | { kind: 'unclassified'; name: string; app: string; module: string }

/** `source` with comments blanked, so a name in prose is not an import. */
function withoutComments(source: string): string {
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

/** Names a module imports from the library's barrel (`…/ui/index`), not its other modules. */
export function namesImportedFromLib(raw: string): string[] {
  const source = withoutComments(raw)
  return [
    ...source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'\.[^']*\/ui\/index'/g),
  ].flatMap((m) => bindings(m[1] ?? '', { exported: false }))
}

/** Relative specifiers a module imports or re-exports. */
function relativeSpecifiers(raw: string): string[] {
  const source = withoutComments(raw)
  return [...source.matchAll(/(?:from|import)\s*'(\.[^']+)'/g)]
    .map((m) => m[1])
    .filter((s): s is string => s !== undefined)
}

/**
 * The group a component module's directory files it under, or null for a
 * non-component (`.ts`) module or one outside the group directories.
 */
export function groupOf(module: string): string | null {
  if (!module.endsWith('.tsx')) return null
  const inLib = module.replace(/^apps\/web\/src\/ui\//, '')
  return GROUP_DIRS.find(([dir]) => inLib.startsWith(dir))?.[1] ?? null
}

/**
 * The failing verdicts, given which apps reach each export (transitively),
 * plus the `allowed` entries that have gone stale.
 */
export function judge(
  exports: readonly BarrelExport[],
  reach: ReadonlyMap<string, ReadonlySet<string>>,
  allowed: Readonly<Record<string, string>> = SINGLE_APP
): { verdicts: ExportVerdict[]; stale: string[] } {
  const verdicts: ExportVerdict[] = []
  const unclassifiedSingle = new Set<string>()
  for (const exp of exports) {
    const apps = [...(reach.get(exp.name) ?? [])]
    if (apps.length !== 1) continue
    const app = apps[0] ?? ''
    const group = groupOf(exp.module)
    if (group) {
      if (!PRIMITIVE_GROUPS.has(group)) {
        verdicts.push({ kind: 'composition', name: exp.name, app, module: exp.module, group })
      }
      continue
    }
    unclassifiedSingle.add(exp.name)
    if (!(exp.name in allowed)) {
      verdicts.push({ kind: 'unclassified', name: exp.name, app, module: exp.module })
    }
  }
  const stale = Object.keys(allowed)
    .filter((name) => !unclassifiedSingle.has(name))
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

const isShippedSource = (path: string) =>
  /\.tsx?$/.test(path) && !/[\\/]__tests__[\\/]/.test(path) && !/\.test\.tsx?$/.test(path)

/**
 * The workspaces that render the library: `apps/web` alone, which holds it
 * (`src/ui`) beside the two apps that import it.
 */
const CONSUMING_WORKSPACES = ['apps/web']

/** A consuming file: shipped source outside the library itself. */
const isAppSource = (path: string) => isShippedSource(path) && !path.startsWith(`${LIB_SRC}/`)

export type Census = {
  exports: BarrelExport[]
  /** Export name → apps that reach it through the library's import graph. */
  reach: Map<string, Set<string>>
  workspaces: string[]
  /** App source files read. */
  scanned: number
}

/** Read the barrel, the library's import graph and the apps' imports. */
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

  const workspaces = CONSUMING_WORKSPACES
  const reach = new Map(exports.map((e) => [e.name, new Set<string>()]))
  let scanned = 0
  for (const workspace of workspaces) {
    for (const dir of APP_SOURCE_DIRS) {
      for (const file of walk(join(ROOT, workspace, dir), isAppSource)) {
        scanned++
        const app = appOf(workspace, rel(file))
        for (const name of namesImportedFromLib(readFileSync(file, 'utf-8'))) {
          const module = moduleOf.get(name)
          if (!module) continue
          for (const reached of closure(module)) {
            for (const n of exportsByModule.get(reached) ?? []) reach.get(n)?.add(app)
          }
        }
      }
    }
  }

  return { exports, reach, workspaces, scanned }
}

/** A failing verdict as the two lines the gate prints: what is wrong, and the fix. */
export function explain(v: ExportVerdict): [string, string] {
  if (v.kind === 'composition') {
    return [
      `✗ ${v.name} (${v.module}): only ${v.app} renders it, and its directory files it under '${v.group}'.`,
      `  → Move it and its tests into ${appSrc(v.app)}components/: a composition one app renders is that app's.`,
    ]
  }
  return [
    `✗ ${v.name} (${v.module}): only ${v.app} reaches it, and no group directory classifies it.`,
    `  → Move it into ${appSrc(v.app)}, or list it in SINGLE_APP in tools/check-barrel-consumers.ts with why the library owns it.`,
  ]
}

/** The scan floors `main` holds a census to: exports, consuming workspaces, app files. */
const FLOORS = { exports: 60, workspaces: 1, scanned: 270 }

/** Judge a census and report; returns the exit code. */
export function main(
  read: () => Census = census,
  {
    allowed = SINGLE_APP,
    floors = FLOORS,
    log = console.log,
    error = console.error,
  }: {
    allowed?: Readonly<Record<string, string>>
    floors?: typeof FLOORS
    log?: (line: string) => void
    error?: (line: string) => void
  } = {}
): number {
  const { exports, reach, workspaces, scanned } = read()
  assertScanFloor('barrel-consumers (barrel exports)', exports.length, floors.exports)
  assertScanFloor('barrel-consumers (consuming workspaces)', workspaces.length, floors.workspaces)
  assertScanFloor('barrel-consumers (app source files)', scanned, floors.scanned)

  const { verdicts, stale } = judge(exports, reach, allowed)
  for (const v of verdicts) error(explain(v).join('\n'))
  for (const name of stale) {
    error(
      `✗ SINGLE_APP lists ${name}, which is no longer an unclassified single-app export: remove it.`
    )
  }
  if (verdicts.length > 0 || stale.length > 0) return 1

  const single = exports.filter((e) => reach.get(e.name)?.size === 1).length
  log(
    `✓ barrel consumers: ${exports.length} exports, ${workspaces.length} consuming workspaces (${scanned} files); ${single} single-app, none an app's composition.`
  )
  return 0
}

if (import.meta.main) process.exit(main())
