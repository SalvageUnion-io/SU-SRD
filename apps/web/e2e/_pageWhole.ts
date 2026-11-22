import type { Page } from '@playwright/test'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * A reference page shows its whole self, at every width (hard rules R43,
 * R44): nothing in its content folds shut, a Live Sheet aside (`fold:`, a disclosure toggle, the
 * `useDisclosure` fold or a `<details>`; a Peek, a menu, a combobox and an
 * index's search rail aside), and the page never scrolls sideways
 * (`scroll:`, the document wider than the window).
 *
 * R43's one fold (`ONE_FOLD`): on a class page, an Ability on its track may
 * unfold its own rules in place, a `<details>` straight after its Compact in
 * its tier. On a chassis page, a pattern row's loadout may unfold under its
 * name (`PATTERN_FOLD`, r6 E5), drawn only on a phone. The same folds
 * anywhere else, or any other fold there, fail.
 */

/** The one fold R43 allows: where it may stand, and what it must follow. */
export const ONE_FOLD = {
  /** A class page's path. */
  page: '^/classes/[a-z0-9-]+/$',
  /** The fold, in its tier of an ability track. */
  fold: '.su-ability-track[data-track] > .su-ability-track__tier > details.su-ability-open',
  /** What it must follow: its own Ability's Compact, the tier's first child. */
  after: '.su-ability-track__tier > a.su-entity-compact[href^="/abilities/"]:first-child',
}

/** R43's pattern fold: a chassis's pattern row, opening to its loadout on a phone (r6 E5). */
export const PATTERN_FOLD = {
  page: '^/chassis/[a-z0-9-]+/$',
  fold: '.su-ledger__under > details.su-pattern-fold',
}

/** Runs in the page; returns plain data. */
export function scanPageWhole({
  path = location.pathname,
  one,
  pattern,
}: {
  path?: string
  one: typeof ONE_FOLD
  pattern: typeof PATTERN_FOLD
}): string[] {
  const faults: string[] = []
  const root = document.scrollingElement ?? document.documentElement
  const across = root.scrollWidth - innerWidth
  if (across > 0) faults.push(`scroll: the page is ${across}px wider than the window`)
  const main = document.querySelector('main') ?? document.body
  // A Live Sheet folds its sections (R46); it is no reference page.
  if (main.matches('[data-variant]')) return faults
  const classPage = new RegExp(one.page).test(path)
  // An Ability's own rules, unfolding under its Compact on a class page (R43).
  const chassisPage = new RegExp(pattern.page).test(path)
  const allowed = (el: Element) =>
    (classPage && el.matches(one.fold) && !!el.previousElementSibling?.matches(one.after)) ||
    (chassisPage && el.matches(pattern.fold))
  const folds = main.querySelectorAll(
    'details, [aria-expanded][aria-controls]:not([aria-haspopup]):not([role="combobox"])'
  )
  for (const el of folds) {
    if (el.closest('.su-rail, [data-peek-popup], [aria-hidden="true"], [inert]')) continue
    if (allowed(el)) continue
    // A shut fold may stand no taller than its summary, drawn outside it.
    const drawn = [el, el.querySelector(':scope > summary')].some((box) => {
      const r = box?.getBoundingClientRect()
      return !!r && r.width >= 1 && r.height >= 1
    })
    if (!drawn) continue
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ')
    faults.push(`fold: "${name.slice(0, 40)}" folds the page's content`)
  }
  return faults
}

/** A fold in a reference page's content, and a page wider than its window. */
export async function findPageWhole(page: Page): Promise<Finding[]> {
  return fromFaults(await page.evaluate(scanPageWhole, { one: ONE_FOLD, pattern: PATTERN_FOLD }))
}
