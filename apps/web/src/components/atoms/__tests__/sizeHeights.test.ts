import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readPackageStylesheet } from '../../../styles/__tests__/packageStylesheet'

/**
 * One height per Size (hard rule R12, ruleset §4.6–§4.7): a button and a chip
 * at the same Size are the same height, whatever the component, on every
 * pointer and screen. A phone takes a bigger Size where it needs a bigger
 * target; no control carries an invisible hit area, and no pointer query
 * lifts a Size or floors a button.
 *
 * `_siblingHeights.ts` holds the rendered lines; this holds the stylesheet's
 * half: each Size class sets its token height, and nothing undoes it.
 */

const STYLES = join(import.meta.dir, '../../../styles')
const SIZES = ['mini', 'compact', 'full'] as const

/** Every stylesheet the app loads, comments stripped, by its path. */
function stylesheets(): { file: string; css: string }[] {
  const out: { file: string; css: string }[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(path)
      } else if (entry.name.endsWith('.css')) {
        out.push({ file: path, css: readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') })
      }
    }
  }
  walk(STYLES)
  return out
}

/** The declarations of the first rule whose selector is exactly `selector`. */
function declarations(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

describe('one height per Size', () => {
  const pkg = readPackageStylesheet().replace(/\/\*[\s\S]*?\*\//g, '')

  test.each([...SIZES])('a %s button and a %s chip are its token high', (size) => {
    expect(declarations(pkg, `.su-btn--${size}`)).toMatch(
      new RegExp(`(?:^|;|\\s)height:\\s*var\\(--size-${size}\\)`)
    )
    expect(declarations(pkg, `.su-stat-cell--${size}`)).toMatch(
      new RegExp(`(?:^|;|\\s)height:\\s*var\\(--size-${size}\\)`)
    )
  })

  test('a Size token is declared once: no pointer or width lifts it', () => {
    for (const { file, css } of stylesheets()) {
      const declared = [...css.matchAll(/--size-(?:mini|compact|full)\s*:/g)]
      if (file.endsWith('theme.css')) expect(declared).toHaveLength(SIZES.length)
      else expect(declared, file).toHaveLength(0)
    }
  })

  test('no control carries an invisible hit area', () => {
    for (const { file, css } of stylesheets()) {
      expect(css, file).not.toContain('su-hit-area')
      expect(css, file).not.toMatch(/::(?:after|before)\s*\{[^}]*max\(100%,\s*var\(--size-/)
    }
  })

  test('no pointer query floors a button', () => {
    for (const { file, css } of stylesheets()) {
      for (const block of css.matchAll(
        /@media[^{]*pointer:\s*coarse[^{]*\{((?:[^{}]*\{[^}]*\})*)/g
      )) {
        for (const rule of (block[1] ?? '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
          const [, selector = '', body = ''] = rule
          if (!/min-height/.test(body)) continue
          expect(selector, file).not.toMatch(/(?:^|[\s,(])(?:button|\.su-btn)\b/)
        }
      }
    }
  })
})
