/**
 * pageJump — the script half of a long page's floating "On this page" button
 * (`PageJump`, the Reference's layout): it shows the button once a long page
 * has scrolled past its header, and fills the sheet with the page's sections.
 *
 * - **Long** is `LONG_PAGE_SCREENS` screens or more: a shorter page's header
 *   is one flick away.
 * - **The sections** are the page's own contents where it draws them (a
 *   class's and a guide's "On this page", `data-page-contents`), else its
 *   second-level headings. One section is no list.
 * - A section pressed closes the sheet, scrolls to its heading and hands it
 *   the focus, so a screen reader and the next Tab start there.
 *
 * Plain DOM, free of React: the page's entry script runs it on every page.
 */

/** The floating button's wrapper, served hidden. */
export const PAGE_JUMP_ATTRIBUTE = 'data-page-jump'
/** The sheet's list, which this script fills. */
export const PAGE_JUMP_LIST_ATTRIBUTE = 'data-page-jump-list'
/** The sheet's id: its button's `popovertarget`. */
export const PAGE_JUMP_SHEET_ID = 'su-page-jump-sheet'
/** A page's own contents (`nav`), whose links the sheet repeats. */
const PAGE_CONTENTS_ATTRIBUTE = 'data-page-contents'

/** A page this many screens tall is long. */
const LONG_PAGE_SCREENS = 2.5
/** The button shows once the page has scrolled this many pixels: its header is out of sight. */
const SHOW_AFTER = 240

export type PageSection = { label: string; target: HTMLElement }

/** The page's sections, in reading order: its own contents' where it has them, else its h2s. */
export function pageSections(doc: Document): PageSection[] {
  const main = doc.querySelector('main') ?? doc.body
  const sections: PageSection[] = []
  const seen = new Set<HTMLElement>()
  const add = (label: string, target: HTMLElement | null) => {
    const text = label.replace(/\s+/g, ' ').trim()
    if (!text || !target || seen.has(target)) return
    seen.add(target)
    sections.push({ label: text, target })
  }
  for (const link of main.querySelectorAll<HTMLAnchorElement>(
    `[${PAGE_CONTENTS_ATTRIBUTE}] a[href^="#"]`
  )) {
    const id = decodeURIComponent(link.getAttribute('href')?.slice(1) ?? '')
    add(link.textContent ?? '', id ? doc.getElementById(id) : null)
  }
  if (sections.length === 0) {
    for (const heading of main.querySelectorAll<HTMLElement>('h2')) {
      add(heading.textContent ?? '', heading)
    }
  }
  return sections.length > 1 ? sections : []
}

/** Whether the page is long enough to want the button. */
export function isLongPage(pageHeight: number, screenHeight: number): boolean {
  return screenHeight > 0 && pageHeight >= screenHeight * LONG_PAGE_SCREENS
}

type PageJumpWindow = Pick<Window, 'addEventListener' | 'innerHeight' | 'scrollY'>

/** Starts the button on `doc`, where the layout served one. */
export function watchPageJump(doc: Document, win: PageJumpWindow = window): void {
  const root = doc.querySelector<HTMLElement>(`[${PAGE_JUMP_ATTRIBUTE}]`)
  const sheet = doc.getElementById(PAGE_JUMP_SHEET_ID)
  const list = root?.querySelector<HTMLElement>(`[${PAGE_JUMP_LIST_ATTRIBUTE}]`)
  if (!root || !sheet || !list) return

  const close = () => {
    if (typeof sheet.hidePopover === 'function' && sheet.matches(':popover-open')) {
      sheet.hidePopover()
    }
  }

  // The sections are read as the sheet opens: an island may have drawn more
  // of the page since the script started.
  const fill = () => {
    const sections = pageSections(doc)
    list.replaceChildren(
      ...sections.map(({ label, target }) => {
        const item = doc.createElement('li')
        const button = doc.createElement('button')
        button.type = 'button'
        button.className = 'su-page-jump__item'
        button.textContent = label
        button.addEventListener('click', () => {
          close()
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
          target.scrollIntoView({ block: 'start' })
          target.focus({ preventScroll: true })
        })
        item.append(button)
        return item
      })
    )
    root.toggleAttribute('data-sections', sections.length > 0)
  }
  sheet.addEventListener('beforetoggle', (event) => {
    if ((event as ToggleEvent).newState === 'open') fill()
  })
  // Search leaves the sheet: the bar's field takes the focus (`data-search-open`).
  sheet.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-search-open]')) close()
  })

  const update = () => {
    const long = isLongPage(doc.documentElement.scrollHeight, win.innerHeight)
    const show = long && win.scrollY > SHOW_AFTER
    if (root.hidden === show) root.hidden = !show
    if (!show) close()
  }
  win.addEventListener('scroll', update, { passive: true })
  win.addEventListener('resize', update, { passive: true })
  update()
}
