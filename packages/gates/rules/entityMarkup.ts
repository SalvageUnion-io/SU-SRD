/**
 * The `styling` rule set's comment strippers and its `entity-markup` rule
 * (R7), kept beside `stylingOwnership.ts`, which runs them.
 */

import type { Finding } from '../lib/ruleEngine'

/** Strip /* … *\/ comments so regexes never match commented-out CSS. */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

/**
 * Strip both block and line comments from TS/TSX so class-name extraction never
 * mistakes PROSE for a live reference: documentation of a removed class must
 * not read as a usage.
 * Line comments are only stripped when `//` follows whitespace or line-start, so
 * `https://…` and `'a//b'` string contents are left intact.
 */
export function stripTsComments(src: string): string {
  return stripCssComments(src).replace(/(^|\s)\/\/[^\n]*/g, '$1')
}

/** Play's own code and stylesheets: R7's surface. */
const PLAY_DIRS = ['apps/web/src/play/', 'apps/web/src/styles/play/'] as const

/** An entity form's inner class: its markup, which only `components/entity/` draws. */
const ENTITY_PART_CLASS = /\bsu-entity-(?:row|token)__[\w-]+/g

/**
 * R7 (hard-rules.md): Play draws with the shared primitives, so entity markup
 * lives only in `components/entity/` (EDL E15). A Play stylesheet that
 * restyles a Row's frame or main, or Play code that draws a Token's pill by
 * its class, is a second entity form; the form's own props (`Box`'s
 * `reference` and `fill`, `Row`'s `dim`) say what Play needs instead. The
 * imports' half is Biome's `noRestrictedImports` over `apps/web/src/play/**`.
 *
 * `files` are repo-relative (the app's CSS and source); `read` reads one.
 */
export function scanEntityMarkup(
  files: readonly string[],
  read: (rel: string) => string
): Finding[] {
  const out: Finding[] = []
  // A test reads the DOM it is handed; it draws nothing.
  const play = files.filter(
    (rel) => PLAY_DIRS.some((dir) => rel.startsWith(dir)) && !/__tests__\/|\.test\.tsx?$/.test(rel)
  )
  for (const rel of play) {
    const text = rel.endsWith('.css') ? stripCssComments(read(rel)) : stripTsComments(read(rel))
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(ENTITY_PART_CLASS)) {
        out.push({ file: rel, line: i + 1, detail: `entity markup '${m[0]}' outside entity/` })
      }
    })
  }
  return out
}
