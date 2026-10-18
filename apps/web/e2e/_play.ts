import { createRequire } from 'node:module'
import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
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
 * The viewports a Play screen must fit without the page scrolling:
 * the canvas at its design size, the canvas at its scale floor (0.62 of
 * 1280 × 800, `playCanvas.model.ts`, just above where the phone form takes
 * over), and a phone, which gets the phone form (play.md §11).
 */
export const PLAY_VIEWPORTS = [
  { name: 'canvas', form: 'canvas', width: 1280, height: 800 },
  { name: 'scale floor', form: 'canvas', width: 794, height: 497 },
  { name: 'phone', form: 'phone', width: 390, height: 844 },
] as const

export type PlayViewport = (typeof PLAY_VIEWPORTS)[number]

/** The design size: the canvas at scale 1, where a measured px is a drawn px. */
export const CANVAS = PLAY_VIEWPORTS[0]
/** The phone. */
export const PHONE = PLAY_VIEWPORTS[2]

/** Every `Math.random()` draw is 13/20, so every d20 Randsum rolls is 14: a Success. */
export function seedDice(): void {
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
  await expect(page.locator('.su-dash-root header h1')).toBeVisible({ timeout: 30_000 })
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
  // Root-relative under the Cantina's base: the route without it.
  return new URL(href, page.url()).pathname.replace(/^\/build/, '')
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
  return (await page.locator('.su-dash-phone').count()) > 0 ? 'phone' : 'canvas'
}

/**
 * The page neither scrolls nor overflows, at every Play viewport, and each
 * viewport draws the form it should: the canvas down to its floor, the phone
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

/** axe-core from the local install, as `gates/a11y` loads it. */
const AXE_PATH = createRequire(import.meta.url).resolve('axe-core/axe.min.js')

/** The rule tags `gates/a11y` runs: WCAG 2.2 AA and best practice. */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

/**
 * axe over the page as it stands, at the design size and as a phone, with the
 * tags `gates/a11y`'s scans run (`a11y-signed-in.e2e.ts`). A Play state is the
 * server's, not a URL's, so the scan reads the live page rather than opening a
 * fresh one. Returns one line per violation; the spec asserts none.
 */
export async function axeViolations(page: Page, state: string): Promise<string[]> {
  const found: string[] = []
  for (const viewport of [CANVAS, PHONE]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expect.poll(() => formOf(page), { timeout: 10_000 }).toBe(viewport.form)
    if ((await page.evaluate(() => 'axe' in window)) === false) {
      await page.addScriptTag({ path: AXE_PATH })
    }
    const ids = await page.evaluate(async (tags) => {
      type Axe = {
        run: (
          context: Document,
          options: { runOnly: string[] }
        ) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }>
      }
      const axe = (window as unknown as { axe: Axe }).axe
      const result = await axe.run(document, { runOnly: tags })
      return result.violations.map(
        (v) => `${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`
      )
    }, AXE_TAGS)
    for (const id of ids) found.push(`${state} (${viewport.name}): ${id}`)
  }
  await page.setViewportSize({ width: CANVAS.width, height: CANVAS.height })
  return found
}
