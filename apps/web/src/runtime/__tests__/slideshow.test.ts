import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
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

  test('Previous, turning: lands where the slide before starts its turn, a whole step ahead of it (r2 H6)', () => {
    expect(turnedClock(STEP * 2.5, -1, { ...show8, held: false })).toBe(STEP * 0.8)
  })

  test('Previous, held: lands on the slide before standing still', () => {
    expect(turnedClock(STEP * 2.5, -1, { ...show8, held: true })).toBe(STEP)
  })

  test('the slide sliding in is the one in view', () => {
    // At 2.9 steps slide 3 is entering: Next is slide 4, Previous slide 2.
    expect(turnedClock(STEP * 2.9, 1, { ...show8, held: true })).toBe(STEP * 4)
    expect(turnedClock(STEP * 2.9, -1, { ...show8, held: true })).toBe(STEP * 2)
  })

  test('the show is a loop: Previous from the first is the last, Next from the last the first', () => {
    expect(turnedClock(STEP * 0.5, -1, { ...show8, held: false })).toBe(STEP * 6.8)
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
    // 1.8 steps: slide 2 is sliding in, so Previous is slide 1, its turn afresh.
    expect(clocks.map((c) => c.currentTime)).toEqual(Array(8).fill(STEP * 0.8))
  })

  test('held, Next lands on the slide standing still and the show stays held', () => {
    const { clocks, press, root } = show(8)
    press('[data-show-pause]')
    press('[data-show-turn="1"]')
    expect(clocks[0]?.currentTime).toBe(STEP * 2)
    expect(root.hasAttribute('data-paused')).toBe(true)
  })

  test('a finger down on a slide’s plate holds the show until it lifts (r2 H6)', () => {
    const { root } = show(8)
    const plate = document.createElement('div')
    plate.className = 'su-front__show-copy'
    const act = document.createElement('a')
    plate.append(act)
    root.append(plate)
    act.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(root.hasAttribute('data-touched')).toBe(true)
    document.dispatchEvent(new Event('pointerup'))
    expect(root.hasAttribute('data-touched')).toBe(false)
    // The controls are not the slide: a press on them leaves it turning.
    root
      .querySelector('[data-show-turn="1"]')
      ?.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(root.hasAttribute('data-touched')).toBe(false)
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

describe('the show holds while it is being read (r5 E14)', () => {
  const css = readFileSync(new URL('../../styles/partials/front.css', import.meta.url), 'utf8')
  const hold = css.slice(
    css.indexOf('.su-front__show:is('),
    css.indexOf('animation-play-state: paused')
  )

  test('the pointer on a slide’s words or its button holds it, as focus on them does', () => {
    expect(hold).toContain(':has(.su-front__show-copy:hover)')
    expect(hold).toContain(':has(.su-front__show-slides:focus-within)')
  })
})
