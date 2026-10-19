import type { Page } from '@playwright/test'
import type { DesignDebt } from './_designRoutes'
import { expectWithinBaseline, seedDesignAccount, walkDesignRoutes } from './_designRoutes'
import type { DesignFamily } from './_helpers'
import { DESIGN_FAMILIES, designRoutes } from './_helpers'
import { expect, test } from './fixtures'

/**
 * Hard rule R10, "A surface sets its texture once" (ruleset §1.3, §3.5.1; EDL
 * E13), on the rendered page over every context (R0's `designRoutes`):
 *
 * - `flat`: the Cockpit is flat. Nothing on a Play canvas or phone form
 *   (`.su-dash-root`: the player's, solo and the Mediator's), nor on an
 *   overlay it lays over itself (a Peek, a menu, a dialog: the Mediator's
 *   Reference), wears the speckle (`[data-grain]`). `PlayFrame` turns it off
 *   once for all of them; the overlays inherit it through the portal.
 * - `band`: only the Cockpit is flat. Manage (the Hangar, the Play hub, a
 *   Game's page, the invite screen) is paper under its area's band, and the
 *   band keeps its speckle (`ChapterBand`'s `.su-grain-layer`).
 *
 * The overlays are opened on the canvas only (`page` width): a phone opens a
 * Peek by a long press, and its tabs are the walk's.
 */

/** The Cockpit, canvas or phone form. */
const COCKPIT = '.su-dash-root'

/** What the Cockpit lays over itself, portalled out of it. */
const OVERLAY = '[data-peek-popup], [role="dialog"], [role="alertdialog"], [role="menu"]'

/** Every `[data-grain]` in the Cockpit or an overlay over it, named by its text. */
async function grainedIn(page: Page): Promise<string[]> {
  return await page.evaluate(
    ({ cockpit, overlay }) =>
      [...document.querySelectorAll('[data-grain]')]
        .filter((el) => el.closest(cockpit) || el.closest(overlay))
        .map((el) => {
          const where = el.closest(overlay) ? 'overlay' : 'canvas'
          const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
          return `${where} [data-grain="${el.getAttribute('data-grain')}"] "${text}"`
        }),
    { cockpit: COCKPIT, overlay: OVERLAY }
  )
}

/** Let an overlay come to rest before it is read. */
async function rest(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(300)
}

/**
 * Open each overlay the Cockpit has and read it: a Peek from the canvas's
 * first trigger, and the Mediator's More menu and its Reference. Each is
 * closed again, so the walk goes on from the screen it found.
 */
async function overlays(page: Page): Promise<{ what: string; grained: string[] }[]> {
  const read: { what: string; grained: string[] }[] = []
  const trigger = page.locator(`${COCKPIT} [data-peek]`).first()
  if (await trigger.isVisible().catch(() => false)) {
    const address = await trigger.getAttribute('data-peek')
    await trigger.hover()
    const popup = page.locator('[data-peek-popup]')
    await expect(popup.locator('.su-entity-row__head, .su-roll').first()).toBeVisible()
    read.push({ what: `the ${address} Peek`, grained: await grainedIn(page) })
    await page.mouse.move(0, 0)
    await page.keyboard.press('Escape')
    await expect(popup).toHaveCount(0)
  }
  const more = page.locator(`${COCKPIT} button[aria-label="More"]:not([disabled])`).first()
  if (await more.isVisible().catch(() => false)) {
    await more.click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    read.push({ what: 'the More menu', grained: await grainedIn(page) })
    const reference = menu.getByRole('menuitem', { name: 'Reference' })
    if (await reference.isVisible().catch(() => false)) {
      await reference.click()
      const dialog = page.getByRole('dialog', { name: 'Reference' })
      await expect(dialog).toBeVisible()
      await dialog.getByRole('combobox', { name: 'Search the Reference' }).fill('drill')
      await rest(page)
      read.push({ what: "the Reference's results", grained: await grainedIn(page) })
      const result = dialog.getByRole('option').first()
      if (await result.isVisible().catch(() => false)) {
        await result.click()
        await rest(page)
        read.push({ what: "the Reference's entity", grained: await grainedIn(page) })
      }
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
    } else {
      await page.keyboard.press('Escape')
    }
  }
  return read
}

/** Manage's band: present, and speckled. */
async function bandFault(page: Page): Promise<string | null> {
  const band = page.locator('.su-chapter-band').first()
  if ((await band.count()) === 0) return 'no ChapterBand'
  const layers = await band.locator('.su-grain-layer').count()
  return layers > 0 ? null : `the band "${(await band.innerText()).trim().slice(0, 40)}" is flat`
}

/**
 * `BASELINE` is the debt this pass found when it landed, by route family and
 * rule, each to be fixed and deleted here. A finding off it fails; an entry
 * nothing matches is noted on the report as paid off.
 */
const BASELINE: readonly DesignDebt[] = []

/** The routes R10 reads: the Cockpits and Manage; no other context is held to it at runtime. */
const ROUTES = designRoutes.filter((r) => ['play', 'manage'].includes(DESIGN_FAMILIES[r.family]))

test.describe.configure({ retries: 0 })

test('every context: the Cockpit is flat, and only the Cockpit', async ({ page }) => {
  test.setTimeout(20 * 60_000)
  const seed = await seedDesignAccount(page)
  const playFamilies = new Set<DesignFamily>()
  const read: string[] = []
  const findings = await walkDesignRoutes(
    page,
    seed,
    async ({ family, width, where }) => {
      const context = DESIGN_FAMILIES[family]
      const found: { rule: string; line: string }[] = []
      if (context === 'play') {
        playFamilies.add(family)
        await expect(page.locator(COCKPIT).first(), `${where}: the Cockpit is up`).toBeVisible()
        for (const g of await grainedIn(page)) found.push({ rule: 'flat', line: `${where}: ${g}` })
        if (width === 'page' && !where.includes(' tab')) {
          for (const { what, grained } of await overlays(page)) {
            read.push(`${where}: ${what}`)
            for (const g of grained) {
              found.push({ rule: 'flat', line: `${where}, ${what}: ${g}` })
            }
          }
        }
      }
      if (context === 'manage') {
        const fault = await bandFault(page)
        if (fault) found.push({ rule: 'band', line: `${where}: ${fault}` })
      }
      return found
    },
    ROUTES
  )
  test.info().annotations.push({ type: 'overlays read', description: read.join('; ') })
  expect([...playFamilies].sort(), 'the walk reached every Cockpit').toEqual([
    'play-mediator',
    'play-player',
    'play-solo',
  ])
  expectWithinBaseline('texture', findings, BASELINE)
})
