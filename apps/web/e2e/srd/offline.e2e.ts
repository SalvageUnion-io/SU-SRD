import { expect, test } from '@playwright/test'

/**
 * The one install, offline: opened at `/`, the site switches to the builder
 * and back with the network cut. One service worker precaches both halves
 * (`src/pwa.ts`), so this is the spec that proves they are one app offline.
 *
 * Service workers are blocked for every other spec (`playwright.config.ts`); this
 * file opts back in. A dev server emits no worker, so locally it skips; in CI,
 * against the built site, it must run.
 */
test.use({ serviceWorkers: 'allow' })

test('opened at /, the reference and the builder both open offline', async ({ page, context }) => {
  await page.goto('/')
  const active = await page
    .evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      const ready = navigator.serviceWorker.ready.then(() => true)
      const gaveUp = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 15_000))
      return await Promise.race([ready, gaveUp])
    })
    .catch(() => false)
  test.skip(
    !active && !process.env.CI,
    'No service worker: this is a dev-server run. Runs for real against the CI preview build.'
  )
  expect(active, 'no service worker became active').toBe(true)
  // With no builder tab open, the worker claims the page it installed from.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 20_000,
  })

  await context.setOffline(true)
  try {
    await page.goto('/build/')
    await expect(page.locator('#root')).not.toBeEmpty()
    await expect(page).toHaveTitle(/Cantina/i)

    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page).toHaveTitle(/Salvage Union/i)
  } finally {
    await context.setOffline(false)
  }
})
