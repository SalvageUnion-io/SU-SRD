import { afterEach, describe, expect, test } from 'bun:test'
import { focusSearchLanding, markSearchLanding } from '../searchHref'

afterEach(() => {
  sessionStorage.clear()
  document.body.innerHTML = ''
})

describe('a page opened from search (RR7-09)', () => {
  test('puts its heading in focus, once', () => {
    document.body.innerHTML = '<a href="/">Home</a><main><h1>Reaction Roll</h1></main>'
    markSearchLanding()
    focusSearchLanding(document)
    const heading = document.querySelector('h1')
    expect(document.activeElement).toBe(heading)
    expect(heading?.tabIndex).toBe(-1)
    ;(document.activeElement as HTMLElement).blur()
    focusSearchLanding(document)
    expect(document.activeElement).not.toBe(heading)
  })

  test('a page not opened from search leaves the focus alone', () => {
    document.body.innerHTML = '<main><h1>Hot</h1></main>'
    focusSearchLanding(document)
    expect(document.activeElement).not.toBe(document.querySelector('h1'))
  })
})
