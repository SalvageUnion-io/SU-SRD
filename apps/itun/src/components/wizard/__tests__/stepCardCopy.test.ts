import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

/**
 * Copy a wizard step prints straight on WizShell's tinted step card
 * (`--tone-card`) keeps AA there, so it never takes `wkMuted`: that measures
 * 3.78 / 3.03 / 2.65:1 on the pilot / mech / crawler card (`contrast.test.ts`,
 * "the wizard step card"). It inherits the card's ink instead.
 *
 * The "Compositions/Wizard/Step Card" stories hold this under axe in a real
 * browser. This is the source-level half, for the steps those stories leave
 * out and for a step added later: every component a wizard renders inside
 * the card, read from the three wizards' own imports, is checked for
 * - a `Slab` with a `count` that is not `countInk="inherit"`,
 * - a quiet `EmptyState` that is not `bodyInk="inherit"`,
 * - `wkMuted` in a style object outside `ON_PAPER`, the styles whose ground
 *   is a paper surface inside the card.
 */

const COMPONENTS = join(import.meta.dir, '../..')

const WIZARDS = ['pilot/PilotWizard.tsx', 'mech/MechWizard.tsx', 'crawler/CrawlerBuilder.tsx']

/** Style objects that print `wkMuted` on their own paper, not on the card. */
const ON_PAPER: Record<string, readonly string[]> = {
  // The Custom-build door is a paper pick card (`CUSTOM_CARD`).
  'mech/MechChassisStep.tsx': ['CUSTOM_BODY'],
  // The Scrap Pool hint sits in a paper `Panel`.
  'crawler/CrawlerIdentityStep.tsx': ['SCRAP_HINT'],
}

/** The step bodies each wizard renders inside the card, by its imports. */
function stepFiles(): string[] {
  const files = new Set<string>()
  for (const wizard of WIZARDS) {
    const source = readFileSync(join(COMPONENTS, wizard), 'utf8')
    for (const [, names = '', from = ''] of source.matchAll(
      /^import \{ ([^}]+) \} from '(\.[^']+)'/gm
    )) {
      const rendered = names
        .split(',')
        .map((n) => n.trim())
        .some((n) => n.endsWith('Step') || n === 'SystemsList' || n === 'RuleBrief')
      if (rendered)
        files.add(relative(COMPONENTS, join(COMPONENTS, dirname(wizard), `${from}.tsx`)))
    }
  }
  return [...files].sort()
}

/** `file`'s source without its comments, which may name `wkMuted` freely. */
function code(file: string): string {
  return readFileSync(join(COMPONENTS, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

/** Each JSX element `<Name …/>` or `<Name …>` opening tag in `source`. */
function openingTags(source: string, name: string): string[] {
  return [...source.matchAll(new RegExp(`<${name}\\b[^>]*?/?>`, 'g'))].map((m) => m[0])
}

/** Top-level `const X = {…}` objects: on one line, or closed by a `}` at column 0. */
const STYLE_OBJECT = /^const (\w+)[^=\n]*= \{(.*\}.*$|[\s\S]*?^\}.*$)/gm

/** The names of the style objects that use `wkMuted`. */
function mutedStyles(source: string): string[] {
  return [...source.matchAll(STYLE_OBJECT)]
    .filter(([, , body = '']) => body.includes('wkMuted'))
    .map(([, name = '']) => name)
}

describe('copy on the wizard step card', () => {
  const files = stepFiles()

  test('the wizards still render their steps from imports this reads', () => {
    expect(files.length).toBeGreaterThanOrEqual(18)
    expect(files).toContain('wizard/BackgroundStep.tsx')
    expect(files).toContain('crawler/CrawlerIdentityStep.tsx')
  })

  for (const file of files) {
    test(`${file} prints no muted copy on the card`, () => {
      const source = code(file)
      const slabs = openingTags(source, 'Slab').filter((tag) => tag.includes('count='))
      expect(slabs.filter((tag) => !tag.includes('countInk="inherit"'))).toEqual([])
      const quiet = openingTags(source, 'EmptyState').filter((tag) =>
        tag.includes('variant="quiet"')
      )
      expect(quiet.filter((tag) => !tag.includes('bodyInk="inherit"'))).toEqual([])
      expect(mutedStyles(source).filter((name) => !ON_PAPER[file]?.includes(name))).toEqual([])
      // A muted colour written inline in JSX, outside any named style.
      expect(source.replace(STYLE_OBJECT, '')).not.toContain('wkMuted')
    })
  }

  test('every ON_PAPER entry still names a muted style in a step', () => {
    for (const [file, names] of Object.entries(ON_PAPER)) {
      expect(files).toContain(file)
      const muted = mutedStyles(code(file))
      for (const name of names) expect(muted).toContain(name)
    }
  })
})
