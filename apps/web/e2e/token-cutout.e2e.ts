import { expectCorpusClean } from './_designRoutes'
import { corpusRoutes } from './_designTable'
import { findTokenCutouts, TOKEN_CUTOUT_SELECTORS } from './_tokenCutout'
import { test } from './fixtures'

/**
 * Every Mini wears the cut-out head every Compact and index Compact wears
 * (R45): its name on a tab notched into its band's foot, the paint showing
 * over it, no edge under it (`_tokenCutout.ts`). A header-only Mini's tab is
 * its ground, on the pill's foot; a contentful Mini's (N3) is the paper,
 * opening into its body's paper with no rule between. The pages are the
 * reference corpus's `contentful-mini` and `header-mini` ones
 * (`_designTable.ts`), signed out, at page and phone widths: every kind a
 * sheet or a page draws as one. Each page must draw at least one, so the gate
 * never passes by reading nothing. There is no allowlist: every fault fails.
 */
test.use({ account: 'anonymous' })
test.describe.configure({ retries: 0 })

test('every contentful Mini wears the cut-out head', { tag: '@pr' }, async ({ page }) => {
  test.setTimeout(5 * 60_000)
  await expectCorpusClean(page, 'token-cutout', () => findTokenCutouts(page), {
    routes: corpusRoutes('contentful-mini'),
    draws: TOKEN_CUTOUT_SELECTORS.contentful,
    message: 'contentful Minis off the cut-out',
  })
})

test('every header-only Mini wears the cut-out head', { tag: '@pr' }, async ({ page }) => {
  test.setTimeout(5 * 60_000)
  await expectCorpusClean(page, 'token-cutout', () => findTokenCutouts(page), {
    routes: corpusRoutes('header-mini'),
    draws: `${TOKEN_CUTOUT_SELECTORS.token}:not([data-contentful])`,
    message: 'header-only Minis off the cut-out',
  })
})
