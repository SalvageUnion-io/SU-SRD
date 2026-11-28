/**
 * A long page's floating "On this page" (r2 H4): the button shows once a long
 * page has scrolled past its header, and its sheet lists the page's sections,
 * each of which closes the sheet and takes the reader (and the focus) there.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import {
  isLongPage,
  PAGE_JUMP_ATTRIBUTE,
  PAGE_JUMP_LIST_ATTRIBUTE,
  PAGE_JUMP_SHEET_ID,
  pageSections,
  watchPageJump,
} from '../pageJump'

const JUMP = `
  <div ${PAGE_JUMP_ATTRIBUTE} hidden>
    <a href="/reference/" class="glass" data-search-open>Search the Reference</a>
    <button popovertarget="${PAGE_JUMP_SHEET_ID}">On this page</button>
    <div id="${PAGE_JUMP_SHEET_ID}" popover="auto">
      <a href="/reference/" data-search-open>Search the Reference</a>
      <ul ${PAGE_JUMP_LIST_ATTRIBUTE}></ul>
    </div>
  </div>`

function page(main: string) {
  document.body.innerHTML = `<main>${main}</main>${JUMP}`
  const root = document.querySelector(`[${PAGE_JUMP_ATTRIBUTE}]`) as HTMLElement
  const sheet = document.getElementById(PAGE_JUMP_SHEET_ID) as HTMLElement
  return { root, sheet, items: () => [...sheet.querySelectorAll('button')] }
}

/** A window the test scrolls itself. */
function fakeWindow(innerHeight: number) {
  const listeners = new Map<string, () => void>()
  const win = {
    innerHeight,
    scrollY: 0,
    location: { hash: '' },
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
  }
  return {
    win: win as unknown as Window,
    hash: () => win.location.hash,
    scrollTo(y: number) {
      win.scrollY = y
      listeners.get('scroll')?.()
    },
  }
}

const tall = (height: number) =>
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: height,
  })

afterEach(() => {
  document.body.replaceChildren()
  Reflect.deleteProperty(document.documentElement, 'scrollHeight')
})

describe('pageSections', () => {
  test('a page’s own contents are its sections, each once', () => {
    page(`
      <nav data-page-contents><a href="#a">Alpha</a><a href="#b">Beta</a></nav>
      <nav data-page-contents><a href="#a">Alpha</a><a href="#b">Beta</a></nav>
      <h2 id="a">Alpha tree</h2><h2 id="b">Beta tree</h2><h2>Not listed</h2>`)
    expect(pageSections(document).map((section) => section.label)).toEqual(['Alpha', 'Beta'])
  })

  test('a numbered entry reads its number and its label apart: "1 Tally Salvage" (RR6-05)', () => {
    page(`
      <nav data-page-contents>
        <a href="#a"><span>1</span><span>Tally Salvage</span></a><a href="#b"><span>2</span><span>Upkeep</span></a>
      </nav>
      <h2 id="a">Tally Salvage</h2><h2 id="b">Upkeep</h2>`)
    expect(pageSections(document).map((section) => section.label)).toEqual([
      '1 Tally Salvage',
      '2 Upkeep',
    ])
  })

  test('with no contents of its own, its second-level headings', () => {
    page('<h2>Chassis Ability</h2><h3>Not a section</h3><h2> Systems </h2>')
    const sections = pageSections(document)
    expect(sections.map((section) => section.label)).toEqual(['Chassis Ability', 'Systems'])
    expect(sections[1]?.target.tagName).toBe('H2')
  })

  test('one section is no list', () => {
    page('<h2>Actions</h2>')
    expect(pageSections(document)).toEqual([])
  })
})

describe('watchPageJump', () => {
  test('a page long enough to scroll its header away is long: a trait page counts (r4 F10)', () => {
    // /traits/hot/ is 1,400px on an 844px screen.
    expect(isLongPage(1400, 844)).toBe(true)
    expect(isLongPage(1775, 844)).toBe(true)
    // One the screen holds, or nearly: its header never leaves.
    expect(isLongPage(844, 844)).toBe(false)
    expect(isLongPage(1000, 844)).toBe(false)
  })

  test('the search glass floats beside the contents: one press opens search (r4 F10)', () => {
    const { root } = page('<h2>One</h2><h2>Two</h2>')
    const trigger = document.createElement('button')
    trigger.className = 'su-mobile-search__trigger'
    document.body.append(trigger)
    let opened = 0
    trigger.addEventListener('click', () => opened++)
    watchPageJump(document, fakeWindow(844).win)
    const press = new MouseEvent('click', { bubbles: true, cancelable: true })
    root.querySelector('.glass')?.dispatchEvent(press)
    expect(opened).toBe(1)
    expect(press.defaultPrevented).toBe(true)
  })

  test('a page with no sections floats the glass alone: its contents button has nothing to open (r4 F10)', () => {
    const { root } = page('<p>One long rule.</p>')
    tall(1400)
    const { win, scrollTo } = fakeWindow(844)
    watchPageJump(document, win)
    scrollTo(400)
    expect(root.hidden).toBe(false)
    expect(root.hasAttribute('data-sections')).toBe(false)
  })

  test('a page with sections says so as the button shows, before its sheet opens', () => {
    const { root } = page('<h2>One</h2><h2>Two</h2>')
    tall(1400)
    const { win, scrollTo } = fakeWindow(844)
    watchPageJump(document, win)
    scrollTo(400)
    expect(root.hasAttribute('data-sections')).toBe(true)
  })

  test('the button shows once a long page has scrolled past its header', () => {
    const { root } = page('<h2>One</h2><h2>Two</h2>')
    tall(5000)
    const { win, scrollTo } = fakeWindow(844)
    watchPageJump(document, win)
    expect(root.hidden).toBe(true)
    scrollTo(900)
    expect(root.hidden).toBe(false)
    scrollTo(0)
    expect(root.hidden).toBe(true)
  })

  test('a short page never shows it', () => {
    const { root } = page('<h2>One</h2><h2>Two</h2>')
    tall(1000)
    const { win, scrollTo } = fakeWindow(844)
    watchPageJump(document, win)
    scrollTo(900)
    expect(root.hidden).toBe(true)
  })

  test('the sheet lists the sections as it opens; one pressed takes the focus there', () => {
    const { root, sheet, items } = page('<h2>One</h2><h2>Two</h2>')
    tall(5000)
    watchPageJump(document, fakeWindow(844).win)
    const opening = new Event('beforetoggle')
    Object.defineProperty(opening, 'newState', { value: 'open' })
    sheet.dispatchEvent(opening)
    expect(items().map((item) => item.textContent)).toEqual(['One', 'Two'])
    expect(root.hasAttribute('data-sections')).toBe(true)
    const two = document.querySelectorAll('h2')[1] as HTMLElement
    let scrolled = false
    two.scrollIntoView = () => {
      scrolled = true
    }
    items()[1]?.click()
    expect(scrolled).toBe(true)
    expect(document.activeElement).toBe(two)
  })

  /** Opens the sheet as the browser would, filling its list. */
  function open(sheet: HTMLElement) {
    const opening = new Event('beforetoggle')
    Object.defineProperty(opening, 'newState', { value: 'open' })
    sheet.dispatchEvent(opening)
  }

  test('a jump to a section with an id names it in the address, so Back returns (r3 C2)', () => {
    const { sheet, items } = page(`
      <nav data-page-contents><a href="#a">Alpha</a><a href="#b">Beta</a></nav>
      <h2 id="a">Alpha tree</h2><h2 id="b">Beta tree</h2>`)
    const { win, hash } = fakeWindow(844)
    watchPageJump(document, win)
    open(sheet)
    items()[1]?.click()
    expect(hash()).toBe('#b')
    expect(document.activeElement).toBe(document.getElementById('b'))
  })

  test('a jump to the section the address already names still goes there', () => {
    const { sheet, items } = page('<h2 id="a">One</h2><h2 id="b">Two</h2>')
    const { win, hash } = fakeWindow(844)
    ;(win as unknown as { location: { hash: string } }).location.hash = '#b'
    watchPageJump(document, win)
    open(sheet)
    const two = document.getElementById('b') as HTMLElement
    let scrolled = false
    two.scrollIntoView = () => {
      scrolled = true
    }
    items()[1]?.click()
    expect(scrolled).toBe(true)
    expect(hash()).toBe('#b')
  })

  test('Search opens the phone’s search sheet in place, never the bar’s field (r3 C2)', () => {
    const { sheet } = page('<h2>One</h2><h2>Two</h2>')
    const trigger = document.createElement('button')
    trigger.className = 'su-mobile-search__trigger'
    document.body.append(trigger)
    const seen: string[] = []
    trigger.addEventListener('pointerdown', () => seen.push('pointerdown'))
    trigger.addEventListener('click', () => seen.push('click'))
    watchPageJump(document, fakeWindow(844).win)
    const press = new MouseEvent('click', { bubbles: true, cancelable: true })
    sheet.querySelector('[data-search-open]')?.dispatchEvent(press)
    // The intent wakes the island; the press is held and played back by it.
    expect(seen).toEqual(['pointerdown', 'click'])
    // The page's own handler (focus the bar's field, at the top) stands down.
    expect(press.defaultPrevented).toBe(true)
  })

  test('with no search sheet on the page, Search is left to the page', () => {
    const { sheet } = page('<h2>One</h2><h2>Two</h2>')
    watchPageJump(document, fakeWindow(844).win)
    const press = new MouseEvent('click', { bubbles: true, cancelable: true })
    sheet.querySelector('[data-search-open]')?.dispatchEvent(press)
    expect(press.defaultPrevented).toBe(false)
  })
})
