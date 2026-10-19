import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { at } from './_base'
import type { DesignDebt } from './_designRoutes'
import { expectWithinBaseline, seedDesignAccount, walkDesignRoutes } from './_designRoutes'
import { waitForReady } from './_helpers'
import { board, CANVAS, openPlay, PHONE, pilotPlayPath } from './_play'
import { findSiblingMismatches } from './_siblingHeights'
import { setUpTable } from './_table'
import { findTypeFloorFaults } from './_typeFloor'
import { test as signedIn } from './fixtures'

/** A touch phone (`pointer: coarse`): a Pixel 7's viewport with touch on. */
const PHONE_TOUCH = { viewport: { width: 412, height: 839 }, hasTouch: true, isMobile: true }

/**
 * The sibling-height law (ruleset §4.7) on one of each page shape, at desktop
 * and as a phone: no line of controls whose heights differ. A failure names the
 * page, the line and every control on it with its height; give the odd one the
 * line's Size (`styles/sizing.ts`), never a height of its own.
 */
const PAGES = [
  '/',
  '/chassis/',
  '/chassis/mazona/',
  '/chassis/mazona/pattern/buzzard/',
  '/systems/',
  '/systems/salvaging-drill/',
  '/abilities/',
  '/classes/hacker/',
  '/bio-titans/tyrant/',
  '/npcs/saboteur/',
  '/drones/pest-drone/',
  '/vehicles/fighting-box-wheel/',
  '/crawler-bays/armoury/',
  '/roll-tables/core-mechanic/',
  '/roll-tables/mechapult/',
  '/guides/create-a-pilot/',
  '/search?q=drill',
  '/build/',
  '/build/starter',
  '/build/starter/pilot/starter-pilot-bonesaw',
  '/build/starter/mech/starter-mech-mazona',
  '/build/starter/crawler/starter-crawler-tenacity',
  '/build/play/',
]

/** Desktop, and a phone's width (the phone project runs only the smoke specs). */
const WIDTHS = [1440, 390]

test.describe.configure({ retries: 0 })

test('siblings on one line share one height', async ({ page }) => {
  test.setTimeout(10 * 60_000)
  const failures: string[] = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' })
      for (const m of await findSiblingMismatches(page)) {
        const controls = m.controls.map((c) => `${c.height}px ${c.what}`).join(', ')
        failures.push(`${path} at ${width}px, ${m.line}: ${controls}`)
      }
    }
  }
  expect(failures, 'controls on one line at different heights').toEqual([])
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
  { path: '/build/', mode: 'build', nav: ['Hangar', 'Patterns', 'Starter Set'] },
  { path: '/build/mechs/patterns/', mode: 'build', nav: ['Hangar', 'Patterns', 'Starter Set'] },
  { path: '/build/play/', mode: 'play', nav: ['Solo'] },
] as const

test('the Union bar holds one height in Build and in Play', async ({ page }) => {
  const failures: string[] = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
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
      const heights = await bar.evaluate((header) =>
        [
          ...header.querySelectorAll(
            '.su-union-bar__tab, .su-search-field, .su-btn, .su-union-bar__buy, .su-nav-drawer__trigger'
          ),
        ]
          .filter((el) => el.getBoundingClientRect().height > 0)
          .map((el) => {
            const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)
            return { height: Math.round(el.getBoundingClientRect().height), text }
          })
      )
      expect(heights.length, `${path} at ${width}px: nothing measured`).toBeGreaterThan(3)
      if (new Set(heights.map((c) => c.height)).size > 1) {
        const controls = heights.map((c) => `${c.height}px "${c.text}"`).join(', ')
        failures.push(`${path} at ${width}px, the Union bar: ${controls}`)
      }
      for (const m of await findSiblingMismatches(page, '.su-union-bar')) {
        const controls = m.controls.map((c) => `${c.height}px ${c.what}`).join(', ')
        failures.push(`${path} at ${width}px, ${m.line}: ${controls}`)
      }
    }
  }
  expect(failures, 'Union bar controls at different heights').toEqual([])
})

/**
 * Play's own lines: the Play bar, each unit box and each action row, open and
 * closed. On the canvas a unit box is scanned whole (its head and every body
 * row: the vitals, the pilot's class / TP / injuries beside Sheet ⤢, the
 * mech's range); on a phone only its head, since the touch floor lifts every
 * button there to 44px beside chips that keep their drawn Size (the `every context`
 * pass below scans each phone tab whole, against its baseline). Play needs an account,
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
const BAR = '.su-dash-root header'
const UNITS = '.su-play-unit'
const UNIT_HEADS = '.su-play-unit .su-entity-row__head'
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
      const bar = await page.locator(BAR).evaluate((header) =>
        [...header.querySelectorAll(':scope > .su-badge-stamp, :scope > .su-btn, .su-seg')]
          .filter((el) => el.getBoundingClientRect().height > 0)
          .map((el) => {
            const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)
            return { height: Math.round(el.getBoundingClientRect().height), text }
          })
      )
      if (new Set(bar.map((c) => c.height)).size > 1) {
        const controls = bar.map((c) => `${c.height}px "${c.text}"`).join(', ')
        failures.push(`Play, ${state}, at ${where}, the bar: ${controls}`)
      }
      // The phone's other tab is hidden, so its lines measure nothing there.
      const scanned = viewport === PHONE ? [BAR, UNIT_HEADS, ACTIONS] : lines
      for (const m of await findSiblingMismatches(page, scanned.join(', '))) {
        const controls = m.controls.map((c) => `${c.height}px ${c.what}`).join(', ')
        failures.push(`Play, ${state}, at ${where}, ${m.line}: ${controls}`)
      }
    }
    if (viewport === PHONE) await page.getByRole('tab', { name: 'Act' }).click()
  }
  await page.setViewportSize({ width: CANVAS.width, height: CANVAS.height })
  return failures
}

signedIn('Play: the bar, unit boxes and action rows share one height', async ({ page }) => {
  signedIn.setTimeout(8 * 60_000)
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

/**
 * Every context (hard rule R0, R12): the whole page of each of `designRoutes`
 * (`_helpers.ts`), signed in and seeded, at page and phone widths, and on
 * Play's phone form every tab scanned whole (unit boxes, Crew, Tables), not
 * only the unit heads. Each view is held to two rules:
 *
 * - `sibling`: no line whose controls differ in height (§4.7).
 * - `type-floor`: no text drawn under 11px (§4.6, `_typeFloor.ts`), its
 *   computed size times every scale above it.
 *
 * Then, under a coarse pointer (a touch phone), every menu item a seeded page
 * opens is on the 44px floor (§4.6): the Hangar's ⋯ and the Play bar's.
 *
 * No baseline: a finding fails.
 */
const BASELINE: readonly DesignDebt[] = []

signedIn('every context: siblings on one line share one height', async ({ page, browser }) => {
  signedIn.setTimeout(20 * 60_000)
  const seed = await seedDesignAccount(page)
  const findings = await walkDesignRoutes(page, seed, async ({ where }) => [
    ...(await findSiblingMismatches(page)).map((m) => ({
      rule: 'sibling',
      line: `${where}, ${m.line}: ${m.controls.map((c) => `${c.height}px ${c.what}`).join(', ')}`,
    })),
    ...(await findTypeFloorFaults(page)).map((fault) => ({
      rule: 'type-floor',
      line: `${where}: ${fault}`,
    })),
  ])
  expectWithinBaseline('sibling-heights', findings, BASELINE)

  // A coarse pointer: the seeded session in a touch phone's context.
  const touch = await browser.newContext({
    storageState: await page.context().storageState({ indexedDB: true }),
    ...PHONE_TOUCH,
  })
  const phone = await touch.newPage()
  const short: string[] = []
  const menus = [
    { path: at('/'), trigger: /^More for / },
    { path: seed.playMediator, trigger: /^More$/ },
  ]
  for (const { path, trigger } of menus) {
    await phone.goto(path)
    await waitForReady(phone)
    expect(
      await phone.evaluate(() => matchMedia('(pointer: coarse)').matches),
      'the touch context reports a coarse pointer'
    ).toBe(true)
    await phone.getByRole('button', { name: trigger }).filter({ visible: true }).first().click()
    const items = phone.getByRole('menuitem')
    await expect(items.first(), `${path}: its menu opens`).toBeVisible()
    for (const item of await items.all()) {
      const box = await item.boundingBox()
      const height = Math.round(box?.height ?? 0)
      if (height < 44) short.push(`${path}: ${height}px menu item "${await item.textContent()}"`)
    }
    await phone.keyboard.press('Escape')
  }
  await touch.close()
  expect(short, 'menu items under 44px on a coarse pointer').toEqual([])
})
