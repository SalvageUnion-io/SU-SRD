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
