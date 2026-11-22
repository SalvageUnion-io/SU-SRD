/**
 * Focus lands on what you made (r6 F7, WCAG 2.4.3): after a create that opens
 * its page (Create Pilot, Create Mech, a Blank create, Build With This), the
 * new page's heading takes focus, so a keyboard user carries on from it
 * rather than from Skip to content.
 *
 * Called as the create navigates: it waits, a frame at a time, for the
 * address to leave the page it was called on and for that page's `<main>` to
 * hold its h1, then focuses it without scrolling. It gives up after
 * `MAX_FRAMES`.
 */

/** About two seconds at 60 frames a second: a sheet that takes longer has been left alone. */
const MAX_FRAMES = 120

type ArrivalDeps = {
  /** The next frame (`requestAnimationFrame`); a test passes its own. */
  schedule?: (run: () => void) => void
  /** The address's path (`location.pathname`); a test passes its own. */
  path?: () => string
}

/** The new page's heading: the first h1 in its `<main>` that is not a wizard step's. */
function arrivedHeading(): HTMLElement | null {
  for (const h1 of document.querySelectorAll<HTMLElement>('main h1')) {
    if (h1.closest('.su-wiz-shell') === null) return h1
  }
  return null
}

export function focusHeadingOnArrival({ schedule, path }: ArrivalDeps = {}): void {
  if (typeof window === 'undefined') return
  const next = schedule ?? ((run: () => void) => window.requestAnimationFrame(run))
  const at = path ?? (() => window.location.pathname)
  const from = at()
  let frames = 0
  const tick = () => {
    frames += 1
    if (frames > MAX_FRAMES) return
    const heading = at() === from ? null : arrivedHeading()
    if (heading === null) {
      next(tick)
      return
    }
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
  }
  next(tick)
}
