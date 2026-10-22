import { expect, test } from '@playwright/test'
import { findAbilityTreeFaults } from './_abilityTrees'
import { walkDesignRoutes } from './_designRoutes'
import { corpusRoutes } from './_designTable'

/**
 * Ability trees keep their layout (`_abilityTrees.ts`) wherever they render:
 * each tree its own column, its tiers stacked at their own heights, and never
 * more than three trees side by side. The pages are the reference corpus's
 * `ability-trees` ones (`_designTable.ts`), signed out: a Core class's page, a
 * Hybrid Class's, the abilities index's Tree and every Starter pilot's sheet,
 * at the page width, a laptop's and a phone's. Each page must draw a tree, so
 * the gate never passes by reading nothing. There is no allowlist.
 */
test.describe.configure({ retries: 0 })

test('every ability tree is its own column, three across at most', async ({ page }) => {
  test.setTimeout(5 * 60_000)
  const found = await walkDesignRoutes(
    page,
    async ({ where }) => {
      await expect(page.locator('.su-ability-track').first(), `${where} draws a tree`).toBeVisible()
      return (await findAbilityTreeFaults(page)).map((fault) => ({
        rule: 'tree',
        line: `${where}, ${fault}`,
      }))
    },
    { routes: corpusRoutes('ability-trees'), widths: ['page', 1024, 'phone'] }
  )
  expect(
    found.map((f) => f.line),
    'ability trees off their columns'
  ).toEqual([])
})
