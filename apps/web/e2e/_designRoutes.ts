import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import type { DesignWidth } from 'gates/lib/designViewports'
import { DESIGN_VIEWPORTS } from 'gates/lib/designViewports'
import type { Seed } from 'gates/lib/seedAccount'
import { resolveSeedPath } from 'gates/lib/seedAccount'
import { BASE } from './_base'
import type { DesignDebt, DesignFamily, DesignFinding, DesignRoute } from './_designTable'
import { againstBaseline, DESIGN_FAMILIES, designRoutes } from './_designTable'
import { editSheet, waitForReady } from './_helpers'
import { holdPending } from './_pendingRules'
import { CANVAS, MID, PHONE } from './_play'

/**
 * Walking a route list for a layout gate (hard rule R0): `designRoutes`
 * (`_designTable.ts`) signed in on the one seeded account
 * (`gates/lib/seedAccount.ts`), or the signed-out reference corpus
 * (`corpusRoutes`). Each route opens at each of its widths, in the state it
 * names (Edit, a Peek open, each of Play's phone tabs), at rest, and each view
 * goes to the gate's scan. The gate's findings are then held against its
 * baseline (`againstBaseline`, `_designTable.ts`), the debt it has recorded, by
 * route family and rule.
 */

/**
 * A width a walk holds a route at: one of its own (`DesignWidth`); `mid`, a
 * mid-size window (`_play.ts`'s `MID`, 1024 × 700) under Play's design size,
 * which no family is held at but a gate may walk on top (the type floor over
 * Play, R12); or a window this many px wide (900 tall), a width a gate reads
 * beside R0's two (a mid desktop, a narrow band, a wide phone).
 */
export type DesignWalkWidth = DesignWidth | 'mid' | number

/** One view a gate scans: a route at a width, in one state. */
export type DesignView = {
  family: DesignFamily
  /** The route's path as the list names it (`/chassis/mazona/`, `:pilot`). */
  path: string
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

/** Put the sheet in Edit (`editSheet`), then let it settle for a capture. */
async function edit(page: Page): Promise<void> {
  await editSheet(page)
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
  if (typeof width === 'number') return { width, height: 900 }
  if (width === 'mid') return MID
  if (DESIGN_FAMILIES[route.family] !== 'play') return DESIGN_VIEWPORTS[width]
  return width === 'page' ? CANVAS : PHONE
}

/** Where the walk is: a route's family and path at a width, and the state it is in. */
function whereOf(route: DesignRoute, width: DesignWalkWidth): string {
  const state = [route.edit && 'Edit', route.peek && `${route.peek.name} Peek open`]
    .filter(Boolean)
    .join(', ')
  const size = typeof width === 'number' ? `${width}px` : width
  return `${route.family} ${route.path} at ${size}${state ? `, ${state}` : ''}`
}

/**
 * Open every view of `routes` (all of `designRoutes` by default) and hand each,
 * at rest, to `visit`: each route at each of its widths (or at `widths`, when
 * given, in their place), and wherever Play draws its phone form each tab in
 * turn. A `:key` path is the seed's, so a walk over one needs `seed`.
 */
export async function visitDesignViews(
  page: Page,
  visit: (view: DesignView) => Promise<void>,
  {
    seed,
    routes = designRoutes,
    widths,
  }: { seed?: Seed; routes?: readonly DesignRoute[]; widths?: readonly DesignWalkWidth[] } = {}
): Promise<void> {
  for (const route of routes) {
    const path = resolveSeedPath(route.path, seed ?? {})
    if (!path) throw new Error(`the seed made no ${route.path}`)
    for (const width of widths ?? route.widths) {
      const { width: w, height } = viewportFor(route, width)
      await page.setViewportSize({ width: w, height })
      await open(page, route, path)
      const where = whereOf(route, width)
      const view: DesignView = { family: route.family, path: route.path, width, where }
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
          await visit({ ...view, where: `${where}, ${name.trim()} tab` })
        }
      } else {
        await visit(view)
      }
    }
  }
}

/** Every finding `scan` makes over the views `visitDesignViews` opens. */
export async function walkDesignRoutes(
  page: Page,
  scan: DesignScan,
  options: Parameters<typeof visitDesignViews>[2] = {}
): Promise<DesignFinding[]> {
  const found: DesignFinding[] = []
  await visitDesignViews(
    page,
    async (view) => {
      for (const { rule, line } of await scan(view)) found.push({ family: view.family, rule, line })
    },
    options
  )
  return found
}

/**
 * Fail on every finding off `baseline`; note each stale entry on the test
 * (an annotation in the report, not a failure: a debt one machine's fonts
 * draw and another's do not must not turn the gate red). A pending rule's
 * findings (`_pendingRules.ts`) are reported, not failed. The failure is soft
 * (`expect.soft`), so a walk that holds several gates checks every one and
 * names each that failed.
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
  expect
    .soft(
      fresh.map((f) => `${f.rule} ${f.line}`),
      `${gate}, off its baseline`
    )
    .toEqual([])
}
