import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { editSheet, sheetLink, visit, waitForReady } from 'gates/lib/appPage'
import { at } from './_base'

/**
 * Shared helpers for the app end-to-end tests.
 *
 * Every pickable entity in a wizard or picker pane is a `ReferenceEntityCard`
 * with a whole-card click. Its interactive wrapper takes its role from
 * `selectionRole`: an exclusive "choose exactly one" pane (class, chassis,
 * crawler type, pattern) renders `role="radio"` + `aria-checked`, while a
 * multi-pick pane (abilities, equipment, systems) renders `role="button"` +
 * `aria-pressed`.
 *
 * So a pick target is "a radio OR a button" — matching only one of the two
 * silently misses whole steps, which is exactly how these specs rotted while
 * the panes migrated onto the entity card. We match by accessible text
 * containing the entity name, the same pattern the in-app integration tests
 * use.
 */
function pickTargets(page: Page): Locator {
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
 * Open an app route (`/pilots/new`, written root-relative as the app writes
 * it) and wait for it to hydrate: `visit` retries the transient `ERR_ABORTED`
 * a client redirect can cause, then `waitForReady` waits for the game data
 * (`gates/lib/appPage.ts`, which the seeded account opens the app with too).
 * Every spec opens an app page this way.
 */
export async function openApp(page: Page, route: string): Promise<void> {
  await visit(page, at(route))
  await waitForReady(page)
}

export { editSheet, waitForReady }

/** An entity to Peek from the Union bar's search: its schema and a name its Mini holds. */
export type SearchPeek = { schema: string; name: string }

/**
 * Type `name` into the Union bar's search (the combobox mounts its island on
 * intent, so it is clicked first) and return the result Mini of `schema` that
 * holds it, a Peek trigger (`data-peek`), without waiting for it.
 */
export async function searchPeekTrigger(page: Page, { schema, name }: SearchPeek) {
  const search = page.getByRole('combobox', { name: 'Search the Reference' }).first()
  await search.click()
  await search.fill(name)
  return page.locator(`[role="option"][data-peek^="${schema}:"]`).filter({ hasText: name }).first()
}

/** Open `name`'s Peek from the Union bar's search; resolves once its plate draws a head. */
export async function openPeekFromSearch(page: Page, peek: SearchPeek): Promise<void> {
  const trigger = await searchPeekTrigger(page, peek)
  await expect(trigger, `a ${peek.schema} Mini for ${peek.name} to Peek`).toBeVisible()
  await trigger.hover()
  await expect(page.locator('[data-peek-popup] .su-entity-compact__head').first()).toBeVisible()
}

/**
 * Every `Math.random()` draw from now on rolls `die` on a d20 (Randsum draws
 * `floor(random * 20) + 1`); 14 is a Success.
 */
export async function seedDice(page: Page, die = 14): Promise<void> {
  await page.evaluate((d) => {
    Math.random = () => (d - 1) / 20 + 0.001
  }, die)
}

/** How far the page scrolls past the window, down and across, in px (0 or less: it fits). */
export function pageOverflow(page: Page): Promise<{ down: number; across: number }> {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement
    return { down: root.scrollHeight - innerHeight, across: root.scrollWidth - innerWidth }
  })
}

/** `text` as a literal in a `RegExp`. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A `/new` wizard (`pilots`, `mechs`, `crawlers`). */
export type WizardKind = 'pilots' | 'mechs' | 'crawlers'

/**
 * Open a `/new` wizard on its first step: `?mode=guided` skips the
 * `CreateModeChooser` ("Guided vs Blank") gate in front of every wizard, and
 * `game` builds into that Game (`?game=`, ADR-052 §3).
 */
export async function openWizard(page: Page, kind: WizardKind, game?: string): Promise<void> {
  await openApp(page, `/${kind}/new?mode=guided${game ? `&game=${game}` : ''}`)
}

/** The option cells not chosen yet, in either selection semantic (see `optionCells`). */
export function unselectedOptions(page: Page): Locator {
  return page.locator('[aria-pressed="false"], [aria-checked="false"]')
}

/**
 * Advance a guided wizard forward until `target` shows up, then stop.
 *
 * A spec that wants to exercise ONE step must not `goto('/<kind>/new')` and
 * assume that step is the landing step: a `CreateModeChooser` gate stands in
 * front of every wizard (hence `?mode=guided`), and the pilot wizard has a
 * "Your Stats" step ahead of "Class & Ability". A spec that assumed either sat
 * waiting for an element that was one
 * click away until it burned its whole timeout.
 *
 * So don't encode WHICH step index a thing lives on — walk forward until it is
 * on screen. Inserting another step ahead of the target then costs nothing.
 */
export async function advanceUntilVisible(
  page: Page,
  target: Locator,
  maxSteps = 8
): Promise<void> {
  for (let step = 0; step < maxSteps; step++) {
    // Target first, with a RETRYING wait. `isVisible()` resolves immediately —
    // it does not retry the way `click()` and `expect().toBeVisible()` do — so
    // probing it bare straight after `waitForReady()` (which only awaits the
    // game-data flag, not the step's own paint) answers about a step that is
    // one tick from rendering. Guarding this loop on a bare `isVisible()` is
    // what made it fall straight through without ever clicking.
    await target.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => {})
    if (await target.isVisible().catch(() => false)) return

    // Not on this step, so look for the CTA. Waiting on it here also absorbs a
    // slow first paint: if nothing had rendered yet, the next pass re-checks
    // the target before clicking anything.
    const next = page.getByRole('button', { name: /^Next(: |$)/ }).first()
    await next.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
    if (!(await next.isVisible().catch(() => false))) break

    // Next goes briefly disabled while a step swaps in, so a bare
    // `isDisabled()` here reads a transition as "this step is gated" and ends
    // the walk early. Give it a bounded chance to settle and only stop when it
    // stays disabled — that is a genuine gate the caller must satisfy itself.
    if (await next.isDisabled().catch(() => false)) {
      const settled = await expect(next)
        .toBeEnabled({ timeout: 3_000 })
        .then(() => true)
        .catch(() => false)
      if (!settled) break
    }
    await next.click()
  }
  await expect(target, 'target step should be reachable by advancing the wizard').toBeVisible({
    timeout: 15_000,
  })
}

/**
 * Click a chassis / class / ability / equipment / system / module card by its
 * displayed entity name. Asserts the card exists first so test failures point
 * at the right step.
 */
export async function pickByName(page: Page, name: string): Promise<void> {
  const card = choiceCardByName(page, name)
  // Step-agnostic, for the same reason `runWizard` is (see its note): these
  // wizards get restructured, and a spec that says "pick Engineer" means it
  // regardless of which step index Engineer currently lives on. When a step was
  // inserted ahead of the Class/Chassis step, every one of these calls sat
  // waiting for a card one click away until it burned its timeout — which is
  // how ~18 specs went red at once. Walk forward to wherever the card is.
  await advanceUntilVisible(page, card).catch(() => {})
  await expect(card, `card containing "${name}" should render`).toBeVisible({
    timeout: 15_000,
  })
  await card.click()
}

/**
 * Install a System/Module by name on a mech wizard craft step. Each entity card
 * carries its Qty stepper (`Stat`), whose "Increase {name} count" appends one
 * copy (installing the same System/Module twice is rules-legal), so we target
 * that button rather than clicking the card.
 */
export async function installLoadoutItem(page: Page, name: string): Promise<void> {
  // The stepper's `+` reads "Increase <name> count": each press appends one copy.
  const add = page.getByRole('button', { name: `Increase ${name} count`, exact: true })
  await expect(add, `"Increase ${name} count" should render`).toBeVisible({
    timeout: 15_000,
  })
  await add.click()
}

/**
 * Add one entry from a searcher (`EntitySearcher`: the sheet's pickers, a
 * Mini list beside the opened entity's Page). An entry is opened from the
 * list and added from its Page's action bar (`<name> actions`), never toggled
 * in the list.
 */
async function addFromSearcher(picker: Locator, name: string): Promise<void> {
  await picker.getByRole('button', { name, exact: true }).first().click()
  const actions = picker.getByRole('group', { name: `${name} actions` })
  await expect(actions, `the searcher opens ${name}'s Page`).toBeVisible()
  await actions.getByRole('button').last().click()
}

/**
 * Add `name` through one of the open sheet's pickers: Edit, the section's
 * control that opens it (`Manage abilities`, `Manage systems`, a bay's
 * `Mount`), the searcher (`addFromSearcher`), then close it. A picker writes
 * through as it adds; there is no Save to press.
 */
export async function addThroughPicker(page: Page, control: RegExp, name: string): Promise<void> {
  await editSheet(page)
  await page.getByRole('button', { name: control }).click()
  const picker = page.getByRole('dialog')
  await expect(picker).toBeVisible()
  await addFromSearcher(picker, name)
  await page.keyboard.press('Escape')
  await expect(picker).toBeHidden()
}

/**
 * Click the wizard's Next button. WizShell wizards label the CTA from the
 * steps array (`NextLabel`, 'Next: Abilities'); legacy builders use a bare 'Next'.
 */
export async function clickNext(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Next(: |$)/ }).click()
}

// ---------------------------------------------------------------------------
// Entity builders — drive the WizShell wizards end to end.
// Each returns once the redirect to the Training Bay lands (the server write is
// complete), so subsequent steps can rely on the entity existing.
// ---------------------------------------------------------------------------

/**
 * Fill a wizard identity field by its visible `Field` label.
 *
 * These are not plain inputs. `Field` with `value` + `onSave` is in its edit
 * state: a `role="button"` readout that swaps to an input only once
 * activated, and it labels both halves `Edit <label lowercased>`. So filling one
 * is click-then-type, and `getByLabel(/^Name$/)` matches nothing at all.
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
    // Field's edit state commits on blur.
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

/** The Training Bay at `/`, or a Game's own page: where a finished build returns to. */
function isContainerPage(pathname: string): boolean {
  return pathname === at('/') || /^\/play\/games\/[^/]+\/?$/.test(pathname)
}

/**
 * Drive a `/new` wizard to completion and return once the redirect lands: `/`
 * for the Training Bay, or `/play/games/<id>` for a wizard started from a Game's page
 * (`?game=`), so a pilot built in a Game finishes too.
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
 * Without `create` the walk stops on the step that offers no Next (Review),
 * creating nothing: a gate scanning each step (`onStep`) needs no unit.
 */
export async function runWizard(page: Page, kind: WizardKind, walk: WizardWalk): Promise<void> {
  const { identity, create: createLabel, prefer = [], game, onStep } = walk
  await openWizard(page, kind, game)

  const heading = page.locator('.su-wiz-main h1').first()
  // The wizard's own Next, in its footer pill: an ability's NEXT tree chip
  // on a step reads "Next: <ability>" too.
  const next = page
    .locator('.su-wiz-pill')
    .getByRole('button', { name: /^Next(: |$)/ })
    .first()
  const MAX_STEPS = 16
  for (let step = 0; step < MAX_STEPS; step++) {
    const title = ((await heading.textContent({ timeout: 15_000 })) ?? '').trim()
    const name = title.replace(/^Step \d+ of \d+ · /, '')
    await onStep?.(name, 'landed')

    if (createLabel) {
      const create = page.getByRole('button', { name: createLabel }).first()
      if (await create.isVisible().catch(() => false)) {
        await create.click()
        await page.waitForURL((url) => isContainerPage(url.pathname), { timeout: 30_000 })
        return
      }
      await expect(next, `wizard ${kind} should offer Next or Create at step ${step}`).toBeVisible({
        timeout: 15_000,
      })
    } else if (!(await next.isVisible().catch(() => false))) {
      return
    }

    if (await next.isDisabled()) {
      // Identity first — a name step is gated on text, not on a pick.
      // `fillIdentity` reports whether the field was on this step at all, and
      // handles both shapes the wizards use (click-to-edit and plain input).
      for (const [label, value] of Object.entries(identity)) {
        await fillIdentity(page, label, value)
      }
      // Then options. A step can require a pick from more than one GROUP, and
      // later groups may not exist until an earlier one is answered — the pilot
      // step reveals its "first ability" trees only once a class is chosen.
      // Pick the LAST unselected option each round, re-reading the page in
      // between. Sections that appear in response to a pick are appended below
      // the one that triggered them, so "last" always lands in the newest
      // unanswered section — pick a class and the next round lands in the
      // ability trees that class just revealed. Walking forwards from the top
      // instead just re-picks within the first section (click every class in
      // turn and you end on the last one, ability still unchosen).
      for (let round = 0; round < 6 && (await next.isDisabled()); round++) {
        // Match unselected cells by their OWN state attribute: a
        // `filter({ hasNot })` asks whether a cell CONTAINS a selected
        // descendant, which a selected cell does not, so the walk would
        // re-click (and thereby DEselect) what it had just chosen.
        const unselected = unselectedOptions(page)

        // Take a named pick when one is on offer, so the built entity is the
        // same every run.
        let picked = false
        for (const want of prefer) {
          const candidate = unselected.filter({ hasText: want }).first()
          if (await candidate.isVisible().catch(() => false)) {
            await candidate.click().catch(() => {})
            picked = true
            break
          }
        }

        if (!picked) {
          const count = await unselected.count()
          if (count === 0) break
          await unselected
            .nth(count - 1)
            .click()
            .catch(() => {})
        }
        // Done once Next unlocks; else the pick revealed another group to answer.
        await expect(next)
          .toBeEnabled({ timeout: 350 })
          .catch(() => {})
      }
      await expect(next, `wizard ${kind} step ${step} should unlock after picking`).toBeEnabled({
        timeout: 10_000,
      })
      await onStep?.(name, 'picked')
    }
    await next.click()
    // The next step is in once its heading is.
    await expect(heading).not.toHaveText(title)
  }
  throw new Error(`wizard ${kind} did not reach its end within ${MAX_STEPS} steps`)
}

/** How `runWizard` walks a wizard. */
export type WizardWalk = {
  /** Identity fields by label (`fillIdentity`), filled on whichever step asks. */
  identity: Record<string, string>
  /** The Create button's name; without it the walk stops on Review. */
  create?: RegExp
  /**
   * Option names to choose when this walk is offered them. Being step-agnostic
   * means "take whatever is on offer", which makes the BUILT ENTITY
   * nondeterministic — and specs downstream assert on it ("the sheet header
   * shows Engineer"). Naming the picks keeps the walk structure-agnostic while
   * making its OUTPUT deterministic.
   */
  prefer?: string[]
  /** Started from this Game's page (`?game=`): the unit lands there, and so does the walk. */
  game?: string
  /** Called as each step lands, and again once a gated step's picks unlock Next. */
  onStep?: (title: string, state: 'landed' | 'picked') => Promise<void>
}

/** Build a pilot. Steps: Stats → Class & Ability → Equipment → Callsign → Background → Motto → Keepsake → Appearance → Review. */
export async function buildPilot(
  page: Page,
  name: string,
  callsign: string,
  /** A Game's id: build it from that Game's page, into the Game (ADR-052 §3). */
  game?: string
): Promise<void> {
  // Engineer, so specs may assert the built pilot's class on the sheet. Without
  // a named pick the walk takes whatever option sits last in the DOM and the
  // class silently varies between runs.
  await runWizard(page, 'pilots', {
    identity: { name, callsign },
    create: /Create Pilot/i,
    prefer: ['Engineer'],
    game,
  })
}

/**
 * Build a mech. Steps: Gain Scrap → Chassis → Statistics → Systems → Modules →
 * Quirk → Appearance → Pattern Name → Review.
 *
 * The name field is labelled "Name / Pattern" — a mech's name IS its pattern —
 * so both spellings are offered; whichever is absent is a no-op.
 */
export async function buildMech(page: Page, name: string): Promise<void> {
  // Mule chassis — the one downstream specs assert on. See buildPilot.
  await runWizard(page, 'mechs', {
    identity: { 'name / pattern': name, 'mech name': name },
    create: /Create Mech/i,
    prefer: ['Mule'],
  })
}

/** Build a crawler. Steps: Type → Statistics → Armament Bay → Crew → Name → Review. */
export async function buildCrawler(page: Page, name: string): Promise<void> {
  await runWizard(page, 'crawlers', {
    identity: { 'crawler name': name },
    create: /Create Crawler/i,
  })
}

/**
 * Open the live sheet for the named entity from the Training Bay, by its
 * shelf item's sheet link (`sheetLink`, `gates/lib/appPage.ts`): the href
 * is the contract, and it survives a copy change that would otherwise leave
 * the helper waiting until the job's ceiling.
 */
export async function openSheetFor(page: Page, name: string): Promise<void> {
  await openApp(page, '/')
  const line = sheetLink(page, name)
  await expect(line, `shelf item for "${name}" should render`).toBeVisible({
    timeout: 15_000,
  })
  await line.click()
  await page.waitForURL(/\/build\/(pilots|mechs|crawlers|npcs)\/(?!new)/, { timeout: 20_000 })
  await waitForReady(page)
}

/**
 * A linked unit on the open sheet's Assigned units: its relation chip
 * (`PILOT | Bonesaw`, hard rule R5), a link to its sheet.
 */
export function assignedUnit(page: Page, name: string) {
  return page.locator('[data-assigned-unit]').getByRole('link', { name: new RegExp(name) })
}

/**
 * Wire a pilot onto the mech sheet currently open, via the Assigned units'
 * 'Assign Pilot' dialog. Resolves when the pilot's relation chip renders.
 */
export async function assignPilotOnMechSheet(page: Page, pilotName: string): Promise<void> {
  await editSheet(page)
  await page.getByRole('button', { name: /assign pilot to mech/i }).click()
  await page.getByRole('dialog').getByText(pilotName).click()
  await page.getByRole('button', { name: /confirm pilot assignment/i }).click()
  await expect(assignedUnit(page, pilotName)).toBeVisible({ timeout: 10_000 })
}

/**
 * Wire a crawler onto the pilot sheet currently open, via the Assigned units'
 * 'Assign Crawler' dialog. Resolves when the crawler's relation chip renders.
 */
export async function assignCrawlerOnPilotSheet(page: Page, crawlerName: string): Promise<void> {
  await editSheet(page)
  await page.getByRole('button', { name: /assign crawler to pilot/i }).click()
  await page.getByRole('dialog').getByText(crawlerName).click()
  await page.getByRole('button', { name: /confirm crawler assignment/i }).click()
  await expect(assignedUnit(page, crawlerName)).toBeVisible({ timeout: 10_000 })
}
