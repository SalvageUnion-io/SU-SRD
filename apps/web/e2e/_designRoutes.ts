import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { at, BASE } from './_base'
import type {
  DesignDebt,
  DesignFamily,
  DesignFinding,
  DesignRoute,
  DesignSeedKey,
  DesignWidth,
} from './_designTable'
import {
  againstBaseline,
  DESIGN_FAMILIES,
  DESIGN_VIEWPORTS,
  designRoutes,
  gamePageRoute,
} from './_designTable'
import { gotoStable, waitForReady } from './_helpers'
import { holdPending } from './_pendingRules'
import { CANVAS, MID, PHONE, pilotPlayPath, playDoor } from './_play'
import { createGame, makeInviteLink } from './_table'

/**
 * Walking `designRoutes` (`_designTable.ts`, hard rule R0) for a layout gate: seed
 * an account, open every route at each of its widths, put it in the state it
 * names (Edit, a Peek open, each of Play's phone tabs) and hand each view to
 * the gate's scan. The gate's findings are then held against its baseline
 * (`againstBaseline`, `_designTable.ts`), the debt it has recorded, by route
 * family and rule.
 */

/** Every path the seed made, by the `:key` a route names it with. Browser paths, base included. */
export type DesignSeed = Record<DesignSeedKey, string>

/**
 * The Game the seed makes, `tools/gallery.ts`'s name made long: its Training Bay
 * chip is wider than a Compact's room beside the name at a page's three columns
 * (R3), so the chip-strip gate holds it inside the Compact.
 */
const GAME = 'The Long Haul Across the Glass Wastes'

/** The player in the Game (moved in from the Training Bay) and the one left on the shelf to play solo. */
const IN_GAME = 'Bonesaw'
const SOLO = 'Driftwood'

/** Copy a Starter Set build to the Training Bay from its sheet's "Make a copy". */
async function copyStarter(page: Page, sheet: string, name: string): Promise<void> {
  await gotoStable(page, `/starter/${sheet}`)
  await waitForReady(page)
  await page.getByRole('button', { name: 'Make a copy', exact: true }).first().click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Make a copy' }).click()
  // A crawler's name is its number and name ("Crawler #430 'Tenacity'").
  await expect(
    page.getByText(new RegExp(`^Copied .*${name}.* to your Training Bay`)).first()
  ).toBeVisible({ timeout: 20_000 })
}

/** A Training Bay item's sheet, by kind and (when the shelf holds several) name. */
async function sheetPath(page: Page, kind: string, name?: string): Promise<string> {
  const all = page.locator(`a[href*="/sheet/${kind}/"]`)
  const link = name
    ? page
        .locator(`a[href*="/sheet/${kind}/"][aria-label="${name}"]`)
        .or(all.filter({ hasText: name }))
        .first()
    : all.first()
  await expect(link, `the Training Bay lists a ${kind}${name ? ` named ${name}` : ''}`).toBeVisible(
    {
      timeout: 20_000,
    }
  )
  const href = await link.getAttribute('href')
  if (!href) throw new Error(`the Training Bay's ${kind} has no href`)
  return new URL(href, page.url()).pathname
}

/**
 * Seed the signed-in account as `tools/gallery.ts --signed-in` does: Bonesaw,
 * the Mazona and Tenacity copied from the Starter Set to the Training Bay, a Game
 * started and Bonesaw moved in. Then what the other contexts need: carried
 * things the reference does not hold (`seedCarried`), Driftwood
 * on the shelf to play solo, the Organizer appointed Mediator, an invite link,
 * and an NPC from the Veteran. Resolves to every path a route names by `:key`.
 */
export async function seedDesignAccount(page: Page): Promise<DesignSeed> {
  await copyStarter(page, 'pilot/starter-pilot-bonesaw', IN_GAME)
  await copyStarter(page, 'pilot/starter-pilot-driftwood', SOLO)
  await copyStarter(page, 'mech/starter-mech-mazona', 'Mazona')
  await copyStarter(page, 'crawler/starter-crawler-tenacity', 'Tenacity')

  await gotoStable(page, '/')
  await waitForReady(page)
  const pilot = await sheetPath(page, 'pilot', IN_GAME)
  const mech = await sheetPath(page, 'mech')
  const crawler = await sheetPath(page, 'crawler')
  await seedCarried(page, { pilot, mech, crawler })

  // The Game, its Mediator (the Organizer) and its invite link.
  const gameId = await createGame(page, GAME)
  await page.getByRole('button', { name: 'Appoint' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Appoint' }).click()
  await expect(page.getByText('You mediate')).toBeVisible({ timeout: 20_000 })
  const token = await makeInviteLink(page)

  // Bonesaw moves in from the Training Bay's ⋯ menu.
  await gotoStable(page, '/')
  await waitForReady(page)
  await page.getByRole('button', { name: `More for ${IN_GAME}` }).click()
  await page.getByRole('menuitem', { name: 'Move to a Game…' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: GAME }).click()
  const confirm = page.getByRole('dialog').getByRole('button', { name: /^Move/ })
  if (await confirm.count()) await confirm.first().click()
  await expect(page.getByText(`Moved ${IN_GAME} to ${GAME}.`).first()).toBeVisible({
    timeout: 20_000,
  })

  // An NPC, from the Veteran (`npc-crew.e2e.ts`).
  await gotoStable(page, '/npcs/new')
  await waitForReady(page)
  await page.getByRole('radio', { name: 'Start from Veteran' }).click()
  await page.getByRole('button', { name: 'Next: Stats' }).click()
  await page.getByRole('button', { name: 'Next: Actions & traits' }).click()
  await page.getByRole('button', { name: 'Next: Identity' }).click()
  await page.getByLabel(/^Name/).fill('Sergeant Kessler')
  await page.getByRole('button', { name: 'Next: Review' }).click()
  await page.getByRole('button', { name: 'Save NPC' }).click()
  await page.waitForURL(/\/sheet\/npc\//, { timeout: 20_000 })
  const npc = new URL(page.url()).pathname

  // Play's doors, read off the Play hub as a player reaches them.
  // The Organizer mediates the Game, so its Compact's one door is Mediate: the
  // player's screen is the pilot's own, from its Training Bay Compact.
  const playPlayer = at(await pilotPlayPath(page, IN_GAME))
  const playSolo = at(await playDoor(page, `Play ${SOLO} solo`))
  const playMediator = at(await playDoor(page, `Mediate ${GAME}`))

  return {
    pilot,
    mech,
    crawler,
    npc,
    game: at(gamePageRoute(gameId)),
    invite: at(`/invite/${token}`),
    playPlayer,
    playSolo,
    playMediator,
  }
}

/**
 * The carried things the reference does not hold, so a sheet's lists show
 * them (hard rule R35: a sheet list's item is a Mini or Compact): a generic entry
 * in Bonesaw's inventory, a lot in the Mazona's hold and one in Tenacity's
 * Storage Bay, each through its sheet's own intake in Edit.
 */
async function seedCarried(
  page: Page,
  sheets: { pilot: string; mech: string; crawler: string }
): Promise<void> {
  const carried = (name: string) =>
    page.locator('.su-sheet-live-body .su-entity-mini__name').filter({ hasText: name }).first()
  await page.goto(sheets.pilot, { waitUntil: 'networkidle' })
  await waitForReady(page)
  await edit(page)
  await page.getByRole('button', { name: 'Add Scrap (3 slots)' }).click()
  await expect(carried('Scrap'), 'the generic entry is a Mini').toBeVisible({ timeout: 20_000 })
  for (const [path, into, lot] of [
    [sheets.mech, 'Load cargo into the mech hold', 'Salvaged Plating'],
    [sheets.crawler, 'Stow cargo into the Storage Bay', 'Sealed Crate'],
  ] as const) {
    await page.goto(path, { waitUntil: 'networkidle' })
    await waitForReady(page)
    await edit(page)
    const adder = page.getByRole('button', { name: into })
    await adder.scrollIntoViewIfNeeded()
    await adder
      .locator('xpath=ancestor::*[.//input[@aria-label="New cargo name"]][1]')
      .getByLabel('New cargo name')
      .fill(lot)
    await adder.click()
    await expect(carried(lot), `${lot} is a Mini in its hold`).toBeVisible({ timeout: 20_000 })
  }
}

/** A route's path in the browser: its own, or the seed's for a `:key`. */
export function resolveDesignPath(path: string, seed: DesignSeed): string {
  if (!path.startsWith(':')) return path
  const resolved = seed[path.slice(1) as DesignSeedKey]
  if (!resolved) throw new Error(`the seed made no ${path}`)
  return resolved
}

/**
 * A width a walk holds a route at: one of its own (`DesignWidth`), or `mid`,
 * a mid-size window (`_play.ts`'s `MID`, 1024 × 700) under Play's design
 * size, which no family is held at but a gate may walk on top
 * (`sibling-heights.e2e.ts`'s type floor over Play, R12).
 */
export type DesignWalkWidth = DesignWidth | 'mid'

/** One view a gate scans: a route at a width, in one state. */
export type DesignView = {
  family: DesignFamily
  width: DesignWalkWidth
  /** `<path> at <width>[, <state>]`, the prefix of every finding the view has. */
  where: string
}

/** What a gate's scan reads off one view: a rule and a line for each finding. */
export type DesignScan = (view: DesignView) => Promise<{ rule: string; line: string }[]>

/** Let the page come to rest: game data, the network, the fonts, any "Loading …". */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await expect(page.getByText(/^Loading\b.*…$/))
    .toHaveCount(0, { timeout: 15_000 })
    .catch(() => {})
  await page.waitForTimeout(300)
}

/** Press the sheet's Edit (a toggle on a sheet's band, or a Read | Edit radio). */
async function edit(page: Page): Promise<void> {
  const control = page
    .getByRole('button', { name: 'Edit', exact: true })
    .or(page.getByRole('radio', { name: 'Edit', exact: true }))
    .first()
  await expect(control, 'the Live Sheet offers Edit').toBeVisible({ timeout: 15_000 })
  const on = async () =>
    (await control.getAttribute('aria-pressed')) ?? (await control.getAttribute('aria-checked'))
  if ((await on()) !== 'true') await control.click()
  await expect.poll(on, { message: 'the Live Sheet is in Edit' }).toBe('true')
  await settle(page)
}

/** Open a Peek from the Union bar's search, as `nesting-depth.e2e.ts`'s Peek pass does. */
async function openPeek(page: Page, { schema, name }: { schema: string; name: string }) {
  const search = page.getByRole('combobox', { name: 'Search the Reference' }).first()
  await search.click()
  await search.fill(name)
  const trigger = page
    .locator(`[role="option"][data-peek^="${schema}:"]`)
    .filter({ hasText: name })
    .first()
  await expect(trigger, `a ${schema} Mini for ${name} to Peek`).toBeVisible()
  await trigger.hover()
  await expect(page.locator('[data-peek-popup] .su-entity-compact__head').first()).toBeVisible()
}

/** Open a route and put it in its state; resolves when the page is at rest. */
async function open(page: Page, route: DesignRoute, path: string): Promise<void> {
  if (DESIGN_FAMILIES[route.family] === 'play') {
    await page.goto(path)
    await waitForReady(page)
    await expect(page.locator('.su-play-root header h1')).toBeVisible({ timeout: 30_000 })
  } else {
    await page.goto(path, { waitUntil: 'networkidle' })
    if (path.startsWith(`${BASE}/`)) await waitForReady(page)
  }
  await settle(page)
  if (route.edit === true) await edit(page)
  if (route.peek) await openPeek(page, route.peek)
}

/** The viewport a route is held at: Play's `page` is its canvas at the design size. */
function viewportFor(route: DesignRoute, width: DesignWalkWidth) {
  if (width === 'mid') return MID
  if (DESIGN_FAMILIES[route.family] !== 'play') return DESIGN_VIEWPORTS[width]
  return width === 'page' ? CANVAS : PHONE
}

/**
 * Every view of `routes` (all of `designRoutes` by default) through `scan`: each
 * route at each of its widths (or at `widths`, when given, in their place),
 * and wherever Play draws its phone form each tab in turn.
 */
export async function walkDesignRoutes(
  page: Page,
  seed: DesignSeed,
  scan: DesignScan,
  routes: readonly DesignRoute[] = designRoutes,
  { widths }: { widths?: readonly DesignWalkWidth[] } = {}
): Promise<DesignFinding[]> {
  const found: DesignFinding[] = []
  const take = async (view: DesignView) => {
    for (const { rule, line } of await scan(view)) found.push({ family: view.family, rule, line })
  }
  for (const route of routes) {
    const path = resolveDesignPath(route.path, seed)
    for (const width of widths ?? route.widths) {
      const { width: w, height } = viewportFor(route, width)
      await page.setViewportSize({ width: w, height })
      await open(page, route, path)
      const state = [route.edit && 'Edit', route.peek && `${route.peek.name} Peek open`]
        .filter(Boolean)
        .join(', ')
      const where = `${route.family} ${route.path} at ${width}${state ? `, ${state}` : ''}`
      const tabs = page.locator('.su-play-root--phone [role="tab"]')
      const play = DESIGN_FAMILIES[route.family] === 'play'
      if (play && width === 'phone') {
        await expect(tabs.first(), `${where}: Play draws its phone form`).toBeVisible()
      }
      const phonePlay = play && (await page.locator('.su-play-root--phone').count()) > 0
      if (phonePlay) {
        await expect(tabs.first(), `${where}: the phone form shows its tabs`).toBeVisible()
        for (const name of await tabs.allTextContents()) {
          await tabs.filter({ hasText: name }).first().click()
          await settle(page)
          await take({ family: route.family, width, where: `${where}, ${name.trim()} tab` })
        }
      } else {
        await take({ family: route.family, width, where })
      }
    }
  }
  return found
}

/**
 * Fail on every finding off `baseline`; note each stale entry on the test
 * (an annotation in the report, not a failure: a debt one machine's fonts
 * draw and another's do not must not turn the gate red). A pending rule's
 * findings (`_pendingRules.ts`) are reported, not failed.
 */
export function expectWithinBaseline(
  gate: string,
  findings: readonly DesignFinding[],
  baseline: readonly DesignDebt[]
): void {
  const { fresh, stale } = againstBaseline(holdPending(gate, findings), baseline)
  for (const d of stale) {
    test.info().annotations.push({
      type: 'paid-off debt',
      description: `${gate}: ${d.family} ${d.rule} "${d.match}" matched nothing; delete it`,
    })
  }
  expect(
    fresh.map((f) => `${f.rule} ${f.line}`),
    `${gate} over designRoutes, off its baseline`
  ).toEqual([])
}
