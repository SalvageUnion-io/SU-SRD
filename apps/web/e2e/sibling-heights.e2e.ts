import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import type { DesignDebt } from './_designRoutes'
import { expectWithinBaseline, seedDesignAccount, walkDesignRoutes } from './_designRoutes'
import { board, CANVAS, openPlay, PHONE, playDoor } from './_play'
import { findSiblingMismatches } from './_siblingHeights'
import { setUpTable } from './_table'
import { test as signedIn } from './fixtures'

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
  const { gameName } = await setUpTable(page)
  await page.setViewportSize({ width: CANVAS.width, height: CANVAS.height })
  await openPlay(page, await playDoor(page, `Play Bonesaw in ${gameName}`))
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
 * Every context (hard rule R0): the whole page of each of `designRoutes`
 * (`_helpers.ts`), signed in and seeded, at page and phone widths, and on
 * Play's phone form every tab scanned whole (unit boxes, Crew, Tables), not
 * only the unit heads.
 *
 * `BASELINE` is the debt this pass found when it landed, by route family and
 * rule: each a line whose controls differ today, to be given one Size and
 * deleted here. A finding off it fails; an entry nothing matches is noted on
 * the report as paid off.
 */
const BASELINE: readonly DesignDebt[] = [
  // Live Sheet, Edit: a stat's max override (17px) beside its provenance
  // trigger (14px), on every gauge.
  ...(['sheet-pilot-edit', 'sheet-mech-edit', 'sheet-crawler-edit'] as const).map((family) => ({
    family,
    rule: 'sibling',
    match: 'button "Override ',
    why: "the max override and the provenance trigger take the gauge's one Size",
  })),
  // Live Sheet, Edit, on a phone: a section's Manage (44px, the touch floor)
  // beside its Collapse (32px).
  ...(['sheet-pilot-edit', 'sheet-mech-edit'] as const).map((family) => ({
    family,
    rule: 'sibling',
    match: 'button.su-btn.su-focus-ring "Collapse ',
    why: "a section head's Collapse takes its Manage's touch Size",
  })),
  {
    family: 'sheet-crawler-edit',
    rule: 'sibling',
    match: 'div.su-sheet-crawler-identity-row',
    why: "the TL chip (20px) beside the type picker (44px) in the crawler's identity row",
  },
  // The wizards: Cancel (32px) beside Next (44px) in the step pill, and the
  // crawler's off-rules link (17px) with them.
  ...(['wizard-pilot', 'wizard-mech', 'wizard-crawler'] as const).map((family) => ({
    family,
    rule: 'sibling',
    match: 'div.su-wiz-pill',
    why: "the step pill's Cancel and off-rules link take Next's Size",
  })),
  {
    family: 'wizard-crawler',
    rule: 'sibling',
    match: 'div.su-masonry',
    why: 'the crawler-type cards, side by side in a masonry, at their own heights',
  },
  // Manage.
  {
    family: 'play-hub',
    rule: 'sibling',
    match: 'a.su-btn.su-focus-ring "Play ',
    why: "a solo pilot's Play (19px) beside its No Mech stamp (18px) in the Row's line",
  },
  {
    family: 'game-page',
    rule: 'sibling',
    match: 'span.su-caps.su-caps--w-bold "You mediate"',
    why: "the band's YOU MEDIATE stamp (20px) beside its 32px Buttons",
  },
  // Play: the Mediator's Propose form, its caps labels (21px) inline with
  // their 44px fields, on the canvas and the phone's Propose tab.
  {
    family: 'play-mediator',
    rule: 'sibling',
    match: 'span.su-caps.su-caps--w-bold "Field"',
    why: "Propose's labels sit above their fields, or take the fields' Size",
  },
]

signedIn('every context: siblings on one line share one height', async ({ page }) => {
  signedIn.setTimeout(20 * 60_000)
  const seed = await seedDesignAccount(page)
  const findings = await walkDesignRoutes(page, seed, async ({ where }) =>
    (await findSiblingMismatches(page)).map((m) => ({
      rule: 'sibling',
      line: `${where}, ${m.line}: ${m.controls.map((c) => `${c.height}px ${c.what}`).join(', ')}`,
    }))
  )
  expectWithinBaseline('sibling-heights', findings, BASELINE)
})
