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
 * The emitted URL of each preloaded face, picked from the assets the Vite
 * manifest lists for the styles entry (`assets/<name>-<hash>.woff2`).
 *
 * Throws when a face is missing: a renamed `@fontsource` file or a dropped
 * import would otherwise ship pages that silently preload nothing.
 */
export function pickFontPreloads(emittedAssets: readonly string[]): string[] {
  return PRELOADED_FONTS.map((name) => {
    const file = emittedAssets.find((asset) =>
      new RegExp(`(^|/)${name}-[\\w-]+\\.woff2$`).test(asset)
    )
    if (!file) {
      throw new Error(
        `[ssg] font preload "${name}.woff2" is not among the styles entry's emitted assets. Update PRELOADED_FONTS in ssg/fontPreloads.ts to match the @fontsource imports in src/runtime/styles.entry.ts.`
      )
    }
    return `/${file}`
  })
}
