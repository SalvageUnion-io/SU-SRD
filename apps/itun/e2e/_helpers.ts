import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Shared helpers for ITUN end-to-end tests.
 *
 * Every pickable entity in a wizard or picker pane is a `ReferenceEntityCard`
 * with a whole-card click. Its interactive wrapper takes its role from
 * `selectionRole`: an exclusive "choose exactly one" pane (class, chassis,
 * crawler type, pattern) renders `role="radio"` + `aria-checked`, while a
 * multi-pick pane (abilities, equipment, systems) renders `role="button"` +
 * `aria-pressed`. `Sel`-wrapped cells are plain `<div role="button">`.
 *
 * So a pick target is "a radio OR a button" — matching only one of the two
 * silently misses whole steps, which is exactly how these specs rotted while
 * the panes migrated onto the entity card. We match by accessible text
 * containing the entity name, the same pattern the in-app integration tests
 * use.
 */
export function pickTargets(page: Page): Locator {
  return page.getByRole('button').or(page.getByRole('radio'))
}

export function choiceCardByName(page: Page, name: string): Locator {
  return pickTargets(page).filter({ hasText: name }).first()
}

/**
 * Every option cell a pick pane offers — chosen or not. The entity card only
 * emits `aria-pressed` / `aria-checked` when it was given a `selectionRole`,
 * so this matches selectable cells and nothing else (nav buttons, the stepper
 * and the wizard CTA carry neither attribute).
 */
export function optionCells(page: Page): Locator {
  return page.locator('[aria-pressed], [aria-checked]')
}

/**
 * The currently-chosen option cell(s). Covers both selection semantics — a
 * multi-pick pane's `aria-pressed` toggle and an exclusive pane's
 * `aria-checked` radio — so the "exactly one option is current" assertion
 * survives a pane moving between the two.
 */
export function selectedOption(page: Page): Locator {
  return page.locator('[aria-pressed="true"], [aria-checked="true"]')
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
      // Let the competing client navigation settle deterministically before
      // re-issuing the goto — wait for the superseding load to reach
      // `domcontentloaded` rather than blindly sleeping a fixed delay. Swallow:
      // the aborted load may already be gone, in which case there is nothing to
      // wait for and we retry immediately.
      await page.waitForLoadState('domcontentloaded').catch(() => {})
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

/**
 * Fill a wizard identity field by its visible `Field` label.
 *
 * These are not plain inputs. `Field` with `value` + `onSave` renders an
 * `InlineEditField`: a `role="button"` readout that swaps to an input only once
 * activated, and it labels both halves `Edit <label lowercased>`. So filling one
 * is click-then-type, and `getByLabel(/^Name$/)` — what these helpers used to
 * do — matches nothing at all.
 *
 * Falls back to a direct fill for the steps that do render a real input.
 */
export async function fillIdentity(page: Page, label: string, value: string): Promise<boolean> {
  // Click-to-edit (`Field` with `value` + `onSave`): a role="button" readout
  // that swaps to an input once activated, both named `Edit <label>`.
  const editLabel = new RegExp(`^Edit ${label}$`, 'i')
  const editor = page.getByLabel(editLabel).first()
  if (await editor.isVisible().catch(() => false)) {
    await editor.click().catch(() => {})
    await page.getByLabel(editLabel).first().fill(value)
    // InlineEditField commits on blur.
    await page.keyboard.press('Tab')
    return true
  }
  // Plain labelled input (`Field` with `htmlFor`) — the callsign step's shape.
  const plain = page.getByLabel(new RegExp(`^${label}`, 'i')).first()
  if (await plain.isVisible().catch(() => false)) {
    await plain.fill(value)
    return true
  }
  return false
}

/**
 * Drive a `/new` wizard to completion and return once the redirect to `/` lands.
 *
 * Deliberately step-AGNOSTIC. These wizards have been restructured repeatedly —
 * the pilot went from 6 steps to 9, the mech to 9, the crawler to 6, and a
 * `CreateModeChooser` ("Guided vs Blank") gate was added in front of all three —
 * and the previous hard-coded builders broke silently at the first pick every
 * time. The builders' only contract is "produce a valid entity for the specs
 * that follow", so this walks whatever steps exist: advance while Next is
 * enabled, and when it is gated, satisfy the gate (fill identity fields, else
 * take the first offered option) and try again.
 *
 * `?mode=guided` skips the chooser gate directly rather than clicking through it.
 */
async function runWizard(
  page: Page,
  kind: 'pilots' | 'mechs' | 'crawlers',
  identity: Record<string, string>,
  createLabel: RegExp
): Promise<void> {
  await gotoStable(page, `/${kind}/new?mode=guided`)
  await waitForReady(page)

  const MAX_STEPS = 16
  for (let step = 0; step < MAX_STEPS; step++) {
    const create = page.getByRole('button', { name: createLabel }).first()
    if (await create.isVisible().catch(() => false)) {
      await create.click()
      await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 })
      return
    }

    const next = page.getByRole('button', { name: /^Next( ·|$)/ }).first()
    await expect(next, `wizard ${kind} should offer Next or Create at step ${step}`).toBeVisible({
      timeout: 15_000,
    })

    if (await next.isDisabled()) {
      // Identity first — a name step is gated on text, not on a pick.
      // `fillIdentity` reports whether the field was on this step at all, and
      // handles both shapes the wizards use (click-to-edit and plain input).
      for (const [label, value] of Object.entries(identity)) {
        await fillIdentity(page, label, value)
      }
      // Then options. A step can require a pick from more than one GROUP, and
      // later groups may not exist until an earlier one is answered — the pilot
      // step reveals its "first ability" trees only once a class is chosen. So
      // satisfy one group at a time, re-reading the page after each pick: take
      // the first not-yet-selected option in the first group that has none.
      // (Walking a flat option list instead just re-picks within the same
      // group — click every class in turn and you end on the last one, with
      // the ability requirement still unmet.)
      // Pick the LAST unselected option each round, re-reading the page in
      // between. Sections that appear in response to a pick are appended below
      // the one that triggered them, so "last" always lands in the newest
      // unanswered section — pick a class and the next round lands in the
      // ability trees that class just revealed. Walking forwards from the top
      // instead just re-picks within the first section (click every class in
      // turn and you end on the last one, ability still unchosen).
      for (let round = 0; round < 6 && (await next.isDisabled()); round++) {
        const unselected = optionCells(page).filter({
          hasNot: page.locator('[aria-checked="true"], [aria-pressed="true"]'),
        })
        const count = await unselected.count()
        if (count === 0) break
        await unselected
          .nth(count - 1)
          .click()
          .catch(() => {})
        await page.waitForTimeout(350)
      }
      await expect(next, `wizard ${kind} step ${step} should unlock after picking`).toBeEnabled({
        timeout: 10_000,
      })
    }
    await next.click()
    await page.waitForTimeout(400)
  }
  throw new Error(`wizard ${kind} did not reach its Create step within ${MAX_STEPS} steps`)
}

/** Build a pilot. Steps: Stats → Class & Ability → Equipment → Callsign → Background → Motto → Keepsake → Appearance → Review. */
export async function buildPilot(page: Page, name: string, callsign: string): Promise<void> {
  await runWizard(page, 'pilots', { name, callsign }, /Create Pilot/i)
}

/**
 * Build a mech. Steps: Gain Scrap → Chassis → Statistics → Systems → Modules →
 * Quirk → Appearance → Pattern Name → Review.
 *
 * The name field is labelled "Name / Pattern" — a mech's name IS its pattern —
 * so both spellings are offered; whichever is absent is a no-op.
 */
export async function buildMech(page: Page, name: string): Promise<void> {
  await runWizard(page, 'mechs', { 'name / pattern': name, 'mech name': name }, /Create Mech/i)
}

/** Build a crawler. Steps: Type → Statistics → Armament Bay → Crew → Name → Review. */
export async function buildCrawler(page: Page, name: string): Promise<void> {
  await runWizard(page, 'crawlers', { 'crawler name': name }, /Create Crawler/i)
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
  await page.waitForURL(/\/sheet\//, { timeout: 20_000 })
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
