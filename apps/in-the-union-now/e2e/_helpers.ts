import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Shared helpers for ITUN end-to-end tests.
 *
 * Selection cards in the wizards are rendered by `EntityChoiceCard`, which
 * wraps `ReferenceEntityDisplay` with `cardClick: true`. The card root is a
 * `<div role="button">`. We locate cards by walking role=button divs whose
 * accessible text contains the entity name — the same pattern used by the
 * in-app integration tests.
 */
export function choiceCardByName(page: Page, name: string): Locator {
  return page.locator('div[role="button"]').filter({ hasText: name }).first()
}

/**
 * Wait for the page to finish hydrating (router + game data preload). The
 * dashboard and wizards mount with a Suspense boundary that resolves once
 * `salvageunion-reference` is loaded.
 */
export async function waitForReady(page: Page): Promise<void> {
  // Either the dashboard heading or a wizard heading should be visible.
  await page.waitForLoadState('domcontentloaded')
  // Allow a beat for game-data preload before asserting.
  await page.waitForFunction(
    () => Boolean(document.querySelector('[role="button"], h1, h2, main')),
    null,
    { timeout: 30_000 }
  )
}

/**
 * Click a chassis / class / ability / equipment / system / module card by its
 * displayed entity name. Asserts the card exists first so test failures point
 * at the right step.
 */
export async function pickByName(page: Page, name: string): Promise<void> {
  const card = choiceCardByName(page, name)
  await expect(card, `card containing "${name}" should render`).toBeVisible({ timeout: 15_000 })
  await card.click()
}

/**
 * Click the wizard's Next button.
 */
export async function clickNext(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Next$/ }).click()
}

/**
 * Click a top-level navigation control by accessible name.
 */
export async function clickNavLink(page: Page, name: RegExp | string): Promise<void> {
  await page.getByRole('link', { name }).click()
}
