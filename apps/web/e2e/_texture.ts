import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import type { Finding } from './_findings'

/**
 * Hard rule R10, "A surface sets its texture once" (ruleset §1.3, §3.5.1; EDL
 * E13), on the rendered page: the speckle is universal on brand-colour
 * grounds, the Cockpit and the Peek included, and never on paper, cream, the
 * page ground (Play's included), the ink-deep, a button or a field.
 *
 * - `speckled`: every entity band (a Compact's, a TitledBox's or a unit box's
 *   head, a card's band) on a Play screen at any width (`.su-play-root`:
 *   the player's, solo and the Mediator's), or on an overlay it lays over
 *   itself (a Peek, a menu, a dialog: the Mediator's Reference), that is a
 *   brand-colour ground carries its `[data-grain]`, as on the sheet.
 * - `clean`: no `[data-grain]` there sits on paper, cream, the page ground or
 *   ink-deep, or on or inside a button or a field.
 * - `band`: Manage (the Training Bay, the Play hub, a Game's page, the invite
 *   screen) is paper under its area's band, and the band keeps its speckle
 *   (`ChapterBand`'s `.su-grain-layer`).
 */

/** The Cockpit, at any width. */
export const COCKPIT = '.su-play-root'

/** What the Cockpit lays over itself, portalled out of it. */
const OVERLAY = '[data-peek-popup], [role="dialog"], [role="alertdialog"], [role="menu"]'

/** An entity band: a Compact's, TitledBox's or card's head (`Head`). */
const BAND = '.su-entity-compact__head'

/**
 * The texture faults in the Cockpit and the overlays over it, one line each:
 * a brand-colour band with no speckle (`speckled`), and speckle on a ground
 * that never wears it (`clean`).
 */
export async function findGrain(page: Page): Promise<Finding[]> {
  return await page.evaluate(
    ({ cockpit, overlay, band }) => {
      // The grounds that never wear it, as the browser computes them.
      const probe = document.createElement('span')
      document.body.append(probe)
      const resolve = (token: string) => {
        probe.style.backgroundColor = `var(${token})`
        return getComputedStyle(probe).backgroundColor
      }
      const clean = new Set(
        ['--color-paper', '--color-band-cream', '--color-wk-bg', '--color-ink-deep'].map(resolve)
      )
      probe.remove()
      const transparent = (bg: string) => bg === 'transparent' || /rgba\(.*,\s*0\)$/.test(bg)
      const inScope = (el: Element) => el.closest(cockpit) || el.closest(overlay)
      const name = (el: Element) => {
        const where = el.closest(overlay) ? 'overlay' : 'canvas'
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
        return `${where} "${text}"`
      }
      const out: { rule: string; detail: string }[] = []
      for (const el of document.querySelectorAll(band)) {
        if (!inScope(el)) continue
        const bg = getComputedStyle(el).backgroundColor
        if (transparent(bg) || clean.has(bg)) continue
        if (!el.hasAttribute('data-grain'))
          out.push({ rule: 'speckled', detail: `${name(el)}: a ${bg} band with no speckle` })
      }
      for (const el of document.querySelectorAll('[data-grain]')) {
        if (!inScope(el)) continue
        const bg = getComputedStyle(el).backgroundColor
        if (clean.has(bg))
          out.push({ rule: 'clean', detail: `${name(el)}: speckle on a ${bg} ground` })
        if (
          el.closest('button, input, textarea, select') ||
          el.querySelector('input, textarea, select')
        )
          out.push({ rule: 'clean', detail: `${name(el)}: speckle on a button or a field` })
      }
      return out
    },
    { cockpit: COCKPIT, overlay: OVERLAY, band: BAND }
  )
}

/** Let an overlay come to rest before it is read. */
async function rest(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(300)
}

/**
 * Open each overlay the Cockpit has and read it: a Peek from the wide layout's
 * first trigger, and the Mediator's More menu and its Reference. Each is
 * closed again, so the walk goes on from the screen it found.
 */
export async function readOverlays(page: Page): Promise<{ what: string; findings: Finding[] }[]> {
  const read: { what: string; findings: Finding[] }[] = []
  const trigger = page.locator(`${COCKPIT} [data-peek]`).first()
  if (await trigger.isVisible().catch(() => false)) {
    const address = await trigger.getAttribute('data-peek')
    await trigger.hover()
    const popup = page.locator('[data-peek-popup]')
    await expect(
      popup.locator('.su-entity-compact__head, .su-entity-mini__head, .su-roll').first()
    ).toBeVisible()
    read.push({ what: `the ${address} Peek`, findings: await findGrain(page) })
    await page.mouse.move(0, 0)
    await page.keyboard.press('Escape')
    await expect(popup).toHaveCount(0)
  }
  const more = page.locator(`${COCKPIT} button[aria-label="More"]:not([disabled])`).first()
  if (await more.isVisible().catch(() => false)) {
    await more.click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    read.push({ what: 'the More menu', findings: await findGrain(page) })
    const reference = menu.getByRole('menuitem', { name: 'Reference' })
    if (await reference.isVisible().catch(() => false)) {
      await reference.click()
      const dialog = page.getByRole('dialog', { name: 'Reference' })
      await expect(dialog).toBeVisible()
      await dialog.getByRole('combobox', { name: 'Search the Reference' }).fill('drill')
      await rest(page)
      read.push({ what: "the Reference's results", findings: await findGrain(page) })
      const result = dialog.getByRole('option').first()
      if (await result.isVisible().catch(() => false)) {
        await result.click()
        await rest(page)
        read.push({ what: "the Reference's entity", findings: await findGrain(page) })
      }
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
    } else {
      await page.keyboard.press('Escape')
    }
  }
  return read
}

/** Manage's band: present, and speckled; or a `band` finding for what is wrong with it. */
export async function findBand(page: Page): Promise<Finding[]> {
  const band = page.locator('.su-chapter-band').first()
  if ((await band.count()) === 0) return [{ rule: 'band', detail: 'no ChapterBand' }]
  if ((await band.locator('.su-grain-layer').count()) > 0) return []
  const name = (await band.innerText()).trim().slice(0, 40)
  return [{ rule: 'band', detail: `the band "${name}" is flat` }]
}
