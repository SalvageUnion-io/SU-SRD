import { describe, expect, test } from 'bun:test'
import { unionHere } from '../../lib/barLinks'
import { markUnionRoute } from '../../worker/shellMeta'
import { renderShell } from '../shell'
import { renderUnionBar } from '../unionBar'
import { slotSelector, UNION_SLOTS } from '../unionSlots'

/** The bar's markup in a document of its own. */
function bar(): Document {
  return new DOMParser().parseFromString(`<body>${renderUnionBar()}</body>`, 'text/html')
}

describe('the shell’s Union bar', () => {
  test('opens with the skip link, then the bar', () => {
    const body = bar().body
    // React hoists the mark's image preload ahead of it.
    const [skip, header] = Array.from(body.children).filter((el) => el.tagName !== 'LINK')
    expect(skip?.getAttribute('href')).toBe('#main-content')
    expect(header?.tagName).toBe('HEADER')
    expect(header?.getAttribute('style')).toContain('view-transition-name:nav')
  })

  test('links its lockup and the Training Bay tab home under the base, Reference to the root, Games to Your Games', () => {
    const doc = bar()
    expect(doc.querySelector('.su-union-bar__brand')?.getAttribute('href')).toBe('/')
    // Vite puts the base in front of it.
    expect(doc.querySelector('.su-union-bar__mark')?.getAttribute('src')).toBe(
      '/logos/su-cargo-dark.svg'
    )
    const tabs = Array.from(doc.querySelectorAll('.su-union-bar__tab'))
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute('href')])).toEqual([
      ['Reference', '/reference/'],
      ['Training Bay', '/build/'],
      ['Games', '/games/'],
    ])
    expect(tabs.map((tab) => tab.getAttribute('data-tool'))).toEqual(['reference', 'build', 'play'])
    expect(tabs[1]?.getAttribute('aria-current')).toBe('true')
  })

  test('carries no second nav: each tab is a place', () => {
    expect(bar().querySelector('.su-union-bar__nav')).toBeNull()
  })

  test('is served on the Training Bay’s front door, its tab current', () => {
    const doc = bar()
    expect(doc.querySelector('.su-union-bar')?.getAttribute('data-mode')).toBe('build')
    expect(
      Array.from(doc.querySelectorAll('[aria-current]')).map((el) => [
        el.textContent,
        el.getAttribute('aria-current'),
      ])
    ).toEqual([['Training Bay', 'true']])
  })

  test('carries every slot, empty, and Buy the game right after the areas', () => {
    const doc = bar()
    for (const name of UNION_SLOTS) {
      expect(doc.querySelector(slotSelector(name))?.innerHTML).toBe('')
    }
    const nav = doc.querySelector('.su-union-bar__switch')
    expect(nav?.lastElementChild?.className).toContain('su-union-bar__buy')
    const end = doc.querySelector('.su-union-bar__end')
    expect(
      Array.from(end?.children ?? []).map(
        (el) => el.className || el.getAttribute('data-union-slot')
      )
    ).toEqual(['su-union-bar__search', 'su-union-bar__actions'])
    expect(end?.querySelector('.su-union-bar__search > [data-union-slot="search"]')).not.toBeNull()
    expect(
      end?.querySelector('.su-union-bar__actions > [data-union-slot="actions"]')
    ).not.toBeNull()
  })
})

/** What a bar says about where you are: its mode, and each "here" in it. */
function hereIn(html: string) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  return {
    mode: doc.querySelector('.su-union-bar')?.getAttribute('data-mode'),
    current: Array.from(doc.querySelectorAll('[aria-current]')).map(
      (el) => `${el.textContent}=${el.getAttribute('aria-current')}`
    ),
  }
}

/**
 * One shell answers every route, so whoever serves it marks it for the route
 * (`markUnionRoute`): the right mode, tab and nav item from the first paint.
 */
describe('the shell’s Union bar, marked for its route', () => {
  test('on Your Games: the Games tab', () => {
    expect(hereIn(markUnionRoute(renderUnionBar(), '/games/'))).toEqual({
      mode: 'play',
      current: ['Games=true'],
    })
  })

  test('on the Training Bay’s pages: its tab', () => {
    expect(hereIn(markUnionRoute(renderUnionBar(), '/patterns/'))).toEqual({
      mode: 'build',
      current: ['Training Bay=true'],
    })
    expect(hereIn(markUnionRoute(renderUnionBar(), '/starter/pilot/x'))).toEqual({
      mode: 'build',
      current: ['Training Bay=true'],
    })
    expect(hereIn(markUnionRoute(renderUnionBar(), '/settings'))).toEqual({
      mode: 'build',
      current: ['Training Bay=true'],
    })
  })

  test('says what the bar rendered for that route says, on every kind of route', () => {
    for (const route of [
      '/',
      '/patterns/',
      '/starter/',
      '/pilots/new',
      '/games/',
      '/games/g1',
      '/invite/t1',
    ]) {
      expect(hereIn(markUnionRoute(renderUnionBar(), route))).toEqual(
        hereIn(renderUnionBar(unionHere(route)))
      )
    }
  })

  test('marks the whole shell the same way, leaving the rest of it alone', () => {
    const shell = renderShell()
    const marked = markUnionRoute(shell, '/games/')
    expect(hereIn(marked).mode).toBe('play')
    expect(markUnionRoute(marked, '/')).toBe(shell)
  })
})
