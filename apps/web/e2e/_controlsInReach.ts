import type { Page } from '@playwright/test'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * K14, every control in reach: each enabled control drawn in `root` (the
 * page's `main` by default) sits inside every frame that clips it, and a
 * press at its centre lands on it, not on something drawn over it (an
 * invisible slide, a sticky bar, a neighbour's overflow). The mech wizard's
 * Systems step shipped with its count steppers past the Ledger's
 * `overflow: hidden` edge at 1440px, and focusing one scrolled every name
 * sideways; the home slideshow's hidden slides took the visible slide's
 * clicks.
 *
 * Each control is checked where it stands first (a clip is a fault before any
 * scroll could hide it), then pressed in thought (`elementFromPoint`) as the
 * page is swept past it, block axis only, while it stands in the viewport's
 * middle half. A visually hidden
 * input (a radio under its row) and a disabled control are not controls a
 * pointer meets, and are skipped. Returns one fault per control; a spec
 * asserts none.
 */
export async function findControlsOutOfReach(page: Page, root = 'main'): Promise<Finding[]> {
  const faults = await page.evaluate((rootSelector) => {
    const CONTROLS =
      'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=radio], [role=tab], [role=checkbox], [role=switch], [role=option], [role=slider]'
    const scope = document.querySelector(rootSelector) ?? document.body
    const nameOf = (el: Element) =>
      (
        el.getAttribute('aria-label') ||
        (el as HTMLElement).innerText ||
        el.getAttribute('title') ||
        el.tagName.toLowerCase()
      )
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 48)
    const describe = (el: Element | null) =>
      el
        ? `${el.tagName.toLowerCase()}${el.classList[0] ? `.${el.classList[0]}` : ''}${
            el.closest('[aria-label]') && el.closest('[aria-label]') !== el
              ? ` in "${el.closest('[aria-label]')?.getAttribute('aria-label')?.slice(0, 32)}"`
              : ''
          }`
        : 'nothing'
    const off = (el: HTMLElement) => {
      if ((el as HTMLButtonElement).disabled) return true
      if (el.closest('[aria-disabled="true"], [inert], [hidden]')) return true
      const style = getComputedStyle(el)
      if (style.visibility !== 'visible' || style.pointerEvents === 'none') return true
      const r = el.getBoundingClientRect()
      // Visually hidden (the sr-only clip): its row is the control.
      return r.width < 2 || r.height < 2
    }
    const faults: string[] = []
    const startX = scrollX
    const startY = scrollY
    const reachable: HTMLElement[] = []
    for (const el of scope.querySelectorAll<HTMLElement>(CONTROLS)) {
      if (off(el)) continue
      // A control whose own control is an ancestor (a button inside a
      // role=button readout) is that one's part.
      if (el.parentElement?.closest(CONTROLS) && !el.matches('a[href], button')) continue
      const r = el.getBoundingClientRect()
      let clipped: HTMLElement | null = null
      for (let at = el.parentElement; at && at !== document.body; at = at.parentElement) {
        const cs = getComputedStyle(at)
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
        const f = at.getBoundingClientRect()
        const left = f.left + at.clientLeft
        const top = f.top + at.clientTop
        // A frame that scrolls down on purpose (a dialog's body, a sticky
        // detail) may hold a control below its fold; sideways, nothing may
        // stand past a frame's edge.
        const scrollsY = cs.overflowY === 'auto' || cs.overflowY === 'scroll'
        const outX = r.left < left - 1 || r.right > left + at.clientWidth + 1
        const outY = !scrollsY && (r.top < top - 1 || r.bottom > top + at.clientHeight + 1)
        if (outX || outY) {
          clipped = at
          break
        }
      }
      if (clipped) {
        faults.push(
          `clip: "${nameOf(el)}" (${Math.round(r.left)}–${Math.round(r.right)}px) runs past its frame ${describe(clipped)}`
        )
      } else reachable.push(el)
    }
    // Pressed in thought once each, while it stands in the viewport's middle
    // half (clear of a sticky bar at either edge): the page is swept in
    // half-viewport steps, block axis only, so every line passes through.
    const pending = new Set(reachable)
    const step = Math.max(1, Math.floor(innerHeight / 2))
    const height = document.documentElement.scrollHeight
    for (let y = 0; pending.size > 0 && y < height + step; y += step) {
      scrollTo(startX, y)
      // At the page's top and foot the edge quarter is all there is.
      const top = scrollY <= 0 ? 0 : innerHeight / 4
      const foot = scrollY + innerHeight >= height - 1 ? innerHeight : (innerHeight * 3) / 4
      for (const el of pending) {
        const box = el.getBoundingClientRect()
        const x = box.left + box.width / 2
        const cy = box.top + box.height / 2
        if (cy < top || cy > foot) continue
        pending.delete(el)
        if (x < 0 || x > innerWidth) continue
        const hit = document.elementFromPoint(x, cy)
        const own =
          hit !== null &&
          (el.contains(hit) ||
            (hit instanceof HTMLLabelElement && (hit.control === el || hit.contains(el))))
        if (!own) faults.push(`covered: a press on "${nameOf(el)}" lands on ${describe(hit)}`)
      }
    }
    scrollTo(startX, startY)
    return faults
  }, root)
  return fromFaults(faults)
}
