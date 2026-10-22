import { expect, test } from '@playwright/test'
import { walkDesignRoutes } from './_designRoutes'
import { corpusRoutes } from './_designTable'
import { findMiniCutoutFaults, TOKEN_CUTOUT_SELECTORS } from './_tokenCutout'

/**
 * Every contentful Mini (N3) wears the cut-out head every Mini, Compact and
 * index Compact wears: its name on a paper tab notched into its band's foot, the paint
 * showing over it, the tab opening into its body's paper with no rule
 * between (`_tokenCutout.ts`). The
 * pages are the reference corpus's `contentful-mini` ones (`_designTable.ts`),
 * signed out, at page and phone widths: every kind a sheet or a page draws as
 * one. Each page must draw at least one, so the gate never passes by reading
 * nothing. There is no allowlist: every fault fails.
 */
test.describe.configure({ retries: 0 })

test('every contentful Mini wears the cut-out head', async ({ page }) => {
  test.setTimeout(5 * 60_000)
  const found = await walkDesignRoutes(
    page,
    async ({ where }) => {
      const tokens = page.locator(TOKEN_CUTOUT_SELECTORS.token)
      await expect(tokens.first(), `${where} draws a contentful Mini`).toBeVisible()
      return (await findMiniCutoutFaults(page)).map((fault) => ({
        rule: 'cutout',
        line: `${where}, ${fault}`,
      }))
    },
    { routes: corpusRoutes('contentful-mini') }
  )
  expect(
    found.map((f) => f.line),
    'contentful Minis off the cut-out'
  ).toEqual([])
})
