import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { runAxeOnPage } from 'gates/a11y'
import { gotoStable, waitForReady } from './_helpers'

/**
 * What the Play specs share (ADR-051, docs/architecture/play.md): opening a
 * Play screen, the three viewports every state is held to, the layout law
 * (the page never scrolls) and an axe scan of the page as it stands.
 *
 * Play's state lives on the server — the seat's mount, the Game's Downtime —
 * so a spec puts the screen in a state through Play's own controls and checks
 * the screen it is looking at, rather than opening a URL per state.
 */

/**
 * The viewports a Play screen must fit without the page scrolling: the
 * canvas at its design size, which is also its floor (`playCanvas.model.ts`:
 * its smallest text is 11px, so it never scales down, ADR-045 decision 1), a
 * mid-size window just under it, and a phone. The last two get the phone
 * form (play.md §11).
 */
const PLAY_VIEWPORTS = [
  { name: 'canvas', form: 'canvas', width: 1280, height: 800 },
  { name: 'mid-size window', form: 'phone', width: 1024, height: 700 },
  { name: 'phone', form: 'phone', width: 390, height: 844 },
] as const

/** The design size: the canvas at scale 1, where a measured px is a drawn px. */
export const CANVAS = PLAY_VIEWPORTS[0]
/** A mid-size window, under the design size: the canvas would draw at 0.8, so the phone form is up. */
export const MID = PLAY_VIEWPORTS[1]
/** The phone. */
export const PHONE = PLAY_VIEWPORTS[2]

/** Every `Math.random()` draw is 13/20, so every d20 Randsum rolls is 14: a Success. */
function seedDice(): void {
  Math.random = () => 13 / 20
}

/**
 * Open a Play screen and wait for its bar. With `dice`, every d20 after the
 * load is 14.
 *
 * The seed goes in once the Convex client has opened its socket: the client
 * draws its session id from `Math.random()` when it connects, and the server
 * replays a mutation it has already seen from a session id, so a seed in
 * place before then gives every run one id, and the server answers a later
 * run's writes with the first run's.
 */
export async function openPlay(page: Page, path: string, { dice = false } = {}): Promise<void> {
  const socket = page.waitForEvent('websocket', {
    predicate: (ws) => ws.url().endsWith('/sync'),
    timeout: 60_000,
  })
  await gotoStable(page, path)
  await waitForReady(page)
  await socket
  await expect(page.locator('.su-play-root header h1')).toBeVisible({ timeout: 30_000 })
  if (dice) await page.evaluate(seedDice)
}

/**
 * The path of a door on the Play landing (`/play/`): "Play Bonesaw in <Game>",
 * "Play Mira Voss solo" or "Mediate <Game>" (`PlayLanding`). Read off the
 * landing, so the specs reach Play the way a player does.
 */
export async function playDoor(page: Page, name: string | RegExp): Promise<string> {
  await gotoStable(page, '/play/')
  await waitForReady(page)
  const door = page.getByRole('link', { name }).first()
  await expect(door, `the Play landing offers "${name}"`).toBeVisible({ timeout: 30_000 })
  const href = await door.getAttribute('href')
  if (!href) throw new Error(`"${name}" on the Play landing has no href`)
  // Root-relative under the app's base: the route without it.
  return new URL(href, page.url()).pathname.replace(/^\/build/, '')
}

/**
 * A pilot's Play screen, `/play/<id>`, read off its Training Bay Compact's sheet link.
 * For a pilot in a Game its player also mediates: that Game's Compact on the Play
 * hub has one door, Mediate (ADR-052 §4), so there is no "Play <pilot>" to
 * follow.
 */
export async function pilotPlayPath(page: Page, name: string): Promise<string> {
  await gotoStable(page, '/')
  await waitForReady(page)
  const row = page.getByRole('region', { name: 'Pilots' }).getByRole('link', { name, exact: true })
  await expect(row, `the Training Bay lists ${name}`).toBeVisible({ timeout: 30_000 })
  const href = await row.first().getAttribute('href')
  const id = href?.match(/\/sheet\/pilot\/([^/?#]+)/)?.[1]
  if (!id) throw new Error(`${name}'s Training Bay Compact has no sheet link: ${href}`)
  return `/play/${id}`
}

/** The Situation switch in the bar (canvas) or under the pinned vitals (phone). */
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
  const claim = page.getByRole('alertdialog').getByRole('button', { name: /^Claim and board/ })
  if (await claim.isVisible({ timeout: 2_000 }).catch(() => false)) await claim.click()
  await expect(
    situation(page).getByRole('button', { name: new RegExp(`^Boarded( · ${mech})?`) })
  ).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 })
}

/** Which form the screen drew: the 1280 × 800 canvas, or the phone's tabs. */
async function formOf(page: Page): Promise<'canvas' | 'phone'> {
  return (await page.locator('.su-play-root--phone').count()) > 0 ? 'phone' : 'canvas'
}

/**
 * The page neither scrolls nor overflows, at every Play viewport, and each
 * viewport draws the form it should: the canvas at its design size, the phone
 * form below it. Leaves the viewport at the design size.
 */
export async function expectNoPageScroll(page: Page, state: string): Promise<void> {
  const failures: string[] = []
  for (const viewport of PLAY_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    // The canvas measures its host on resize; let it settle a frame or two.
    await expect.poll(() => formOf(page), { timeout: 10_000 }).toBe(viewport.form)
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    )
    const over = await page.evaluate(() => {
      const root = document.scrollingElement ?? document.documentElement
      return {
        down: root.scrollHeight - window.innerHeight,
        across: root.scrollWidth - window.innerWidth,
      }
    })
    if (over.down > 0 || over.across > 0) {
      failures.push(
        `${state} at ${viewport.name} (${viewport.width}×${viewport.height}): ` +
          `the page scrolls ${over.down}px down, ${over.across}px across`
      )
    }
  }
  await page.setViewportSize({ width: CANVAS.width, height: CANVAS.height })
  await expect.poll(() => formOf(page), { timeout: 10_000 }).toBe('canvas')
  expect(failures, 'Play scrolls the page').toEqual([])
}

/**
 * axe over the page as it stands, at the design size and as a phone, through
 * `gates/a11y`'s `runAxeOnPage` (the tags its scans run). A Play state is the
 * server's, not a URL's, so the scan reads the live page rather than opening a
 * fresh one. Returns one line per violation; the spec asserts none.
 */
export async function axeViolations(page: Page, state: string): Promise<string[]> {
  const found: string[] = []
  for (const viewport of [CANVAS, PHONE]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expect.poll(() => formOf(page), { timeout: 10_000 }).toBe(viewport.form)
    // The form change re-lays its heads (a strip drops under a name), and a
    // control's colour eases to its new ground (`--dur-fast`): axe reads the
    // page at rest, not mid-transition.
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))
    )
    const ids = await runAxeOnPage(page)
    for (const id of ids) found.push(`${state} (${viewport.name}): ${id}`)
  }
  await page.setViewportSize({ width: CANVAS.width, height: CANVAS.height })
  return found
}
