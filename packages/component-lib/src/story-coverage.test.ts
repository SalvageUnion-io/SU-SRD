import { describe, test, expect } from 'bun:test'
import { Glob } from 'bun'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Story-coverage guard: every barrel-exported visual component must be exercised
 * by at least one Ladle story (the catalog is ground truth — see component-lib
 * CLAUDE.md "Stories (Ladle)"). Add a story rather than extending the allowlist,
 * unless the export is a genuine internal sub-part demonstrated via its parent.
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

function read(rel: string): string {
  return readFileSync(join(SRC, rel), 'utf8')
}

const barrel = read('index.ts')

// 1. Discover component definitions: `export function Xxx` or `export const Xxx =`
//    (arrow/forwardRef/memo), excluding React contexts.
const componentFiles = [...new Glob('**/*.tsx').scanSync(SRC)].filter(
  (f) => !f.includes('.stories.') && !f.includes('__tests__')
)
const components = new Set<string>()
for (const f of componentFiles) {
  const src = read(f)
  for (const m of src.matchAll(/export function ([A-Z][A-Za-z0-9]+)/g)) {
    if (m[1]) components.add(m[1])
  }
  for (const m of src.matchAll(/export const ([A-Z][A-Za-z0-9]+)\s*=\s*(?!createContext)/g)) {
    if (m[1]) components.add(m[1])
  }
}

// 2. Keep only components re-exported from the public barrel.
const publicComponents = [...components].filter((name) => new RegExp(`\\b${name}\\b`).test(barrel))

// 3. Concatenate every story's source.
const storyFiles = [...new Glob('**/*.stories.tsx').scanSync(SRC)]
const storyText = storyFiles.map((f) => read(f)).join('\n')

/** Sanctioned top-level story groups (see component-lib CLAUDE.md "Stories"). */
const TITLE_PATTERN = /^(Foundations|Atoms|Containers|Compositions)\/.+/

/**
 * Extract ONLY the default-export META title from a story file: the FIRST
 * `title: '...'` (or "...") that appears AFTER the first `export default`.
 * Story BODIES contain non-meta `title:` occurrences (entity names like
 * 'Cargo Hold', a `title: string` prop, a code-sample string) that must NOT be
 * mistaken for the meta title — anchoring after `export default` skips them.
 */
function extractMetaTitle(src: string): string | null {
  const exportIdx = src.indexOf('export default')
  if (exportIdx === -1) return null
  const after = src.slice(exportIdx)
  const m = after.match(/title:\s*(['"])([^'"]*)\1/)
  return m ? (m[2] ?? null) : null
}

describe('Ladle story coverage', () => {
  test('every public visual component is referenced by a story', () => {
    const uncovered = publicComponents
      .filter((name) => !ALLOWLIST.has(name))
      .filter((name) => !new RegExp(`\\b${name}\\b`).test(storyText))
      .sort()
    expect(uncovered).toEqual([])
  })

  test('every story META title starts with a sanctioned top-level group', () => {
    const offenders = storyFiles
      .map((f) => ({ file: f, title: extractMetaTitle(read(f)) }))
      .filter(({ title }) => title === null || !TITLE_PATTERN.test(title))
      .map(({ file, title }) => `${file}: ${title ?? '<no meta title found>'}`)
      .sort()
    expect(offenders).toEqual([])
  })

  test('the allowlist has no stale entries (all still exist + still unstoried)', () => {
    const stale = [...ALLOWLIST].filter(
      (name) => !publicComponents.includes(name) || new RegExp(`\\b${name}\\b`).test(storyText)
    )
    expect(stale).toEqual([])
  })
})
