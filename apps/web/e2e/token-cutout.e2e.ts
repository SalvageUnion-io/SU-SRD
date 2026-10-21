import { expect, test } from '@playwright/test'
import { findMiniCutoutFaults, TOKEN_CUTOUT_SELECTORS } from './_tokenCutout'

/**
 * Every contentful Mini (N3) wears the cut-out head every Mini, Compact and
 * index Compact wears: its name on a paper tab notched into its band's foot, the paint
 * showing over it, the tab opening into its body's paper with no rule
 * between, the body bordered in the band's colour (`_tokenCutout.ts`). The
 * pages hold every kind a sheet or a page draws as one, signed out: a
 * crawler's type ability, bays and crew, a pilot's abilities and equipment, a
 * mech's chassis ability, systems and modules, a pattern's loadout, a class's
 * ability track. Each page must draw at least one, so the gate never passes
 * by reading nothing. There is no allowlist: every fault fails.
 */
const PAGES = [
  '/build/starter/crawler/starter-crawler-tenacity',
  '/build/starter/pilot/starter-pilot-bonesaw',
  '/build/starter/mech/starter-mech-mule',
  '/chassis/mule/',
  '/chassis/mule/pattern/crusher/',
  '/classes/hacker/',
]

/** A wide page and a phone. */
const WIDTHS = [1440, 390]

test.describe.configure({ retries: 0 })

test('every contentful Mini wears the cut-out head', async ({ page }) => {
  test.setTimeout(5 * 60_000)
  const failures: string[] = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' })
      const tokens = page.locator(TOKEN_CUTOUT_SELECTORS.token)
      await expect(tokens.first(), `${path} draws a contentful Mini`).toBeVisible()
      for (const fault of await findMiniCutoutFaults(page)) {
        failures.push(`${path} at ${width}px, ${fault}`)
      }
    }
  }
  expect(failures, 'contentful Minis off the cut-out').toEqual([])
})
