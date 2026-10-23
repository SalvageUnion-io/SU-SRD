import type { Locator, Page } from '@playwright/test'
import { DESIGN_VIEWPORTS } from 'gates/lib/designViewports'
import { at } from './_base'
import { expectCorpusClean } from './_designRoutes'
import { board, CANVAS, openPlay, PHONE, pilotPlayPath } from './_play'
import {
  describeMismatch,
  findSiblingHeights,
  findSiblingMismatches,
  findTabSizes,
} from './_siblingHeights'
import { setUpTable } from './_table'
import { expect, test } from './fixtures'

/**
 * The sibling-height law (ruleset §4.7) on the signed-out reference corpus
 * (`REFERENCE_CORPUS`, `_designTable.ts`) at page and phone widths: no line of
 * controls whose heights differ. A failure names the page, the line and every
 * control on it with its height; give the odd one the line's Size
 * (`styles/sizing.ts`), never a height of its own. Every signed-in context
 * (`designRoutes`, R12's whole-page pass and the touch floor) is
 * `design-walk.e2e.ts`'s.
 */

test.describe.configure({ retries: 0 })

/** Each drawn element in `within` matching `selector`: its height and its name. */
function heightsOf(within: Locator, selector: string): Promise<{ height: number; text: string }[]> {
  return within.evaluate(
    (root, sel) =>
      [...root.querySelectorAll(sel)]
        .filter((el) => el.getBoundingClientRect().height > 0)
        .map((el) => {
          const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)
          return { height: Math.round(el.getBoundingClientRect().height), text }
        }),
    selector
  )
}

test.describe('signed out', { tag: '@pr' }, () => {
  test.use({ account: 'anonymous' })

  test('siblings on one line share one height', async ({ page }) => {
    test.setTimeout(15 * 60_000)
    await expectCorpusClean(
      page,
      'sibling-heights',
      async () => [...(await findSiblingHeights(page)), ...(await findTabSizes(page))],
      { message: 'controls on one line at different heights' }
    )
  })

  /**
   * The Union bar in each of the app's modes (ruleset §3.11, §4.7): Reference |
   * Build | Play stays one switch at one Size, beside the mode's own nav, and
   * every control on the bar shares the switch's height. The bar's tabs are
   * links the page scan does not count as controls, so the bar is held whole
   * here, and each route is checked to wear its mode and show its nav: Build's
   * on the front door and Patterns, Play's on the hub.
   */
  const BAR_ROUTES = [
    { path: at('/'), mode: 'build', nav: ['Training Bay', 'Patterns', 'Starter Set'] },
    {
      path: at('/patterns/'),
      mode: 'build',
      nav: ['Training Bay', 'Patterns', 'Starter Set'],
    },
    { path: at('/play/'), mode: 'play', nav: ['Solo'] },
  ] as const

  test('the Union bar holds one height in Build and in Play', async ({ page }) => {
    const failures: string[] = []
    for (const viewport of Object.values(DESIGN_VIEWPORTS)) {
      const { width } = viewport
      await page.setViewportSize(viewport)
      for (const { path, mode, nav } of BAR_ROUTES) {
        await page.goto(path, { waitUntil: 'networkidle' })
        const bar = page.locator('.su-union-bar')
        await expect(bar, `${path}: the bar wears its mode`).toHaveAttribute('data-mode', mode)
        await expect(
          bar.locator('.su-union-bar__tab[aria-current]'),
          `${path}: its mode's tab is current`
        ).toHaveAttribute('data-tool', mode)
        // The mode's nav shows inline from `lg`; below it the drawer carries it.
        if (width >= 1024) {
          await expect(bar.locator('.su-union-bar__nav a').filter({ visible: true })).toHaveText([
            ...nav,
          ])
        }
        const heights = await heightsOf(
          bar,
          '.su-union-bar__tab, .su-search-field, .su-btn, .su-union-bar__buy, .su-nav-drawer__trigger'
        )
        expect(heights.length, `${path} at ${width}px: nothing measured`).toBeGreaterThan(3)
        if (new Set(heights.map((c) => c.height)).size > 1) {
          const controls = heights.map((c) => `${c.height}px "${c.text}"`).join(', ')
          failures.push(`${path} at ${width}px, the Union bar: ${controls}`)
        }
        for (const m of await findSiblingMismatches(page, '.su-union-bar'))
          failures.push(`${path} at ${width}px, ${describeMismatch(m)}`)
      }
    }
    expect(failures, 'Union bar controls at different heights').toEqual([])
  })
})

/**
 * Play's own lines: the Play bar, each unit box and each action row, open and
 * closed. On the canvas a unit box is scanned whole (its head and every body
 * row: the vitals, the pilot's class / TP / injuries, the mech's range;
 * Sheet and Board are chips on the head); on a phone only its head, since the touch floor lifts every
 * button there to 44px beside chips that keep their drawn Size (`design-walk.e2e.ts`
 * scans each phone tab whole, against its baseline). Play needs an account,
 * so this signs in, sets up the Starter Set table (`setUpTable`) and opens
 * Bonesaw's screen, on foot, then Boarded with an action open, at the
 * canvas's design size (scale 1, so a measured px is a drawn px) and as a
 * phone. Only those lines are scanned (`EXPECTED`); the rest of the page is
 * the other specs'.
 *
 * Each line's selector must match something visible where it is expected, or
 * the scan would pass having measured nothing: a renamed class fails here
 * instead of turning the gate off.
 *
 * Skips without the test sign-in seam (`fixtures.ts`); ci.yml's `build-web`
 * carries it, so this runs on every PR.
 */
const BAR = '.su-play-root header'
const UNITS = '.su-play-unit'
const UNIT_HEADS = '.su-play-unit .su-entity-compact__head'
const ACTIONS = 'li.su-play-act'

/** Which lines each view shows and scans: the canvas all three, a phone's tab its own. */
const EXPECTED: Record<string, readonly string[]> = {
  canvas: [BAR, UNITS, ACTIONS],
  Act: [BAR, ACTIONS],
  Units: [BAR, UNIT_HEADS],
}

async function playMismatches(page: Page, state: string): Promise<string[]> {
  const failures: string[] = []
  for (const viewport of [CANVAS, PHONE]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    // The phone form puts the Units on their own tab.
    for (const tab of viewport === PHONE ? ['Act', 'Units'] : [null]) {
      if (tab !== null) await page.getByRole('tab', { name: tab }).click()
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const where = tab === null ? viewport.name : `${viewport.name}, ${tab}`
      const lines = EXPECTED[tab ?? 'canvas'] ?? []
      for (const selector of lines) {
        const seen = await page.locator(selector).filter({ visible: true }).count()
        expect(seen, `Play, ${state}, at ${where}: nothing matches ${selector}`).toBeGreaterThan(0)
      }
      // The bar's stamps sit a label's width from the switch, past the scan's
      // neighbour gap, so the bar is held to one height whole: every stamp
      // and control on it.
      const bar = await heightsOf(
        page.locator(BAR),
        ':scope > .su-badge-stamp, :scope > .su-btn, .su-seg'
      )
      if (new Set(bar.map((c) => c.height)).size > 1) {
        const controls = bar.map((c) => `${c.height}px "${c.text}"`).join(', ')
        failures.push(`Play, ${state}, at ${where}, the bar: ${controls}`)
      }
      // The phone's other tab is hidden, so its lines measure nothing there.
      // Each kind of line is scanned on its own: an action line is a Mini
      // (ruleset §1.3), itself a control, so the Actions column's Minis are
      // never one line with the Units column's steppers across the gutter.
      const scanned = viewport === PHONE ? [BAR, UNIT_HEADS, ACTIONS] : lines
      for (const within of scanned) {
        for (const m of await findSiblingMismatches(page, within))
          failures.push(`Play, ${state}, at ${where}, ${describeMismatch(m)}`)
      }
    }
    if (viewport === PHONE) await page.getByRole('tab', { name: 'Act' }).click()
  }
  await page.setViewportSize({ width: CANVAS.width, height: CANVAS.height })
  return failures
}

test('Play: the bar, unit boxes and action rows share one height', { tag: '@pr' }, async ({
  page,
}) => {
  test.setTimeout(8 * 60_000)
  await setUpTable(page)
  await page.setViewportSize({ width: CANVAS.width, height: CANVAS.height })
  await openPlay(page, await pilotPlayPath(page, 'Bonesaw'))
  const failures = await playMismatches(page, 'On foot')

  await board(page, 'Scrapper')
  const use = page
    .getByRole('list', { name: 'On hand' })
    .getByRole('button', { name: /^Use / })
    .first()
  await use.click()
  await expect(page.locator('li.su-play-act[data-open]')).toHaveCount(1)
  failures.push(...(await playMismatches(page, 'Boarded, an action open')))

  expect(failures, 'Play controls on one line at different heights').toEqual([])
})
