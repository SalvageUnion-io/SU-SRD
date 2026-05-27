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
 * `salvageunion-reference` finishes loading.
 *
 * Vite's dev server lazily compiles modules on first hit, so the initial
 * page load on a CI runner can take 30-60 s before any meaningful content
 * appears. We wait for both a real heading element AND at least one
 * interactive element to be present before returning — the bare `<main>`
 * tag renders pre-hydration and would otherwise resolve immediately.
 */
export async function waitForReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(
    () => {
      const heading = document.querySelector('h1, h2')
      const interactive = document.querySelector(
        'div[role="button"], button, input, select, a[href]'
      )
      return Boolean(heading && interactive)
    },
    null,
    { timeout: 60_000 }
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
