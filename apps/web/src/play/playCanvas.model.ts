/**
 * playCanvas.model — the fixed canvas's arithmetic (ADR-038 §9, ADR-045):
 * its design size, and whether a host draws it or hands over to the phone
 * form, browser zoom included. Pure; `PlayCanvas` reads the window and asks.
 */

/** The canvas's design size, in CSS px (ADR-038 §9). */
export const CANVAS_W = 1280
export const CANVAS_H = 800

/**
 * The canvas's smallest text, in CSS px at a scale of 1: its stamps, chip
 * labels and Mini buttons sit on the type floor (`fontSize.badge`, ruleset
 * §4.6), and nothing on it is smaller (`tokens/type-floor` holds the source).
 */
const SMALLEST_TEXT = 11

/** The type floor as drawn (ruleset §4.6, hard rule R12). */
const TYPE_FLOOR = 11

/**
 * The canvas's floor: the smallest scale that keeps its smallest text on the
 * type floor as drawn (ADR-045 decision 1). Its smallest text is the floor
 * itself, so this is 1: the canvas never draws below its design size, and any
 * host smaller than 1280 × 800 on either axis gets the phone form.
 */
const MIN_SCALE = TYPE_FLOOR / SMALLEST_TEXT

/**
 * The zoom steps a reading must land on to count (ADR-045 §7): Chromium's
 * and Safari's steps above 100%. A side panel, docked devtools or vertical
 * tabs widen the window by any amount; zoom widens it by one of these.
 */
const ZOOM_STEPS = [1.1, 1.15, 1.25, 1.5, 1.75, 2, 2.5, 3] as const

/**
 * How far a reading may sit from its step. Window chrome (a Windows frame)
 * only ever adds to `outerWidth`, by about 2% at most, so the slack over is
 * wider than the slack under, which only covers rounding. The page's own
 * scrollbar is not chrome here: `layoutWidth` counts it in the viewport.
 */
const ZOOM_SLACK_OVER = 0.03
const ZOOM_SLACK_UNDER = 0.01

/**
 * Display densities come in quarters (Windows and Linux scaling at 100%,
 * 125%, 150%…, a Retina screen at 2), so `devicePixelRatio` over a real zoom
 * lands on one exactly, give or take float precision. The slack stays that
 * tight because a looser one admits panels: at 2%, a ~200px side panel on a
 * Retina screen reads 1.15, and 2 / 1.15 = 1.739 sits 0.6% from 1.75.
 */
const DENSITY_STEP = 0.25
const DENSITY_SLACK = 0.002

/** What `pageZoom` reads off the window. */
export type ZoomReading = {
  /** The display's density times the page zoom. */
  devicePixelRatio: number
  /** The window's width in screen px, which page zoom leaves alone in Chromium and Safari. */
  outerWidth: number
  /** The layout viewport's width in CSS px, scrollbar included (`layoutWidth`), which page zoom shrinks. */
  viewportWidth: number
}

/**
 * The layout viewport's width in CSS px, scrollbar included: what
 * `pageZoom` divides `outerWidth` by.
 *
 * `clientWidth` alone leaves out the page's scrollbar, and only the phone
 * form has one (the canvas never scrolls). Read that way, switching to the
 * phone form would itself raise the reading, by a scrollbar's width, and
 * near a step's edge that drops the zoom, lowers the floor and switches back,
 * forever. `innerWidth` counts the scrollbar, so the reading is the same in
 * both forms. `clientWidth` stays its floor, because a pinch-zoom shrinks
 * `innerWidth` (the visual viewport) in Chromium and Safari, and a pinch is
 * not page zoom. (The host's own width also loses the scrollbar in the phone
 * form, but that only pushes further below the floor, so it cannot flip.)
 */
export function layoutWidth(clientWidth: number, innerWidth: number): number {
  return Math.max(clientWidth, innerWidth)
}

/** Whether `devicePixelRatio` over `zoom` is a display density a screen ships with. */
function plausibleDensity(devicePixelRatio: number, zoom: number): boolean {
  const density = devicePixelRatio / zoom
  const nearest = Math.round(density / DENSITY_STEP) * DENSITY_STEP
  return nearest >= 1 && Math.abs(density / nearest - 1) <= DENSITY_SLACK
}

/**
 * The browser's page zoom, normalised against the display's own density
 * (ADR-045 §7): 1 at 100%, 1.5 at 150%.
 *
 * `devicePixelRatio` alone cannot tell zoom from density: a Retina screen at
 * 100% and a 1x screen at 200% both report 2. The window's width in screen
 * px over its viewport in CSS px is the zoom, but anything else that widens
 * the window past its viewport (a side panel, docked devtools, vertical tabs)
 * reads the same way, and on a high-density screen `devicePixelRatio` is no
 * cap on it. So a reading counts only when it snaps to a browser zoom step
 * and leaves a density a screen ships with (`devicePixelRatio` over the
 * step, in quarters from 1): a 400px side panel on a 1512px Retina window
 * reads 1.36, between steps, and reads 1. Every doubtful reading is 1, which
 * is the canvas's old behaviour: a panel reads as zoom only by landing on a
 * step and a density at once. Firefox scales `outerWidth` with the page, so it
 * reads 1 there too. Zooming out reads 1 as well: it never moves the floor.
 */
export function pageZoom({ devicePixelRatio, outerWidth, viewportWidth }: ZoomReading): number {
  if (!(outerWidth > 0) || !(viewportWidth > 0) || !(devicePixelRatio > 0)) return 1
  const ratio = outerWidth / viewportWidth
  const step = ZOOM_STEPS.find(
    (s) => ratio >= s * (1 - ZOOM_SLACK_UNDER) && ratio <= s * (1 + ZOOM_SLACK_OVER)
  )
  return step !== undefined && plausibleDensity(devicePixelRatio, step) ? step : 1
}

/**
 * Whether a host of `width` × `height` CSS px gets the phone form: it would
 * draw the canvas below `MIN_SCALE` on EITHER axis, so its 11px text would
 * draw under 11px. Both axes: a window short of 800px squeezes the canvas as
 * surely as a narrow one, and a landscape phone is both.
 *
 * `zoom` (from `pageZoom`) raises the floor with it (ADR-045 §7). A
 * scale-to-fit canvas cancels browser zoom: an 11px label paints at the same
 * device px at 100%, 150% and 175%. So zoom is the reader asking for more
 * than the canvas can give, and at 150% the canvas must reach 1.5 × its
 * design size or hand over to the phone form, whose type does grow with zoom.
 */
export function isPhoneForm(width: number, height: number, zoom = 1): boolean {
  return Math.min(width / CANVAS_W, height / CANVAS_H) < MIN_SCALE * Math.max(1, zoom)
}

// Uniform upscale cap — generous enough to fill a 4K display's height while
// still guarding against an absurdly large render on giant panels (beyond which
// the canvas grows in its own units instead).
const MAX_SCALE = 2.6

/** How the canvas fills a host: its scale, and its size in its own units. */
export type CanvasFit = { scale: number; width: number; height: number }

/**
 * How the canvas fills a `width` × `height` host (ADR-038 §9): scaled
 * uniformly by whichever axis binds first (capped), then widened or
 * lengthened in its own units, never below its design size, so that at that
 * scale it covers the host. The Play bar and foot run edge to edge and no
 * page ground letterboxes the screen.
 */
export function canvasFit(width: number, height: number): CanvasFit {
  const scale = Math.min(MAX_SCALE, width / CANVAS_W, height / CANVAS_H)
  return {
    scale,
    width: Math.max(CANVAS_W, Math.floor(width / scale)),
    height: Math.max(CANVAS_H, Math.floor(height / scale)),
  }
}
