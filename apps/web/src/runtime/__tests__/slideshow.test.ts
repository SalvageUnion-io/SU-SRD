import { describe, expect, test } from 'bun:test'
import { turnedClock, watchSlideshow } from '../slideshow'

const STEP = 7000
const show8 = { step: STEP, count: 8 }

describe('turnedClock', () => {
  test('Next, turning: lands where the next slide starts to slide in', () => {
    expect(turnedClock(STEP * 2.5, 1, { ...show8, held: false })).toBe(STEP * 2.8)
  })

  test('Next, held: lands on the next slide standing still', () => {
    expect(turnedClock(STEP * 2.5, 1, { ...show8, held: true })).toBe(STEP * 3)
  })

  test('Previous lands on the slide before, at the start of its turn', () => {
    expect(turnedClock(STEP * 2.5, -1, { ...show8, held: false })).toBe(STEP)
  })

  test('the slide sliding in is the one in view', () => {
    // At 2.9 steps slide 3 is entering: Next is slide 4, Previous slide 2.
    expect(turnedClock(STEP * 2.9, 1, { ...show8, held: true })).toBe(STEP * 4)
    expect(turnedClock(STEP * 2.9, -1, { ...show8, held: true })).toBe(STEP * 2)
  })

  test('the show is a loop: Previous from the first is the last, Next from the last the first', () => {
    expect(turnedClock(STEP * 0.5, -1, { ...show8, held: false })).toBe(STEP * 7)
    expect(turnedClock(STEP * 7.5, 1, { ...show8, held: true })).toBe(0)
    expect(turnedClock(STEP * 7.5, 1, { ...show8, held: false })).toBe(STEP * 7.8)
    // A second lap reads as the first.
    expect(turnedClock(STEP * 10.5, 1, { ...show8, held: true })).toBe(STEP * 3)
  })
})

function show(slideCount: number, animated = true) {
  document.body.innerHTML = `
    <section class="su-front__show">
      <ul>${'<li class="su-front__show-slide"></li>'.repeat(slideCount)}</ul>
      <div data-show-controls hidden>
        <button data-show-turn="-1"></button>
        <button data-show-pause aria-pressed="false" class="su-btn--default"></button>
        <button data-show-turn="1"></button>
      </div>
    </section>`
  const clocks = [...document.querySelectorAll<HTMLElement>('.su-front__show-slide')].map(
    (slide) => {
      const clock = {
        currentTime: STEP * 1.5,
        effect: { getComputedTiming: () => ({ duration: STEP * slideCount }) },
      }
      slide.getAnimations = () => (animated ? [clock as unknown as Animation] : [])
      return clock
    }
  )
  watchSlideshow(document)
  const press = (selector: string) =>
    document.querySelector<HTMLButtonElement>(selector)?.dispatchEvent(new Event('click'))
  return { clocks, press, root: document.querySelector('.su-front__show') as HTMLElement }
}

describe('watchSlideshow', () => {
  test('shows the controls; Pause holds the show and wears the pressed plate, and lifts again', () => {
    const { press, root } = show(8)
    const pause = root.querySelector('[data-show-pause]') as HTMLElement
    expect(root.querySelector<HTMLElement>('[data-show-controls]')?.hidden).toBe(false)
    press('[data-show-pause]')
    expect(root.hasAttribute('data-paused')).toBe(true)
    expect(pause.getAttribute('aria-pressed')).toBe('true')
    expect(pause.classList.contains('su-btn--ink')).toBe(true)
    press('[data-show-pause]')
    expect(root.hasAttribute('data-paused')).toBe(false)
    expect(pause.classList.contains('su-btn--default')).toBe(true)
  })

  test('Next and Previous set every slide to one clock', () => {
    const { clocks, press } = show(8)
    press('[data-show-turn="1"]')
    expect(clocks.map((c) => c.currentTime)).toEqual(Array(8).fill(STEP * 1.8))
    press('[data-show-turn="-1"]')
    // 1.8 steps: slide 2 is sliding in, so Previous is slide 1.
    expect(clocks.map((c) => c.currentTime)).toEqual(Array(8).fill(STEP))
  })

  test('held, Next lands on the slide standing still and the show stays held', () => {
    const { clocks, press, root } = show(8)
    press('[data-show-pause]')
    press('[data-show-turn="1"]')
    expect(clocks[0]?.currentTime).toBe(STEP * 2)
    expect(root.hasAttribute('data-paused')).toBe(true)
  })

  test('where nothing turns (reduced motion), a press changes nothing', () => {
    const { clocks, press } = show(8, false)
    press('[data-show-turn="1"]')
    expect(clocks[0]?.currentTime).toBe(STEP * 1.5)
  })

  test('a show without its controls is left alone', () => {
    document.body.innerHTML = '<section class="su-front__show"></section>'
    expect(() => watchSlideshow(document)).not.toThrow()
  })
})
