import { test, expect } from '@playwright/test'

/**
 * Smoke suite — proves the static build serves, islands hydrate, and the core
 * navigation surfaces work. `chassis` / `Mule` are core, stable entities used
 * as fixtures (the same chassis ITUN's e2e builds against).
 */

// (a) Landing page loads and search returns results.
test('landing page loads and search returns results', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Salvage Union/i)

  // The combobox lives in the top nav; it lazily loads game data on first
  // intent (focus/type), then renders result options.
  const search = page.getByRole('combobox', { name: /search the srd/i }).first()
  await search.click()
  await search.fill('Mule')

  const listbox = page.getByRole('listbox')
  await expect(listbox.getByRole('option').first()).toBeVisible({ timeout: 30_000 })
  await expect(listbox).toContainText(/Mule/i)
})

// (b) A schema index page renders its entities.
test('chassis schema index renders entities', async ({ page }) => {
  await page.goto('/schema/chassis/')
  await expect(page).toHaveTitle(/Chassis/i)

  // Entities render (after the island hydrates + game data loads) as links to
  // their individual item pages.
  await expect(page.locator('a[href*="/schema/chassis/item/"]').first()).toBeVisible({
    timeout: 30_000,
  })
})

// (c) An individual entity page renders.
test('a chassis entity page renders its card', async ({ page }) => {
  await page.goto('/schema/chassis/item/mule/')
  // Title is server-rendered, so this asserts the static page exists.
  await expect(page).toHaveTitle(/Mule/i)
  // Heading is present in both the SEO fallback and the hydrated card.
  await expect(page.getByRole('heading', { name: /Mule/i }).first()).toBeVisible({
    timeout: 30_000,
  })
})
