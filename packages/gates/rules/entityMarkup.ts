/**
 * The `styling` rule set's comment strippers and its `entity-markup` rule
 * (R7), kept beside `stylingOwnership.ts`, which runs them.
 */

import type { Finding } from '../lib/ruleEngine'
import { listFiles } from '../lib/ruleEngine'

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

/** The app: R7's surface, every file of it but the entity forms' own. */
const APP_DIR = 'apps/web/src/'

/**
 * Where entity markup is drawn and styled: the forms' code and their one
 * stylesheet (`index.css` imports it into the package layer).
 */
const ENTITY_HOMES = [
  'apps/web/src/components/entity/',
  'apps/web/src/styles/partials/entity-forms.css',
] as const

/** An entity form's inner class: its markup, which only `components/entity/` draws. */
const ENTITY_PART_CLASS = /\bsu-entity-(?:compact|mini)__[\w-]+/g

/**
 * R7 (hard-rules.md): entity markup lives only in `components/entity/` (EDL
 * E15), and its styling only in `entity-forms.css`. Anywhere else in the app
 * (Play, Build, the library's other containers and stylesheets) a rule that
 * restyles a Compact's frame or main, or code that draws a Mini's pill by its
 * class, is a second entity form; the form's own props say what a host needs
 * instead (`Box`'s `reference`, `fill` and `shrink`, `Compact`'s `dim`, the
 * pill's `--su-mini-end`), and a cascade handback names a part by its
 * `data-handback`. The imports' half is Biome's `noRestrictedImports` over
 * `apps/web/src/**` outside `components/entity/`.
 *
 * `files` are repo-relative (the app's CSS and source); `read` reads one.
 */
function scanEntityMarkup(files: readonly string[], read: (rel: string) => string): Finding[] {
  const out: Finding[] = []
  // A test reads the DOM it is handed; it draws nothing.
  const outside = files.filter(
    (rel) =>
      rel.startsWith(APP_DIR) &&
      !ENTITY_HOMES.some((home) => rel.startsWith(home)) &&
      !rel.includes('__tests__/') &&
      !/\.test\.tsx?$/.test(rel)
  )
  for (const rel of outside) {
    const text = rel.endsWith('.css') ? stripCssComments(read(rel)) : stripTsComments(read(rel))
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(ENTITY_PART_CLASS)) {
        out.push({ file: rel, line: i + 1, detail: `entity markup '${m[0]}' outside entity/` })
      }
    })
  }
  return out
}

/** `scanEntityMarkup` over every stylesheet under `apps/web/src` (the library's included) and `source`. */
export function scanEntityMarkupIn(
  root: string,
  source: readonly string[],
  read: (rel: string) => string
): Finding[] {
  return scanEntityMarkup([...listFiles(root, [APP_DIR], ['.css']), ...source], read)
}
