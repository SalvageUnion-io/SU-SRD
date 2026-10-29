import { expectCorpusClean } from './_designRoutes'
import { corpusRoutes } from './_designTable'
import { buildCrawler, openApp, openSheetFor } from './_helpers'
import { countLinkHeads, findDeadLinks, findLinkHeads } from './_linkHeads'
import { expect, test } from './fixtures'

/**
 * EDL E6 ("Nested contentful and Peek heads link"; Modes: a link is the whole
 * surface, contentful its head): where an entity opens its Page but
 * cannot be one `<a>`, its name's link stretches over its whole head
 * (`_linkHeads.ts`). A contentful card met inside another (its body reads) is
 * read on the reference corpus's `linked-head` pages (`_designTable.ts`),
 * signed out, at page and phone widths, every entity link there opening a
 * real page (`findDeadLinks`); an app Page's links and foot (a Starter
 * pilot's ability); a Mini with controls on a crawler's live sheet, its bays. Each must draw at least one, so the gate never passes
 * by reading nothing. There is no allowlist: every fault fails.
 */
test.describe.configure({ retries: 0 })

test.describe('signed out', () => {
  test.use({ account: 'anonymous' })

  test('a nested card opens its Page from its whole head', { tag: '@pr' }, async ({ page }) => {
    test.setTimeout(5 * 60_000)
    await expectCorpusClean(
      page,
      'link-heads',
      async () => [...(await findLinkHeads(page)), ...(await findDeadLinks(page))],
      {
        routes: corpusRoutes('linked-head'),
        draws: 'a.su-card-title-link',
        message: 'linked heads with a point that opens nothing, or links to no page',
      }
    )
  })

  test("an app Page's links open real pages", { tag: '@pr' }, async ({ page }) => {
    // A Starter pilot's ability opens its Page in the app's dialog; its Next
    // ability opens that one's Page there too, never an SRD path under the app.
    await openApp(page, '/starter/pilot/starter-pilot-bonesaw')
    await page.getByText('Jury Rig').first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Mech-Gyver')).toBeVisible()
    expect((await findDeadLinks(page, '[role="dialog"]')).map((f) => f.detail)).toEqual([])
    expect((await findLinkHeads(page)).map((f) => f.detail)).toEqual([])
    // Its foot's citation is a cut-out hanging from the band's top edge (ruleset Source 2).
    const gap = await dialog.locator('[data-foot-band]').evaluate((foot) => {
      const cut = foot.querySelector('span > span')
      return cut ? cut.getBoundingClientRect().top - foot.getBoundingClientRect().top : -1
    })
    expect(gap).toBe(0)
  })
})

test('a Mini with controls opens its Page from its whole pill', async ({ page }) => {
  await buildCrawler(page, 'Whole Pill')
  await openSheetFor(page, 'Whole Pill')
  await expect(page.locator('[data-acts] .su-entity-mini__link').first()).toBeVisible()
  expect(await countLinkHeads(page)).toBeGreaterThan(0)
  expect((await findLinkHeads(page)).map((f) => f.detail)).toEqual([])
})
