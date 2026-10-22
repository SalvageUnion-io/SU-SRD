/**
 * The one seeded account: what the layout gates' walk (`apps/web/e2e/_designRoutes.ts`),
 * the signed-in a11y scan, the screenshot gallery (`tools/gallery.ts --signed-in`)
 * and `bun run dev:backend` (and so `bun run shot --signed-in`) all sign in to.
 *
 * `seedAccount` takes a page already signed in (`signInThroughSeam`,
 * `testSignIn.ts`) and gives the account one of everything a screen draws:
 * Bonesaw, Driftwood, the Mazona and Tenacity copied from the Starter Set to
 * the Training Bay, each carrying something the reference does not hold; a
 * Game with the Organizer appointed Mediator, an invite link, and Bonesaw
 * moved in; an NPC from the Veteran. It resolves to every page it made, by the
 * `:key` a route or a gallery page names it with (`SEED_KEYS`).
 *
 * It needs no Playwright test runner (no `expect`), so the tools run it too.
 * Every path is a browser path, the app's base included; `base` is the
 * origin, empty where the page has a `baseURL` (the e2e specs).
 */
import type { Page } from '@playwright/test'
import { APP_BASE } from '../../../apps/web/src/lib/appBase'
import { copyStarter, editSheet, openApp, sheetLink, waitForReady } from './appPage'

/** The pages the seed makes, as a route or a gallery page names them: `:pilot`, … */
export const SEED_KEYS = [
  'pilot',
  'mech',
  'crawler',
  'npc',
  'game',
  'invite',
  'playPlayer',
  'playSolo',
  'playMediator',
] as const

export type SeedKey = (typeof SEED_KEYS)[number]

/** Every path the seed made, by key. Browser paths, base included. */
export type Seed = Record<SeedKey, string>

/**
 * The seeded Game's name, made long: its Training Bay chip is wider than a
 * Compact's room beside the name at a page's three columns (R3), so the
 * chip-strip gate holds it inside the Compact.
 */
const SEED_GAME = 'The Long Haul Across the Glass Wastes'

/** The player in the Game (moved in from the Training Bay) and the one left on the shelf to play solo. */
const SEED_IN_GAME = 'Bonesaw'
const SEED_SOLO = 'Driftwood'

/** A path a route or gallery page names: its own, or the seed's for a `:key` (undefined if the seed made none). */
export function resolveSeedPath(path: string, seed: Partial<Seed>): string | undefined {
  if (!path.startsWith(':')) return path
  return seed[path.slice(1) as SeedKey]
}

const LONG = { timeout: 20_000 }

/** A Training Bay item's sheet, by kind and (when the shelf holds several) name. */
async function sheetPath(page: Page, kind: string, name?: string): Promise<string> {
  const link = name
    ? sheetLink(page, name, kind)
    : page.locator(`a[href*="/sheet/${kind}/"]`).first()
  await link.waitFor(LONG)
  const href = await link.getAttribute('href')
  if (!href) throw new Error(`the Training Bay's ${kind}${name ? ` ${name}` : ''} has no href`)
  return new URL(href, page.url()).pathname
}

/**
 * The carried things the reference does not hold, so a sheet's lists show
 * them (hard rule R35: a sheet list's item is a Mini or Compact): a generic
 * entry in Bonesaw's inventory, a lot in the Mazona's hold and one in
 * Tenacity's Storage Bay, each through its sheet's own intake in Edit.
 */
async function seedCarried(
  page: Page,
  base: string,
  sheets: { pilot: string; mech: string; crawler: string }
): Promise<void> {
  const carried = (name: string) =>
    page.locator('.su-sheet-live-body .su-entity-mini__name').filter({ hasText: name }).first()
  await page.goto(`${base}${sheets.pilot}`, { waitUntil: 'networkidle' })
  await waitForReady(page)
  await editSheet(page)
  await page.getByRole('button', { name: 'Add Scrap (3 slots)' }).click()
  await carried('Scrap').waitFor(LONG)
  for (const [path, into, lot] of [
    [sheets.mech, 'Load cargo into the mech hold', 'Salvaged Plating'],
    [sheets.crawler, 'Stow cargo into the Storage Bay', 'Sealed Crate'],
  ] as const) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
    await waitForReady(page)
    await editSheet(page)
    const adder = page.getByRole('button', { name: into })
    await adder.scrollIntoViewIfNeeded()
    await adder
      .locator('xpath=ancestor::*[.//input[@aria-label="New cargo name"]][1]')
      .getByLabel('New cargo name')
      .fill(lot)
    await adder.click()
    await carried(lot).waitFor(LONG)
  }
}

/** "+ New Game" from the Play hub, named; resolves to the new Game's id, its page open. */
export async function createGame(page: Page, name: string, base = ''): Promise<string> {
  await openApp(page, '/play/', base)
  await page.getByRole('button', { name: '+ New Game' }).click()
  await page.getByLabel('New Game name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForURL(/\/play\/games\/[^/]+$/, LONG)
  const id = new URL(page.url()).pathname.split('/').pop()
  if (!id) throw new Error(`No Game id in ${page.url()}`)
  // The Game's own page is up: its band names it, as the page's h1.
  await page.getByRole('heading', { level: 1, name }).waitFor(LONG)
  return id
}

/**
 * Copy the open Game's invite link from its page ("Copy invite link", the
 * Organiser's) and read its token off the clipboard.
 */
export async function makeInviteLink(page: Page): Promise<string> {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copy invite link' }).click()
  // The copy control's own swap and its polite status (chrome.md K5), never a toast.
  await page
    .getByRole('status')
    .filter({ hasText: /^Copied$/ })
    .waitFor({ state: 'attached', timeout: 15_000 })
  const url = String(await page.evaluate('navigator.clipboard.readText()')).trim()
  const token = /\/invite\/([^/\s]+)$/.exec(url)?.[1]
  if (!token) throw new Error(`No invite token in "${url}"`)
  return token
}

/** A Play hub door's path (`Play Driftwood solo`, `Mediate <Game>`), read off its link. */
async function playDoor(page: Page, base: string, name: string): Promise<string> {
  await openApp(page, '/play/', base)
  const door = page.getByRole('link', { name }).first()
  await door.waitFor({ timeout: 30_000 })
  const href = await door.getAttribute('href')
  if (!href) throw new Error(`"${name}" on the Play hub has no href`)
  return new URL(href, page.url()).pathname
}

/**
 * Seed the signed-in account on the open `page` (see the header). `base` is
 * the site's origin, or empty where the page resolves paths against its
 * `baseURL`.
 */
export async function seedAccount(page: Page, base = ''): Promise<Seed> {
  await copyStarter(page, 'pilot/starter-pilot-bonesaw', SEED_IN_GAME, base)
  await copyStarter(page, 'pilot/starter-pilot-driftwood', SEED_SOLO, base)
  await copyStarter(page, 'mech/starter-mech-mazona', 'Mazona', base)
  await copyStarter(page, 'crawler/starter-crawler-tenacity', 'Tenacity', base)

  await openApp(page, '/', base)
  const pilot = await sheetPath(page, 'pilot', SEED_IN_GAME)
  const mech = await sheetPath(page, 'mech')
  const crawler = await sheetPath(page, 'crawler')
  await seedCarried(page, base, { pilot, mech, crawler })

  // The Game, its Mediator (the Organizer) and its invite link.
  await createGame(page, SEED_GAME, base)
  const game = new URL(page.url()).pathname
  await page.getByRole('button', { name: 'Appoint' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Appoint' }).click()
  await page.getByText('You mediate').waitFor(LONG)
  const token = await makeInviteLink(page)

  // Bonesaw moves in from the Training Bay's ⋯ menu.
  await openApp(page, '/', base)
  await page.getByRole('button', { name: `More for ${SEED_IN_GAME}` }).click()
  await page.getByRole('menuitem', { name: 'Move to a Game…' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: SEED_GAME }).click()
  const confirm = page.getByRole('dialog').getByRole('button', { name: /^Move/ })
  if (await confirm.count()) await confirm.first().click()
  await page.getByText(`Moved ${SEED_IN_GAME} to ${SEED_GAME}.`).first().waitFor(LONG)

  // An NPC, from the Veteran.
  await openApp(page, '/npcs/new', base)
  await page.getByRole('radio', { name: 'Start from Veteran' }).click()
  await page.getByRole('button', { name: 'Next: Stats' }).click()
  await page.getByRole('button', { name: 'Next: Actions & traits' }).click()
  await page.getByRole('button', { name: 'Next: Identity' }).click()
  await page.getByLabel(/^Name/).fill('Sergeant Kessler')
  await page.getByRole('button', { name: 'Next: Review' }).click()
  await page.getByRole('button', { name: 'Save NPC' }).click()
  await page.waitForURL(/\/sheet\/npc\//, LONG)
  const npc = new URL(page.url()).pathname

  // Play's screens. The Organizer mediates the Game, so its Compact's one door
  // is Mediate (ADR-052 §4): the player's screen is the pilot's own, `/play/<id>`.
  const pilotId = pilot.match(/\/sheet\/pilot\/([^/?#]+)/)?.[1]
  if (!pilotId) throw new Error(`no pilot id in ${pilot}`)
  const playSolo = await playDoor(page, base, `Play ${SEED_SOLO} solo`)
  const playMediator = await playDoor(page, base, `Mediate ${SEED_GAME}`)

  return {
    pilot,
    mech,
    crawler,
    npc,
    game,
    invite: `${APP_BASE}/invite/${token}`,
    playPlayer: `${APP_BASE}/play/${pilotId}`,
    playSolo,
    playMediator,
  }
}
