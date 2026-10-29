import { expectCorpusClean } from './_designRoutes'
import { corpusRoutes } from './_designTable'
import { buildCrawler, openSheetFor } from './_helpers'
import { countLinkHeads, findLinkHeads } from './_linkHeads'
import { expect, test } from './fixtures'

/**
 * EDL E6 ("Nested contentful and Peek heads link"; Modes: a link is the whole
 * surface, contentful its head): where an entity opens its Page but
 * cannot be one `<a>`, its name's link stretches over its whole head
 * (`_linkHeads.ts`). A contentful card met inside another (its body reads) is
 * read on the reference corpus's `linked-head` pages (`_designTable.ts`),
 * signed out, at page and phone widths; a Mini with controls on a crawler's
 * live sheet, its bays. Each must draw at least one, so the gate never passes
 * by reading nothing. There is no allowlist: every fault fails.
 */
test.describe.configure({ retries: 0 })

test.describe('signed out', () => {
  test.use({ account: 'anonymous' })

  test('a nested card opens its Page from its whole head', { tag: '@pr' }, async ({ page }) => {
    test.setTimeout(5 * 60_000)
    await expectCorpusClean(page, 'link-heads', () => findLinkHeads(page), {
      routes: corpusRoutes('linked-head'),
      draws: 'a.su-card-title-link',
      message: 'linked heads with a point that opens nothing',
    })
  })
})

test('a Mini with controls opens its Page from its whole pill', async ({ page }) => {
  await buildCrawler(page, 'Whole Pill')
  await openSheetFor(page, 'Whole Pill')
  await expect(page.locator('[data-acts] .su-entity-mini__link').first()).toBeVisible()
  expect(await countLinkHeads(page)).toBeGreaterThan(0)
  expect((await findLinkHeads(page)).map((f) => f.detail)).toEqual([])
})
