import type { Page } from '@playwright/test'
import { DESIGN_VIEWPORTS } from 'gates/lib/designViewports'
import { expectCorpusClean } from './_designRoutes'
import { findFrames } from './_entityFrames'
import { place } from './_findings'
import { editSheet, openPeekFromSearch, openSheetFor, runWizard, waitForReady } from './_helpers'
import { findNesting } from './_nestingDepth'
import { expect, test } from './fixtures'

/**
 * The nesting law (ruleset §5, N1–N8; EDL E6) on the rendered page
 * (`_nestingDepth.ts`): three levels, nothing titled at level 2, a Mini that
 * nests nothing and fills its line, no TitledBox inside an entity or around a
 * wizard step's entities. A failure names the page, the chain of headed frames
 * (`Shield Drone (Drone) > Refractive Shield Projector (System)`) and the rule.
 *
 * There is no allowlist: every finding fails, bar a pending rule's
 * (`_pendingRules.ts`), which the report shows. Every entity frame's colour
 * (`_entityFrames.ts`, R38) is read on the same pages.
 *
 * Signed out: the reference corpus (`REFERENCE_CORPUS`, `_designTable.ts`:
 * every Starter Set sheet among it) at page and phone widths, and a Peek of a
 * chassis, a Bio-Titan and an equipment item. Signed in (`fixtures.ts`; the PR
 * tier's build carries the seam): every step of the three wizards, and a built
 * crawler's sheet in Read and Edit. Every signed-in context (`designRoutes`) is
 * `design-walk.e2e.ts`'s.
 */

/**
 * An entity's, a pattern's or a guide's Page, where an entity one level deep
 * is a Compact drawn open (N8): not an index, a table, the Training Bay or a sheet.
 */
const ONE_DEEP = /^\/(?!build\/|roll-tables\/)[a-z-]+\/[a-z0-9-]+\/(?:pattern\/[a-z0-9-]+\/)?$/

/**
 * Each Peek opens from the bar search's result Mini: its schema and a name
 * it holds.
 */
const PEEKS = [
  { schema: 'chassis', name: 'Big Brother' },
  { schema: 'bio-titans', name: 'Typhon' },
  { schema: 'equipment', name: 'Portable Arc Welder' },
]

test.describe.configure({ retries: 0 })

/** The findings on the page as it stands, one line each, under `where`. */
async function scan(page: Page, where: string): Promise<string[]> {
  return place(where, await findNesting(page)).map((f) => f.line)
}

test.describe('signed out', { tag: '@pr' }, () => {
  test.use({ account: 'anonymous' })

  test('every page nests three levels deep at most', async ({ page }) => {
    test.setTimeout(15 * 60_000)
    await expectCorpusClean(
      page,
      'nesting-depth',
      async ({ path }) => [
        ...(await findNesting(page, { oneDeep: ONE_DEEP.test(path) })),
        ...(await findFrames(page)),
      ],
      { message: 'entities nested past the three levels' }
    )
  })

  test('a Peek holds only Minis', async ({ page }) => {
    test.setTimeout(5 * 60_000)
    await page.setViewportSize(DESIGN_VIEWPORTS.page)
    const failures: string[] = []
    for (const peek of PEEKS) {
      await page.goto('/chassis/', { waitUntil: 'networkidle' })
      await openPeekFromSearch(page, peek)
      failures.push(...(await scan(page, `the ${peek.name} Peek`)))
    }
    expect(failures, 'entities nested past the three levels in a Peek').toEqual([])
  })
})

/**
 * Walk a wizard from its first step (`runWizard`), scanning each step as it
 * lands and again once its gate is met. Stops on the Review step, or creates
 * the unit when `create` is set.
 */
async function walkWizard(
  page: Page,
  kind: 'pilots' | 'mechs' | 'crawlers',
  options: { identity: Record<string, string>; prefer: string[]; create?: RegExp }
): Promise<string[]> {
  const failures: string[] = []
  await runWizard(page, kind, {
    identity: options.identity,
    create: options.create,
    prefer: options.prefer,
    onStep: async (title, state) => {
      const where = `/${kind}/new, ${title}${state === 'picked' ? ', picked' : ''}`
      failures.push(...(await scan(page, where)))
    },
  })
  return failures
}

test.describe('signed in', { tag: '@pr' }, () => {
  test('the pilot wizard nests three levels deep at most', async ({ page }) => {
    test.setTimeout(5 * 60_000)
    const failures = await walkWizard(page, 'pilots', {
      identity: { name: 'Nesting', callsign: 'Depth' },
      prefer: ['Engineer'],
    })
    expect(failures, 'entities nested past the three levels').toEqual([])
  })

  test('the mech wizard nests three levels deep at most', async ({ page }) => {
    test.setTimeout(5 * 60_000)
    // Big Brother: a chassis with drones, whose systems nest a level deeper.
    const failures = await walkWizard(page, 'mechs', {
      identity: { 'name / pattern': 'Nesting', 'mech name': 'Nesting' },
      prefer: ['Big Brother'],
    })
    expect(failures, 'entities nested past the three levels').toEqual([])
  })

  test('the crawler wizard and sheet nest three levels deep at most', async ({ page }) => {
    test.setTimeout(8 * 60_000)
    const failures = await walkWizard(page, 'crawlers', {
      identity: { 'crawler name': 'Nesting Wagon' },
      prefer: ['Battle'],
      create: /Create Crawler/i,
    })
    await openSheetFor(page, 'Nesting Wagon')
    await waitForReady(page)
    failures.push(...(await scan(page, 'the crawler sheet in Read')))
    await editSheet(page)
    failures.push(...(await scan(page, 'the crawler sheet in Edit')))
    // The Armament Bay's weapon picker, a dialog over the sheet.
    await page.getByRole('button', { name: /^Mount$/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    failures.push(...(await scan(page, "the Armament Bay's picker")))
    await page.keyboard.press('Escape')
    expect(failures, 'entities nested past the three levels').toEqual([])
  })
})
