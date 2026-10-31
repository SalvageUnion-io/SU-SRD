import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { cockpitPath } from 'game-domain/entityKinds'
import { runAxeOnPage } from 'gates/a11y'
import { playDoor as openDoor } from 'gates/lib/appPage'
import { routeInApp } from '../src/lib/appBase'
import { ROOMS_PATH } from '../src/rooms/routes'
import { openApp, pageOverflow, seedDice } from './_helpers'

/**
 * What the Play specs share (ADR-051, docs/architecture/play.md): opening a
 * Play screen, the three widths every state is held to, the layout law
 * (the page never scrolls) and an axe scan of the page as it stands.
 *
 * Play's state lives on the server — the seat's mount, the Game's Downtime —
 * so a spec puts the screen in a state through Play's own controls and checks
 * the screen it is looking at, rather than opening a URL per state.
 */

/**
 * The viewports a Play screen must fit without the page scrolling, one
 * layout at each (`PlayFrame`, play.md §2, ADR-063): a desktop window and a
 * mid-size one at the `lg` rung draw the three columns, a phone the tabs.
 */
const PLAY_VIEWPORTS = [
  { name: 'wide', layout: 'columns', width: 1440, height: 900 },
  { name: 'mid-size window', layout: 'columns', width: 1024, height: 700 },
  { name: 'phone', layout: 'tabs', width: 390, height: 844 },
] as const

/** A desktop window: the three columns with room. */
export const WIDE = PLAY_VIEWPORTS[0]
/** A mid-size window, on the `lg` rung: the three columns at their narrowest. */
export const MID = PLAY_VIEWPORTS[1]
/** The phone: the tabs. */
export const PHONE = PLAY_VIEWPORTS[2]

/**
 * Open a Play screen and wait for its bar. With `dice`, every d20 after the
 * load is 14 (`seedDice`): a Success.
 *
 * The seed goes in once a room's socket has opened (`ROOMS_PATH`), so the
 * screen is live before any roll is made.
 */
export async function openPlay(page: Page, path: string, { dice = false } = {}): Promise<void> {
  const socket = page.waitForEvent('websocket', {
    predicate: (ws) => new URL(ws.url()).pathname.startsWith(`${ROOMS_PATH}/`),
    timeout: 60_000,
  })
  await openApp(page, path)
  await socket
  await expect(page.locator('.su-play-root header h1')).toBeVisible({ timeout: 30_000 })
  if (dice) await seedDice(page)
}

/** A Play hub door's path (`playDoor`, `gates/lib/appPage.ts`), as a route in the app. */
export async function playDoor(page: Page, name: string | RegExp): Promise<string> {
  const path = await openDoor(page, name)
  return routeInApp(path) ?? path
}

/**
 * A pilot's Play screen, `/play/pilots/<id>`, read off its Training Bay Compact's sheet link,
 * so a spec reaches it without first waiting on the Play hub's Games.
 */
export async function pilotPlayPath(page: Page, name: string): Promise<string> {
  await openApp(page, '/')
  const row = page.getByRole('region', { name: 'Pilots' }).getByRole('link', { name, exact: true })
  await expect(row, `the Training Bay lists ${name}`).toBeVisible({ timeout: 30_000 })
  const href = await row.first().getAttribute('href')
  const id = href?.match(/\/pilots\/([^/?#]+)/)?.[1]
  if (!id) throw new Error(`${name}'s Training Bay Compact has no sheet link: ${href}`)
  return cockpitPath(id)
}

/** The Situation switch in the bar (from `lg`) or under the pinned vitals (a phone). */
export function situation(page: Page): Locator {
  return page.getByRole('group', { name: 'Situation' })
}

/** The Mediator's Scene / Downtime switch. */
export function gameState(page: Page): Locator {
  return page.getByRole('group', { name: 'Game state' })
}

/**
 * Board `mech` from the Situation switch: its one Board option ("Board ·
 * Scrapper"), or, with several mechs, its menu ("Board, choose a Mech").
 * A spare is claimed first, behind its confirm.
 */
export async function board(page: Page, mech: string): Promise<void> {
  const only = situation(page).getByRole('button', { name: new RegExp(`^Board · ${mech}`) })
  if (await only.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await only.click()
  } else {
    await situation(page)
      .getByRole('button', { name: /choose a Mech$/ })
      .click()
    await page.getByRole('menuitem', { name: new RegExp(mech) }).click()
  }
  const assign = page.getByRole('alertdialog').getByRole('button', { name: /^Assign and board/ })
  if (await assign.isVisible({ timeout: 2_000 }).catch(() => false)) await assign.click()
  await expect(
    situation(page).getByRole('button', { name: new RegExp(`^Boarded( · ${mech})?`) })
  ).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 })
}

/** Which arrangement the screen drew: the three columns, or the tabs. */
async function layoutOf(page: Page): Promise<'columns' | 'tabs'> {
  const tabs = page.locator('.su-play-root').getByRole('tablist', { name: 'Play' })
  return (await tabs.count()) > 0 ? 'tabs' : 'columns'
}

/**
 * The page neither scrolls nor overflows, at every Play viewport, and each
 * viewport draws the layout it should: the columns from `lg`, the tabs below
 * it. Leaves the viewport wide.
 */
export async function expectNoPageScroll(page: Page, state: string): Promise<void> {
  const failures: string[] = []
  for (const viewport of PLAY_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    // The frame measures its host on resize; let it settle a frame or two.
    await expect.poll(() => layoutOf(page), { timeout: 10_000 }).toBe(viewport.layout)
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    )
    const over = await pageOverflow(page)
    if (over.down > 0 || over.across > 0) {
      failures.push(
        `${state} at ${viewport.name} (${viewport.width}×${viewport.height}): ` +
          `the page scrolls ${over.down}px down, ${over.across}px across`
      )
    }
  }
  await page.setViewportSize({ width: WIDE.width, height: WIDE.height })
  await expect.poll(() => layoutOf(page), { timeout: 10_000 }).toBe('columns')
  expect(failures, 'Play scrolls the page').toEqual([])
}

/**
 * axe over the page as it stands, at every Play viewport, through
 * `gates/a11y`'s `runAxeOnPage` (the tags its scans run). A Play state is the
 * server's, not a URL's, so the scan reads the live page rather than opening a
 * fresh one. Returns one line per violation; the spec asserts none.
 */
export async function axeViolations(page: Page, state: string): Promise<string[]> {
  const found: string[] = []
  for (const viewport of PLAY_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expect.poll(() => layoutOf(page), { timeout: 10_000 }).toBe(viewport.layout)
    // The layout change re-lays its heads (a strip drops under a name), and a
    // control's colour eases to its new ground (`--dur-fast`): axe reads the
    // page at rest, not mid-transition.
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))
    )
    const ids = await runAxeOnPage(page)
    for (const id of ids) found.push(`${state} (${viewport.name}): ${id}`)
  }
  await page.setViewportSize({ width: WIDE.width, height: WIDE.height })
  return found
}
