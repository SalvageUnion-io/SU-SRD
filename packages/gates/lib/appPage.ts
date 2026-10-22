/**
 * Opening the app in a browser, for everything that drives it: the e2e specs
 * (`apps/web/e2e/_helpers.ts` builds on these), the one seeded account
 * (`seedAccount.ts`), and through it the gallery and `bun run dev:backend`.
 *
 * It needs no Playwright test runner (no `expect`), so the tools run it too.
 * Every path is a browser path; `openApp` puts the app's base in front.
 */
import type { Page } from '@playwright/test'
import { APP_BASE } from '../../../apps/web/src/lib/appBase'

/**
 * `page.goto`, again when a client navigation aborts it.
 *
 * A builder ends on a client-side redirect (the create flow pushes the
 * Training Bay's route), and a `goto` issued right after can race the tail of
 * it: the browser aborts the superseded load with `net::ERR_ABORTED; maybe
 * frame was detached?`. The abort is transient, so the `goto` is retried here
 * rather than the whole test. Any other navigation error rethrows.
 */
export async function visit(page: Page, url: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(url)
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (attempt === 4 || !/ERR_ABORTED|frame was detached/i.test(message)) throw error
      // Let the navigation that won settle; it may already be gone.
      await page.waitForLoadState('domcontentloaded').catch(() => undefined)
    }
  }
}

/**
 * Wait until the app has its game data. The router root holds its Outlet in
 * `<GameDataReady>` until `SalvageUnionReference.preload('all')` resolves, then
 * sets `body[data-game-data-ready="true"]`: once it is set, every lookup
 * resolves synchronously. 60 s, because a cold preload on a CI runner is slow.
 */
export async function waitForReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction("document.body?.dataset?.gameDataReady === 'true'", null, {
    timeout: 60_000,
  })
}

/** Open an app route (`/play/`) under `base` (the origin, empty against a `baseURL`) and wait for its game data. */
export async function openApp(page: Page, route: string, base = ''): Promise<void> {
  await visit(page, `${base}${APP_BASE}${route}`)
  await waitForReady(page)
}

/**
 * Put the open sheet in Edit. A sheet opens in Read, so every Manage, Assign
 * and bay control is one press of Edit away: a toggle on the band, or a
 * Read | Edit radio. Pressing it when it is already on is a no-op.
 */
export async function editSheet(page: Page): Promise<void> {
  const control = page
    .getByRole('button', { name: 'Edit', exact: true })
    .or(page.getByRole('radio', { name: 'Edit', exact: true }))
    .first()
  await control.waitFor({ timeout: 15_000 })
  const on = async () =>
    (await control.getAttribute('aria-pressed')) ?? (await control.getAttribute('aria-checked'))
  if ((await on()) !== 'true') await control.click()
  for (let i = 0; i < 50 && (await on()) !== 'true'; i++) await page.waitForTimeout(100)
  if ((await on()) !== 'true') throw new Error(`the sheet at ${page.url()} did not go into Edit`)
}

/**
 * The link to a Training Bay item's sheet, by kind (`pilot`, or any) and name.
 * Matched by its `/sheet/` href and the name, never the row around it: an
 * item's chips name the units linked to it ("Linked: Stomper"), so the first
 * row mentioning a name may be somebody else's. A shelf item with a menu draws
 * its link as a cover named by its `aria-label` and holding no text; one
 * without a menu wraps its text.
 */
export function sheetLink(page: Page, name: string, kind = '') {
  const href = `a[href*="/sheet/${kind ? `${kind}/` : ''}"]`
  return page
    .locator(`${href}[aria-label="${name}"]`)
    .or(page.locator(href, { hasText: name }))
    .first()
}

/** Copy a Starter Set build (`pilot/starter-pilot-bonesaw`) to the Training Bay from its sheet's "Make a copy". */
export async function copyStarter(
  page: Page,
  sheet: string,
  name: string,
  base = ''
): Promise<void> {
  await openApp(page, `/starter/${sheet}`, base)
  await page.getByRole('button', { name: 'Make a copy', exact: true }).first().click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Make a copy' }).click()
  // A crawler's name is its number and name ("Crawler #430 'Tenacity'").
  await page
    .getByText(new RegExp(`^Copied .*${name}.* to your Training Bay`))
    .first()
    .waitFor({ timeout: 20_000 })
}
