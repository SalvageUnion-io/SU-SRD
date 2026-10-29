import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { visit } from 'gates/lib/appPage'
import type { DesignWidth } from 'gates/lib/designViewports'
import { DESIGN_VIEWPORTS } from 'gates/lib/designViewports'
import type { Seed } from 'gates/lib/seedAccount'
import { resolveSeedPath } from 'gates/lib/seedAccount'
import { routeInApp } from '../src/lib/appBase'
import type { DesignDebt, DesignFamily, DesignFinding, DesignRoute } from './_designTable'
import { againstBaseline, corpusRoutes, DESIGN_FAMILIES, designRoutes } from './_designTable'
import type { Finding, Placed } from './_findings'
import { place } from './_findings'
import { editSheet, openPeekFromSearch, waitForReady } from './_helpers'
import { holdPending } from './_pendingRules'
import { MID } from './_play'

/**
 * Walking a route list for a layout gate (hard rule R0): `designRoutes`
 * (`_designTable.ts`) signed in on the one seeded account
 * (`gates/lib/seedAccount.ts`), or the signed-out reference corpus
 * (`corpusRoutes`). Each route opens at each of its widths, in the state it
 * names (Edit, a Peek open, each of Play's tabs on a phone and table mode), at rest, and each view
 * goes to the gate's scan. The gate's findings are then held against its
 * baseline (`againstBaseline`, `_designTable.ts`), the debt it has recorded, by
 * route family and rule.
 */

/**
 * A width a walk holds a route at: one of its own (`DesignWidth`); `mid`, a
 * mid-size window (`_play.ts`'s `MID`, 1024 × 700) on the `lg` rung, Play's
 * three columns at their narrowest, which no family is held at but a gate may
 * walk on top (the type floor over Play, R12); or a window this many px wide (900 tall), a width a gate reads
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

/** What a gate's scan reads off one view: its findings, placed on the view (`place`). */
export type DesignScan = (view: DesignView) => Promise<Placed[]>

/**
 * Let the page come to rest: game data, the network, the fonts, any "Loading …",
 * the chip fits, then every finite animation. A page still loading or fitting
 * fails here rather than handing a gate a skeleton to measure; only the
 * network wait may time out (a live room keeps its socket busy).
 */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await expect(page.getByText(/^Loading\b.*…$/), 'the page finished loading').toHaveCount(0, {
    timeout: 15_000,
  })
  // The chip fill's later turns (`chipFillWatch.ts`): every head fitted.
  await page.waitForFunction(
    () => !document.documentElement.hasAttribute('data-chip-fitting'),
    null,
    { timeout: 15_000 }
  )
  // Transitions and one-shot animations end; a spinner's infinite one never does.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Number.POSITIVE_INFINITY)
        .map((a) => a.finished.catch(() => undefined))
    ).then(() => undefined)
  )
}

/** Put the sheet in Edit (`editSheet`), then let it settle for a capture. */
async function edit(page: Page): Promise<void> {
  await editSheet(page)
  await settle(page)
}

/** Open a route and put it in its state; resolves when the page is at rest. */
async function open(page: Page, route: DesignRoute, path: string): Promise<void> {
  if (DESIGN_FAMILIES[route.family] === 'play') {
    await visit(page, path)
    await waitForReady(page)
    await expect(page.locator('.su-play-root header h1')).toBeVisible({ timeout: 30_000 })
  } else {
    await page.goto(path, { waitUntil: 'networkidle' })
    if (routeInApp(path) !== null) await waitForReady(page)
  }
  await settle(page)
  if (route.edit === true) await edit(page)
  if (route.peek) await openPeekFromSearch(page, route.peek)
}

/** The viewport a route is held at. */
function viewportFor(width: DesignWalkWidth) {
  if (typeof width === 'number') return { width, height: 900 }
  if (width === 'mid') return MID
  return DESIGN_VIEWPORTS[width]
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
 * given, in their place), and wherever Play draws its tabs (below `lg`) each
 * tab in turn. A `:key` path is the seed's, so a walk over one needs `seed`.
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
      const { width: w, height } = viewportFor(width)
      await page.setViewportSize({ width: w, height })
      await open(page, route, path)
      const where = whereOf(route, width)
      const view: DesignView = { family: route.family, path: route.path, width, where }
      const tabs = page.locator('.su-play-root [role="tab"]')
      const play = DESIGN_FAMILIES[route.family] === 'play'
      if (play && width === 'phone') {
        await expect(tabs.first(), `${where}: Play draws its tabs`).toBeVisible()
      }
      const tabbedPlay = play && (await tabs.count()) > 0
      if (tabbedPlay) {
        for (const name of await tabs.allTextContents()) {
          await tabs.filter({ hasText: name }).first().click()
          await settle(page)
          await visit({ ...view, where: `${where}, ${name.trim()} tab` })
        }
        // The player's table mode, then back to the tabs for the next route.
        const table = page.locator('.su-play-root').getByRole('button', {
          name: 'Table mode',
        })
        if ((await table.count()) > 0) {
          await table.click()
          await settle(page)
          await visit({ ...view, where: `${where}, table mode` })
          await table.click()
          await settle(page)
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

/**
 * A signed-out corpus gate (hard rule R0): walk `routes` (the whole reference
 * corpus by default, `corpusRoutes`) and fail on every finding `find` makes on
 * a view, bar a pending rule's (`holdPending`). There is no baseline. With
 * `draws`, every view must show what it matches, so the gate never passes by
 * reading nothing.
 */
export async function expectCorpusClean(
  page: Page,
  gate: string,
  find: (view: DesignView) => Promise<Finding[]>,
  {
    routes = corpusRoutes(),
    widths,
    draws,
    message,
  }: {
    routes?: readonly DesignRoute[]
    widths?: readonly DesignWalkWidth[]
    draws?: string
    message: string
  }
): Promise<void> {
  const found = await walkDesignRoutes(
    page,
    async (view) => {
      if (draws) {
        await expect(page.locator(draws).first(), `${view.where} draws ${draws}`).toBeVisible()
      }
      return place(view.where, await find(view))
    },
    { routes, widths }
  )
  expect(
    holdPending(gate, found).map((f) => f.line),
    message
  ).toEqual([])
}
