import type { Foreground } from '../../design/contrast'
import type { SpeckleGrain } from './Speckle'

/**
 * The Union bar wears the colour of the band a page leads with: its ground,
 * its foreground and its grain, so the site header and the page's band read as
 * one colour, with no rule between them. The footer stays ink.
 *
 * A band cannot reach the bar through the cascade (the bar is the page's
 * sibling, not its ancestor), so each page-scale band serves a rule that
 * recolours the bar **only while it is the page's leading band**: nothing
 * precedes it in the page's `<main>` (it is a first child, of `main` or of
 * its first child, down to three levels: a `PageShell`, an entity page's
 * article, the home page's band), or it is a sheet's band in
 * `.su-page-gutters`, whose sticky bar is served before it. A band anywhere
 * else (a dialog's, one mid-page) serves the rule too, and it never matches.
 *
 * The rule sets the `--su-bar-*` properties `.su-union-bar` reads
 * (`styles/partials/shell.css`); every colour the bar draws is one of them.
 * Only the reference's bar matches: the app's wears its area's colour on
 * every route (`data-mode`, `compositions/AppBar.tsx`).
 */
const BAND = ".su-chapter-band[data-layout='bleed']"
const LEADING_BAND = `:is(${[
  `main > ${BAND}:first-child`,
  `main > :first-child > ${BAND}:first-child`,
  `main > :first-child > :first-child > ${BAND}:first-child`,
  `.su-page-gutters > ${BAND}`,
].join(', ')})`

/** The band's attribute the rule keys on. */
export const BAND_KEY_ATTRIBUTE = 'data-band'

/** The opposite of a foreground: the text on a plate of it (the current tab). */
const ON: Record<Foreground, Foreground> = { ink: 'paper', paper: 'ink' }

export function unionBarMatchCss(
  key: string,
  band: string,
  foreground: Foreground,
  grain: SpeckleGrain
): string {
  // The two grains the bar serves: the band's shows, the other is hidden.
  const shown = (layer: SpeckleGrain) => (layer === grain ? 'contents' : 'none')
  return (
    `:root:has(${LEADING_BAND}[${BAND_KEY_ATTRIBUTE}='${key}']) .su-union-bar[data-mode='reference']{` +
    `--su-bar-bg:${band};` +
    `--su-bar-fg:var(--color-${foreground});` +
    `--su-bar-on-fg:var(--color-${ON[foreground]});` +
    // No rule between the bar and the band: they are one colour.
    '--su-bar-rule:transparent;' +
    `--su-bar-grain-paper:${shown('paper')};` +
    `--su-bar-grain-ink:${shown('ink')}}`
  )
}
