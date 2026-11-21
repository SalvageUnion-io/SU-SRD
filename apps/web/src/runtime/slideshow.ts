/**
 * The home's slideshow controls (`HomeHero`): the server draws them hidden;
 * this shows them and makes them work. Plain DOM: the page loads no React.
 *
 * - **Pause** (WCAG 2.2.2), a `Toggle` at rest: pressed, it holds the show
 *   (`[data-paused]`, `front.css`) and wears the Toggle's pressed ink plate.
 * - **Previous** and **Next** turn the show by hand. The show is one CSS
 *   animation per slide, all on one clock, so a turn sets that clock: the
 *   slide landed on starts its turn afresh, in either direction, so the show
 *   waits a full step before it moves on by itself; paused, it stays.
 * - **A touch** on a slide's words or its action holds the show for as long
 *   as the finger is down (`[data-touched]`): a touch screen has no hover, and
 *   a slide must never turn away under the press that reaches for its button.
 */

/** The part of a step a slide spends sliding in (`su-front-show`: 2.5% of eight steps). */
const ENTRY = 0.2

/**
 * The show's clock (ms) after a turn of `by` slides from `now`, in a loop of
 * `count` slides `step` ms each. Slide i stands still from `i * step`; the one
 * sliding in already counts as the one in view. Turning, the clock lands where
 * the slide it turns to starts to slide in, forward or back: the turn is seen,
 * and that slide has its whole step before the show moves on. Held, it lands
 * on the slide standing still.
 */
export function turnedClock(
  now: number,
  by: number,
  { step, count, held }: { step: number; count: number; held: boolean }
): number {
  const total = step * count
  const phase = ((now % total) + total) % total
  const inView = Math.floor(phase / step + ENTRY) % count
  const target = (((inView + by) % count) + count) % count
  const at = target * step - (held ? 0 : step * ENTRY)
  return (at + total) % total
}

function turn(show: HTMLElement, by: number): void {
  const slides = [...show.querySelectorAll<HTMLElement>('.su-front__show-slide')]
  const clocks = slides.flatMap((slide) => slide.getAnimations?.().slice(0, 1) ?? [])
  const first = clocks[0]
  // Under reduced motion nothing turns, and there is nothing to set.
  if (first === undefined || clocks.length !== slides.length) return
  const total = Number(first.effect?.getComputedTiming().duration ?? 0)
  if (!(total > 0)) return
  const at = turnedClock(Number(first.currentTime) || 0, by, {
    step: total / slides.length,
    count: slides.length,
    held: show.hasAttribute('data-paused'),
  })
  for (const clock of clocks) clock.currentTime = at
}

export function watchSlideshow(root: ParentNode): void {
  for (const show of root.querySelectorAll<HTMLElement>('.su-front__show')) {
    const controls = show.querySelector<HTMLElement>('[data-show-controls]')
    const pause = show.querySelector<HTMLButtonElement>('[data-show-pause]')
    if (!controls || !pause) continue
    controls.hidden = false
    pause.addEventListener('click', () => {
      const paused = pause.getAttribute('aria-pressed') !== 'true'
      pause.setAttribute('aria-pressed', String(paused))
      pause.classList.toggle('su-btn--ink', paused)
      pause.classList.toggle('su-btn--default', !paused)
      show.toggleAttribute('data-paused', paused)
    })
    for (const button of show.querySelectorAll<HTMLButtonElement>('[data-show-turn]')) {
      button.addEventListener('click', () => turn(show, Number(button.dataset.showTurn)))
    }
    // A finger down on a slide's plate holds the show until it lifts.
    const doc = show.ownerDocument
    const release = () => show.removeAttribute('data-touched')
    show.addEventListener('pointerdown', (event) => {
      const on =
        event.target instanceof Element ? event.target.closest('.su-front__show-copy') : null
      if (on) show.setAttribute('data-touched', '')
    })
    doc.addEventListener('pointerup', release)
    doc.addEventListener('pointercancel', release)
  }
}
