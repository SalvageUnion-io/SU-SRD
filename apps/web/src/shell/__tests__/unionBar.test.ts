import { describe, expect, test } from 'bun:test'
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

  test('links its lockup and the Build tab home under the base, Reference to the root', () => {
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
    ])
    expect(tabs[1]?.getAttribute('aria-current')).toBe('true')
  })

  test('reads Hangar · Games · Starter Set, Games being a slot', () => {
    const nav = bar().querySelector('.su-union-bar__nav')
    expect(
      Array.from(nav?.children ?? []).map(
        (el) => el.getAttribute('data-union-slot') ?? el.getAttribute('href')
      )
    ).toEqual(['/build/', 'games', '/build/starter/'])
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
