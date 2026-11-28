/**
 * The `chrome-tokens` rule set's `item-grid` rule (hard rule R68), kept beside
 * `chromeTokens.ts`, which runs it.
 *
 * A grid of items is the one item grid, `.su-grid` (`foundation.css`): a
 * wrapping flex row whose items grow, so a short last row shares the line and
 * no track stands empty. A CSS grid of equal repeated tracks
 * (`repeat(3, …)`, `repeat(auto-fill, …)`) is a second item grid, and its
 * last row orphans a cell whenever the count is not a multiple of its tracks.
 *
 * A fixed matrix that is no list of items (a gauge's pips, a track's ten
 * steps, a roll table's halves) says so on its line:
 * `design-tokens-ignore(item-grid): <what it is>`.
 */

import type { CssDecl } from '../lib/styleSource'

/** Two or more repeated tracks, or as many as fit. */
const REPEATED_TRACKS = /repeat\(\s*(?:auto-fi(?:ll|t)|[2-9]|\d{2,}|\$\{)/

/** Where the one item grid is defined. */
const ITEM_GRID_HOME = 'apps/web/src/styles/partials/foundation.css'

const itemGridCss = (decls: CssDecl[], _blocks: unknown, rel: string) =>
  rel === ITEM_GRID_HOME
    ? []
    : decls
        .filter(
          (d) =>
            (d.prop === 'grid-template-columns' || d.prop === 'grid-template') &&
            REPEATED_TRACKS.test(d.value)
        )
        .map((d) => ({ line: d.line, detail: `${d.context.at(-1)} { ${d.prop}: ${d.value} }` }))

/** The gauges: a pip track is one reading split into rows (ruleset §4.5), no list of items. */
const PIP_TRACKS: readonly string[] = [
  'apps/web/src/components/atoms/VitalGauge.tsx',
  'apps/web/src/components/atoms/PhoneVitals.tsx',
]

/** A style object's `gridTemplateColumns` of repeated tracks. */
const itemGridScript = (text: string, rel: string) =>
  PIP_TRACKS.includes(rel)
    ? []
    : [...text.matchAll(/gridTemplateColumns\s*:\s*(['"`])((?:(?!\1)[^\n])*)\1/g)]
        .filter((m) => REPEATED_TRACKS.test(m[2] ?? ''))
        .map((m) => ({ offset: m.index ?? 0, detail: `gridTemplateColumns: ${m[2]}` }))

/** The rule, spread into the `chrome-tokens` rule set. */
export const itemGridRule = {
  id: 'item-grid',
  mode: 'zero',
  rule: 'hard rule R68 — a grid of items is the one item grid, `.su-grid`: never a CSS grid of repeated equal tracks, whose last row orphans a cell',
  fix: 'Give the list `su-grid` (or render `Grid`) and set what varies in its own class: `--su-grid-min` (an item’s narrowest), `--su-grid-max` (the most a row holds), `--su-grid-gap` / `--su-grid-row-gap`; an item that takes a row of its own sets `flex-basis: 100%`. Drop `display: grid` and `grid-template-columns`. A fixed matrix that is no list (a track’s ten steps, a roll table’s halves) takes `design-tokens-ignore(item-grid): <what it is>` on its line.',
  css: itemGridCss,
  script: itemGridScript,
} as const
