/**
 * Ref resolution (slug canonical; legacy name/id tolerated) — audit item 1.
 * Uses real reference data: preloaded via the shared test preload.
 */
import { describe, expect, test } from 'bun:test'
import { getEntitySlug, SalvageUnionReference } from '../index.js'
import {
  matchesRef,
  resolveChassisRef,
  resolveInstalledRef,
  resolveRef,
  resolveSystemRef,
} from './resolveRefs.js'

const anyChassis = () => {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  if (!chassis) throw new Error('reference data not loaded')
  return chassis
}

const anySystem = () => {
  const system = SalvageUnionReference.Systems.all()[0]
  if (!system) throw new Error('reference data not loaded')
  return system
}

describe('resolveRefs', () => {
  // Own preload — CI runs test files in a different order than local, and
  // this file must not depend on another file having loaded the schemas.
  test('resolves a chassis by slug (canonical form)', () => {
    const chassis = anyChassis()
    expect(resolveChassisRef(getEntitySlug(chassis))?.id).toBe(chassis.id)
  })

  test('resolves a chassis by legacy name and by id', () => {
    const chassis = anyChassis()
    expect(resolveChassisRef(chassis.name)?.id).toBe(chassis.id)
    expect(resolveChassisRef(chassis.id)?.id).toBe(chassis.id)
  })

  test('resolves an installed system by slug, name, and id', () => {
    const system = anySystem()
    expect(resolveSystemRef(getEntitySlug(system))?.id).toBe(system.id)
    expect(resolveInstalledRef(system.name)?.id).toBe(system.id)
    expect(resolveInstalledRef(system.id)?.id).toBe(system.id)
  })

  test('returns null for unresolvable refs instead of throwing', () => {
    expect(resolveChassisRef('no-such-chassis-xyz')).toBeNull()
    expect(resolveInstalledRef('')).toBeNull()
  })

  test('matchesRef never matches an empty ref against a named entity', () => {
    expect(matchesRef({ id: 'abc', name: 'Welding Rig' }, '')).toBe(false)
  })
})

/**
 * `resolveRef` is the exported, indexed replacement for
 * `SomeModel.find((e) => matchesRef(e, ref))` — the predicate form that spread
 * full-schema scans across the apps. It must answer identically.
 */
describe('resolveRef', () => {
  test('resolves by slug, name and id, on any model', () => {
    const chassis = anyChassis()
    for (const ref of [getEntitySlug(chassis), chassis.name, chassis.id]) {
      expect(resolveRef(SalvageUnionReference.Chassis, ref)).toBe(chassis)
    }
  })

  test('agrees with the matchesRef predicate it replaces, across a whole model', () => {
    const abilities = SalvageUnionReference.Abilities.all()
    expect(abilities.length).toBeGreaterThan(50)
    for (const ability of abilities) {
      for (const ref of [ability.id, ability.name, getEntitySlug(ability)]) {
        expect(resolveRef(SalvageUnionReference.Abilities, ref)).toBe(
          SalvageUnionReference.Abilities.find((a) => matchesRef(a, ref)) as never
        )
      }
    }
  })

  test('returns null rather than throwing on an unresolvable ref', () => {
    expect(resolveRef(SalvageUnionReference.Abilities, 'no-such-ability-xyz')).toBeNull()
    expect(resolveRef(SalvageUnionReference.Abilities, '')).toBeNull()
  })
})
