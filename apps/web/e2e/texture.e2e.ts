import type { Page } from '@playwright/test'
import { expectWithinBaseline, seedDesignAccount, walkDesignRoutes } from './_designRoutes'
import type { DesignDebt, DesignFamily } from './_designTable'
import { DESIGN_FAMILIES, designRoutes } from './_designTable'
import { expect, test } from './fixtures'

/**
 * Hard rule R10, "A surface sets its texture once" (ruleset §1.3, §3.5.1; EDL
 * E13), on the rendered page over every context (R0's `designRoutes`): the
 * speckle is universal on brand-colour grounds, the Cockpit and the Peek
 * included, and never on paper, cream, the page ground (Play's included), the
 * ink-deep, a button or a field.
 *
 * - `speckled`: every entity band (a Compact's, a TitledBox's or a unit box's
 *   head, a card's band) on a Play canvas or phone form (`.su-play-root`:
 *   the player's, solo and the Mediator's), or on an overlay it lays over
 *   itself (a Peek, a menu, a dialog: the Mediator's Reference), that is a
 *   brand-colour ground carries its `[data-grain]`, as on the sheet.
 * - `clean`: no `[data-grain]` there sits on paper, cream, the page ground or
 *   ink-deep, or on or inside a button or a field.
 * - `band`: Manage (the Training Bay, the Play hub, a Game's page, the invite
 *   screen) is paper under its area's band, and the band keeps its speckle
 *   (`ChapterBand`'s `.su-grain-layer`).
 *
 * The overlays are opened on the canvas only (`page` width): a phone opens a
 * Peek by a long press, and its tabs are the walk's.
 */

/** The Cockpit, canvas or phone form. */
const COCKPIT = '.su-play-root'

/** What the Cockpit lays over itself, portalled out of it. */
const OVERLAY = '[data-peek-popup], [role="dialog"], [role="alertdialog"], [role="menu"]'

/** An entity band: a Compact's or TitledBox's head, a card's band. */
const BAND = '.su-entity-compact__head, .su-ec-band'

/**
 * The texture faults in the Cockpit and the overlays over it, one line each:
 * a brand-colour band with no speckle (`speckled`), and speckle on a ground
 * that never wears it (`clean`).
 */
async function grainFaults(page: Page): Promise<{ rule: string; line: string }[]> {
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
      const out: { rule: string; line: string }[] = []
      for (const el of document.querySelectorAll(band)) {
        if (!inScope(el)) continue
        const bg = getComputedStyle(el).backgroundColor
        if (transparent(bg) || clean.has(bg)) continue
        if (!el.hasAttribute('data-grain'))
          out.push({ rule: 'speckled', line: `${name(el)}: a ${bg} band with no speckle` })
      }
      for (const el of document.querySelectorAll('[data-grain]')) {
        if (!inScope(el)) continue
        const bg = getComputedStyle(el).backgroundColor
        if (clean.has(bg))
          out.push({ rule: 'clean', line: `${name(el)}: speckle on a ${bg} ground` })
        if (
          el.closest('button, input, textarea, select') ||
          el.querySelector('input, textarea, select')
        )
          out.push({ rule: 'clean', line: `${name(el)}: speckle on a button or a field` })
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
 * Open each overlay the Cockpit has and read it: a Peek from the canvas's
 * first trigger, and the Mediator's More menu and its Reference. Each is
 * closed again, so the walk goes on from the screen it found.
 */
async function overlays(
  page: Page
): Promise<{ what: string; faults: { rule: string; line: string }[] }[]> {
  const read: { what: string; faults: { rule: string; line: string }[] }[] = []
  const trigger = page.locator(`${COCKPIT} [data-peek]`).first()
  if (await trigger.isVisible().catch(() => false)) {
    const address = await trigger.getAttribute('data-peek')
    await trigger.hover()
    const popup = page.locator('[data-peek-popup]')
    await expect(popup.locator('.su-entity-compact__head, .su-roll').first()).toBeVisible()
    read.push({ what: `the ${address} Peek`, faults: await grainFaults(page) })
    await page.mouse.move(0, 0)
    await page.keyboard.press('Escape')
    await expect(popup).toHaveCount(0)
  }
  const more = page.locator(`${COCKPIT} button[aria-label="More"]:not([disabled])`).first()
  if (await more.isVisible().catch(() => false)) {
    await more.click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    read.push({ what: 'the More menu', faults: await grainFaults(page) })
    const reference = menu.getByRole('menuitem', { name: 'Reference' })
    if (await reference.isVisible().catch(() => false)) {
      await reference.click()
      const dialog = page.getByRole('dialog', { name: 'Reference' })
      await expect(dialog).toBeVisible()
      await dialog.getByRole('combobox', { name: 'Search the Reference' }).fill('drill')
      await rest(page)
      read.push({ what: "the Reference's results", faults: await grainFaults(page) })
      const result = dialog.getByRole('option').first()
      if (await result.isVisible().catch(() => false)) {
        await result.click()
        await rest(page)
        read.push({ what: "the Reference's entity", faults: await grainFaults(page) })
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

test('every context: brand-colour grounds wear the speckle, the Cockpit and the Peek too', async ({
  page,
}) => {
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
        for (const f of await grainFaults(page))
          found.push({ rule: f.rule, line: `${where}: ${f.line}` })
        if (width === 'page' && !where.includes(' tab')) {
          for (const { what, faults } of await overlays(page)) {
            read.push(`${where}: ${what}`)
            for (const f of faults) {
              found.push({ rule: f.rule, line: `${where}, ${what}: ${f.line}` })
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
