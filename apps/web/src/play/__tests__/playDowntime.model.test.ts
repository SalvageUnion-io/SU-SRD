/**
 * The Downtime step box's plan (`playDowntime.model.ts`, play.md §6): what the
 * "Restore your Mech & Pilot" step will apply, line by line, when a bay blocks
 * it, and which Downtime steps the ticked lines switch on (ADR-007: each line
 * skippable).
 */
import { describe, expect, test } from 'bun:test'
import type { Crawler } from 'game-domain/schemas/crawler'
import { crawlerFixture, mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import type { StepPlanInput } from '../playDowntime.model'
import {
  healAgainPatch,
  leftOnMove,
  mechBayOf,
  restoreAgainLine,
  restoreLead,
  stepPlan,
  stepsFor,
} from '../playDowntime.model'

const RESTORE = 'Restore your Mech & Pilot'

type Condition = 'intact' | 'damaged'

const crawler = (techLevel: number, mechBay: Condition = 'intact'): Crawler =>
  crawlerFixture({
    id: 'c',
    name: 'Tenacity',
    techLevel,
    crawlerBays: [
      { bayRef: 'mech-bay', condition: mechBay },
      { bayRef: 'med-bay', condition: 'intact' },
    ],
  })

const plan = (over: Partial<StepPlanInput>) =>
  stepPlan({
    stepName: RESTORE,
    pilot: null,
    mech: null,
    crawler: null,
    pilotCrawlerTl: 1,
    upkeep: { spent: false, canPay: true },
    ...over,
  })

describe('the restore step', () => {
  test('a damaged Mech Bay blocks the mech line, which may not be unticked', () => {
    const mech = mechFixture({ id: 'm', name: 'Buzzard', currentSP: 1 })
    const site = crawler(2, 'damaged')
    expect(mechBayOf(site)?.operational).toBe(false)
    expect(mechBayOf(null)).toBeUndefined()
    expect(plan({ mech, crawler: site })).toEqual([
      {
        key: 'mech',
        title: 'Buzzard',
        chips: [],
        steps: ['restoreMechs', 'repairItems'],
        skippable: false,
        blocked: 'Mech Bay damaged: no restore or repair this Downtime',
      },
    ])
  })

  test('a Med Bay that heals the injury counts it healed', () => {
    const pilot = pilotFixture({
      id: 'p',
      name: 'Bonesaw',
      injuries: [
        { severity: 'minor', note: 'sprain' },
        { severity: 'major', note: 'break' },
      ],
    })
    const [line] = plan({ pilot, crawler: crawler(3), pilotCrawlerTl: 3 })
    expect(line?.key).toBe('pilot')
    expect(line?.chips).toContainEqual({ label: 'Injuries healed', value: '1' })
  })

  test('spent uses recharge by name, mech and pilot both; a never-recharge item is left out', () => {
    const mech = mechFixture({ id: 'm', name: 'Buzzard', itemUses: { '50-cal-machine-gun': 1 } })
    const pilot = pilotFixture({
      id: 'p',
      name: 'Bonesaw',
      equipmentUses: { 'first-aid-kit': 0, 'orbital-lance-controller': 1, 'no-such-kit': 2 },
    })
    const uses = plan({ mech, pilot }).find((l) => l.key === 'uses')
    expect(uses).toEqual({
      key: 'uses',
      title: 'Uses recharge',
      chips: [
        { label: '.50 Cal Machine Gun', value: '1→full' },
        { label: 'First Aid Kit', value: '0→full' },
        { label: 'no-such-kit', value: '2→full' },
      ],
      steps: ['rechargeUses'],
      skippable: true,
    })
  })

  test('with nothing spent, the step plans nothing', () => {
    expect(plan({ mech: mechFixture({ id: 'm' }), pilot: pilotFixture({ id: 'p' }) })).toEqual([])
  })
})

describe('a hurt pilot with no Med Bay (r5 A12)', () => {
  const hurt = () => pilotFixture({ id: 'p', name: 'Tessa', currentHP: 0 })
  const input = (over: Partial<StepPlanInput>): StepPlanInput => ({
    stepName: RESTORE,
    pilot: null,
    mech: null,
    crawler: null,
    pilotCrawlerTl: 1,
    upkeep: { spent: false, canPay: true },
    ...over,
  })

  test('with no crawler the restore step says the HP stays, and links to making one', () => {
    const line = plan({ pilot: hurt() }).find((l) => l.key === 'pilot')
    expect(line).toMatchObject({
      key: 'pilot',
      skippable: false,
      blocked: 'HP stays 0',
      needsCrawler: true,
    })
  })

  test('a damaged Med Bay says so, with no link to a crawler', () => {
    const site = crawlerFixture({
      id: 'c',
      techLevel: 1,
      crawlerBays: [{ bayRef: 'med-bay', condition: 'damaged' }],
    })
    const line = plan({ pilot: hurt(), crawler: site }).find((l) => l.key === 'pilot')
    expect(line?.blocked).toBe('HP stays 0')
    expect(line?.needsCrawler).toBe(false)
  })

  // r6 D7 (SB6-06): the step's own line gives the reason, with its page.
  test('Restore leads with why a hurt pilot cannot heal, and only then', () => {
    expect(restoreLead(input({ pilot: hurt() }))).toBe(
      'Healing in Downtime needs your crawler’s Med Bay (Core Book p.242).'
    )
    const damaged = crawlerFixture({
      id: 'c',
      techLevel: 1,
      crawlerBays: [{ bayRef: 'med-bay', condition: 'damaged' }],
    })
    expect(restoreLead(input({ pilot: hurt(), crawler: damaged }))).toMatch(/damaged/)
    expect(restoreLead(input({ pilot: hurt(), crawler: crawler(1) }))).toBeNull()
    expect(restoreLead(input({ pilot: pilotFixture({ id: 'p' }) }))).toBeNull()
    expect(restoreLead(input({ pilot: hurt(), stepName: 'Train your Pilot' }))).toBeNull()
  })

  test('once taken, the step keeps saying why until a crawler with a Med Bay arrives', () => {
    const pilot = hurt()
    expect(restoreAgainLine(input({ pilot }))?.blocked).toBe('HP stays 0')
    const again = restoreAgainLine(input({ pilot, crawler: crawler(1) }))
    expect(again?.skippable).toBe(true)
    expect(again?.chips.map((c) => c.label)).toEqual(['HP'])
    expect(healAgainPatch(pilot, crawler(1), 1).currentHP).toBe(10)
  })

  test('a full pilot, or another step, has nothing to run again', () => {
    expect(restoreAgainLine(input({ pilot: pilotFixture({ id: 'p' }) }))).toBeNull()
    expect(restoreAgainLine(input({ pilot: hurt(), stepName: 'Train your Pilot' }))).toBeNull()
  })
})

describe('the Reactor’s conditions (r7 D2)', () => {
  // r7 D2 (SB7-14): Restore proposed SP and Heat but left the Shutdown on.
  test('a Shutdown, Vulnerable mech reads both cleared, and the step clears them', () => {
    const mech = mechFixture({ id: 'm', name: 'Buzzard', conditions: ['Shutdown', 'Vulnerable'] })
    const [line] = plan({ mech })
    expect(line?.chips).toEqual([
      { label: 'Shutdown', value: 'clears' },
      { label: 'Vulnerable', value: 'clears' },
    ])
    expect(line?.steps).toContain('restoreMechs')
  })
})

describe('what else the restore step resets', () => {
  test('a mech’s spent EP is shown going back to full', () => {
    const mech = mechFixture({ id: 'm', name: 'Buzzard', chassisRef: 'mule', currentEP: 1 })
    const [line] = plan({ mech, crawler: crawler(1) })
    expect(line?.key).toBe('mech')
    const ep = line?.chips.find((chip) => chip.label === 'EP')
    expect(ep?.value).toMatch(/^1→\d+$/)
  })

  test('used abilities and the once-per-Downtime toggles are their own line, which may be skipped', () => {
    const pilot = pilotFixture({
      id: 'p',
      name: 'Bonesaw',
      usedAbilities: ['jury-rig', 'talk-shop'],
      usedToggles: { motto: true },
    })
    const resets = plan({ pilot }).find((l) => l.key === 'resets')
    expect(resets).toEqual({
      key: 'resets',
      title: 'Once-per-Downtime resets',
      chips: [
        { label: 'Abilities used', value: '2→0' },
        { label: 'Once per Downtime', value: 'reset' },
      ],
      steps: ['clearUsed'],
      skippable: true,
    })
    expect(stepsFor([resets as never], new Set()).clearUsed).toBe(true)
  })
})

describe('the other steps', () => {
  test('Train your Pilot plans one Training Point', () => {
    const pilot = pilotFixture({ id: 'p', name: 'Rosa', callsign: 'Bonesaw', trainingPoints: 2 })
    const [line] = plan({ stepName: 'Train your Pilot', pilot })
    expect(line).toMatchObject({
      key: 'train',
      chips: [{ label: 'TP', value: '2→3' }],
      steps: ['trainPilots'],
    })
  })

  test('Upkeep says what it costs and whose it is to pay', () => {
    const funded: Crawler = { ...crawler(2), scrapPool: { tl2: 5 } }
    const upkeep = (state: StepPlanInput['upkeep'], unit: Crawler = funded) =>
      plan({ stepName: 'Upkeep & Upgrade', crawler: unit, upkeep: state })[0]
    const outstanding = upkeep({ spent: false, canPay: true })
    expect(outstanding?.chips[0]?.value).toMatch(/^\d+ Scrap · T2$/)
    expect(outstanding?.chips[1]?.label).toBe('Outstanding')
    expect(outstanding?.skippable).toBe(true)
    const paid = upkeep({ spent: true, canPay: true })
    expect(paid?.chips[1]?.label).toBe('Paid')
    expect(paid?.skippable).toBe(false)
    const theirs = upkeep({ spent: false, canPay: false })
    expect(theirs?.chips[1]?.label).toMatch(/Mediator/)
    expect(theirs?.skippable).toBe(false)
    // r4 A7: a pool too small reads Short by N for payer and player alike, may
    // not be applied, and cites the book; once paid it is Paid again.
    for (const canPay of [true, false]) {
      const short = upkeep({ spent: false, canPay }, crawler(2))
      expect(short?.chips[1]?.label).toBe('Short by 5')
      expect(short?.skippable).toBe(false)
      expect(short?.note).toBe('Unpaid Upkeep: Core Book p.218.')
    }
    expect(upkeep({ spent: true, canPay: true }, crawler(2))?.chips[1]?.label).toBe('Paid')
    // No crawler, no Upkeep to plan.
    expect(plan({ stepName: 'Upkeep & Upgrade' })).toEqual([])
  })
})

describe('stepsFor', () => {
  test('the ticked lines switch on their steps, an unticked one leaves its own off', () => {
    const mech = mechFixture({ id: 'm', name: 'Buzzard', itemUses: { '50-cal-machine-gun': 1 } })
    const lines = plan({ mech })
    expect(stepsFor(lines, new Set()).rechargeUses).toBe(true)
    expect(Object.values(stepsFor(lines, new Set(['uses']))).some(Boolean)).toBe(false)
  })
})

describe('the craft step: Process Nanites (False Flag p.66)', () => {
  const CRAFT = 'Craft Mech Chassis, Systems, and Modules'
  const site = (condition: Condition, inertNanites: number) =>
    crawlerFixture({
      id: 'c',
      name: 'Tenacity',
      techLevel: 2,
      crawlerBays: [{ bayRef: 'nanite-processing-bay', condition }],
      scrapPool: { inertNanites },
    })

  test('a crawler with piles and the bay offers the line to whoever pays Upkeep', () => {
    expect(plan({ stepName: CRAFT, crawler: site('intact', 4) })).toEqual([
      {
        key: 'nanites',
        title: 'Process Nanites',
        chips: [{ label: 'Inert piles', value: '4' }, { label: 'd20 each · 20 is Active' }],
        steps: [],
        skippable: true,
      },
    ])
  })

  test('in a Game a player reads that the Mediator processes them', () => {
    const [line] = plan({
      stepName: CRAFT,
      crawler: site('intact', 4),
      upkeep: { spent: false, canPay: false },
    })
    expect(line?.skippable).toBe(false)
    expect(line?.chips[1]).toEqual({ label: 'The Mediator processes them' })
  })

  test('a Damaged bay blocks it; no piles or no bay, no line', () => {
    expect(plan({ stepName: CRAFT, crawler: site('damaged', 4) })[0]?.blocked).toBe(
      'Nanite Processing Bay damaged: no processing this Downtime'
    )
    expect(plan({ stepName: CRAFT, crawler: site('intact', 0) })).toEqual([])
    expect(plan({ stepName: CRAFT, crawler: crawler(2) })).toEqual([])
  })
})

describe('leftOnMove (r5 A3)', () => {
  test('moved on, the skipped steps from where the table stood are the ones left unfinished', () => {
    expect(leftOnMove(0, 3, [0, 2])).toEqual([0, 2])
    expect(leftOnMove(2, 3, [0, 2])).toEqual([2])
  })

  test('a Back, or a step already left behind before, says nothing', () => {
    expect(leftOnMove(3, 1, [0, 2])).toEqual([])
    expect(leftOnMove(3, 4, [0, 2])).toEqual([])
  })
})
