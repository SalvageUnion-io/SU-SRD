/**
 * fonts — the site's three faces, through Astro's Fonts API: `fonts` in
 * `astro.config.ts` emits them under `/assets/fonts/`, and every document's
 * head (`astro/components/Fonts.astro`) inlines their `@font-face` rules and
 * preloads the ones it paints first. Barlow sets body text, Barlow Semi
 * Condensed the all-caps chrome, and Caveat the tagline's hand
 * (`lib/scriptFont.ts`).
 *
 * Self-hosted from the `@fontsource` packages (the local provider: the build
 * fetches nothing), latin only. Each family falls back to a metric-matched
 * local face Astro generates per weight, so the swap to the webfont does not
 * re-wrap text: a wider fallback once moved `<main>` on a phone by a CLS of
 * 0.2-0.3.
 */

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fontProviders } from 'astro/config'

const require = createRequire(import.meta.url)

/** One `@fontsource` face's latin file, which its package's exports do not name. */
function face(pkg: string, weight: number) {
  const files = join(dirname(require.resolve(`@fontsource/${pkg}`)), 'files')
  return {
    weight,
    style: 'normal' as const,
    src: [join(files, `${pkg}-latin-${weight}-normal.woff2`)] as [string],
  }
}

function family(
  name: string,
  cssVariable: string,
  pkg: string,
  weights: number[],
  fallback: string
) {
  const [first, ...rest] = weights.map((weight) => face(pkg, weight))
  if (!first) throw new Error(`[fonts] ${name} names no weight`)
  return {
    provider: fontProviders.local(),
    name,
    cssVariable,
    fallbacks: [fallback],
    options: { variants: [first, ...rest] as [typeof first, ...(typeof first)[]] },
  }
}

export const FONTS = [
  family('Barlow', '--font-barlow', 'barlow', [400, 500, 600, 700], 'sans-serif'),
  family(
    'Barlow Semi Condensed',
    '--font-barlow-cond',
    'barlow-semi-condensed',
    [500, 600, 700],
    'sans-serif'
  ),
  family('Caveat', '--font-caveat', 'caveat', [600], 'cursive'),
]
