import { afterEach, describe, expect, test } from 'bun:test'
import { focusMarkedContent, markAtContent } from '../searchHref'

/**
 * A page opened from search lands at its top, its address clean, and the
 * next Tab starts in its content (RR7-09, r8 G3).
 */
describe('a page opened from search, at its content', () => {
  afterEach(() => {
    sessionStorage.clear()
    document.body.innerHTML = ''
    window.location.href = 'http://localhost/'
  })

  function page(path: string): HTMLElement {
    window.location.href = `http://localhost${path}`
    document.body.innerHTML = '<a href="#">bar</a><main id="main-content" tabindex="-1"></main>'
    return document.getElementById('main-content') as HTMLElement
  }

  test('the page marked focuses its content, once, with no anchor in its address', () => {
    markAtContent('/roll-tables/reaction-roll/')
    const main = page('/roll-tables/reaction-roll/')
    focusMarkedContent()
    expect(document.activeElement).toBe(main)
    expect(window.location.hash).toBe('')
    document.body.focus()
    ;(document.activeElement as HTMLElement | null)?.blur()
    focusMarkedContent()
    expect(document.activeElement).not.toBe(main)
  })

  test('another page, or one opened on its own anchor, is left alone', () => {
    markAtContent('/roll-tables/reaction-roll/')
    const main = page('/chassis/mule/')
    focusMarkedContent()
    expect(document.activeElement).not.toBe(main)

    markAtContent('/guides/crawler-downtime/#train-your-pilot')
    const guide = page('/guides/crawler-downtime/')
    focusMarkedContent()
    expect(document.activeElement).not.toBe(guide)
  })
})
