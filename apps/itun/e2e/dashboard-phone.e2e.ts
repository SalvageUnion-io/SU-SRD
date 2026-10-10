import type { Page } from '@playwright/test'
import { gotoStable, waitForReady } from './_helpers'
import { expect, test } from './fixtures'

/**
 * The Dashboard on a phone (ADR-044, issue #1256): a full boarded turn at
 * 375×812 and 390×844.
 *
 * Board, then the deck's pennant (which opens the resolve screen and pays the
 * cost), Roll, Push, Apply and Done, then Vent, the Log behind ≡, and
 * Dismount. Along the way: no masthead and no rotate notice, no horizontal
 * page scroll, the unit tab following the mount with focus on its heading,
 * Push and Vent at thumb height, and every visible control at least 44×44.
 *
 * ## The table
 *
 * A Game started from the Starter Set template, with the signed-in account as
 * its Mediator (ADR-038 §1). It picks up Bonesaw and his Scrapper, so the
 * pilot is in this browser (`LaunchDashboard` lists only those) and the
 * Scrapper is his own to board.
 *
 * ## The dice
 *
 * `rollDie` draws one `Uint32Array` from `crypto.getRandomValues` per die. The
 * init script answers every one-element draw with 13, so every d20 lands on
 * 14: a Success on the Core Mechanic, and a safe Heat Check at any Heat below
 * 14. Any other draw (auth, ids) gets real randomness.
 *
 * ## Viewport
 *
 * The account fixture signs in at the desktop viewport, where its readiness
 * signal (the masthead's Games menu) is on screen, and the table is set up
 * there. The phone viewport is set just before the Dashboard opens.
 *
 * Skips without the test sign-in seam, like every signed-in spec
 * (`fixtures.ts`); the nightly `e2e-itun` job runs it for real.
 */

const PHONES = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
] as const

/** Every one-element Uint32 draw is 13, so every die `rollDie` throws is 14 on a d20. */
function seedDice(): void {
  const real = crypto.getRandomValues.bind(crypto)
  crypto.getRandomValues = (<T extends ArrayBufferView | null>(array: T): T => {
    if (array instanceof Uint32Array && array.length === 1) {
      array[0] = 13
      return array
    }
    return real(array as ArrayBufferView & Uint32Array) as unknown as T
  }) as typeof crypto.getRandomValues
}

/** The page never scrolls sideways. */
async function expectNoOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow, 'horizontal page overflow (px)').toBeLessThanOrEqual(0)
}

/** Every visible control is at least 44×44 (ruleset §4.6, ADR-044 D14). */
async function expectHitAreas(page: Page): Promise<void> {
  const small = await page.evaluate(() => {
    const controls = document.querySelectorAll<HTMLElement>(
      'button, a[href], [role="button"], [role="tab"]'
    )
    const out: string[] = []
    for (const el of controls) {
      if (el.closest('[aria-hidden="true"], [inert]')) continue
      const box = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (box.width === 0 || box.height === 0 || style.visibility === 'hidden') continue
      // A link inside running text is exempt (WCAG 2.5.8's inline exception).
      if (style.display === 'inline') continue
      // Rounding: a 44px box can measure 43.99 after a sub-pixel scale.
      if (box.width < 43.5 || box.height < 43.5) {
        const name = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? ''
        out.push(
          `${el.tagName.toLowerCase()} "${name}" ${box.width.toFixed(1)}×${box.height.toFixed(1)}`
        )
      }
    }
    return out
  })
  expect(small, 'controls under 44×44').toEqual([])
}

/** A numeral cell or gauge's current value, from its accessible name ("EP 6 of 9"). */
async function readout(page: Page, label: string): Promise<number> {
  const name = await page
    .getByRole('img', { name: new RegExp(`^${label} \\d+ of \\d+`) })
    .first()
    .getAttribute('aria-label')
  const value = name?.match(/ (\d+) of /)?.[1]
  if (value === undefined) throw new Error(`no ${label} readout`)
  return Number(value)
}

/** A pinned vital's current value ("EP 6/9" in the pinned row). */
async function pinned(page: Page, label: string): Promise<number> {
  const text = await page.getByRole('list', { name: 'Pinned vitals' }).innerText()
  const value = text.replace(/\s+/g, ' ').match(new RegExp(`${label} ?(\\d+) ?/`, 'i'))?.[1]
  if (value === undefined) throw new Error(`no pinned ${label} in "${text}"`)
  return Number(value)
}

/** Pick up an unclaimed pre-gen from the Game's roster. */
async function pickUp(page: Page, name: string): Promise<void> {
  const row = page.locator('li', { hasText: name }).first()
  await row.getByRole('button', { name: /— pick this up$/ }).click()
  const confirm = page.getByRole('alertdialog')
  await confirm.getByRole('button', { name: 'Pick up' }).click()
  await expect(confirm).toBeHidden({ timeout: 15_000 })
}

/** Start a Starter Set Game, mediate it, take Bonesaw and his Scrapper. */
async function setUpTable(page: Page): Promise<void> {
  await gotoStable(page, '/')
  await waitForReady(page)
  await page.getByRole('button', { name: '+ New game' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start this game' }).first().click()
  await page.getByRole('button', { name: 'Make Mediator' }).first().click()
  await expect(page.getByRole('button', { name: 'Launch Dashboard' })).toBeVisible({
    timeout: 20_000,
  })
  await pickUp(page, 'Bonesaw')
  await pickUp(page, 'Scrapper')
}

for (const phone of PHONES) {
  test(`a boarded turn on a ${phone.width}×${phone.height} phone`, async ({ page }) => {
    test.slow()
    await page.addInitScript(seedDice)
    await setUpTable(page)

    await page.setViewportSize(phone)
    await page.getByRole('button', { name: 'Launch Dashboard' }).click()
    const launcher = page.getByRole('dialog', { name: 'Launch Dashboard' })
    await launcher.getByRole('radio', { name: /Bonesaw/ }).check({ timeout: 30_000 })
    await launcher.getByRole('button', { name: 'Launch' }).click()
    await page.waitForURL(/\/dashboard\//)

    // ── The phone form, on foot ──────────────────────────────────────────────
    const units = page.getByRole('tablist', { name: 'Units' })
    await expect(units).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('navigation', { name: 'Salvage Union tools' })).toHaveCount(0)
    await expect(page.getByText(/rotate to landscape/i)).toHaveCount(0)
    await expect(units.getByRole('tab', { name: /^Pilot/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expectNoOverflow(page)
    await expectHitAreas(page)

    // ── Board: the Mech tab takes over, focus on its heading ─────────────────
    await page.getByRole('button', { name: /^▶ Board/ }).click()
    const claim = page.getByRole('button', { name: /^Claim and board/ })
    if (await claim.isVisible().catch(() => false)) await claim.click()
    await expect(units.getByRole('tab', { name: /^Mech/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { level: 2, name: 'Scrapper' })).toBeFocused()

    // ── Push and Vent at thumb height, at scroll 0 ───────────────────────────
    await page.evaluate(() => window.scrollTo(0, 0))
    for (const name of ['Push · +2 Heat', 'Vent']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox()
      if (!box) throw new Error(`${name} has no box`)
      expect(box.y, `${name} top`).toBeGreaterThanOrEqual(phone.height * 0.4)
      expect(box.y + box.height, `${name} bottom`).toBeLessThanOrEqual(phone.height)
    }
    await expectNoOverflow(page)
    await expectHitAreas(page)

    // ── The pennant: open and pay ────────────────────────────────────────────
    const epBefore = await readout(page, 'EP')
    const pennant = page.getByRole('button', { name: /^Activate .+, spend \d+ EP$/ }).first()
    const pennantName = (await pennant.getAttribute('aria-label')) ?? ''
    const cost = Number(pennantName.match(/spend (\d+) EP$/)?.[1] ?? 0)
    await pennant.click()
    await expect(page.getByRole('heading', { name: 'Resolving' })).toBeFocused()
    expect(await pinned(page, 'EP')).toBe(epBefore - cost)
    await expectNoOverflow(page)
    await expectHitAreas(page)

    // ── Roll, then Push: +2 Heat, a Heat Check, and Push is spent ────────────
    const bar = page.getByRole('group', { name: 'Next step' })
    await bar.getByRole('button', { name: 'Roll the die' }).click()
    await expect(page.getByText('11–19 · Success')).toBeVisible()
    const heatBefore = await pinned(page, 'Heat')
    await bar.getByRole('button', { name: 'Push · Re-roll +2 Heat' }).click()
    await expect.poll(() => pinned(page, 'Heat')).toBe(heatBefore + 2)
    await expect(page.getByText(/Heat Check|Heat \d+/).first()).toBeVisible()
    await expect(bar.getByRole('button', { name: /^Push/ })).toHaveCount(0)

    // ── Apply, then Done ─────────────────────────────────────────────────────
    await bar.getByRole('button', { name: 'Apply · Success' }).click()
    await bar.getByRole('button', { name: 'Done' }).click()
    await expect(units).toBeVisible()

    // ── Vent: Heat to 0 ──────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Vent', exact: true }).click()
    const reactor = page.getByRole('dialog', { name: 'Reactor' })
    await expect(reactor).toContainText('Heat 0')
    await reactor.getByRole('button', { name: 'Close' }).click()
    expect(await readout(page, 'Heat')).toBe(0)

    // ── ≡ → Log: the rolls are there ─────────────────────────────────────────
    await page.getByRole('button', { name: /^Menu/ }).click()
    const menu = page.getByRole('dialog')
    await menu.getByRole('button', { name: 'Log', exact: true }).click()
    await expect(menu.getByText(/14, Success/).first()).toBeVisible({ timeout: 15_000 })
    await expectHitAreas(page)
    await menu.getByRole('button', { name: 'Close the menu' }).click()
    await expect(menu).toBeHidden()

    // ── Dismount: back on foot, the Pilot tab ────────────────────────────────
    await page.getByRole('button', { name: 'Dismount', exact: true }).click()
    await expect(units.getByRole('tab', { name: /^Pilot/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expectNoOverflow(page)
  })
}
