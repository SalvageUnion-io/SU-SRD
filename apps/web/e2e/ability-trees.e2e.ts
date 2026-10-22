import { findAbilityTrees } from './_abilityTrees'
import { expectCorpusClean } from './_designRoutes'
import { corpusRoutes } from './_designTable'
import { test } from './fixtures'

/**
 * Ability trees keep their layout (`_abilityTrees.ts`) wherever they render:
 * each tree its own column, its tiers stacked at their own heights, and never
 * more than three trees side by side. The pages are the reference corpus's
 * `ability-trees` ones (`_designTable.ts`), signed out: a Core class's page, a
 * Hybrid Class's, the abilities index's Tree and every Starter pilot's sheet,
 * at the page width, a laptop's and a phone's. Each page must draw a tree, so
 * the gate never passes by reading nothing. There is no allowlist.
 */
test.use({ account: 'anonymous' })
test.describe.configure({ retries: 0 })

test('every ability tree is its own column, three across at most', { tag: '@pr' }, async ({
  page,
}) => {
  test.setTimeout(5 * 60_000)
  await expectCorpusClean(page, 'ability-trees', () => findAbilityTrees(page), {
    routes: corpusRoutes('ability-trees'),
    widths: ['page', 1024, 'phone'],
    draws: '.su-ability-track',
    message: 'ability trees off their columns',
  })
})
