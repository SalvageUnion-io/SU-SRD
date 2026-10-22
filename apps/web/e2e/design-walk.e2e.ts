import type { Browser, Page } from '@playwright/test'
import type { Seed } from 'gates/lib/seedAccount'
import { seedAccount } from 'gates/lib/seedAccount'
import { at } from './_base'
import { findChipStripFaults } from './_chipStrips'
import type { DesignView } from './_designRoutes'
import { expectWithinBaseline, visitDesignViews, walkDesignRoutes } from './_designRoutes'
import type { DesignDebt, DesignFamily, DesignFinding } from './_designTable'
import { corpusRoutes, DESIGN_FAMILIES, designRoutes } from './_designTable'
import { findFrameFaults } from './_entityFrames'
import { chassisAbilityNames, findFormFindings } from './_formFits'
import { waitForReady } from './_helpers'
import { findNestingFindings } from './_nestingDepth'
import { ruleOfFault } from './_pendingRules'
import { findRelationFindings } from './_relationChips'
import { findSheetGrammar } from './_sheetGrammar'
import { findSiblingMismatches, findTabSizeFaults } from './_siblingHeights'
import { findStripControlFaults } from './_stripControls'
import { countTabLabels, findTabLabelFaults } from './_tabLabels'
import { COCKPIT, findBandFault, findGrainFaults, readOverlays } from './_texture'
import { findTypeFloorFaults } from './_typeFloor'
import { findValueCellFaults } from './_valueCells'
import { expect, test } from './fixtures'

/**
 * Every layout gate over every context (hard rule R0), in one walk: the
 * account is seeded once (`gates/lib/seedAccount.ts`), each of `designRoutes`
 * (`_designTable.ts`) opens once at page and phone widths, Play's phone form
 * tab by tab, and each view is handed to every gate's scan in `designGates` (a
 * gate that reads only some families says which; `E2E_DESIGN_GATES` holds a run
 * to some gates, `selectGates`). A gate's own scanner is its `_x.ts`.
 *
 * Each gate is then held to its `baseline` in a step of its own
 * (`expectWithinBaseline`, soft), so a failure names the gate and every gate is
 * checked. A `baseline` is the debt the gate found when it landed, by route
 * family and rule, each to be fixed and deleted here: a finding off it fails,
 * and an entry nothing matches is noted on the report as paid off. A scan that
 * throws on a view is a finding of its gate's, so one broken scanner never
 * hides the others.
 */

type Finding = { rule: string; line: string }

/** What a gate's `finish` may use: the walk's page, the browser, the seed. */
type FinishArgs = { page: Page; browser: Browser; seed: Seed }

type Gate = {
  /** The gate's name, as its findings and its step are reported. */
  gate: string
  /** The families it reads; every family when absent. */
  reads?: (family: DesignFamily) => boolean
  scan: (view: DesignView) => Promise<Finding[]>
  baseline: readonly DesignDebt[]
  /**
   * After the walk, in the gate's step: what the gate reads beyond the walk's
   * views (its findings join the walk's), and what the walk must have read.
   */
  finish?: (args: FinishArgs) => Promise<DesignFinding[]>
}

/** The gates, each with the state it keeps over the walk. Texture's is last: it opens overlays. */
function designGates(page: Page): Gate[] {
  const abilities = chassisAbilityNames()
  const typeFloor = async ({ where }: { where: string }) =>
    (await findTypeFloorFaults(page)).map((fault) => ({
      rule: 'type-floor',
      line: `${where}: ${fault}`,
    }))
  const faults = (where: string, list: readonly string[]) =>
    list.map((fault) => ({ rule: ruleOfFault(fault), line: `${where}, ${fault}` }))
  const unique = (lines: Map<string, string>) => [...lines].map(([line, rule]) => ({ rule, line }))

  let labels = 0
  const cells = { cells: 0, seams: 0 }
  const readValueCells = async (where: string) => {
    const { faults: found, cells: c, seams } = await findValueCellFaults(page)
    cells.cells += c
    cells.seams += seams
    return faults(where, found)
  }
  const cockpits = new Set<DesignFamily>()
  const overlaysRead: string[] = []

  return [
    {
      /**
       * The chip-strip law (ruleset §4.7, `_chipStrips.ts`). A fault's rule is
       * its kind: `size`, `gap`, `flush`, `cost`, `clip` or `lines`. The seeded
       * Game's long name holds a Training Bay Compact's Game chip inside its
       * Compact at a page's three columns (R3).
       */
      gate: 'chip-strips',
      scan: async ({ where }) => faults(where, await findChipStripFaults(page)),
      baseline: [
        {
          family: 'sheet-crawler-edit',
          rule: 'flush',
          match: 'flush: Wasteland Explorer',
          why: "the crawler's type strip wraps in Edit with its lines on no common edge",
        },
      ],
    },
    {
      /**
       * Hard rule R35, the form fits the place (EDL E2, E11, E19,
       * `_formFits.ts`): every list item that holds an entity draws it as a
       * Compact, a CompactIndex or a Mini; a lead only on an SRD index; a
       * chassis ability at level 1 only on its chassis and pattern Pages and
       * the mech sheet's hero, else a contentful Mini; and Play's lists (the
       * player's, solo and the Mediator's, every phone tab) are Minis, never
       * Compacts (E3, ruleset §1.3).
       */
      gate: 'form-fits',
      scan: async ({ family, where }) => {
        const place = {
          // A Peek opens over an index (`designRoutes`), whose CompactIndexes keep their leads.
          index: family === 'reference-index' || family === 'peek',
          chassisPage: family === 'reference-page' && /\/chassis\//.test(page.url()),
          play: DESIGN_FAMILIES[family] === 'play',
        }
        const lines = new Map<string, string>()
        for (const f of await findFormFindings(page, place, abilities))
          lines.set(`${where}: ${f.rule} ${f.detail}`, f.rule)
        return unique(lines)
      },
      baseline: [],
    },
    {
      /**
       * The nesting law (ruleset §5, N1–N8; EDL E6, `_nestingDepth.ts`), and
       * every entity frame's colour (`_entityFrames.ts`, R38).
       */
      gate: 'nesting-depth',
      scan: async ({ where }) => {
        const lines = new Map<string, string>()
        for (const f of await findNestingFindings(page))
          lines.set(`${where}: ${f.rule} ${f.chain}: ${f.detail}`, f.rule)
        for (const fault of await findFrameFaults(page))
          lines.set(`${where}, ${fault}`, ruleOfFault(fault))
        return unique(lines)
      },
      baseline: [],
    },
    {
      /**
       * Hard rule R5, a linked unit is a relation chip (C11,
       * `_relationChips.ts`): no entity in a Compact's body and no Mini hung
       * under a Compact. Its copy half is the `copy` gate's banned role stamps
       * ("Assigned Mech", "Assigned Pilot").
       */
      gate: 'relation-chips',
      scan: async ({ where }) => {
        const lines = new Map<string, string>()
        for (const f of await findRelationFindings(page)) lines.set(`${where}: ${f.detail}`, f.rule)
        return unique(lines)
      },
      baseline: [],
    },
    {
      /**
       * Hard rule R11, one Live Sheet grammar (ruleset §0, §1.2,
       * `_sheetGrammar.ts`), on each kind's sheet in Read and Edit:
       * `LiveSheet`'s band with its corner actions and Read | Edit, a
       * `SheetHero` opening whose vitals are `SheetVitalGauge`s in full words,
       * a typeset Read (no field, stepper or empty section), in Edit the one
       * remove control, and the permanent right sidebar of what the unit
       * carries: beside the sheet at page width, under the opening on a phone,
       * never folded. The seed carries something on the pilot, the mech and the
       * crawler; an NPC carries nothing, so its sheet has no sidebar.
       */
      gate: 'sheet-grammar',
      reads: (family) => DESIGN_FAMILIES[family] === 'sheet',
      scan: async ({ family, where }) =>
        (
          await findSheetGrammar(page, {
            edit: family.endsWith('-edit'),
            carries: !family.startsWith('sheet-npc-'),
          })
        ).map((f) => ({ rule: f.rule, line: `${where}: ${f.detail}` })),
      baseline: [],
    },
    {
      /**
       * Hard rule R12 on the whole page (Play's phone tabs scanned whole):
       * - `sibling`: no line whose controls differ in height (§4.7).
       * - `type-floor`: no text drawn under 11px (§4.6, `_typeFloor.ts`), its
       *   computed size times every scale above it. Play is swept again in a
       *   mid-size window (`MID`, 1024 × 700), under its canvas's design size,
       *   where a canvas scaled to fit would draw its 11px text at 8.8px: there
       *   the phone form is up (ADR-045 decision 1), and every tab is scanned.
       * - `tab-size` (pending, `_pendingRules.ts`): a Button beside Tabs is the
       *   Tabs' Size.
       * Then, under a coarse pointer (a touch phone), every menu item a seeded
       * page opens is on the 44px floor (§4.6): the Training Bay's ⋯ and the
       * Play bar's.
       */
      gate: 'sibling-heights',
      scan: async (view) => [
        ...(await findSiblingMismatches(page)).map((m) => ({
          rule: 'sibling',
          line: `${view.where}, ${m.line}: ${m.controls.map((c) => `${c.height}px ${c.what}`).join(', ')}`,
        })),
        ...(await typeFloor(view)),
        ...faults(view.where, await findTabSizeFaults(page)),
      ],
      baseline: [],
      finish: async ({ browser, seed }) => {
        const play = designRoutes.filter((r) => DESIGN_FAMILIES[r.family] === 'play')
        const mid = await walkDesignRoutes(page, typeFloor, { seed, routes: play, widths: ['mid'] })
        await expectTouchMenus(browser, page, seed)
        return mid
      },
    },
    {
      /**
       * Hard rule R6, nothing beside or under a strip (`chips-and-actions.md`
       * C1, C8; EDL E8, `_stripControls.ts`): every control in an entity list
       * item is inside its entity's chip group, its state, uses and actions
       * inlined last after the cost; none sits beside the strip (`beside`) or
       * in the body under it (`under`). A sheet item's state, uses, actions and
       * ✕ ride its Mini's chip group (`SheetItemLine`, R11), its name the link.
       */
      gate: 'strip-controls',
      scan: async ({ where }) => faults(where, await findStripControlFaults(page)),
      baseline: [],
    },
    {
      /** Hard rule R29: no tab or segment label overflows (`_tabLabels.ts`). */
      gate: 'tab-labels',
      scan: async ({ where }) => {
        labels += await countTabLabels(page)
        return (await findTabLabelFaults(page)).map(({ rule, line }) => ({
          rule,
          line: `${where}: ${line}`,
        }))
      },
      baseline: [],
      finish: async () => {
        expect.soft(labels, 'the walk read tab and segment labels').toBeGreaterThan(50)
        return []
      },
    },
    {
      /**
       * Hard rule R31, "Value cells and seams" (ruleset §7.1, §7.2,
       * `_valueCells.ts`): every `Stat` value cell is paper with a 1px ink
       * frame (`fill`, `frame`), and every border-riding stamp centres on its
       * frame's border line (`seam`). The one seam stamp lives outside
       * `designRoutes`, so the corpus's `seam` Page is read too.
       */
      gate: 'value-cells',
      scan: async ({ where }) => await readValueCells(where),
      baseline: [],
      finish: async () => {
        const seams = await walkDesignRoutes(page, ({ where }) => readValueCells(where), {
          routes: corpusRoutes('seam'),
        })
        test.info().annotations.push({
          type: 'read',
          description: `value-cells: ${cells.cells} value cells, ${cells.seams} seam stamps`,
        })
        expect.soft(cells.cells, 'the walk read value cells').toBeGreaterThan(0)
        expect.soft(cells.seams, 'the walk read seam stamps').toBeGreaterThan(0)
        return seams
      },
    },
    {
      /**
       * Hard rule R10, "A surface sets its texture once" (`_texture.ts`), on
       * the Cockpits and Manage; no other context is held to it at runtime.
       * The overlays are opened on the canvas only (`page` width): a phone
       * opens a Peek by a long press, and its tabs are the walk's.
       */
      gate: 'texture',
      reads: (family) => ['play', 'manage'].includes(DESIGN_FAMILIES[family]),
      scan: async ({ family, width, where }) => {
        const found: Finding[] = []
        if (DESIGN_FAMILIES[family] === 'play') {
          cockpits.add(family)
          await expect(page.locator(COCKPIT).first(), `${where}: the Cockpit is up`).toBeVisible()
          for (const f of await findGrainFaults(page))
            found.push({ rule: f.rule, line: `${where}: ${f.line}` })
          if (width === 'page' && !where.includes(' tab')) {
            for (const { what, faults: overlay } of await readOverlays(page)) {
              overlaysRead.push(`${where}: ${what}`)
              for (const f of overlay)
                found.push({ rule: f.rule, line: `${where}, ${what}: ${f.line}` })
            }
          }
        } else {
          const fault = await findBandFault(page)
          if (fault) found.push({ rule: 'band', line: `${where}: ${fault}` })
        }
        return found
      },
      baseline: [],
      finish: async () => {
        test.info().annotations.push({
          type: 'overlays read',
          description: `texture: ${overlaysRead.join('; ')}`,
        })
        expect
          .soft([...cockpits].sort(), 'the walk reached every Cockpit')
          .toEqual(['play-mediator', 'play-player', 'play-solo'])
        return []
      },
    },
  ]
}

/** A touch phone (`pointer: coarse`): a Pixel 7's viewport with touch on. */
const PHONE_TOUCH = { viewport: { width: 412, height: 839 }, hasTouch: true, isMobile: true }

/** Every menu item the seeded Training Bay's ⋯ and the Mediator's More open is 44px tall or more. */
async function expectTouchMenus(browser: Browser, page: Page, seed: Seed): Promise<void> {
  const touch = await browser.newContext({
    storageState: await page.context().storageState({ indexedDB: true }),
    ...PHONE_TOUCH,
  })
  const phone = await touch.newPage()
  const short: string[] = []
  const menus = [
    { path: at('/'), trigger: /^More for / },
    { path: seed.playMediator, trigger: /^More$/ },
  ]
  for (const { path, trigger } of menus) {
    await phone.goto(path)
    await waitForReady(phone)
    expect(
      await phone.evaluate(() => matchMedia('(pointer: coarse)').matches),
      'the touch context reports a coarse pointer'
    ).toBe(true)
    await phone.getByRole('button', { name: trigger }).filter({ visible: true }).first().click()
    const items = phone.getByRole('menuitem')
    await expect(items.first(), `${path}: its menu opens`).toBeVisible()
    for (const item of await items.all()) {
      const box = await item.boundingBox()
      const height = Math.round(box?.height ?? 0)
      if (height < 44) short.push(`${path}: ${height}px menu item "${await item.textContent()}"`)
    }
    await phone.keyboard.press('Escape')
  }
  await touch.close()
  expect.soft(short, 'menu items under 44px on a coarse pointer').toEqual([])
}

/**
 * The gates a run holds: every one, or those `E2E_DESIGN_GATES` names
 * (comma-separated). ci.yml's PR tier names the gates that fit its time
 * budget; the nightly run sets none and holds them all. A name that is no
 * gate throws, so a renamed gate never silently drops out of the PR tier.
 */
function selectGates(gates: Gate[], only = process.env.E2E_DESIGN_GATES): Gate[] {
  if (!only) return gates
  const names = only.split(',').map((n) => n.trim())
  const unknown = names.filter((n) => !gates.some((g) => g.gate === n))
  if (unknown.length) throw new Error(`E2E_DESIGN_GATES names no gate: ${unknown.join(', ')}`)
  const held = gates.filter((g) => names.includes(g.gate))
  test.info().annotations.push({
    type: 'gates held',
    description: `${held.map((g) => g.gate).join(', ')} (E2E_DESIGN_GATES); the rest run nightly`,
  })
  return held
}

/** A thrown error's first line, as a finding reports it. */
const threw = (error: unknown): string =>
  `threw ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`

test.describe.configure({ retries: 0 })

test('every context: every layout gate', async ({ page, browser }) => {
  test.setTimeout(45 * 60_000)
  const seed = await test.step('seed the account', () => seedAccount(page))
  const gates = selectGates(designGates(page))
  const found = new Map<Gate, DesignFinding[]>(gates.map((g) => [g, []]))
  await test.step('walk designRoutes', () =>
    visitDesignViews(
      page,
      async (view) => {
        for (const gate of gates) {
          if (gate.reads && !gate.reads(view.family)) continue
          const into = found.get(gate) ?? []
          try {
            for (const { rule, line } of await gate.scan(view))
              into.push({ family: view.family, rule, line })
          } catch (error) {
            into.push({ family: view.family, rule: 'scan', line: `${view.where}: ${threw(error)}` })
          }
        }
      },
      { seed }
    ))
  for (const gate of gates) {
    await test.step(gate.gate, async () => {
      const findings = found.get(gate) ?? []
      try {
        findings.push(...((await gate.finish?.({ page, browser, seed })) ?? []))
      } catch (error) {
        expect.soft(threw(error), `${gate.gate}, after the walk`).toBe('')
      }
      expectWithinBaseline(gate.gate, findings, gate.baseline)
    })
  }
})
