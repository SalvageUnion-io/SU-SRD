/**
 * Unit tests for downtime.ts — the Union Crawler Downtime Procedure
 * (Core Book p.227-228, design-review R-2). Every reset is covered:
 * scope resolution, the Med Bay gate, mech restore/repair/recharge, pilot
 * heal/train/recharge, and the once-per-Downtime flag clears.
 *
 * Uses REAL reference data (systems/modules/equipment/crawler-bays) so the
 * Tech-Level repair gate and the Orbital Lance never-recharge exception are
 * pinned against the shipped dataset.
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { Crawler } from '../../schemas/crawler'
import type { Mech } from '../../schemas/mech'
import type { Pilot } from '../../schemas/pilot'
import type { SoftLink } from '../../schemas/softLink'
import {
  CHASSIS_DAMAGED_CONDITION,
  allDowntimeSteps,
  downtimeMechPatch,
  downtimePilotPatch,
  healableInjuries,
  medBayStatus,
  mechBayStatus,
  repairableItems,
  resolveDowntimeScope,
} from '../downtime'
import type { DowntimeSteps, MedBayStatus } from '../downtime'

beforeAll(async () => {
  await SalvageUnionReference.preload([
    'chassis',
    'systems',
    'modules',
    'equipment',
    'crawler-bays',
    'crawler-tech-levels',
  ])
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = '2026-07-01T00:00:00.000Z'

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return {
    id: 'pilot-1',
    schemaVersion: 1,
    name: 'Ada',
    callsign: 'Wrench',
    classRef: 'engineer',
    abilities: [],
    equipment: [],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeMech(overrides: Partial<Mech> = {}): Mech {
  return {
    id: 'mech-1',
    schemaVersion: 1,
    name: 'Iron Fist',
    // Real TL1 chassis (chassisRef stores the NAME).
    chassisRef: 'Mule',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeCrawler(overrides: Partial<Crawler> = {}): Crawler {
  return {
    id: 'crawler-1',
    schemaVersion: 1,
    name: 'Tin Lizzy',
    techLevel: 'tech-3',
    systems: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function link(
  id: string,
  type: SoftLink['type'],
  fromType: 'pilot' | 'mech',
  fromId: string,
  toType: 'pilot' | 'crawler',
  toId: string
): SoftLink {
  return {
    id,
    type,
    from: { type: fromType, id: fromId },
    to: { type: toType, id: toId },
    createdAt: NOW,
  }
}

/** A fully-operational Med Bay at the given bands. */
function medBay(overrides: Partial<MedBayStatus> = {}): MedBayStatus {
  return {
    present: true,
    damaged: false,
    operational: true,
    healsMinor: true,
    healsMajor: true,
    ...overrides,
  }
}

function noSteps(): DowntimeSteps {
  return {
    restoreMechs: false,
    repairItems: false,
    healPilots: false,
    healInjuries: false,
    trainPilots: false,
    rechargeUses: false,
    clearUsed: false,
  }
}

// Real reference items with known Tech Levels.
const TL1_SYSTEM = '.50 Cal Machine Gun'
const TL1_MODULE = 'Comms Module'
const ORBITAL_LANCE = 'Orbital Lance Controller'

function findHighTlSystemName(minTl: number): string {
  const system = SalvageUnionReference.Systems.find(
    (s) => typeof s.techLevel === 'number' && s.techLevel >= minTl
  )
  if (!system) throw new Error(`No system at TL >= ${minTl} in reference data`)
  return system.name
}

// ---------------------------------------------------------------------------
// resolveDowntimeScope
// ---------------------------------------------------------------------------

describe('resolveDowntimeScope', () => {
  it('collects crew pilots and their mechs; ignores unlinked entities', () => {
    const crawler = makeCrawler()
    const crew = makePilot({ id: 'p-crew' })
    const stray = makePilot({ id: 'p-stray' })
    const crewMech = makeMech({ id: 'm-crew' })
    const strayMech = makeMech({ id: 'm-stray' })
    const links = [
      link('l1', 'pilot-to-crawler', 'pilot', 'p-crew', 'crawler', crawler.id),
      link('l2', 'mech-to-pilot', 'mech', 'm-crew', 'pilot', 'p-crew'),
      // Stray pilot's mech link exists but the pilot is not crew.
      link('l3', 'mech-to-pilot', 'mech', 'm-stray', 'pilot', 'p-stray'),
    ]
    const scope = resolveDowntimeScope({
      crawler,
      pilots: [crew, stray],
      mechs: [crewMech, strayMech],
      links,
    })
    expect(scope.pilots.map((p) => p.id)).toEqual(['p-crew'])
    expect(scope.mechs.map((m) => m.id)).toEqual(['m-crew'])
  })

  it('skips orphaned links (deleted endpoints) and other crawlers', () => {
    const crawler = makeCrawler()
    const links = [
      link('l1', 'pilot-to-crawler', 'pilot', 'p-gone', 'crawler', crawler.id),
      link('l2', 'pilot-to-crawler', 'pilot', 'p-other', 'crawler', 'crawler-other'),
    ]
    const scope = resolveDowntimeScope({
      crawler,
      pilots: [makePilot({ id: 'p-other' })],
      mechs: [],
      links,
    })
    expect(scope.pilots).toEqual([])
    expect(scope.mechs).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// medBayStatus
// ---------------------------------------------------------------------------

describe('medBayStatus', () => {
  it('no Med Bay installed → nothing heals', () => {
    const status = medBayStatus(makeCrawler({ crawlerBays: [{ bayRef: 'Mech Bay' }] }))
    expect(status.present).toBe(false)
    expect(status.operational).toBe(false)
    expect(status.healsMinor).toBe(false)
    expect(status.healsMajor).toBe(false)
  })

  it('damaged Med Bay → present but nothing heals (p.223)', () => {
    const status = medBayStatus(
      makeCrawler({
        techLevel: 'tech-6',
        crawlerBays: [{ bayRef: 'Med Bay', condition: 'damaged' }],
      })
    )
    expect(status.present).toBe(true)
    expect(status.damaged).toBe(true)
    expect(status.operational).toBe(false)
    expect(status.healsMinor).toBe(false)
    expect(status.healsMajor).toBe(false)
  })

  it('bands by crawler Tech Level: 1-2 HP only, 3-4 +minor, 5-6 +major', () => {
    const bays: Crawler['crawlerBays'] = [{ bayRef: 'Med Bay' }]
    const t2 = medBayStatus(makeCrawler({ techLevel: 'tech-2', crawlerBays: bays }))
    expect(t2.operational).toBe(true)
    expect(t2.healsMinor).toBe(false)
    expect(t2.healsMajor).toBe(false)

    const t3 = medBayStatus(makeCrawler({ techLevel: 'tech-3', crawlerBays: bays }))
    expect(t3.healsMinor).toBe(true)
    expect(t3.healsMajor).toBe(false)

    const t5 = medBayStatus(makeCrawler({ techLevel: 'tech-5', crawlerBays: bays }))
    expect(t5.healsMinor).toBe(true)
    expect(t5.healsMajor).toBe(true)
  })

  it('resolves the bay by id ref as well as by name', () => {
    const medBayId = SalvageUnionReference.CrawlerBays.find((b) => b.name === 'Med Bay')?.id
    expect(medBayId).toBeDefined()
    const status = medBayStatus(
      makeCrawler({ techLevel: 'tech-4', crawlerBays: [{ bayRef: medBayId! }] })
    )
    expect(status.present).toBe(true)
    expect(status.healsMinor).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// mechBayStatus (p.221)
// ---------------------------------------------------------------------------

describe('mechBayStatus', () => {
  it('intact Mech Bay → operational', () => {
    const status = mechBayStatus(makeCrawler({ crawlerBays: [{ bayRef: 'Mech Bay' }] }))
    expect(status.present).toBe(true)
    expect(status.damaged).toBe(false)
    expect(status.operational).toBe(true)
  })

  it('damaged Mech Bay → present but not operational (p.221)', () => {
    const status = mechBayStatus(
      makeCrawler({ crawlerBays: [{ bayRef: 'Mech Bay', condition: 'damaged' }] })
    )
    expect(status.present).toBe(true)
    expect(status.damaged).toBe(true)
    expect(status.operational).toBe(false)
  })

  it('no Mech Bay entry → not operational (surfaced, never silently restored)', () => {
    const status = mechBayStatus(makeCrawler({ crawlerBays: [{ bayRef: 'Med Bay' }] }))
    expect(status.present).toBe(false)
    expect(status.operational).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// repairableItems / downtimeMechPatch
// ---------------------------------------------------------------------------

describe('repairableItems', () => {
  it('repairs damaged items at TL ≤ crawler TL; blocks higher-TL and unresolvable refs', () => {
    const highTl = findHighTlSystemName(5)
    const mech = makeMech({
      systemConditions: {
        [TL1_SYSTEM]: 'damaged',
        [highTl]: 'damaged',
        'custom-widget': 'damaged',
      },
      moduleConditions: { [TL1_MODULE]: 'damaged' },
    })
    const result = repairableItems(mech, 3)
    expect(result.repairable.sort()).toEqual([TL1_SYSTEM, TL1_MODULE].sort())
    expect(result.blocked.sort()).toEqual([highTl, 'custom-widget'].sort())
  })

  it('never repairs destroyed items', () => {
    const mech = makeMech({ systemConditions: { [TL1_SYSTEM]: 'destroyed' } })
    const result = repairableItems(mech, 6)
    expect(result.repairable).toEqual([])
    expect(result.blocked).toEqual([])
  })

  it('flags the Chassis Damaged condition as repairable when chassis TL ≤ crawler TL', () => {
    const mech = makeMech({ conditions: [CHASSIS_DAMAGED_CONDITION] })
    expect(repairableItems(mech, 3).chassisRepairable).toBe(true)
    // Unresolvable chassis ref → never auto-repaired.
    const custom = makeMech({
      chassisRef: 'Custom Chassis',
      conditions: [CHASSIS_DAMAGED_CONDITION],
    })
    expect(repairableItems(custom, 6).chassisRepairable).toBe(false)
  })
})

describe('downtimeMechPatch', () => {
  it('restores SP/EP to derived max and Heat to 0', () => {
    const mech = makeMech({ currentSP: 2, currentEP: 1, currentHeat: 4 })
    const patch = downtimeMechPatch(mech, 3, allDowntimeSteps())
    // Mule chassis: SP 12 (pinned against real data via derivedStats).
    expect(patch.currentSP).toBeDefined()
    expect(patch.currentSP).toBeGreaterThan(2)
    expect(patch.currentEP).toBeDefined()
    expect(patch.currentEP).toBeGreaterThan(1)
    expect(patch.currentHeat).toBe(0)
  })

  it('produces an empty patch when everything is already at rest', () => {
    const mech = makeMech()
    expect(downtimeMechPatch(mech, 3, allDowntimeSteps())).toEqual({})
  })

  it('a non-operational Mech Bay blocks restore + repair but not Uses recharge (p.221)', () => {
    const mech = makeMech({
      currentSP: 2,
      currentEP: 1,
      currentHeat: 4,
      systemConditions: { [TL1_SYSTEM]: 'damaged' },
      conditions: [CHASSIS_DAMAGED_CONDITION],
      itemUses: { [TL1_SYSTEM]: 1 },
    })
    const patch = downtimeMechPatch(mech, 3, allDowntimeSteps(), { operational: false })
    // No SP/EP/Heat restore, no repairs…
    expect(patch.currentSP).toBeUndefined()
    expect(patch.currentEP).toBeUndefined()
    expect(patch.currentHeat).toBeUndefined()
    expect(patch.systemConditions).toBeUndefined()
    expect(patch.conditions).toBeUndefined()
    // …but Uses still recharge (Downtime rest, not the bay).
    expect(patch.itemUses).toEqual({})
  })

  it('an operational Mech Bay passed explicitly behaves like the default', () => {
    const mech = makeMech({ currentSP: 2, currentHeat: 4 })
    const gated = downtimeMechPatch(mech, 3, allDowntimeSteps(), { operational: true })
    const defaulted = downtimeMechPatch(mech, 3, allDowntimeSteps())
    expect(gated).toEqual(defaulted)
  })

  it('repairs damaged system/module conditions and clears Chassis Damaged', () => {
    const highTl = findHighTlSystemName(5)
    const mech = makeMech({
      systemConditions: { [TL1_SYSTEM]: 'damaged', [highTl]: 'damaged' },
      moduleConditions: { [TL1_MODULE]: 'damaged' },
      conditions: ['Prone', CHASSIS_DAMAGED_CONDITION],
    })
    const patch = downtimeMechPatch(mech, 3, allDowntimeSteps())
    expect(patch.systemConditions).toEqual({ [TL1_SYSTEM]: 'intact', [highTl]: 'damaged' })
    expect(patch.moduleConditions).toEqual({ [TL1_MODULE]: 'intact' })
    expect(patch.conditions).toEqual(['Prone'])
  })

  it('leaves destroyed item conditions untouched', () => {
    const mech = makeMech({
      systemConditions: { [TL1_SYSTEM]: 'destroyed' },
    })
    const patch = downtimeMechPatch(mech, 6, allDowntimeSteps())
    expect(patch.systemConditions).toBeUndefined()
  })

  it('recharges itemUses by clearing the map (absent = full)', () => {
    const mech = makeMech({ itemUses: { [TL1_SYSTEM]: 1 } })
    const patch = downtimeMechPatch(mech, 3, allDowntimeSteps())
    expect(patch.itemUses).toEqual({})
  })

  it('skips a Destroyed mech entirely', () => {
    const mech = makeMech({ destroyed: true, currentSP: 0, currentHeat: 9, itemUses: { a: 0 } })
    expect(downtimeMechPatch(mech, 6, allDowntimeSteps())).toEqual({})
  })

  it('applies nothing when every step is skipped', () => {
    const mech = makeMech({
      currentSP: 1,
      currentHeat: 5,
      systemConditions: { [TL1_SYSTEM]: 'damaged' },
      itemUses: { [TL1_SYSTEM]: 0 },
    })
    expect(downtimeMechPatch(mech, 6, noSteps())).toEqual({})
  })

  it('honours individual step toggles (repair off, restore on)', () => {
    const mech = makeMech({
      currentHeat: 5,
      systemConditions: { [TL1_SYSTEM]: 'damaged' },
    })
    const patch = downtimeMechPatch(mech, 6, { ...allDowntimeSteps(), repairItems: false })
    expect(patch.currentHeat).toBe(0)
    expect(patch.systemConditions).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// healableInjuries / downtimePilotPatch
// ---------------------------------------------------------------------------

describe('healableInjuries', () => {
  const injured = makePilot({
    injuries: [
      { severity: 'minor', note: 'sprain' },
      { severity: 'major', note: 'break' },
    ],
  })

  it('counts per the Med Bay bands', () => {
    expect(healableInjuries(injured, medBay())).toEqual({ minor: 1, major: 1, remaining: 0 })
    expect(healableInjuries(injured, medBay({ healsMajor: false }))).toEqual({
      minor: 1,
      major: 0,
      remaining: 1,
    })
    expect(
      healableInjuries(
        injured,
        medBay({ operational: false, healsMinor: false, healsMajor: false })
      )
    ).toEqual({ minor: 0, major: 0, remaining: 2 })
  })
})

describe('downtimePilotPatch', () => {
  it('heals injuries per the Med Bay bands, then restores HP to the RECOVERED max', () => {
    const pilot = makePilot({
      currentHP: 3,
      injuries: [
        { severity: 'minor', note: 'sprain' },
        { severity: 'major', note: 'break' },
      ],
    })
    // Tech 3-4 bay: minor heals, major stays → maxHP = 10 − 2 = 8.
    const patch = downtimePilotPatch(pilot, medBay({ healsMajor: false }), allDowntimeSteps())
    expect(patch.injuries).toEqual([{ severity: 'major', note: 'break' }])
    expect(patch.currentHP).toBe(8)
  })

  it('heals major and minor injuries at Tech 5-6 and restores to full base HP', () => {
    const pilot = makePilot({
      currentHP: 0,
      injuries: [
        { severity: 'minor', note: 'sprain' },
        { severity: 'major', note: 'break' },
      ],
    })
    const patch = downtimePilotPatch(pilot, medBay(), allDowntimeSteps())
    expect(patch.injuries).toEqual([])
    expect(patch.currentHP).toBe(10)
  })

  it('restores AP but NOT HP or injuries when the Med Bay is not operational', () => {
    const pilot = makePilot({
      currentHP: 2,
      currentAP: 1,
      injuries: [{ severity: 'minor', note: 'sprain' }],
    })
    const offline = medBay({
      damaged: true,
      operational: false,
      healsMinor: false,
      healsMajor: false,
    })
    const patch = downtimePilotPatch(pilot, offline, allDowntimeSteps())
    expect(patch.currentAP).toBe(5)
    expect(patch.currentHP).toBeUndefined()
    expect(patch.injuries).toBeUndefined()
  })

  it('respects maxHpModifier/maxApModifier in the restored values', () => {
    const pilot = makePilot({ currentHP: 1, currentAP: 0, maxHpModifier: 2, maxApModifier: 1 })
    const patch = downtimePilotPatch(pilot, medBay(), allDowntimeSteps())
    expect(patch.currentHP).toBe(12)
    expect(patch.currentAP).toBe(6)
  })

  it('adds exactly +1 Training Point (absent reads as 0)', () => {
    expect(downtimePilotPatch(makePilot(), medBay(), allDowntimeSteps()).trainingPoints).toBe(1)
    expect(
      downtimePilotPatch(makePilot({ trainingPoints: 3 }), medBay(), allDowntimeSteps())
        .trainingPoints
    ).toBe(4)
  })

  it('recharges equipmentUses but keeps the Orbital Lance Controller count', () => {
    const pilot = makePilot({
      equipmentUses: { 'First Aid Kit': 0, [ORBITAL_LANCE]: 1 },
    })
    const patch = downtimePilotPatch(pilot, medBay(), allDowntimeSteps())
    expect(patch.equipmentUses).toEqual({ [ORBITAL_LANCE]: 1 })
  })

  it('keeps the Orbital Lance exception when keyed by equipment id', () => {
    const lanceId = SalvageUnionReference.Equipment.find((e) => e.name === ORBITAL_LANCE)?.id
    expect(lanceId).toBeDefined()
    const pilot = makePilot({ equipmentUses: { 'First Aid Kit': 2, [lanceId!]: 2 } })
    const patch = downtimePilotPatch(pilot, medBay(), allDowntimeSteps())
    expect(patch.equipmentUses).toEqual({ [lanceId!]: 2 })
  })

  it('omits equipmentUses when nothing recharges', () => {
    const pilot = makePilot({ equipmentUses: { [ORBITAL_LANCE]: 1 } })
    const patch = downtimePilotPatch(pilot, medBay(), allDowntimeSteps())
    expect(patch.equipmentUses).toBeUndefined()
  })

  it('clears usedAbilities and the once-per-Downtime usedToggles', () => {
    const pilot = makePilot({
      usedAbilities: ['power-slide'],
      usedToggles: { background: true, motto: false },
    })
    const patch = downtimePilotPatch(pilot, medBay(), allDowntimeSteps())
    expect(patch.usedAbilities).toEqual([])
    expect(patch.usedToggles).toEqual({})
  })

  it('produces an empty patch for a rested pilot with training skipped', () => {
    const pilot = makePilot()
    const patch = downtimePilotPatch(pilot, medBay(), {
      ...allDowntimeSteps(),
      trainPilots: false,
    })
    expect(patch).toEqual({})
  })

  it('applies nothing when every step is skipped', () => {
    const pilot = makePilot({
      currentHP: 1,
      currentAP: 0,
      injuries: [{ severity: 'minor', note: 'sprain' }],
      usedAbilities: ['x'],
      usedToggles: { keepsake: true },
      equipmentUses: { 'First Aid Kit': 0 },
    })
    expect(downtimePilotPatch(pilot, medBay(), noSteps())).toEqual({})
  })
})
