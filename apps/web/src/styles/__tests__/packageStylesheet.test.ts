import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PACKAGE_STYLESHEET, readPackageStylesheet } from './packageStylesheet'

/**
 * `index.css` is the package stylesheet's imports and nothing else; its rules
 * live in `partials/`. A part it does not import never ships, and nothing else
 * would notice: every class in it renders unstyled, every build stays green.
 */
const PARTIALS = join(import.meta.dir, '../partials')

const imports = (): string[] =>
  [
    ...readFileSync(PACKAGE_STYLESHEET, 'utf8').matchAll(/^@import '\.\/partials\/([^']+)';$/gm),
  ].map((m) => m[1] ?? '')

describe('the package stylesheet', () => {
  test('imports every part exactly once', () => {
    const parts = readdirSync(PARTIALS).filter((f) => f.endsWith('.css'))
    expect([...imports()].sort()).toEqual([...parts].sort())
  })

  test('holds no rule of its own, only the imports', () => {
    const rest = readFileSync(PACKAGE_STYLESHEET, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^@import '[^']+';$/gm, '')
    expect(rest.trim()).toBe('')
  })

  test('reads joined with no import left', () => {
    expect(readPackageStylesheet()).not.toMatch(/^@import/m)
  })
})

/** The declarations of every rule whose selector ends in `selector`, at one `@media` (or none). */
const rulesFor = (css: string, selector: string, media: string | null): string => {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: string[] = []
  let depth = 0
  let current: string | null = null
  let start = 0
  for (let i = 0; i < flat.length; i++) {
    const ch = flat[i]
    if (ch === '{') {
      const head = flat.slice(start, i).trim()
      if (head.startsWith('@media')) current = head.replace(/^@media\s*/, '')
      else if (
        head.replace(/\s+/g, ' ').endsWith(selector) &&
        (depth === 0 ? media === null : current === media)
      ) {
        out.push(flat.slice(i + 1, flat.indexOf('}', i)))
      }
      depth++
      start = i + 1
    } else if (ch === '}') {
      depth--
      if (depth === 0) current = null
      start = i + 1
    } else if (ch === ';' && depth === 0) start = i + 1
  }
  return out.join(';')
}

const paddingEnd = (decls: string): string | undefined =>
  decls
    .match(/padding-inline(?:-end)?:\s*([^;]+)/)?.[1]
    ?.trim()
    .split(/\s+/)
    .pop()

describe('the band corner and the Union bar', () => {
  // The corner's controls sit a row under the bar's buttons (owner's call,
  // 2026-10-17): one right edge at every width, so the corner's end padding
  // is the bar row's padding at each of its breakpoints.
  const css = readPackageStylesheet()
  for (const media of [null, 'not (width >= 40rem)', '(width >= 40rem)']) {
    test(`share a right edge ${media ?? 'by default'}`, () => {
      const bar = paddingEnd(rulesFor(css, '.su-union-bar__row', media))
      const corner = paddingEnd(rulesFor(css, '.su-chapter-band__corner', media))
      expect(bar).toBeDefined()
      expect(corner).toBe(bar)
    })
  }
})
