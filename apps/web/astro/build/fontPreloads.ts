/**
 * fontPreloads — the webfonts every page preloads from `<head>`.
 *
 * Without a preload the browser discovers a font only after it has parsed the
 * stylesheet and laid the page out, so the first paint is in the fallback face
 * and the swap to Barlow re-wraps text. Measured at phone width on design-refresh:
 * the breadcrumb row's description wrapped to a second line in the wider
 * fallback and folded back on the swap, moving `<main>` 25px — a CLS of 0.21 to
 * 0.31 on every index and show page whose trail is long enough to wrap.
 *
 * Only the faces every page paints above the fold: Barlow 400 and 500 for body
 * text, Barlow Semi Condensed 600 and 700 for the bar, the trail and headings.
 * The other three weights still load on demand through `@font-face`. Each file
 * is ~23 KB and latin-only (the other subsets sit behind `unicode-range`).
 */

/** Source basenames of the preloaded faces, as `@fontsource` names its files. */
export const PRELOADED_FONTS = [
  'barlow-latin-400-normal',
  'barlow-latin-500-normal',
  'barlow-semi-condensed-latin-600-normal',
  'barlow-semi-condensed-latin-700-normal',
] as const

/**
 * The tagline's hand (Caveat 600, `lib/scriptFont.ts`), preloaded only by a
 * page that sets the quote above the fold (`DocumentMeta.preloadScriptFont`):
 * the SRD's home. Discovered at layout instead, it landed after the first
 * paint, and the wider fallback hand re-wrapped the quote on the swap and
 * moved the index under it (CLS 0.035 on `/` in the perf budget; 0 with the
 * preload, for about 120 ms of LCP on slow 4G, measured on a laptop).
 */
export const SCRIPT_FONT_FILE = 'caveat-latin-600-normal'

/**
 * The emitted URL of one face, picked from the fonts the base stylesheet
 * emits (`assets/<name>-<hash>.woff2`, `src/styles/baseStylesheet.ts`).
 *
 * Throws when the face is missing: a renamed `@fontsource` file or a dropped
 * import would otherwise ship pages that silently preload nothing.
 */
function pickFont(name: string, emittedAssets: readonly string[]): string {
  const file = emittedAssets.find((asset) =>
    new RegExp(`(^|/)${name}-[\\w-]+\\.woff2$`).test(asset)
  )
  if (!file) {
    throw new Error(
      `[build] font preload "${name}.woff2" is not among the base stylesheet's emitted fonts. Update astro/build/fontPreloads.ts to match the @fontsource imports in src/styles/base.css.`
    )
  }
  return `/${file}`
}

/** The emitted URL of each face every page preloads, in order. */
export function pickFontPreloads(emittedAssets: readonly string[]): string[] {
  return PRELOADED_FONTS.map((name) => pickFont(name, emittedAssets))
}

/** The emitted URL of the tagline's hand, for the pages that ask for it. */
export function pickScriptFontPreload(emittedAssets: readonly string[]): string {
  return pickFont(SCRIPT_FONT_FILE, emittedAssets)
}
