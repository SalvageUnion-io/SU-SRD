import type { Page } from '@playwright/test'
import { at } from './_base'
import { expectWithinBaseline, seedDesignAccount, walkDesignRoutes } from './_designRoutes'
import type { DesignDebt } from './_designTable'
import { findFrameFaults } from './_entityFrames'
import { editSheet, fillIdentity, openSheetFor, waitForReady } from './_helpers'
import { describeFindings, findNestingFindings } from './_nestingDepth'
import { holdPending, ruleOfFault } from './_pendingRules'
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
 * Signed out: sibling-heights' pages, the pages the nesting audit measured,
 * every Starter Set sheet, and a Peek of a chassis, a Bio-Titan and an
 * equipment item. Signed in (`fixtures.ts`; the PR tier's build carries the
 * seam): every step of the three wizards, and a built crawler's sheet in Read
 * and Edit.
 */
const PAGES = [
  '/',
  '/chassis/',
  '/chassis/mazona/',
  '/chassis/mazona/pattern/buzzard/',
  '/chassis/big-brother/',
  '/chassis/big-brother/pattern/drontek/',
  '/systems/',
  '/systems/salvaging-drill/',
  '/abilities/',
  '/classes/hacker/',
  '/classes/engineer/',
  '/bio-titans/tyrant/',
  '/npcs/saboteur/',
  '/drones/pest-drone/',
  '/vehicles/fighting-box-wheel/',
  '/crawler-bays/armoury/',
  '/roll-tables/core-mechanic/',
  '/roll-tables/mechapult/',
  '/guides/create-a-pilot/',
  '/build/',
  '/build/starter',
  ...[
    'pilot/starter-pilot-bonesaw',
    'pilot/starter-pilot-driftwood',
    'pilot/starter-pilot-hotdog',
    'pilot/starter-pilot-judge',
    'pilot/starter-pilot-nobody',
    'pilot/starter-pilot-pickle',
    'pilot/starter-pilot-razor',
    'mech/starter-mech-bobcat',
    'mech/starter-mech-mazona',
    'mech/starter-mech-mule',
    'mech/starter-mech-scrapper',
    'mech/starter-mech-spectrum',
    'mech/starter-mech-thresher',
    'crawler/starter-crawler-tenacity',
  ].map((sheet) => `/build/starter/${sheet}`),
]

/**
 * An entity's, a pattern's or a guide's Page, where an entity one level deep
 * is a Compact drawn open (N8): not an index, a table, the Training Bay or a sheet.
 */
const ONE_DEEP = /^\/(?!build\/|roll-tables\/)[a-z-]+\/[a-z0-9-]+\/(?:pattern\/[a-z0-9-]+\/)?$/

/** Desktop, and a phone's width: a Mini's line is narrower there. */
const WIDTHS = [1440, 390]

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
  return describeFindings(where, await findNestingFindings(page))
}

test.describe('signed out', () => {
  test.use({ account: 'anonymous' })

  test('every page nests three levels deep at most', async ({ page }) => {
    test.setTimeout(15 * 60_000)
    const found: { rule: string; line: string }[] = []
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of PAGES) {
        await page.goto(path, { waitUntil: 'networkidle' })
        const where = `${path} at ${width}px`
        const findings = await findNestingFindings(page, { oneDeep: ONE_DEEP.test(path) })
        for (const rule of new Set(findings.map((f) => f.rule))) {
          const lines = describeFindings(
            where,
            findings.filter((f) => f.rule === rule)
          )
          found.push(...lines.map((line) => ({ rule, line })))
        }
        for (const fault of await findFrameFaults(page)) {
          found.push({ rule: ruleOfFault(fault), line: `${where}, ${fault}` })
        }
      }
    }
    const failures = holdPending('nesting-depth', found).map((f) => f.line)
    expect(failures, 'entities nested past the three levels').toEqual([])
  })

  test('a Peek holds only Minis', async ({ page }) => {
    test.setTimeout(5 * 60_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    const failures: string[] = []
    for (const { schema, name } of PEEKS) {
      // The Union bar's combobox, which mounts its island on intent.
      await page.goto('/chassis/', { waitUntil: 'networkidle' })
      const search = page.getByRole('combobox', { name: 'Search the Reference' }).first()
      await search.click()
      await search.fill(name)
      const trigger = page
        .locator(`[role="option"][data-peek^="${schema}:"]`)
        .filter({ hasText: name })
        .first()
      await expect(trigger, `a ${schema} Mini for ${name} to Peek`).toBeVisible()
      await trigger.hover()
      const popup = page.locator('[data-peek-popup]')
      await expect(popup.locator('.su-entity-compact__head').first()).toBeVisible()
      failures.push(...(await scan(page, `the ${name} Peek`)))
    }
    expect(failures, 'entities nested past the three levels in a Peek').toEqual([])
  })
})

/**
 * Walk a wizard from its first step, scanning each as it lands and again once
 * its gate is met: fill the identity fields a step asks for, then take the
 * named pick or the last option on offer, as `runWizard` (`_helpers.ts`)
 * does. Stops on the Review step, or creates the unit when `create` is set.
 */
async function walkWizard(
  page: Page,
  kind: 'pilots' | 'mechs' | 'crawlers',
  options: { identity: Record<string, string>; prefer: string[]; create?: RegExp }
): Promise<string[]> {
  await page.goto(at(`/${kind}/new?mode=guided`))
  await waitForReady(page)
  const failures: string[] = []
  for (let step = 0; step < 16; step++) {
    const heading = page.locator('.su-wiz-main h1').first()
    const title = ((await heading.textContent({ timeout: 15_000 })) ?? '').trim()
    const where = `/${kind}/new, ${title.replace(/^Step \d+ of \d+ · /, '')}`
    failures.push(...(await scan(page, where)))
    const create = options.create && page.getByRole('button', { name: options.create }).first()
    if (create && (await create.isVisible().catch(() => false))) {
      await create.click()
      await page.waitForURL((url) => !url.pathname.includes('/new'), { timeout: 30_000 })
      return failures
    }
    // The wizard's own Next, in its footer pill: an ability's NEXT tree chip
    // on a step reads "Next: <ability>" too.
    const next = page
      .locator('.su-wiz-pill')
      .getByRole('button', { name: /^Next(: |$)/ })
      .first()
    if (!(await next.isVisible().catch(() => false))) return failures
    if (await next.isDisabled()) {
      for (const [label, value] of Object.entries(options.identity))
        await fillIdentity(page, label, value)
      for (let round = 0; round < 6 && (await next.isDisabled()); round++) {
        const unselected = page.locator('[aria-pressed="false"], [aria-checked="false"]')
        const wanted = options.prefer.map((want) => unselected.filter({ hasText: want }).first())
        let picked = false
        for (const candidate of wanted) {
          if (!(await candidate.isVisible().catch(() => false))) continue
          await candidate.click()
          picked = true
          break
        }
        if (!picked) {
          const count = await unselected.count()
          if (count === 0) break
          await unselected.nth(count - 1).click()
        }
        await page.waitForTimeout(350)
      }
      await expect(next, `${kind} step ${step} unlocks after picking`).toBeEnabled()
      failures.push(...(await scan(page, `${where}, picked`)))
    }
    await next.click()
    // The next step is in once its heading is.
    await expect(heading).not.toHaveText(title)
  }
  return failures
}

test.describe('signed in', () => {
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

  /**
   * Every context (hard rule R0): each of `designRoutes` (`_helpers.ts`),
   * seeded, at page and phone widths, Play's phone form tab by tab, under
   * N1–N8.
   *
   * `BASELINE` is the debt this pass found when it landed, by route family and
   * rule, each to be fixed and deleted here. A finding off it fails; an entry
   * nothing matches is noted on the report as paid off.
   */
  const BASELINE: readonly DesignDebt[] = []

  test('every context nests three levels deep at most', async ({ page }) => {
    test.setTimeout(20 * 60_000)
    const seed = await seedDesignAccount(page)
    const findings = await walkDesignRoutes(page, seed, async ({ where }) => {
      const lines = new Map<string, string>()
      for (const f of await findNestingFindings(page)) {
        lines.set(`${where}: ${f.rule} ${f.chain}: ${f.detail}`, f.rule)
      }
      for (const fault of await findFrameFaults(page))
        lines.set(`${where}, ${fault}`, ruleOfFault(fault))
      return [...lines].map(([line, rule]) => ({ rule, line }))
    })
    expectWithinBaseline('nesting-depth', findings, BASELINE)
  })
})
