import { afterEach, describe, expect, test } from 'bun:test'
import { currentHeading, readingLine, watchGuideContents } from '../guideContents'

const HEADINGS = [
  { id: 'gain-scrap', top: -400 },
  { id: 'craft-your-mech-chassis', top: 80 },
  { id: 'craft-your-systems', top: 600 },
]

describe('currentHeading', () => {
  test('is the last heading at or above the reading line', () => {
    expect(currentHeading(HEADINGS, 100)).toBe('craft-your-mech-chassis')
    expect(currentHeading(HEADINGS, 80)).toBe('craft-your-mech-chassis')
    expect(currentHeading(HEADINGS, 50)).toBe('gain-scrap')
    expect(currentHeading(HEADINGS, 800)).toBe('craft-your-systems')
  })

  test('is none above the first heading', () => {
    expect(currentHeading([{ id: 'gain-scrap', top: 300 }], 100)).toBeUndefined()
  })
})

describe('readingLine', () => {
  test('sits a fifth of the way down until the last screen of scroll', () => {
    expect(readingLine(1000, 5000)).toBe(200)
    expect(readingLine(1000, 1000)).toBe(200)
  })

  test('slides to the viewport foot as the scroll runs out', () => {
    expect(readingLine(1000, 500)).toBe(600)
    expect(readingLine(1000, 0)).toBe(1000)
    expect(readingLine(1000, -10)).toBe(1000)
  })
})

describe('watchGuideContents', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    Reflect.deleteProperty(document.documentElement, 'scrollHeight')
  })

  function serveGuide() {
    document.body.innerHTML = `
      <div class="su-guide--page">
        <nav><a class="su-guide__toc-link" href="#one">1</a><a class="su-guide__toc-link" href="#two">2</a></nav>
        <nav class="su-guide__rail"><a class="su-guide__toc-link" href="#one">1</a><a class="su-guide__toc-link" href="#two">2</a></nav>
        <h2 id="one">One</h2><h2 id="two">Two</h2>
      </div>`
    const one = document.getElementById('one') as HTMLElement
    const two = document.getElementById('two') as HTMLElement
    one.getBoundingClientRect = () => ({ top: 0 }) as DOMRect
    two.getBoundingClientRect = () => ({ top: 5000 }) as DOMRect
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 20_000,
    })
    return document.querySelector('.su-guide--page') as HTMLElement
  }

  const marked = () =>
    [...document.querySelectorAll('[aria-current="location"]')].map((link) =>
      link.getAttribute('href')
    )

  test('marks every copy of the current entry, and only it', () => {
    const stop = watchGuideContents(serveGuide())
    expect(stop).toBeFunction()
    expect(marked()).toEqual(['#one', '#one'])
    stop?.()
  })

  test('a followed link holds its entry until the reader scrolls', async () => {
    const stop = watchGuideContents(serveGuide())
    ;(document.querySelector('a[href="#two"]') as HTMLAnchorElement).click()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(marked()).toEqual(['#two', '#two'])

    window.dispatchEvent(new Event('wheel'))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(marked()).toEqual(['#one', '#one'])
    stop?.()
  })

  test('does nothing without contents', () => {
    document.body.innerHTML = '<h2 id="one">One</h2>'
    expect(watchGuideContents(document.body)).toBeUndefined()
  })
})
