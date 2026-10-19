import type { Foreground } from '../../design/contrast'
import type { SpeckleGrain } from './Speckle'

/**
 * The Union bar wears the colour of the band a page leads with: its ground,
 * its foreground and its grain, so the site header and the page's band read as
 * one colour, with no rule between them. The site footer wears it too
 * (`footerMatchCss`, owner's call 2026-10-19): a page ends in the colour it
 * leads with, and one with no leading band keeps the footer's ink.
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
 * The bar matches in every mode, front pages included (owner's call,
 * 2026-10-19); a page with no leading band keeps its area's colour
 * (`data-mode`, `compositions/AppBar.tsx`).
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

/**
 * The bar's faded steps for a foreground, as its alpha tokens: the bar's own
 * defaults are paper's (`--color-paper-NN`, chrome K1), so only an ink
 * foreground sets them (ink has no 70 step: 75).
 */
const STEPS: Record<Foreground, string> = {
  ink:
    '--su-bar-fg-85:var(--color-ink-85);--su-bar-fg-70:var(--color-ink-75);' +
    '--su-bar-fg-60:var(--color-ink-60);--su-bar-fg-30:var(--color-ink-30);' +
    '--su-bar-fg-15:var(--color-ink-15);',
  paper: '',
}

export function unionBarMatchCss(
  key: string,
  band: string,
  foreground: Foreground,
  grain: SpeckleGrain
): string {
  // The two grains the bar serves: the band's shows, the other is hidden.
  const shown = (layer: SpeckleGrain) => (layer === grain ? 'contents' : 'none')
  return (
    `:root:has(${LEADING_BAND}[${BAND_KEY_ATTRIBUTE}='${key}']) .su-union-bar{` +
    `--su-bar-bg:${band};` +
    `--su-bar-fg:var(--color-${foreground});` +
    `--su-bar-on-fg:var(--color-${ON[foreground]});` +
    STEPS[foreground] +
    // No rule between the bar and the band: they are one colour.
    '--su-bar-rule:transparent;' +
    `--su-bar-grain-paper:${shown('paper')};` +
    `--su-bar-grain-ink:${shown('ink')}}`
  )
}

/**
 * The site footer's rule, the bar's sibling: keyed on the same leading band,
 * it sets the `--su-foot-*` properties the foot band reads (`ChapterFoot`,
 * `styles/partials/shell.css`): the band's ground,
 * its foreground and its grain, and the "Powered by Salvage" mark reversed to
 * paper only on a ground that prints paper.
 */
export function footerMatchCss(
  key: string,
  band: string,
  foreground: Foreground,
  grain: SpeckleGrain
): string {
  const shown = (layer: SpeckleGrain) => (layer === grain ? 'contents' : 'none')
  return (
    `:root:has(${LEADING_BAND}[${BAND_KEY_ATTRIBUTE}='${key}']) .su-chapter-foot{` +
    `--su-foot-bg:${band};` +
    `--su-foot-fg:var(--color-${foreground});` +
    `--su-foot-mark:${foreground === 'paper' ? 'invert(1)' : 'none'};` +
    `--su-foot-grain-paper:${shown('paper')};` +
    `--su-foot-grain-ink:${shown('ink')}}`
  )
}
