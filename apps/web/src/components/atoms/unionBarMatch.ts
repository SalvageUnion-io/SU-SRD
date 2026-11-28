import type { Foreground } from '../../design/contrast'

/**
 * A page-scale band's kind colour (`kindMatchCss`), keyed on the band whose
 * rule matches **only while it is the page's leading band**: nothing precedes
 * it in the page's `<main>` (a first child, of `main` or of its first child,
 * down to three levels), or it is a sheet's band in `.su-page-gutters`. The
 * site header and foot never take a page's colour: they are ink-deep on every
 * page (`styles/partials/shell.css`, chrome K13).
 */
const BAND = ".su-chapter-band[data-layout='bleed']"
const LEADING_BAND = `:is(${[
  `main > ${BAND}:first-child`,
  `main > :first-child > ${BAND}:first-child`,
  `main > :first-child > :first-child > ${BAND}:first-child`,
  `.su-page-gutters > ${BAND}`,
  // A listing's band before its island hydrates sits
  // in the island's stand-in, two wrappers deeper, so the bar stayed ink until
  // hydration (the dark bar on /chassis/ and /systems/).
  `main > :first-child > astro-island > [data-standin] > astro-slot > ${BAND}`,
].join(', ')})`

/** The band's attribute the rule keys on. */
export const BAND_KEY_ATTRIBUTE = 'data-band'

/**
 * The kind colour every head strip and
 * zebra band reads (`--su-kind`, `--su-on-kind`). The page's leading band
 * sets it for the page; any other band (a Peek's, a dialog's) sets it for
 * what shares its parent, so a Peek over a pilot's sheet keeps its own colour
 * and does not repaint the sheet.
 */
export function kindMatchCss(key: string, band: string, foreground: Foreground): string {
  // The area rail stands on the band itself and writes in its foreground
  // (`--su-on-kind`): one colour from the header's foot to the band's.
  const vars = `{--su-kind:${band};--su-on-kind:var(--color-${foreground})}`
  return (
    `:root:has(${LEADING_BAND}[${BAND_KEY_ATTRIBUTE}='${key}'])${vars}` +
    `:has(> ${BAND}[${BAND_KEY_ATTRIBUTE}='${key}'])${vars}`
  )
}
