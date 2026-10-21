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
  test('opens with the skip link, then the banner slot, then the bar', () => {
    const body = bar().body
    // React hoists the mark's image preload ahead of it.
    const [skip, banner, header] = Array.from(body.children).filter((el) => el.tagName !== 'LINK')
    expect(skip?.getAttribute('href')).toBe('#main-content')
    expect(banner?.matches(slotSelector('banner'))).toBe(true)
    expect(header?.tagName).toBe('HEADER')
    expect(header?.getAttribute('style')).toContain('view-transition-name:nav')
  })

  test('links its lockup and the Build tab home under the base, Reference to the root, Play to its landing', () => {
    const doc = bar()
    expect(doc.querySelector('.su-union-bar__brand')?.getAttribute('href')).toBe('/build/')
    // Vite puts the base in front of it.
    expect(doc.querySelector('.su-union-bar__mark')?.getAttribute('src')).toBe(
      '/logos/su-cargo-dark.svg'
    )
    const tabs = Array.from(doc.querySelectorAll('.su-union-bar__tab'))
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute('href')])).toEqual([
      ['Reference', '/'],
      ['Build', '/build/'],
      ['Play', '/build/play/'],
    ])
    expect(tabs.map((tab) => tab.getAttribute('data-tool'))).toEqual(['reference', 'build', 'play'])
    expect(tabs[1]?.getAttribute('aria-current')).toBe('true')
  })

  test('carries both modes’ navs: Build’s Training Bay · Patterns · Starter Set, Play’s Games · Solo, Games a slot', () => {
    const nav = (mode: string) =>
      Array.from(
        bar().querySelector(`.su-union-bar__nav[data-mode="${mode}"]`)?.children ?? []
      ).map((el) => el.getAttribute('data-union-slot') ?? el.getAttribute('href'))
    expect(nav('build')).toEqual(['/build/', '/build/mechs/patterns/', '/build/starter/'])
    expect(nav('play')).toEqual(['games', '/build/play/#play-solo'])
  })

  test('is served on Build’s front door: Build’s tab, Build’s nav, Training Bay here', () => {
    const doc = bar()
    expect(doc.querySelector('.su-union-bar')?.getAttribute('data-mode')).toBe('build')
    expect(
      Array.from(doc.querySelectorAll('[aria-current]')).map((el) => [
        el.textContent,
        el.getAttribute('aria-current'),
      ])
    ).toEqual([
      ['Build', 'true'],
      ['Training Bay', 'page'],
    ])
  })

  test('carries every slot, empty, and Buy the game between the search and the account', () => {
    const doc = bar()
    for (const name of UNION_SLOTS) {
      expect(doc.querySelector(slotSelector(name))?.innerHTML).toBe('')
    }
    const end = doc.querySelector('.su-union-bar__end')
    expect(
      Array.from(end?.children ?? []).map(
        (el) => el.className || el.getAttribute('data-union-slot')
      )
    ).toEqual(['search', expect.stringContaining('su-union-bar__buy'), 'actions'])
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
  test('on Play’s hub: Play’s tab and nav, Games ▾ the nav’s here', () => {
    expect(hereIn(markUnionRoute(renderUnionBar(), '/play/'))).toEqual({
      mode: 'play',
      current: ['Play=true'],
    })
  })

  test('on Build’s pages: Build’s tab, the page’s link here', () => {
    expect(hereIn(markUnionRoute(renderUnionBar(), '/mechs/patterns/'))).toEqual({
      mode: 'build',
      current: ['Build=true', 'Patterns=page'],
    })
    expect(hereIn(markUnionRoute(renderUnionBar(), '/starter/pilot/x'))).toEqual({
      mode: 'build',
      current: ['Build=true', 'Starter Set=page'],
    })
    expect(hereIn(markUnionRoute(renderUnionBar(), '/settings'))).toEqual({
      mode: 'build',
      current: ['Build=true'],
    })
  })

  test('says what the bar rendered for that route says, on every kind of route', () => {
    for (const route of [
      '/',
      '/mechs/patterns/',
      '/starter/',
      '/pilots/new',
      '/play/',
      '/play/games/g1',
      '/invite/t1',
    ]) {
      expect(hereIn(markUnionRoute(renderUnionBar(), route))).toEqual(
        hereIn(renderUnionBar(unionHere(route)))
      )
    }
  })

  test('marks the whole shell the same way, leaving the rest of it alone', () => {
    const shell = renderShell()
    const marked = markUnionRoute(shell, '/play/')
    expect(hereIn(marked).mode).toBe('play')
    expect(markUnionRoute(marked, '/')).toBe(shell)
  })
})
