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
import { mechBayOf, stepPlan, stepsFor } from '../playDowntime.model'

const RESTORE = 'Restore your Mech & Pilot'

type Condition = 'intact' | 'damaged'

const crawler = (techLevel: string, mechBay: Condition = 'intact'): Crawler =>
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
    const site = crawler('tech-2', 'damaged')
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
    const [line] = plan({ pilot, crawler: crawler('tech-3'), pilotCrawlerTl: 3 })
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
      techLevel: 'tech-2',
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
    expect(plan({ stepName: CRAFT, crawler: crawler('tech-2') })).toEqual([])
  })
})
