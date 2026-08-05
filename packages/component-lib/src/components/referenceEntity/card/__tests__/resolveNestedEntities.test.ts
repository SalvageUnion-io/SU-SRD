/**
 * `resolveNestedEntities` and its siblings are the single collection point for
 * every nested entity a card surfaces — grants, chassis-ability drones, a
 * crawler's embedded commander, and a pattern's systems/modules/drone loadout.
 * If a resolver silently returns nothing the card renders a *plausible* page
 * with the nested content missing, which is exactly the failure mode that made
 * roll tables vanish (see `resolveCardTable.test.tsx`). These tests pin the
 * grouping, the name -> entity resolution, and the "nothing to resolve" exits.
 */
import { describe, expect, test } from 'bun:test'
import type { SURefEntity, SURefMetaEntity, SURefObjectPattern } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  resolveChassisDrone,
  resolveDroneOwnLoadout,
  resolveNestedEntities,
  resolvePatternDrones,
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

  test('a `count` renders one card per installed copy', () => {
    // Atlas's Thunder Storm is the printed case: the book's pattern block reads
    // ".50 Cal Machine Gun x6". This resolver used to de-duplicate by entity id,
    // so all six collapsed into one card and the pattern silently under-reported
    // its armament.
    const groups = resolvePatternGroups(pattern('Atlas', 'Thunder Storm'))
    expect(names(group(groups, 'Systems')?.entities ?? [])).toEqual([
      '.50 Cal Machine Gun',
      '.50 Cal Machine Gun',
      '.50 Cal Machine Gun',
      '.50 Cal Machine Gun',
      '.50 Cal Machine Gun',
      '.50 Cal Machine Gun',
      'Armour Plating',
      'Escape Hatch',
      'Locomotion System',
      'Personnel Transport Pod',
      'Shotgun Pit',
    ])
  })

  test('several counted systems in one pattern each keep their own multiplicity', () => {
    // Leviathan's Destroyer is the heaviest case in the dataset: three separate
    // counted weapons, which the old de-dupe flattened to one card each.
    const systems = names(
      group(resolvePatternGroups(pattern('Leviathan', 'Destroyer')), 'Systems')?.entities ?? []
    )
    expect(systems.filter((n) => n === '.50 Cal Machine Gun')).toHaveLength(6)
    expect(systems.filter((n) => n === 'Red Laser')).toHaveLength(3)
    expect(systems.filter((n) => n === '30mm Autocannon')).toHaveLength(2)
  })

  test('a multiple spelled as REPEATED ENTRIES (no `count`) also survives', () => {
    // The data spells multiplicity two ways. Trooper's DronTek lists
    // `Articulated Rigging Arm` and `Chaff Launcher` twice each as separate
    // entries rather than carrying a `count`, so a fix that only reads `count`
    // would still drop these.
    const systems = names(
      group(resolvePatternGroups(pattern('Trooper', 'DronTek')), 'Systems')?.entities ?? []
    )
    expect(systems.filter((n) => n === 'Articulated Rigging Arm')).toHaveLength(2)
    expect(systems.filter((n) => n === 'Chaff Launcher')).toHaveLength(2)
  })

  test('a count of 1 (or none) still renders exactly one card', () => {
    const groups = resolvePatternGroups({
      name: 'Fake',
      systems: [{ name: 'Green Laser', count: 1 }, { name: 'Escape Hatch' }],
    } as SURefObjectPattern)
    expect(names(group(groups, 'Systems')?.entities ?? [])).toEqual(['Green Laser', 'Escape Hatch'])
  })

  test('an explicit `count` of 0 renders nothing, rather than one card', () => {
    // The schema permits 0, and "zero installed" must not be clamped up to one —
    // that would invent a card and diverge from `useChassisPatternConfig`.
    const groups = resolvePatternGroups({
      name: 'Fake',
      systems: [{ name: 'Green Laser', count: 0 }, { name: 'Escape Hatch' }],
    } as SURefObjectPattern)
    expect(names(group(groups, 'Systems')?.entities ?? [])).toEqual(['Escape Hatch'])
  })

  test('a group whose every entry has count 0 is dropped entirely', () => {
    const groups = resolvePatternGroups({
      name: 'Fake',
      systems: [{ name: 'Green Laser', count: 0 }],
    } as SURefObjectPattern)
    expect(group(groups, 'Systems')).toBeUndefined()
  })

  test('a module `count` expands the same way a system count does', () => {
    const groups = resolvePatternGroups({
      name: 'Fake',
      modules: [{ name: 'Comms Module', count: 3 }],
    } as SURefObjectPattern)
    expect(group(groups, 'Modules')?.entities).toHaveLength(3)
  })

  test('an empty pattern yields no groups', () => {
    expect(resolvePatternGroups({ name: 'Fake' } as SURefObjectPattern)).toEqual([])
  })
})

describe('drone loadouts', () => {
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

  test("resolvePatternDrones resolves the PATTERN's drone loadout by name", () => {
    const loadouts = resolvePatternDrones(pattern('Little Sestra', 'Surveyor'))
    expect(loadouts).toHaveLength(1)
    expect((loadouts[0]?.drone as { name?: string })?.name).toBe('Sestra Drone')
    expect(names(loadouts[0]?.systems ?? [])).toEqual([
      'Long Barrelled Green Laser',
      'High Gain Antenna',
      'Cargo Pod',
    ])
    expect(names(loadouts[0]?.modules ?? [])).toEqual(['Survey Scanner', 'M315 Motion Scanner'])
    // No `ref` on this config — the config name IS the stat block, so there is
    // no separate instance name to carry.
    expect(loadouts[0]?.instanceName).toBeUndefined()
  })

  test('resolvePatternDrones returns EVERY drone a pattern fields, not just the first', () => {
    // Big Brother's DronTek pattern fields four. Reading `drones[0]` silently
    // dropped three of them — this is the regression that guards that fix.
    const loadouts = resolvePatternDrones(pattern('Big Brother', 'DronTek'))
    expect(loadouts).toHaveLength(4)
    // Each is an INSTANCE over the one shared 'Big Brother Drone' stat block.
    expect(loadouts.map((l) => (l.drone as { name?: string }).name)).toEqual([
      'Big Brother Drone',
      'Big Brother Drone',
      'Big Brother Drone',
      'Big Brother Drone',
    ])
    expect(loadouts.map((l) => l.instanceName)).toEqual([
      'Shield Drone',
      'Anti-Missile Drone',
      'Fire Support Drone',
      'Minelayer Drone',
    ])
    // …and each carries its OWN kit, so they don't render as four identical cards.
    expect(names(loadouts[3]?.systems ?? [])).toEqual(['Anti-Mech Mine Layer'])
    expect(names(loadouts[3]?.modules ?? [])).toEqual(['Self-Destruct'])
  })

  test('resolvePatternDrones returns empty for a pattern with no drones', () => {
    expect(resolvePatternDrones(pattern('Mule', 'Hauler'))).toEqual([])
    expect(resolvePatternDrones({ name: 'Fake' } as SURefObjectPattern)).toEqual([])
  })

  test('resolvePatternDrones skips configs whose stat block does not exist', () => {
    expect(
      resolvePatternDrones({
        name: 'Fake',
        drones: [{ name: 'No Such Drone', systems: [], modules: [] }],
      } as unknown as SURefObjectPattern)
    ).toEqual([])
  })

  test('resolvePatternDrones resolves through `ref` when the instance name is not a stat block', () => {
    const loadouts = resolvePatternDrones({
      name: 'Fake',
      drones: [{ name: 'Shield Drone', ref: 'Big Brother Drone', systems: [], modules: [] }],
    } as unknown as SURefObjectPattern)
    expect(loadouts).toHaveLength(1)
    expect((loadouts[0]?.drone as { name?: string })?.name).toBe('Big Brother Drone')
    expect(loadouts[0]?.instanceName).toBe('Shield Drone')
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
