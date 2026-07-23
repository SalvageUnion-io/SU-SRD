/**
 * `resolveNestedEntities` and its siblings are the single collection point for
 * every nested entity a card surfaces — grants, chassis-ability drones, a
 * crawler's embedded commander, and a pattern's systems/modules/drone loadout.
 * If a resolver silently returns nothing the card renders a *plausible* page
 * with the nested content missing, which is exactly the failure mode that made
 * roll tables vanish (see `resolveCardTable.test.tsx`). These tests pin the
 * grouping, the name -> entity resolution, and the "nothing to resolve" exits.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity, SURefMetaEntity, SURefObjectPattern } from 'salvageunion-reference'
import {
  resolveChassisDrone,
  resolveDroneOwnLoadout,
  resolveNestedEntities,
  resolvePatternDrone,
  resolvePatternGroups,
} from '../resolveNestedEntities'

const chassis = (name: string): SURefMetaEntity => {
  const match = SalvageUnionReference.Chassis.all().find((c) => c.name === name)
  if (!match) throw new Error(`fixture missing: chassis ${name}`)
  return match as SURefMetaEntity
}

const pattern = (chassisName: string, patternName: string): SURefObjectPattern => {
  const patterns = (chassis(chassisName) as { patterns?: SURefObjectPattern[] }).patterns ?? []
  const match = patterns.find((p) => p.name === patternName)
  if (!match) throw new Error(`fixture missing: pattern ${chassisName}/${patternName}`)
  return match
}

const names = (entities: readonly SURefEntity[]): string[] =>
  entities.map((e) => ('name' in e && typeof e.name === 'string' ? e.name : '?'))

const group = (groups: ReturnType<typeof resolveNestedEntities>, label: string) =>
  groups.find((g) => g.label === label)

describe('resolveNestedEntities', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('an OBJECT-shaped chassis ability naming a drone resolves it into "Drones"', () => {
    // In the shipped dataset `chassisAbilities` is an array of id STRINGS, so
    // this branch only fires for the object-shaped form the type permits (and
    // that `resolveChassisDrone`, which goes through `getChassisAbilities`,
    // handles for real chassis — see the drone-loadout suite below).
    const groups = resolveNestedEntities({
      chassisAbilities: [
        'some-ability-id',
        { name: 'Controller', drone: 'Sestra Drone' },
        { name: 'No drone here' },
        null,
      ],
    } as unknown as SURefMetaEntity)
    expect(names(group(groups, 'Drones')?.entities ?? [])).toEqual(['Sestra Drone'])
  })

  test('the same drone named by two abilities is listed once', () => {
    const groups = resolveNestedEntities({
      chassisAbilities: [
        { drone: 'Sestra Drone' },
        { drone: 'Sestra Drone' },
        { drone: 'No Such Drone' },
      ],
    } as unknown as SURefMetaEntity)
    expect(group(groups, 'Drones')?.entities).toHaveLength(1)
  })

  test('a chassis carries no embedded commander, so no NPCs group', () => {
    expect(group(resolveNestedEntities(chassis('Big Brother')), 'NPCs')).toBeUndefined()
  })

  test("a crawler's embedded commander is synthesized into an npcs-schema entity", () => {
    const groups = resolveNestedEntities(
      SalvageUnionReference.Crawlers.all().find((c) => c.name === 'Augmented') as SURefMetaEntity
    )
    const npcs = group(groups, 'NPCs')
    expect(npcs).toBeDefined()
    const [commander] = npcs?.entities ?? []
    // The Augmented crawler's commander object carries `position`, not `name` —
    // the resolver has to fall back to it or the group is dropped entirely.
    expect((commander as { name?: string })?.name).toBe('Union Crawler A.I.')
    // Synthesized `schemaName` is what routes it back through the same card.
    expect((commander as { schemaName?: string })?.schemaName).toBe('npcs')
  })

  test('an ability that grants equipment surfaces it under "Grants"', () => {
    const ability = SalvageUnionReference.Abilities.all().find((a) => a.name === 'Auto-Turret')
    if (!ability) throw new Error('fixture missing: Auto-Turret')
    const grants = group(resolveNestedEntities(ability as SURefMetaEntity), 'Grants')
    expect(names(grants?.entities ?? [])).toContain('Auto-Turret')
  })

  test('an entity with nothing nested resolves to no groups at all', () => {
    const plain = SalvageUnionReference.Systems.all().find((s) => s.name === 'Red Laser')
    if (!plain) throw new Error('fixture missing: Red Laser')
    expect(resolveNestedEntities(plain as SURefMetaEntity)).toEqual([])
  })
})

describe('resolvePatternGroups', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test("a pattern's systems, modules and drones each resolve into their own group", () => {
    const groups = resolvePatternGroups(pattern('Little Sestra', 'Surveyor'))
    expect(groups.map((g) => g.label)).toEqual(['Systems', 'Modules', 'Drones'])
    expect(names(group(groups, 'Systems')?.entities ?? [])).toEqual([
      'Green Laser',
      'Escape Hatch',
      'Locomotion System',
      'Tracking Node',
    ])
    expect(names(group(groups, 'Modules')?.entities ?? [])).toEqual([
      'Comms Module',
      'Reactor Flare',
    ])
    expect(names(group(groups, 'Drones')?.entities ?? [])).toEqual(['Sestra Drone'])
  })

  test('a name that resolves to nothing is dropped rather than rendered blank', () => {
    const groups = resolvePatternGroups({
      name: 'Fake',
      systems: [{ name: 'Green Laser' }, { name: 'No Such System' }],
    } as SURefObjectPattern)
    expect(names(group(groups, 'Systems')?.entities ?? [])).toEqual(['Green Laser'])
  })

  test('duplicate entries within a group are de-duplicated', () => {
    const groups = resolvePatternGroups({
      name: 'Fake',
      systems: [{ name: 'Green Laser' }, { name: 'Green Laser' }],
    } as SURefObjectPattern)
    expect(group(groups, 'Systems')?.entities).toHaveLength(1)
  })

  test('an empty pattern yields no groups', () => {
    expect(resolvePatternGroups({ name: 'Fake' } as SURefObjectPattern)).toEqual([])
  })
})

describe('drone loadouts', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test("resolveChassisDrone uses the DRONE's own loadout, not the chassis's", () => {
    const loadout = resolveChassisDrone(chassis('Little Sestra'))
    expect((loadout?.drone as { name?: string })?.name).toBe('Sestra Drone')
    // The Sestra Drone entity ships a single system and no modules of its own;
    // the pattern-specific loadout below is a different, richer list.
    expect(names(loadout?.systems ?? [])).toEqual(['Hover Locomotion System'])
    expect(loadout?.modules).toEqual([])
  })

  test('resolveChassisDrone returns undefined when no ability names a drone', () => {
    const noDrone = SalvageUnionReference.Chassis.all().find(
      (c) => resolveChassisDrone(c as SURefMetaEntity) === undefined
    )
    expect(noDrone).toBeDefined()
    expect(resolveChassisDrone(noDrone as SURefMetaEntity)).toBeUndefined()
  })

  test("resolvePatternDrone resolves the PATTERN's drone loadout by name", () => {
    const loadout = resolvePatternDrone(pattern('Little Sestra', 'Surveyor'))
    expect((loadout?.drone as { name?: string })?.name).toBe('Sestra Drone')
    expect(names(loadout?.systems ?? [])).toEqual([
      'Long Barrelled Green Laser',
      'High Gain Antenna',
      'Cargo Pod',
    ])
    expect(names(loadout?.modules ?? [])).toEqual(['Survey Scanner', 'M315 Motion Scanner'])
  })

  test('resolvePatternDrone returns undefined for a pattern with no drones', () => {
    expect(resolvePatternDrone(pattern('Mule', 'Hauler'))).toBeUndefined()
    expect(resolvePatternDrone({ name: 'Fake' } as SURefObjectPattern)).toBeUndefined()
  })

  test('resolvePatternDrone returns undefined when the named drone does not exist', () => {
    expect(
      resolvePatternDrone({
        name: 'Fake',
        drones: [{ name: 'No Such Drone', systems: [], modules: [] }],
      } as unknown as SURefObjectPattern)
    ).toBeUndefined()
  })

  test("resolveDroneOwnLoadout reads the drone entity's own name arrays", () => {
    const drone = SalvageUnionReference.findIn('drones', (d) => d.name === 'Sestra Drone')
    if (!drone) throw new Error('fixture missing: Sestra Drone')
    const loadout = resolveDroneOwnLoadout(drone as SURefMetaEntity)
    expect(names(loadout.systems)).toEqual(['Hover Locomotion System'])
    expect(loadout.modules).toEqual([])
  })

  test('resolveDroneOwnLoadout tolerates missing / non-array loadout fields', () => {
    expect(resolveDroneOwnLoadout({} as SURefMetaEntity)).toEqual({ systems: [], modules: [] })
    expect(
      resolveDroneOwnLoadout({
        systems: 'Green Laser',
        modules: null,
      } as unknown as SURefMetaEntity)
    ).toEqual({ systems: [], modules: [] })
  })
})
