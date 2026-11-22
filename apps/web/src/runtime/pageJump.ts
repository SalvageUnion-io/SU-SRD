/**
 * pageJump — the script half of a page's floating search glass and "On this
 * page" button (`PageJump`, the Reference's layout): it shows them once a long
 * page has scrolled past its header, and fills the sheet with the page's
 * sections.
 *
 * - **Long** is any page that scrolls its header out of sight (`isLongPage`):
 *   there the bar's search is gone and the glass is the one in reach.
 * - A page with no sections floats the glass alone (`data-sections`).
 * - **The sections** are the page's own contents where it draws them (a
 *   class's and a guide's "On this page", `data-page-contents`), else its
 *   second-level headings. One section is no list.
 * - A section pressed closes the sheet, goes to its heading and hands it the
 *   focus, so a screen reader and the next Tab start there. A heading with an
 *   id is named in the address, as the page's own contents name it: Back
 *   returns to where the reader was.
 * - Search opens the phone's search sheet over the page (`MobileSearchDialog`),
 *   so the page stays where it is; the bar's own field is at the top of it.
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

/** The phone's search sheet's trigger (`MobileSearchDialog`), drawn or not. */
const SEARCH_SHEET_TRIGGER = '.su-mobile-search__trigger'

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

/** Whether the page is long enough to want the button: it scrolls its header out of sight. */
export function isLongPage(pageHeight: number, screenHeight: number): boolean {
  return screenHeight > 0 && pageHeight - screenHeight > SHOW_AFTER
}

type PageJumpWindow = Pick<Window, 'addEventListener' | 'innerHeight' | 'scrollY' | 'location'>

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
          // A new address is a history entry and the browser's own jump; the
          // one already named, or a heading with no id, is scrolled to.
          const hash = target.id ? `#${encodeURIComponent(target.id)}` : ''
          if (hash && win.location.hash !== hash) win.location.hash = hash
          else target.scrollIntoView({ block: 'start' })
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
  // Search leaves the sheet for the phone's search sheet, which opens over the
  // page where it is. Its island wakes on intent and plays the press back
  // (`runtime/interaction.ts`). With none, the page's own handler focuses the
  // bar's field (`data-search-open`, `islands.client.ts`).
  // The floating glass is the same press with no sheet between.
  root.addEventListener('click', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-search-open]')) return
    close()
    const trigger = doc.querySelector<HTMLElement>(SEARCH_SHEET_TRIGGER)
    if (!trigger) return
    event.preventDefault()
    trigger.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    trigger.click()
  })

  const update = () => {
    const long = isLongPage(doc.documentElement.scrollHeight, win.innerHeight)
    const show = long && win.scrollY > SHOW_AFTER
    if (root.hidden === show) {
      root.hidden = !show
      // Whether there is a contents button to draw, before its sheet opens.
      if (show) root.toggleAttribute('data-sections', pageSections(doc).length > 0)
    }
    if (!show) close()
  }
  win.addEventListener('scroll', update, { passive: true })
  win.addEventListener('resize', update, { passive: true })
  update()
}
