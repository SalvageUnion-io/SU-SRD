/**
 * Unit tests for softWarnings.ts — non-blocking rule violation detection
 * (REQ-012; advancement prerequisites per plan S5 / 3.3–3.4).
 *
 * All tests use hand-crafted fixtures — soft warnings are intentionally
 * independent of salvageunion-reference data so they can be tested in
 * complete isolation (enrichment is pilotSnapshot.ts's job).
 */
import { describe, expect, it } from 'bun:test'
import {
  evaluateMechWarnings,
  evaluatePilotWarnings,
  evaluateSoftWarnings,
  PILOT_ABILITY_CAP,
  SALVAGER_ABILITY_CAP,
} from './softWarnings.js'
import type {
  AbilityInput,
  EditSnapshot,
  MechSnapshot,
  PilotSnapshot,
  SoftWarningContext,
} from './types.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function core(ref: string, tree: string, level: number): AbilityInput {
  return { ref, name: ref, tree, level, tier: 'core' }
}

function adv(ref: string, tree = 'Advanced Engineer', level = 1): AbilityInput {
  return { ref, name: ref, tree, level, tier: 'advanced' }
}

function leg(ref: string, tree = 'Legendary Engineer'): AbilityInput {
  return { ref, name: ref, tree, level: 'L', tier: 'legendary' }
}

/** A pilot with two complete core trees (6 core abilities). */
function sixCorePilot(extra: AbilityInput[] = []): PilotSnapshot {
  return {
    abilities: [
      core('A1', 'Mechanical Knowledge', 1),
      core('A2', 'Mechanical Knowledge', 2),
      core('A3', 'Mechanical Knowledge', 3),
      core('B1', 'Forging', 1),
      core('B2', 'Forging', 2),
      core('B3', 'Forging', 3),
      ...extra,
    ],
    classTier: 'base',
  }
}

const basePilot: PilotSnapshot = {
  abilities: [core('Basic Training', 'Mechanical Knowledge', 1)],
  classTier: 'base',
}

const baseMech: MechSnapshot = {
  techLevel: 2,
  systems: [{ ref: 'Locomotion System' }],
}

const pilotCtx: SoftWarningContext = { entityType: 'pilot' }
const mechCtx: SoftWarningContext = { entityType: 'mech' }
const crawlerCtx: SoftWarningContext = { entityType: 'crawler' }

function evalPilot(before: PilotSnapshot, after: PilotSnapshot) {
  const snapshot: EditSnapshot<PilotSnapshot> = { before, after }
  return evaluatePilotWarnings(snapshot, pilotCtx)
}

// ---------------------------------------------------------------------------
// Pilot warnings — tree order
// ---------------------------------------------------------------------------

describe('evaluatePilotWarnings — tree order', () => {
  it('returns no warnings for an in-order tree', () => {
    const after: PilotSnapshot = {
      abilities: [core('A1', 'Forging', 1), core('A2', 'Forging', 2)],
    }
    expect(evalPilot(basePilot, after)).toHaveLength(0)
  })

  it('warns when a level-2 ability is taken without level 1 of its tree', () => {
    const after: PilotSnapshot = {
      abilities: [core('Mech-Gyver', 'Forging', 2)],
    }
    const warnings = evalPilot(basePilot, after)
    expect(warnings.some((w) => w.code === 'ABILITY_TREE_ORDER')).toBe(true)
    const warning = warnings.find((w) => w.code === 'ABILITY_TREE_ORDER')
    expect(warning?.severity).toBe('warn')
    expect(warning?.message).toContain('Mech-Gyver')
    expect(warning?.message).toContain('Forging')
  })

  it('lists every missing lower level', () => {
    const after: PilotSnapshot = {
      abilities: [core('Auto-Turret', 'Forging', 3)],
    }
    const warnings = evalPilot(basePilot, after)
    const warning = warnings.find((w) => w.code === 'ABILITY_TREE_ORDER')
    expect(warning?.message).toContain('1 and 2')
  })

  it('skips un-enriched abilities (no tree/level data)', () => {
    const after: PilotSnapshot = {
      abilities: [{ ref: 'mystery-slug' }],
    }
    expect(evalPilot(basePilot, after)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Pilot warnings — advanced / legendary gates
// ---------------------------------------------------------------------------

describe('evaluatePilotWarnings — advanced gate', () => {
  it('no warning when 6 core abilities incl. a complete tree are present', () => {
    const after = sixCorePilot([adv('Union Engineer')])
    expect(
      evalPilot(basePilot, after).filter((w) => w.code === 'ADVANCED_ABILITY_PREREQUISITE')
    ).toHaveLength(0)
  })

  it('warns when an advanced ability is taken without 6 core abilities', () => {
    const after: PilotSnapshot = {
      abilities: [core('A1', 'Forging', 1), adv('Union Engineer')],
    }
    const warnings = evalPilot(basePilot, after)
    const warning = warnings.find((w) => w.code === 'ADVANCED_ABILITY_PREREQUISITE')
    expect(warning).toBeDefined()
    expect(warning?.message).toContain('Union Engineer')
    expect(warning?.message).toContain('6 Core')
  })

  it('warns when 6 core abilities exist but no tree is complete', () => {
    const after: PilotSnapshot = {
      abilities: [
        core('A1', 'Mechanical Knowledge', 1),
        core('A2', 'Mechanical Knowledge', 2),
        core('B1', 'Forging', 1),
        core('B2', 'Forging', 2),
        core('C1', 'Mech-Tech', 1),
        core('C2', 'Mech-Tech', 2),
        adv('Union Engineer'),
      ],
    }
    expect(
      evalPilot(basePilot, after).some((w) => w.code === 'ADVANCED_ABILITY_PREREQUISITE')
    ).toBe(true)
  })
})

describe('evaluatePilotWarnings — legendary gates', () => {
  it('no warning when 6 core + 3 advanced are present', () => {
    const after = sixCorePilot([
      adv('X1', 'Advanced Engineer', 1),
      adv('X2', 'Advanced Engineer', 2),
      adv('X3', 'Advanced Engineer', 3),
      leg('Omega'),
    ])
    expect(
      evalPilot(basePilot, after).filter((w) => w.code === 'LEGENDARY_ABILITY_PREREQUISITE')
    ).toHaveLength(0)
  })

  it('warns when a legendary ability lacks the 6-core + 3-advanced gate', () => {
    const after = sixCorePilot([leg('Omega')])
    const warning = evalPilot(basePilot, after).find(
      (w) => w.code === 'LEGENDARY_ABILITY_PREREQUISITE'
    )
    expect(warning).toBeDefined()
    expect(warning?.message).toContain('Omega')
  })

  it('warns when more than one legendary ability is held', () => {
    const after = sixCorePilot([
      adv('X1', 'Advanced Engineer', 1),
      adv('X2', 'Advanced Engineer', 2),
      adv('X3', 'Advanced Engineer', 3),
      leg('Omega'),
      leg('Alpha', 'Legendary Hauler'),
    ])
    expect(evalPilot(basePilot, after).some((w) => w.code === 'ONE_LEGENDARY_LIMIT')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Pilot warnings — class prerequisite
// ---------------------------------------------------------------------------

describe('evaluatePilotWarnings — class prerequisite', () => {
  it('warns when switching to an advanced/hybrid class without the 6-core gate', () => {
    const after: PilotSnapshot = {
      abilities: basePilot.abilities,
      classTier: 'advanced-hybrid',
      className: 'Cyborg',
    }
    const warning = evalPilot(basePilot, after).find((w) => w.code === 'CLASS_PREREQUISITE')
    expect(warning).toBeDefined()
    expect(warning?.message).toContain('Cyborg')
  })

  it('no warning when the gate is met', () => {
    const after: PilotSnapshot = {
      ...sixCorePilot(),
      classTier: 'advanced-hybrid',
      className: 'Cyborg',
    }
    expect(
      evalPilot(sixCorePilot(), after).filter((w) => w.code === 'CLASS_PREREQUISITE')
    ).toHaveLength(0)
  })

  it('does not re-warn a pilot who was already specialised', () => {
    const specialised: PilotSnapshot = {
      abilities: basePilot.abilities,
      classTier: 'advanced-hybrid',
      className: 'Cyborg',
    }
    expect(
      evalPilot(specialised, specialised).filter((w) => w.code === 'CLASS_PREREQUISITE')
    ).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Pilot warnings — ability count soft cap (plan 2.2: schema caps lifted)
// ---------------------------------------------------------------------------

describe('evaluatePilotWarnings — ability count cap', () => {
  function pilotWithAbilities(count: number, isSalvager = false): PilotSnapshot {
    return {
      abilities: Array.from({ length: count }, (_, i) => ({
        ref: `Ability ${i}`,
      })),
      isSalvager,
    }
  }

  it('no warning at the cap (10)', () => {
    const after = pilotWithAbilities(PILOT_ABILITY_CAP)
    const warnings = evaluatePilotWarnings({ before: after, after }, pilotCtx)
    expect(warnings.filter((w) => w.code === 'PILOT_ABILITY_CAP_EXCEEDED')).toHaveLength(0)
  })

  it('warns beyond 10 abilities', () => {
    const after = pilotWithAbilities(PILOT_ABILITY_CAP + 1)
    const warnings = evaluatePilotWarnings({ before: after, after }, pilotCtx)
    expect(warnings.some((w) => w.code === 'PILOT_ABILITY_CAP_EXCEEDED')).toBe(true)
  })

  it('Salvager cap is 12', () => {
    const at12 = pilotWithAbilities(SALVAGER_ABILITY_CAP, true)
    expect(
      evaluatePilotWarnings({ before: at12, after: at12 }, pilotCtx).filter(
        (w) => w.code === 'PILOT_ABILITY_CAP_EXCEEDED'
      )
    ).toHaveLength(0)

    const at13 = pilotWithAbilities(SALVAGER_ABILITY_CAP + 1, true)
    expect(
      evaluatePilotWarnings({ before: at13, after: at13 }, pilotCtx).some(
        (w) => w.code === 'PILOT_ABILITY_CAP_EXCEEDED'
      )
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mech warnings — system dependency
// ---------------------------------------------------------------------------

describe('evaluateMechWarnings — system dependency', () => {
  it('returns no warnings when no systems are removed', () => {
    const snapshot: EditSnapshot<MechSnapshot> = {
      before: baseMech,
      after: baseMech,
    }
    const warnings = evaluateMechWarnings(snapshot, mechCtx)
    expect(warnings).toHaveLength(0)
  })

  it('warns when a system that another system depends on is removed', () => {
    const before: MechSnapshot = {
      systems: [{ ref: 'Power Core' }, { ref: 'Laser Cannon', requires: ['Power Core'] }],
    }
    const after: MechSnapshot = {
      systems: [{ ref: 'Laser Cannon', requires: ['Power Core'] }], // Power Core removed
    }
    const snapshot: EditSnapshot<MechSnapshot> = { before, after }
    const warnings = evaluateMechWarnings(snapshot, mechCtx)

    expect(warnings.some((w) => w.code === 'SYSTEM_DEPENDENCY_REMOVED')).toBe(true)
    const warning = warnings.find((w) => w.code === 'SYSTEM_DEPENDENCY_REMOVED')
    expect(warning?.severity).toBe('warn')
    expect(warning?.message).toContain('Laser Cannon')
    expect(warning?.message).toContain('Power Core')
  })

  it('does not warn when removed system has no dependents', () => {
    const before: MechSnapshot = {
      systems: [{ ref: 'Locomotion System' }, { ref: 'Armour Plating' }],
    }
    const after: MechSnapshot = {
      systems: [{ ref: 'Armour Plating' }], // Locomotion removed, nobody depends on it
    }
    const snapshot: EditSnapshot<MechSnapshot> = { before, after }
    const warnings = evaluateMechWarnings(snapshot, mechCtx)
    expect(warnings.filter((w) => w.code === 'SYSTEM_DEPENDENCY_REMOVED')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Tech-level downgrade warning
// ---------------------------------------------------------------------------

describe('evaluateSoftWarnings — tech-level downgrade', () => {
  it('warns on tech-level downgrade for a mech', () => {
    const ctx: SoftWarningContext = {
      entityType: 'mech',
      techLevelDowngraded: true,
    }
    const snapshot: EditSnapshot<MechSnapshot> = {
      before: baseMech,
      after: baseMech,
    }
    const warnings = evaluateSoftWarnings(snapshot.before, snapshot.after, ctx)

    expect(warnings.some((w) => w.code === 'TECH_LEVEL_DOWNGRADE')).toBe(true)
  })

  it('adds an additional warning when scrap refund is skipped', () => {
    const ctx: SoftWarningContext = {
      entityType: 'mech',
      techLevelDowngraded: true,
      scrapRefundSkipped: true,
    }
    const snapshot: EditSnapshot<MechSnapshot> = {
      before: baseMech,
      after: baseMech,
    }
    const warnings = evaluateSoftWarnings(snapshot.before, snapshot.after, ctx)

    expect(warnings.some((w) => w.code === 'TECH_LEVEL_DOWNGRADE')).toBe(true)
    expect(warnings.some((w) => w.code === 'TECH_LEVEL_DOWNGRADE_NO_REFUND')).toBe(true)
  })

  it('does not warn when techLevelDowngraded is false', () => {
    const ctx: SoftWarningContext = {
      entityType: 'mech',
      techLevelDowngraded: false,
    }
    const snapshot: EditSnapshot<MechSnapshot> = {
      before: baseMech,
      after: baseMech,
    }
    const warnings = evaluateSoftWarnings(snapshot.before, snapshot.after, ctx)

    expect(warnings.filter((w) => w.code === 'TECH_LEVEL_DOWNGRADE')).toHaveLength(0)
  })

  it('warns on tech-level downgrade for a crawler', () => {
    const ctx: SoftWarningContext = {
      entityType: 'crawler',
      techLevelDowngraded: true,
    }
    const fakeCrawler: MechSnapshot = { systems: [] }
    const warnings = evaluateSoftWarnings(fakeCrawler, fakeCrawler, ctx)

    expect(warnings.some((w) => w.code === 'TECH_LEVEL_DOWNGRADE')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// evaluateSoftWarnings — dispatch
// ---------------------------------------------------------------------------

describe('evaluateSoftWarnings — dispatch by entityType', () => {
  it('dispatches pilot warnings correctly', () => {
    const after: PilotSnapshot = {
      abilities: [core('Out of Order', 'Forging', 3)],
    }
    const warnings = evaluateSoftWarnings(basePilot, after, pilotCtx)
    expect(warnings.some((w) => w.code === 'ABILITY_TREE_ORDER')).toBe(true)
  })

  it('dispatches mech warnings correctly', () => {
    const before: MechSnapshot = {
      systems: [
        { ref: 'Core', requires: [] },
        { ref: 'Weapon', requires: ['Core'] },
      ],
    }
    const after: MechSnapshot = {
      systems: [{ ref: 'Weapon', requires: ['Core'] }],
    }
    const warnings = evaluateSoftWarnings(before, after, mechCtx)
    expect(warnings.some((w) => w.code === 'SYSTEM_DEPENDENCY_REMOVED')).toBe(true)
  })

  it('returns empty array for an unchanged in-order pilot', () => {
    const warnings = evaluateSoftWarnings(basePilot, basePilot, pilotCtx)
    expect(warnings).toHaveLength(0)
  })

  it('returns empty array for crawler with no downgrade', () => {
    const fakeCrawler: MechSnapshot = { systems: [] }
    const warnings = evaluateSoftWarnings(fakeCrawler, fakeCrawler, crawlerCtx)
    expect(warnings).toHaveLength(0)
  })
})
