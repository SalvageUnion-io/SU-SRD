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
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
  }
  return {
    win: win as unknown as Window,
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
  test('a long page is 2.5 screens or more', () => {
    expect(isLongPage(2000, 844)).toBe(false)
    expect(isLongPage(2110, 844)).toBe(true)
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
    tall(1200)
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
})
