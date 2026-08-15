import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { borderWidth, color, font, fontSize, radius, space, tracking, weight } from './tokens'

/**
 * Token-parity guard — the thing that makes it safe for the scale to exist
 * twice.
 *
 * `design/tokens.ts` holds the values as TypeScript, `styles/index.css` emits
 * the same values as `--su-*` custom properties, and each half is there for a
 * reason the other cannot serve: a style object cannot reach a CSS variable's
 * value, and a stylesheet cannot be read by a canvas renderer or a Node script.
 * So the duplication is deliberate — but two hand-maintained copies of one set
 * of numbers is precisely the drift shape the design-token guard exists to
 * catch, and nothing else in the build would notice them diverging. A missing
 * property renders unstyled; a stale one renders the wrong colour. Neither
 * fails typecheck.
 *
 * The mapping is mechanical rather than a hand-written table, because a table
 * is a third copy that can drift too: a camelCase key maps to its kebab-case
 * property (`inkDeep` → `--su-color-ink-deep`, `wkBg2` → `--su-color-wk-bg-2`,
 * `tl1` → `--su-color-tl-1`), and an all-digit key is used verbatim
 * (`space[8]` → `--su-space-8`).
 *
 * Both directions are asserted. A one-way check would let an orphan custom
 * property — a token deleted from TypeScript but left in the CSS — survive
 * indefinitely.
 */

const CSS_PATH = join(import.meta.dir, '../styles/index.css')

/** TS group name → the `--su-<prefix>-` the CSS emits it under. */
const GROUPS = {
  bw: borderWidth,
  color,
  font,
  radius,
  space,
  text: fontSize,
  tracking,
  weight,
} as const satisfies Record<string, Record<string, string | number>>

const PREFIXES = Object.keys(GROUPS) as (keyof typeof GROUPS)[]

/**
 * `inkDeep` → `ink-deep`, `wkBg2` → `wk-bg-2`, `tl1` → `tl-1`, `8` → `8`.
 * An all-digit key is a spacing rung and is used as-is; anything else gets a
 * separator before each capital and before each digit run.
 */
function kebab(key: string): string {
  if (/^\d+$/.test(key)) return key
  return key
    .replace(/([A-Z])/g, '-$1')
    .replace(/(\d+)/g, '-$1')
    .toLowerCase()
}

/** The declarations inside the single top-level `:root` block, comments stripped. */
function readRootDeclarations(): Map<string, string> {
  const css = readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const open = css.indexOf(':root {')
  if (open === -1) throw new Error(`no :root block in ${CSS_PATH}`)
  const close = css.indexOf('}', open)
  if (close === -1) throw new Error(`unterminated :root block in ${CSS_PATH}`)
  const block = css.slice(open, close)

  const out = new Map<string, string>()
  for (const m of block.matchAll(/--su-([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = m
    if (name && value) out.set(name, value.trim())
  }
  return out
}

/** Follow `var(--su-x)` aliases to the literal they point at. */
function resolve(value: string, declarations: Map<string, string>, depth = 0): string {
  const alias = value.match(/^var\(--su-([a-z0-9-]+)\)$/)
  if (!alias?.[1]) return value
  if (depth > 8) throw new Error(`custom-property alias cycle at --su-${alias[1]}`)
  const target = declarations.get(alias[1])
  if (target === undefined) throw new Error(`--su-${alias[1]} referenced but never defined`)
  return resolve(target, declarations, depth + 1)
}

const declarations = readRootDeclarations()

/** Every token, flattened to the custom-property name it must be emitted as. */
const expected = new Map<string, string>()
for (const prefix of PREFIXES) {
  for (const [key, value] of Object.entries(GROUPS[prefix])) {
    expected.set(`${prefix}-${kebab(key)}`, String(value))
  }
}

describe('design token parity', () => {
  test('the guard actually parsed the stylesheet', () => {
    // A moved file or a reshaped :root block would otherwise make every
    // assertion below pass vacuously.
    expect(declarations.size).toBeGreaterThan(80)
    expect(expected.size).toBeGreaterThan(80)
  })

  test('every token is emitted as a --su-* custom property with the same value', () => {
    const mismatches: string[] = []
    for (const [name, value] of expected) {
      const declared = declarations.get(name)
      if (declared === undefined) {
        mismatches.push(`--su-${name} is missing from styles/index.css`)
        continue
      }
      const resolved = resolve(declared, declarations)
      if (resolved !== value) {
        mismatches.push(`--su-${name}: css has "${resolved}", tokens.ts has "${value}"`)
      }
    }
    expect(
      mismatches,
      'design/tokens.ts and styles/index.css have drifted — edit both, never one'
    ).toEqual([])
  })

  test('no --su-* custom property outlives the token it came from', () => {
    const orphans = [...declarations.keys()]
      .filter((name) => !expected.has(name))
      .map((name) => `--su-${name} is declared in styles/index.css but is not a token`)
    expect(orphans, 'delete the property, or add the token it belongs to').toEqual([])
  })
})
