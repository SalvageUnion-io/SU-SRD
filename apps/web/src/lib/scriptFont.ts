/**
 * The hand the legacy tagline is quoted in: Caveat, self-hosted beside Barlow
 * (`astro/build/fonts.ts`), so it renders offline and under the CSP like the
 * rest of the type. The front door, the SRD's home and the link preview set
 * the quote in it. Astro's Fonts API names its stack by this property.
 */
export const SCRIPT_FONT_VARIABLE = '--font-caveat'
export const SCRIPT_FONT = `var(${SCRIPT_FONT_VARIABLE})`

/** The face the quote is set in, as `FontFaceSet.load` names it: `stack` is the property's value. */
export const scriptFace = (stack: string): string => `600 1em ${stack}`

/** Whether `pathname` is the front door, `/` under the app's base path. */
export function isFrontDoor(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname === `${basePath}/`
}

/**
 * Starts the quote's face downloading at boot when the page is the front door,
 * rather than when the quote first lays out.
 *
 * A browser fetches a web font only once text set in it is laid out, and the
 * front door lays out only after the reference data has loaded
 * (`GameDataReady`). Fetched then, the face landed after the first paint and
 * swapped in under it: the fallback hand is wider, so on a phone the quote took
 * two lines and then one, and everything under it jumped (CLS 0.13 at 390px).
 * Asked for at boot, it downloads beside the reference data and is in hand when
 * the quote paints. Only on the front door: no other page sets the quote, so
 * none other pays for the face.
 *
 * `fonts` is absent outside a real browser (the test DOM). The load is a hint
 * the quote's own layout repeats, so its failure needs no handling here.
 */
export function preloadScriptFont(
  pathname: string,
  basePath: string,
  fonts: Pick<FontFaceSet, 'load'> | undefined,
  stack: string
): void {
  if (!fonts || !stack || !isFrontDoor(pathname, basePath)) return
  fonts.load(scriptFace(stack)).catch(() => {
    // A hint only: the quote's layout asks for the face again, and falls back to `cursive`.
  })
}
