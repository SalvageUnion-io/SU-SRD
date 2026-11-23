import type { Locator, Page } from '@playwright/test'
import { DESIGN_VIEWPORTS } from 'gates/lib/designViewports'
import type { FilterFrame } from './_filterShift'
import { findFilterShiftFaults, measureFilterFrame } from './_filterShift'
import { expect, test } from './fixtures'

/**
 * Chrome K17, a filter moves only its results (`_filterShift.ts`): on the
 * listings with the most facets, at R0's phone and page, every filter is
 * pressed in turn (each Tech Level, a menu's first and last choice, Weapons
 * only, the name filter matching some and none, a column's sort) and the
 * header, the band, every rail control and the List's column heads must
 * stand within a pixel of where they stood. Each press is undone before the
 * next, so every reading starts from the unfiltered listing.
 */
test.use({ account: 'anonymous' })
test.describe.configure({ retries: 0 })

const LISTINGS = ['/systems/', '/equipment/', '/chassis/', '/abilities/', '/npcs/'] as const

/** Wakes the listing's island (it mounts on the first reach) and waits for it. */
async function openListing(page: Page, route: string): Promise<void> {
  await page.goto(route)
  // A phone's name filter folds behind Filters with the facets (r8 G4): that is the reach there.
  const search = page.locator('.su-rail input[type="search"]').first()
  const reach = (await search.isVisible()) ? search : page.locator('.su-rail__filters').first()
  await reach.click()
  await page
    .locator('[data-island="SchemaViewerIsland"]:not([data-standin])')
    .waitFor({ state: 'attached', timeout: 30_000 })
  if (reach === search) await search.blur()
}

/** A frame after layout has settled: two frames on from the press. */
async function settled(page: Page): Promise<FilterFrame> {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  )
  return measureFilterFrame(page)
}

/** Every press a listing's rail offers, each with its undo. */
async function presses(page: Page): Promise<
  {
    label: string
    press: (rail: Locator) => Promise<unknown>
    undo: (rail: Locator) => Promise<unknown>
  }[]
> {
  const rail = page.locator('.su-listing-page__filters .su-rail')
  const out: Awaited<ReturnType<typeof presses>> = []
  const levels = rail.locator('.su-rail__facets .su-seg__option')
  const levelCount = await levels.count()
  for (let i = 1; i < levelCount; i++) {
    out.push({
      label: `Tech Level ${(await levels.nth(i).textContent())?.trim()}`,
      press: (r) => r.locator('.su-rail__facets .su-seg__option').nth(i).click(),
      undo: (r) => r.locator('.su-rail__facets .su-seg__option').nth(0).click(),
    })
  }
  const menus = rail.locator('.su-rail__facets select')
  for (let i = 0; i < (await menus.count()); i++) {
    const menu = menus.nth(i)
    const values = (
      await menu
        .locator('option')
        .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
    ).filter(Boolean)
    for (const value of new Set([values[0], values.at(-1)])) {
      if (!value) continue
      out.push({
        label: `${await menu.getAttribute('aria-label')} = ${value}`,
        press: (r) => r.locator('.su-rail__facets select').nth(i).selectOption(value),
        undo: (r) => r.locator('.su-rail__facets select').nth(i).selectOption(''),
      })
    }
  }
  const toggles = rail.locator('.su-rail__facets button[aria-pressed]:not(.su-seg__option)')
  for (let i = 0; i < (await toggles.count()); i++) {
    const at = (r: Locator) =>
      r.locator('.su-rail__facets button[aria-pressed]:not(.su-seg__option)').nth(i)
    out.push({
      label: `${(await toggles.nth(i).textContent())?.trim()}`,
      press: (r) => at(r).click(),
      undo: (r) => at(r).click(),
    })
  }
  for (const query of ['me', 'zzqx']) {
    out.push({
      label: `the name filter "${query}"`,
      press: (r) => r.locator('input[type="search"]').fill(query),
      undo: (r) => r.locator('input[type="search"]').fill(''),
    })
  }
  return out
}

for (const width of ['page', 'phone'] as const) {
  test.describe(`at the ${width} width`, { tag: '@pr' }, () => {
    test.use({ viewport: DESIGN_VIEWPORTS[width] })

    for (const route of LISTINGS) {
      test(`no filter on ${route} moves its controls or columns`, async ({ page }) => {
        test.setTimeout(3 * 60_000)
        await openListing(page, route)
        const rail = page.locator('.su-listing-page__filters .su-rail')
        const filters = rail.locator('.su-rail__filters')
        // A phone's facets fold behind Filters: open them before each press.
        const open = async () => {
          if (
            (await filters.isVisible()) &&
            (await filters.getAttribute('aria-expanded')) !== 'true'
          )
            await filters.click()
        }
        await open()
        const faults: string[] = []
        for (const { label, press, undo } of await presses(page)) {
          await open()
          const before = await settled(page)
          await press(rail)
          const after = await settled(page)
          faults.push(...findFilterShiftFaults(before, after).map((f) => `${label}: ${f}`))
          await open()
          await undo(rail)
        }
        // A column's sort, back to the book's order after.
        const sort = page.locator('#srd-listing-results thead button:visible').nth(1)
        if (await sort.count()) {
          const before = await settled(page)
          await sort.click()
          const after = await settled(page)
          faults.push(...findFilterShiftFaults(before, after).map((f) => `a sort: ${f}`))
        }
        expect(faults, 'a filter moved its controls, the page above them or its columns').toEqual(
          []
        )
      })
    }
  })
}
