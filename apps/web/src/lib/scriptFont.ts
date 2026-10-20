/**
 * The hand the legacy tagline is quoted in: Caveat, self-hosted beside Barlow
 * in the base stylesheet (`styles/base.css`), so it renders offline and under
 * the CSP like the rest of the type. The front door, the SRD's home and the
 * link preview set the quote in it.
 */
export const SCRIPT_FONT = "'Caveat', cursive"

/** The face the quote is set in, as `FontFaceSet.load` names it. */
export const SCRIPT_FACE = `600 1em ${SCRIPT_FONT}`

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
  fonts: Pick<FontFaceSet, 'load'> | undefined
): void {
  if (!fonts || !isFrontDoor(pathname, basePath)) return
  fonts.load(SCRIPT_FACE).catch(() => {
    // A hint only: the quote's layout asks for the face again, and falls back to `cursive`.
  })
}
