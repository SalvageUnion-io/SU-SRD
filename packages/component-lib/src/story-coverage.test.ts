import { describe, test, expect } from 'bun:test'
import { Glob } from 'bun'
import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

/**
 * Ladle catalog guard — the executable half of the story standard documented in
 * `docs/design-system/ladle-styleguide.md` and `component-lib/CLAUDE.md`.
 *
 * The standard, in one line: ONE public component = ONE co-located story file =
 * ONE nav leaf, titled `Group[/Sub-group]/Component Title Case`.
 *
 * These assertions exist because every one of them has already drifted at least
 * once: multi-component "gallery" story files that left their members invisible
 * in the sidebar, component stories squatting in `src/stories/`, and ad-hoc
 * sub-groups appearing under one group but not its siblings.
 */

const SRC = import.meta.dir

/** Barrel-exported components that intentionally have no standalone story. */
const ALLOWLIST = new Set([
  // DisplayCard internal sub-parts — demonstrated via DisplayCard's stories.
  'CardHeader',
  'CardImage',
  // Sub-parts / slots demonstrated via their parent composition.
  'ControlButtons', // rendered via DisplayCard foot actions
  'ReferenceEntityChassisAbilitiesContent', // render-prop slot
  // Redundant with the canonical Slab (ruleset: "slabs section"); pending
  // retirement — its Separators story was dropped as a duplicate.
  'SectionSeparator',
])

/** Sanctioned top-level story groups, in sidebar order (see `.ladle/config.mjs`). */
const GROUPS = ['Foundations', 'Atoms', 'Containers', 'Compositions'] as const

/**
 * Sanctioned sub-groups, per top-level group. A sub-group exists only where a
 * cluster earns it (3+ sibling components); everything else is a direct leaf.
 * Only `Compositions` is large enough to need them — Atoms/Containers are flat
 * lists of peers, which stays scannable and searchable.
 */
const SUBGROUPS: Record<string, readonly string[]> = {
  Foundations: [],
  Atoms: [],
  Containers: [],
  Compositions: ['Entity', 'Catalog', 'Dashboard', 'Wizard', 'Shell'],
}

/**
 * The only `*.stories.tsx` allowed to live in `src/stories/` — catalog-level
 * pages that document the system itself and have no backing component. Anything
 * else belongs beside its component.
 */
const CATALOG_PAGES = new Set([
  'Styleguide',
  'Theme',
  'Typography',
  'Sizing',
  'Layout',
  'RenderingMatrix',
])

/**
 * The bounded exception to "one component = one story": frozen "BEFORE" CAPTURES
 * from the style-unification refresh. Each reproduces an ITUN wizard surface
 * inline — app components can't be imported cross-package — so the refreshed
 * primitives can be compared against the legacy appearance they replace.
 *
 * They are deliberately FROZEN: they do not track the ITUN components they
 * mirror, because their whole job is to preserve the "before" state. So do NOT
 * "fix drift" against the app, and do NOT extract a component out of them —
 * that would defeat the capture. They are retired by DELETION once the refresh
 * they document has landed (a sibling pass already deleted 16 comparison-only
 * captures and kept these two as the app-surface ones).
 *
 * Listed explicitly so the exception stays visible and countable rather than
 * silently becoming the norm — a new componentless story fails CI until it is
 * justified here.
 */
const PROTOTYPE_STORIES = new Set([
  'components/wizard/MechInstallStep.stories.tsx', // legacy ITUN mech-install step
  'components/wizard/NewEntityScreen.stories.tsx', // legacy ITUN new-entity screen
])

function read(rel: string): string {
  return readFileSync(join(SRC, rel), 'utf8')
}

const barrel = read('index.ts')

// 1. Discover component definitions and the file each is defined in.
const componentFiles = [...new Glob('**/*.tsx').scanSync(SRC)].filter(
  (f) => !f.includes('.stories.') && !f.includes('__tests__')
)
const definedIn = new Map<string, string>()
for (const f of componentFiles) {
  const src = read(f)
  for (const m of src.matchAll(/export function ([A-Z][A-Za-z0-9]+)/g)) {
    if (m[1] && !definedIn.has(m[1])) definedIn.set(m[1], f)
  }
  for (const m of src.matchAll(/export const ([A-Z][A-Za-z0-9]+)\s*=\s*(?!createContext)/g)) {
    if (m[1] && !definedIn.has(m[1])) definedIn.set(m[1], f)
  }
}

// 2. Keep only components re-exported from the public barrel.
const publicComponents = [...definedIn.keys()]
  .filter((name) => new RegExp(`\\b${name}\\b`).test(barrel))
  .sort()

/** Directory of the file a component is defined in, or null if it isn't ours. */
function dirOfComponent(name: string): string | null {
  const file = definedIn.get(name)
  return file ? dirname(file) : null
}

// 3. Index every story file: its directory, its meta title, and what it imports.
const storyFiles = [...new Glob('**/*.stories.tsx').scanSync(SRC)]

/**
 * Extract ONLY the default-export META title: the first `title: '...'` AFTER the
 * first `export default`. Story BODIES contain non-meta `title:` occurrences
 * (entity names like 'Cargo Hold', a `title` prop, a code sample) that must not
 * be mistaken for it — anchoring after `export default` skips them.
 */
function extractMetaTitle(src: string): string | null {
  const exportIdx = src.indexOf('export default')
  if (exportIdx === -1) return null
  const after = src.slice(exportIdx)
  const m = after.match(/title:\s*(['"])([^'"]*)\1/)
  return m ? (m[2] ?? null) : null
}

/** Named bindings pulled in by a file's `import { ... }` statements. */
function extractImportedNames(src: string): Set<string> {
  const names = new Set<string>()
  for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]+)\}/g)) {
    const body = m[1]
    if (!body) continue
    for (const raw of body.split(',')) {
      const [binding] = raw.trim().split(/\s+as\s+/)
      const name = binding?.trim().replace(/^type\s+/, '')
      if (name) names.add(name)
    }
  }
  return names
}

const stories = storyFiles.map((f) => {
  const src = read(f)
  return {
    file: f,
    dir: dirname(f),
    base: basename(f, '.stories.tsx'),
    title: extractMetaTitle(src),
    imports: extractImportedNames(src),
  }
})

describe('Ladle catalog: coverage', () => {
  test('every public component has a co-located story that imports it', () => {
    // Coverage means a story IN THE SAME DIRECTORY as the component actually
    // imports it — not merely that its name appears somewhere in the catalog's
    // concatenated text. The weaker text match let a component be "covered" by
    // an incidental mention while having no sidebar entry of its own.
    const uncovered = publicComponents
      .filter((name) => !ALLOWLIST.has(name))
      .filter((name) => {
        const dir = dirOfComponent(name)
        return !stories.some((s) => s.dir === dir && s.imports.has(name))
      })
      .sort()
    expect(uncovered).toEqual([])
  })

  test('the allowlist has no stale entries (all still exist + still unstoried)', () => {
    const stale = [...ALLOWLIST].filter((name) => {
      if (!publicComponents.includes(name)) return true
      const dir = dirOfComponent(name)
      return stories.some((s) => s.dir === dir && s.imports.has(name))
    })
    expect(stale).toEqual([])
  })
})

describe('Ladle catalog: taxonomy', () => {
  test('every story has a meta title in a sanctioned group', () => {
    const offenders = stories
      .filter((s) => {
        const title = s.title
        return title === null || !GROUPS.some((g) => title.startsWith(`${g}/`))
      })
      .map((s) => `${s.file}: ${s.title ?? '<no meta title found>'}`)
      .sort()
    expect(offenders).toEqual([])
  })

  test('sub-groups are sanctioned, and nesting never exceeds Group/Sub-group/Leaf', () => {
    const offenders: string[] = []
    for (const s of stories) {
      const title = s.title
      if (!title) continue
      const [group, ...rest] = title.split('/')
      if (!group || !GROUPS.includes(group as (typeof GROUPS)[number])) continue
      if (rest.length === 1) continue // Group/Leaf — always fine
      if (rest.length > 2) {
        offenders.push(`${s.file}: '${title}' nests deeper than Group/Sub-group/Leaf`)
        continue
      }
      const sub = rest[0]
      const allowed = SUBGROUPS[group] ?? []
      if (sub && !allowed.includes(sub)) {
        offenders.push(
          `${s.file}: '${title}' uses unsanctioned sub-group '${group}/${sub}'` +
            ` (allowed: ${allowed.join(', ') || 'none — this group is flat'})`
        )
      }
    }
    expect(offenders.sort()).toEqual([])
  })

  test('no two stories claim the same title', () => {
    const byTitle = new Map<string, string[]>()
    for (const s of stories) {
      if (!s.title) continue
      byTitle.set(s.title, [...(byTitle.get(s.title) ?? []), s.file])
    }
    const collisions = [...byTitle.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([title, files]) => `'${title}' claimed by ${files.join(' + ')}`)
      .sort()
    expect(collisions).toEqual([])
  })

  test("a title's last segment names the component it demonstrates", () => {
    // The sidebar label must be the component's own name, so the catalog can be
    // navigated by the symbol you'd grep for. Drift here is how you end up with
    // 'Containers/Modal' pointing at ModalShell and 'Atoms/Activation Cost' at
    // ActivationCostBox — labels that look right but match nothing in the code.
    //
    // A sub-group may absorb a shared prefix, so 'Compositions/Dashboard/Gauge'
    // legitimately names DashboardGauge.
    const offenders: string[] = []
    for (const s of stories) {
      const title = s.title
      if (!title) continue
      const segments = title.split('/')
      const last = (segments.at(-1) ?? '').replace(/ /g, '')
      const sub = segments.length === 3 ? (segments[1] ?? '').replace(/ /g, '') : ''
      const local = [...s.imports].filter((n) => dirOfComponent(n) === s.dir)
      const candidates = new Set([s.base, ...local])
      const matches = [...candidates].some(
        (c) =>
          c.toLowerCase() === last.toLowerCase() ||
          c.toLowerCase() === `${sub}${last}`.toLowerCase()
      )
      if (!matches) {
        offenders.push(
          `${s.file}: '${title}' names '${last}', which is neither the story's own` +
            ` basename nor a component defined in its directory (${[...candidates].join(', ') || 'none'})`
        )
      }
    }
    expect(offenders.sort()).toEqual([])
  })
})

describe('Ladle catalog: co-location', () => {
  test('src/stories/ holds only catalog pages, flat', () => {
    const offenders = stories
      .filter((s) => s.file.startsWith('stories/'))
      .filter((s) => s.dir !== 'stories' || !CATALOG_PAGES.has(s.base))
      .map(
        (s) =>
          `${s.file}: component stories are co-located beside their component;` +
          ` src/stories/ is only for flat catalog pages (${[...CATALOG_PAGES].join(', ')})`
      )
      .sort()
    expect(offenders).toEqual([])
  })

  test('every story sits beside a component it demonstrates', () => {
    // The converse of the coverage test: coverage walks component -> story, this
    // walks story -> component, so a story orphaned from any component (a screen
    // mock-up dropped into an unrelated folder) is caught rather than ignored.
    const offenders = stories
      .filter((s) => !s.file.startsWith('stories/'))
      .filter((s) => !PROTOTYPE_STORIES.has(s.file))
      .filter((s) => ![...s.imports].some((n) => dirOfComponent(n) === s.dir))
      .map(
        (s) =>
          `${s.file}: imports no component defined in its own directory —` +
          ' co-locate it beside what it demonstrates, or list it in PROTOTYPE_STORIES'
      )
      .sort()
    expect(offenders).toEqual([])
  })

  test('the prototype list has no stale entries', () => {
    const stale = [...PROTOTYPE_STORIES]
      .filter((f) => !storyFiles.includes(f))
      .map((f) => `${f} no longer exists — prune it from PROTOTYPE_STORIES`)
      .sort()
    expect(stale).toEqual([])
  })

  test('every catalog page in src/stories/ is a Foundations story', () => {
    const offenders = stories
      .filter((s) => s.dir === 'stories')
      .filter((s) => !s.title?.startsWith('Foundations/'))
      .map((s) => `${s.file}: ${s.title ?? '<none>'} (catalog pages are Foundations/*)`)
      .sort()
    expect(offenders).toEqual([])
  })
})
