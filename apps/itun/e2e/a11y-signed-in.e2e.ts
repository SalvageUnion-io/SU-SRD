import type { Page } from '@playwright/test'
import { scanPages } from 'gates/a11y'
import { at } from './_base'
import { setUpTable } from './_table'
import { expect, test } from './fixtures'

/**
 * WCAG 2.2 AA on the pages only an account reaches, at desktop and as a
 * Pixel 7 (`packages/gates/lib/a11yScan.ts`). Fails on any violation.
 *
 * `a11y.e2e.ts` scans signed out, where ITUN is read-only: Shelves, the
 * wizards, the live sheets, the Game, the Mediator Dashboard and the
 * Dashboard never render there. This spec signs in through the fixtures
 * account (`fixtures.ts`), sets up the Starter Set table the Dashboard spec
 * plays (`setUpTable`), and scans each of those pages with that session.
 *
 * Like every signed-in spec it SKIPS in a build with no test sign-in seam, so
 * the PR tier never runs it; the nightly `e2e-itun` job does.
 */

// A violation that fires only sometimes must not pass on a retry.
test.describe.configure({ retries: 0 })

/** The first live sheet of `kind` the Game's roster links to, as the path to open. */
async function rosterSheet(page: Page, kind: 'pilot' | 'mech' | 'crawler'): Promise<string> {
  const link = page.locator(`a[href*="/sheet/${kind}/"]`).first()
  await expect(link, `the roster links a ${kind} sheet`).toBeAttached({ timeout: 20_000 })
  const href = await link.getAttribute('href')
  if (!href) throw new Error(`the roster's ${kind} link has no href`)
  return new URL(href, page.url()).pathname
}

test('no accessibility violations signed in', async ({ page, browser, baseURL }, testInfo) => {
  test.setTimeout(15 * 60_000)
  await setUpTable(page)

  const game = new URL(page.url()).pathname
  const gameId = game.split('/').pop()
  if (!gameId) throw new Error(`No Game id in ${page.url()}`)
  const sheets: string[] = []
  for (const kind of ['pilot', 'mech', 'crawler'] as const)
    sheets.push(await rosterSheet(page, kind))

  await page.getByRole('button', { name: 'Launch Dashboard' }).click()
  const launcher = page.getByRole('dialog', { name: 'Launch Dashboard' })
  await launcher.getByRole('radio', { name: /Bonesaw/ }).check({ timeout: 30_000 })
  await launcher.getByRole('button', { name: 'Launch' }).click()
  await page.waitForURL(/\/dashboard\//)
  const dashboard = new URL(page.url()).pathname

  // The scan opens a context per device; each starts with this session.
  const storageState = await page.context().storageState({ indexedDB: true })
  const { results, violations } = await scanPages({
    browser,
    baseURL: baseURL ?? '',
    pages: [
      // Shelves, with the account's Game and units on it.
      at('/'),
      // Each wizard's first step.
      at('/pilots/new?mode=guided'),
      at('/mechs/new?mode=guided'),
      at('/crawlers/new?mode=guided'),
      at('/npcs/new'),
      game,
      at(`/mediator/${gameId}`),
      dashboard,
      ...sheets,
    ],
    // The reference-data gate's loading screen has no <main>.
    ready: 'main',
    storageState,
  })
  await testInfo.attach('a11y-report.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  })
  expect(
    violations,
    'accessibility violations: the attached a11y-report.json has the details'
  ).toEqual([])
})
