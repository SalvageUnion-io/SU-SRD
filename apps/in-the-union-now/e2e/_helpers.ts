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
 * Wait for the page to finish hydrating (router + game data preload).
 *
 * The router root wraps its Outlet in `<GameDataReady>`, which suspends until
 * `SalvageUnionReference.preload('all')` resolves and then sets
 * `body[data-game-data-ready="true"]`. We wait on that single marker — once
 * it's true, every consumer of game data has its lookups resolved
 * synchronously, so card/label queries downstream are race-free.
 *
 * The wait is generous (60 s) because cold-start preload on a CI runner can
 * be slow; once the marker is set, subsequent queries respond instantly.
 */
export async function waitForReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => document.body?.dataset?.gameDataReady === 'true', null, {
    timeout: 60_000,
  })
}

/**
 * Click a chassis / class / ability / equipment / system / module card by its
 * displayed entity name. Asserts the card exists first so test failures point
 * at the right step.
 */
export async function pickByName(page: Page, name: string): Promise<void> {
  const card = choiceCardByName(page, name)
  await expect(card, `card containing "${name}" should render`).toBeVisible({
    timeout: 15_000,
  })
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
