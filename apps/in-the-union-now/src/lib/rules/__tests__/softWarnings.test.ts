/**
 * Unit tests for softWarnings.ts — non-blocking rule violation detection (AC-5, REQ-012).
 *
 * All tests use hand-crafted fixtures — soft warnings are intentionally
 * independent of salvageunion-reference data so they can be tested in
 * complete isolation.
 */
import { describe, expect, it } from 'bun:test'
import { evaluateSoftWarnings, evaluatePilotWarnings, evaluateMechWarnings } from '../softWarnings'
import type { EditSnapshot, MechSnapshot, PilotSnapshot, SoftWarningContext } from '../types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const basePilot: PilotSnapshot = {
  level: 2,
  abilities: [{ ref: 'Basic Training', minLevel: 1 }],
}

const baseMech: MechSnapshot = {
  techLevel: 2,
  systems: [{ ref: 'Locomotion System' }],
}

const pilotCtx: SoftWarningContext = { entityType: 'pilot' }
const mechCtx: SoftWarningContext = { entityType: 'mech' }
const crawlerCtx: SoftWarningContext = { entityType: 'crawler' }

// ---------------------------------------------------------------------------
// Pilot warnings — ability prerequisite
// ---------------------------------------------------------------------------

describe('evaluatePilotWarnings — ability prerequisite', () => {
  it('returns no warnings when no new abilities are added', () => {
    const snapshot: EditSnapshot<PilotSnapshot> = { before: basePilot, after: basePilot }
    const warnings = evaluatePilotWarnings(snapshot, pilotCtx)
    expect(warnings).toHaveLength(0)
  })

  it('returns no warnings when a new ability has a met minLevel requirement', () => {
    const after: PilotSnapshot = {
      level: 4,
      abilities: [...basePilot.abilities, { ref: 'Advanced Strike', minLevel: 3 }],
    }
    const snapshot: EditSnapshot<PilotSnapshot> = { before: basePilot, after }
    const warnings = evaluatePilotWarnings(snapshot, pilotCtx)
    expect(warnings).toHaveLength(0)
  })

  it('warns when a new ability has an unmet minLevel requirement', () => {
    const after: PilotSnapshot = {
      level: 2,
      abilities: [...basePilot.abilities, { ref: 'Legendary Strike', minLevel: 4 }],
    }
    const snapshot: EditSnapshot<PilotSnapshot> = { before: basePilot, after }
    const warnings = evaluatePilotWarnings(snapshot, pilotCtx)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.code).toBe('ABILITY_LEVEL_PREREQUISITE')
    expect(warnings[0]?.severity).toBe('warn')
    expect(warnings[0]?.message).toContain('Legendary Strike')
    expect(warnings[0]?.message).toContain('level 4')
    expect(warnings[0]?.message).toContain('level 2')
  })

  it('warns once per unmet prerequisite ability', () => {
    const after: PilotSnapshot = {
      level: 1,
      abilities: [
        ...basePilot.abilities,
        { ref: 'Power Surge', minLevel: 3 },
        { ref: 'Ultra Strike', minLevel: 5 },
      ],
    }
    const snapshot: EditSnapshot<PilotSnapshot> = { before: basePilot, after }
    const warnings = evaluatePilotWarnings(snapshot, pilotCtx)

    // Two new abilities, both unmet → two warnings
    expect(warnings.filter((w) => w.code === 'ABILITY_LEVEL_PREREQUISITE')).toHaveLength(2)
  })

  it('does not re-warn for abilities already present in the before snapshot', () => {
    const pilotWithHighAbility: PilotSnapshot = {
      level: 1,
      abilities: [{ ref: 'Overpower', minLevel: 4 }],
    }
    const snapshot: EditSnapshot<PilotSnapshot> = {
      before: pilotWithHighAbility,
      after: pilotWithHighAbility, // same — no new abilities
    }
    const warnings = evaluatePilotWarnings(snapshot, pilotCtx)
    expect(warnings).toHaveLength(0)
  })

  it('does not warn for abilities with no minLevel set', () => {
    const after: PilotSnapshot = {
      level: 1,
      abilities: [...basePilot.abilities, { ref: 'Free Ability' }], // no minLevel
    }
    const snapshot: EditSnapshot<PilotSnapshot> = { before: basePilot, after }
    const warnings = evaluatePilotWarnings(snapshot, pilotCtx)
    expect(warnings).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Mech warnings — system dependency
// ---------------------------------------------------------------------------

describe('evaluateMechWarnings — system dependency', () => {
  it('returns no warnings when no systems are removed', () => {
    const snapshot: EditSnapshot<MechSnapshot> = { before: baseMech, after: baseMech }
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
    const ctx: SoftWarningContext = { entityType: 'mech', techLevelDowngraded: true }
    const snapshot: EditSnapshot<MechSnapshot> = { before: baseMech, after: baseMech }
    const warnings = evaluateSoftWarnings(snapshot.before, snapshot.after, ctx)

    expect(warnings.some((w) => w.code === 'TECH_LEVEL_DOWNGRADE')).toBe(true)
  })

  it('adds an additional warning when scrap refund is skipped', () => {
    const ctx: SoftWarningContext = {
      entityType: 'mech',
      techLevelDowngraded: true,
      scrapRefundSkipped: true,
    }
    const snapshot: EditSnapshot<MechSnapshot> = { before: baseMech, after: baseMech }
    const warnings = evaluateSoftWarnings(snapshot.before, snapshot.after, ctx)

    expect(warnings.some((w) => w.code === 'TECH_LEVEL_DOWNGRADE')).toBe(true)
    expect(warnings.some((w) => w.code === 'TECH_LEVEL_DOWNGRADE_NO_REFUND')).toBe(true)
  })

  it('does not warn when techLevelDowngraded is false', () => {
    const ctx: SoftWarningContext = { entityType: 'mech', techLevelDowngraded: false }
    const snapshot: EditSnapshot<MechSnapshot> = { before: baseMech, after: baseMech }
    const warnings = evaluateSoftWarnings(snapshot.before, snapshot.after, ctx)

    expect(warnings.filter((w) => w.code === 'TECH_LEVEL_DOWNGRADE')).toHaveLength(0)
  })

  it('warns on tech-level downgrade for a crawler', () => {
    const ctx: SoftWarningContext = { entityType: 'crawler', techLevelDowngraded: true }
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
      level: 1,
      abilities: [...basePilot.abilities, { ref: 'High Level Ability', minLevel: 5 }],
    }
    const warnings = evaluateSoftWarnings(basePilot, after, pilotCtx)
    expect(warnings.some((w) => w.code === 'ABILITY_LEVEL_PREREQUISITE')).toBe(true)
  })

  it('dispatches mech warnings correctly', () => {
    const before: MechSnapshot = {
      systems: [
        { ref: 'Core', requires: [] },
        { ref: 'Weapon', requires: ['Core'] },
      ],
    }
    const after: MechSnapshot = { systems: [{ ref: 'Weapon', requires: ['Core'] }] }
    const warnings = evaluateSoftWarnings(before, after, mechCtx)
    expect(warnings.some((w) => w.code === 'SYSTEM_DEPENDENCY_REMOVED')).toBe(true)
  })

  it('returns empty array for pilot with no new abilities and no downgrade', () => {
    const warnings = evaluateSoftWarnings(basePilot, basePilot, pilotCtx)
    expect(warnings).toHaveLength(0)
  })

  it('returns empty array for crawler with no downgrade', () => {
    const fakeCrawler: MechSnapshot = { systems: [] }
    const warnings = evaluateSoftWarnings(fakeCrawler, fakeCrawler, crawlerCtx)
    expect(warnings).toHaveLength(0)
  })
})
