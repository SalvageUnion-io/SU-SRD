import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  texture,
  tracking,
  weight,
} from './tokens'

/**
 * Token-parity guard — the thing that makes it safe for the scale to exist
 * twice.
 *
 * `styles/theme.css` is the one token set: its `@theme` and `:root` blocks
 * declare every token as a custom property, and `styles/index.css` reads them.
 * `design/tokens.ts` holds the same values as TypeScript, because a style
 * object cannot reach a CSS variable's value and a stylesheet cannot be read by
 * a canvas renderer or a Node script. So the duplication is deliberate — but two
 * hand-maintained copies of one set of numbers is precisely the drift shape the
 * design-token guard exists to catch, and nothing else in the build would
 * notice them diverging. A missing property renders unstyled; a stale one
 * renders the wrong colour. Neither fails typecheck.
 *
 * The mapping is mechanical rather than a hand-written table, because a table
 * is a third copy that can drift too: a TS group maps to its theme.css prefix
 * (`weight` → `--font-weight-`, `borderWidth` → `--bw-`), and a camelCase key
 * maps to its kebab-case name (`inkDeep` → `--color-ink-deep`, `wkBg2` →
 * `--color-wk-bg-2`, `tl1` → `--color-tl-1`). A key that starts with a digit is
 * used verbatim (`space[8]` → `--space-8`, `fontSize['2xl']` → `--text-2xl`).
 *
 * Both directions are asserted. A one-way check would let an orphan custom
 * property — a token deleted from TypeScript but left in the CSS — survive
 * indefinitely.
 */

const CSS_PATH = join(import.meta.dir, '../styles/theme.css')

/** theme.css prefix → the TS group it mirrors. */
const GROUPS = {
  bw: borderWidth,
  color,
  font,
  'font-weight': weight,
  radius,
  space,
  text: fontSize,
  texture,
  tracking,
} as const satisfies Record<string, Record<string, string | number>>

/** Longest first, so `--font-weight-bold` is never read as font `weight-bold`. */
const PREFIXES = (Object.keys(GROUPS) as (keyof typeof GROUPS)[]).sort(
  (a, b) => b.length - a.length
)

/**
 * `inkDeep` → `ink-deep`, `wkBg2` → `wk-bg-2`, `tl1` → `tl-1`, `8` → `8`,
 * `2xl` → `2xl`: a separator before each capital, and before a digit run that
 * follows a letter.
 */
function kebab(key: string): string {
  return key
    .replace(/([A-Z])/g, '-$1')
    .replace(/([a-zA-Z])(\d+)/g, '$1-$2')
    .toLowerCase()
}

/**
 * Every token-namespaced custom property theme.css declares, comments stripped,
 * keyed by its name without the leading `--`. Sub-properties such as
 * `--text-xs--line-height` and the `--animate-*` bindings are not tokens.
 */
function readDeclarations(): Map<string, string> {
  const css = readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const out = new Map<string, string>()
  for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = m
    if (!name || !value || name.includes('--')) continue
    if (!PREFIXES.some((p) => name.startsWith(`${p}-`))) continue
    out.set(name, value.trim())
  }
  return out
}

/** Follow `var(--x)` aliases to the literal they point at. */
function resolve(value: string, declarations: Map<string, string>, depth = 0): string {
  const alias = value.match(/^var\(--([a-z0-9-]+)\)$/)
  if (!alias?.[1]) return value
  if (depth > 8) throw new Error(`custom-property alias cycle at --${alias[1]}`)
  const target = declarations.get(alias[1])
  if (target === undefined) throw new Error(`--${alias[1]} referenced but never defined`)
  return resolve(target, declarations, depth + 1)
}

const declarations = readDeclarations()

/** Every token, flattened to the custom-property name it must be declared as. */
const expected = new Map<string, string>()
for (const prefix of PREFIXES) {
  for (const [key, value] of Object.entries(GROUPS[prefix])) {
    expected.set(`${prefix}-${kebab(key)}`, String(value))
  }
}

describe('design token parity', () => {
  test('the guard actually parsed the stylesheet', () => {
    // A moved file or a reshaped block would otherwise make every assertion
    // below pass vacuously.
    expect(declarations.size).toBeGreaterThan(80)
    expect(expected.size).toBeGreaterThan(80)
  })

  test('every token is declared in theme.css with the same value', () => {
    const mismatches: string[] = []
    for (const [name, value] of expected) {
      const declared = declarations.get(name)
      if (declared === undefined) {
        mismatches.push(`--${name} is missing from styles/theme.css`)
        continue
      }
      const resolved = resolve(declared, declarations)
      if (resolved !== value) {
        mismatches.push(`--${name}: css has "${resolved}", tokens.ts has "${value}"`)
      }
    }
    expect(
      mismatches,
      'design/tokens.ts and styles/theme.css have drifted — edit both, never one'
    ).toEqual([])
  })

  test('no token-namespaced custom property outlives the token it came from', () => {
    const orphans = [...declarations.keys()]
      .filter((name) => !expected.has(name))
      .map((name) => `--${name} is declared in styles/theme.css but is not a token`)
    expect(orphans, 'delete the property, or add the token it belongs to').toEqual([])
  })
})
