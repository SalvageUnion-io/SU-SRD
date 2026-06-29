import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Shared helpers for ITUN end-to-end tests.
 *
 * Wizard picks are role=button targets of two shapes: `Sel`-wrapped entity
 * cards and `EntityChoiceCard`s render a `<div role="button">` (Sel carries
 * an aria-label with the entity name); WizShell master panes render native
 * `OptRow` <button>s. `getByRole('button')` covers both — we match by
 * accessible text/name containing the entity name, the same pattern used by
 * the in-app integration tests.
 */
export function choiceCardByName(page: Page, name: string): Locator {
  return page.getByRole('button').filter({ hasText: name }).first()
}

/**
 * Navigate to `path`, tolerating the transient
 * `net::ERR_ABORTED; maybe frame was detached?` that the preview build
 * occasionally throws.
 *
 * The builders end on a *client-side* router redirect to `/` (the create flow
 * pushes the dashboard route). A full `page.goto('/')` issued right afterward
 * can race the tail of that client navigation and the browser aborts the
 * superseded load — this is why `goto('/')` flakes while `goto('/pilots/new')`
 * (a distinct URL) does not. The abort is transient: the competing navigation
 * settles within a tick, so an immediate re-`goto` lands. Playwright's
 * test-level `retries` re-run the whole `beforeEach` and re-hit the same race,
 * so we retry at the `goto` boundary instead. Only the ERR_ABORTED /
 * detached-frame class is swallowed; any other navigation error rethrows.
 */
export async function gotoStable(page: Page, path: string): Promise<void> {
  const MAX_ATTEMPTS = 4
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await page.goto(path)
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/ERR_ABORTED|frame was detached/i.test(message)) throw error
      lastError = error
      // Let the competing client navigation settle before re-issuing the goto.
      await page.waitForTimeout(500)
    }
  }
  throw lastError
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
 * Install a Loadout System/Module by name. The mech wizard's Loadout step
 * (InstallStep) is no longer a one-shot Sel toggle on the card itself — each
 * entity card carries its own aria-labelled "Add {name}" button that appends
 * one copy (installing the same System/Module twice is rules-legal), so we
 * target that button rather than clicking the card.
 */
export async function installLoadoutItem(page: Page, name: string): Promise<void> {
  const add = page.getByRole('button', { name: `Add ${name}` })
  await expect(add, `"Add ${name}" install button should render`).toBeVisible({
    timeout: 15_000,
  })
  await add.click()
}

/**
 * Click the wizard's Next button. WizShell wizards label the CTA from the
 * steps array ('Next · Abilities →'); legacy builders use a bare 'Next'.
 */
export async function clickNext(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Next( ·|$)/ }).click()
}

/**
 * Click a top-level navigation control by accessible name.
 */
export async function clickNavLink(page: Page, name: RegExp | string): Promise<void> {
  await page.getByRole('link', { name }).click()
}

// ---------------------------------------------------------------------------
// Entity builders — drive the Phase-3 WizShell wizards end to end.
// Each returns once the dashboard redirect lands (the IndexedDB write is
// complete), so subsequent steps can rely on the entity existing.
// ---------------------------------------------------------------------------

/** Build a pilot (Class → Abilities → Equipment → Identity → Background → Review). */
export async function buildPilot(page: Page, name: string, callsign: string): Promise<void> {
  await gotoStable(page, '/pilots/new')
  await waitForReady(page)
  await pickByName(page, 'Engineer')
  await clickNext(page) // -> Abilities
  await pickByName(page, 'Engineering Expertise')
  await clickNext(page) // -> Equipment
  await page.locator('div[role="button"]').first().click()
  await clickNext(page) // -> Identity
  await page.getByLabel(/^Name/).fill(name)
  await page.getByLabel(/Callsign/).fill(callsign)
  await clickNext(page) // -> Background
  await clickNext(page) // -> Review
  await page.getByRole('button', { name: /Create Pilot/i }).click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })
}

/** Build a mech (Chassis → Pattern → Loadout → Identity → Review). */
export async function buildMech(page: Page, name: string): Promise<void> {
  await gotoStable(page, '/mechs/new')
  await waitForReady(page)
  await pickByName(page, 'Mule')
  await clickNext(page) // -> Pattern
  await pickByName(page, 'Custom Pattern')
  await page.getByLabel(/Pattern name/i).fill('Custom')
  await clickNext(page) // -> Loadout
  await clickNext(page) // -> Identity (loadout optional)
  await page.getByLabel(/Mech name/i).fill(name)
  await clickNext(page) // -> Review
  await page.getByRole('button', { name: /Create Mech/i }).click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })
}

/** Build a crawler (Crawler type → Systems → Crew → Identity → Review). */
export async function buildCrawler(page: Page, name: string): Promise<void> {
  await gotoStable(page, '/crawlers/new')
  await waitForReady(page)
  await pickByName(page, 'Battle')
  await clickNext(page) // -> Systems
  await clickNext(page) // -> Crew
  await clickNext(page) // -> Identity
  await page.getByLabel(/Crawler Name/i).fill(name)
  await clickNext(page) // -> Review
  await page.getByRole('button', { name: /Create Crawler/i }).click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })
}

/**
 * Open the live sheet for the named entity from the dashboard's saved rows
 * (each row is an <li> with a 'Sheet' link).
 */
export async function openSheetFor(page: Page, name: string): Promise<void> {
  await gotoStable(page, '/')
  await waitForReady(page)
  const row = page.locator('li', { hasText: name }).first()
  await expect(row, `dashboard row for "${name}" should render`).toBeVisible({
    timeout: 15_000,
  })
  await row.getByRole('link', { name: /^Sheet$/ }).click()
  await page.waitForURL(/\/sheet\//, { timeout: 10_000 })
}

/**
 * Wire a pilot onto the mech sheet currently open, via the rail's
 * 'Assign Pilot' dialog. Resolves when the pilot's RailChip renders.
 */
export async function assignPilotOnMechSheet(page: Page, pilotName: string): Promise<void> {
  await page.getByRole('button', { name: /assign pilot to mech/i }).click()
  await page.getByRole('dialog').getByText(pilotName).click()
  await page.getByRole('button', { name: /confirm pilot assignment/i }).click()
  await expect(
    page.getByRole('link', { name: new RegExp(`Assigned Pilot: ${pilotName}`, 'i') })
  ).toBeVisible({ timeout: 10_000 })
}

/**
 * Wire a crawler onto the pilot sheet currently open, via the rail's
 * 'Assign Crawler' dialog. Resolves when the crawler's RailChip renders.
 */
export async function assignCrawlerOnPilotSheet(page: Page, crawlerName: string): Promise<void> {
  await page.getByRole('button', { name: /assign crawler to pilot/i }).click()
  await page.getByRole('dialog').getByText(crawlerName).click()
  await page.getByRole('button', { name: /confirm crawler assignment/i }).click()
  await expect(
    page.getByRole('link', { name: new RegExp(`Home Crawler: ${crawlerName}`, 'i') })
  ).toBeVisible({ timeout: 10_000 })
}
