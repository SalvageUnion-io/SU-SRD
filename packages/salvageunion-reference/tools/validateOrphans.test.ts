import { describe, expect, it } from 'bun:test'
import {
  collectReferencedActionNames,
  collectReferencedSystemNames,
  collectReferencedModuleNames,
  findOrphanedActions,
  findOrphanedSystems,
  findOrphanedModules,
  type OrphanResult,
} from './validateOrphansLogic.js'

// ─── Fixtures ───────────────────────────────────────────────────────────────

const ACTIONS = [
  { id: 'a1', name: 'Shoot', actionSource: 'systems' },
  { id: 'a2', name: 'Ram', actionSource: 'systems' },
  { id: 'a3', name: 'Pilot Jump', actionSource: 'abilities' },
  { id: 'a4', name: 'Ghost Protocol', actionSource: 'equipment' },
]

const SYSTEMS = [
  { id: 's1', name: 'Laser Cannon', actions: ['Shoot'] },
  { id: 's2', name: 'Ram Plate', actions: ['Ram'] },
  { id: 's3', name: 'Orphan System' }, // not referenced by any chassis
]

const MODULES = [
  { id: 'm1', name: 'Shield Module', actions: [] },
  { id: 'm2', name: 'Orphan Module' }, // not referenced
]

const CHASSIS = [
  {
    id: 'c1',
    name: 'Stomper',
    patterns: [
      {
        name: 'Base Pattern',
        systems: [{ name: 'Laser Cannon' }],
        modules: [{ name: 'Shield Module' }],
      },
    ],
    chassisAbilities: ['Pilot Jump'],
  },
]

const ABILITIES = [
  { id: 'ab1', name: 'Pilot Jump', actions: ['Pilot Jump'] },
  { id: 'ab2', name: 'Ghost Walk', actions: ['Ghost Protocol'] },
]

const EQUIPMENT = [{ id: 'eq1', name: 'Sniper Rifle', actions: ['Shoot'] }]

// ─── collectReferencedActionNames ───────────────────────────────────────────

describe('collectReferencedActionNames', () => {
  it('collects action names referenced in systems', () => {
    const refs = collectReferencedActionNames({
      systems: SYSTEMS,
      modules: [],
      abilities: [],
      equipment: [],
      chassis: [],
      otherEntities: [],
    })
    expect(refs.has('Shoot')).toBe(true)
    expect(refs.has('Ram')).toBe(true)
  })

  it('collects action names referenced in abilities', () => {
    const refs = collectReferencedActionNames({
      systems: [],
      modules: [],
      abilities: ABILITIES,
      equipment: [],
      chassis: [],
      otherEntities: [],
    })
    expect(refs.has('Pilot Jump')).toBe(true)
    expect(refs.has('Ghost Protocol')).toBe(true)
  })

  it('collects action names referenced in equipment', () => {
    const refs = collectReferencedActionNames({
      systems: [],
      modules: [],
      abilities: [],
      equipment: EQUIPMENT,
      chassis: [],
      otherEntities: [],
    })
    expect(refs.has('Shoot')).toBe(true)
  })

  it('collects chassisAbilities from chassis entries', () => {
    const refs = collectReferencedActionNames({
      systems: [],
      modules: [],
      abilities: [],
      equipment: [],
      chassis: CHASSIS,
      otherEntities: [],
    })
    expect(refs.has('Pilot Jump')).toBe(true)
  })

  it('collects actions from other arbitrary entity lists', () => {
    const otherEntities = [{ name: 'Bio Titan', actions: ['Crush'] }]
    const refs = collectReferencedActionNames({
      systems: [],
      modules: [],
      abilities: [],
      equipment: [],
      chassis: [],
      otherEntities,
    })
    expect(refs.has('Crush')).toBe(true)
  })

  it('handles entities with no actions field gracefully', () => {
    const refs = collectReferencedActionNames({
      systems: [{ id: 'x', name: 'No Actions System' }],
      modules: [],
      abilities: [],
      equipment: [],
      chassis: [],
      otherEntities: [],
    })
    expect(refs.size).toBe(0)
  })

  it('handles object-style action references', () => {
    const systemsWithObjActions = [
      { id: 's1', name: 'Fancy System', actions: [{ name: 'Fancy Shot' }] },
    ]
    const refs = collectReferencedActionNames({
      systems: systemsWithObjActions,
      modules: [],
      abilities: [],
      equipment: [],
      chassis: [],
      otherEntities: [],
    })
    expect(refs.has('Fancy Shot')).toBe(true)
  })
})

// ─── collectReferencedSystemNames ───────────────────────────────────────────

describe('collectReferencedSystemNames', () => {
  it('collects system names from chassis patterns', () => {
    const refs = collectReferencedSystemNames({ chassis: CHASSIS, vehicles: [], drones: [] })
    expect(refs.has('Laser Cannon')).toBe(true)
  })

  it('collects system names from vehicle systems arrays', () => {
    const vehicles = [{ id: 'v1', name: 'Jeep', systems: ['Ram Plate'] }]
    const refs = collectReferencedSystemNames({ chassis: [], vehicles, drones: [] })
    expect(refs.has('Ram Plate')).toBe(true)
  })

  it('collects system names from drone systems (string values)', () => {
    const drones = [{ id: 'd1', name: 'Watcher', systems: ['Sensor Array'] }]
    const allSystemNames = new Set(['Sensor Array'])
    const refs = collectReferencedSystemNames({
      chassis: [],
      vehicles: [],
      drones,
      allSystemNames,
    })
    expect(refs.has('Sensor Array')).toBe(true)
  })

  it('does not include module names that appear in drone systems', () => {
    const drones = [{ id: 'd1', name: 'Watcher', systems: ['Shield Module'] }]
    const allSystemNames = new Set<string>() // Shield Module is not a system
    const refs = collectReferencedSystemNames({
      chassis: [],
      vehicles: [],
      drones,
      allSystemNames,
    })
    expect(refs.has('Shield Module')).toBe(false)
  })

  it('handles chassis patterns with string-style system entries', () => {
    const chassisWithStrings = [
      {
        id: 'c1',
        name: 'Stomper',
        patterns: [{ name: 'Base', systems: ['Laser Cannon'] }],
      },
    ]
    const refs = collectReferencedSystemNames({
      chassis: chassisWithStrings,
      vehicles: [],
      drones: [],
    })
    expect(refs.has('Laser Cannon')).toBe(true)
  })

  it('handles chassis drone configs inside patterns', () => {
    const chassisWithDrones = [
      {
        id: 'c1',
        name: 'Carrier',
        patterns: [
          {
            name: 'Drone Pattern',
            systems: [],
            drones: [{ name: 'Scout', systems: ['Scout Sensor'] }],
          },
        ],
      },
    ]
    const refs = collectReferencedSystemNames({
      chassis: chassisWithDrones,
      vehicles: [],
      drones: [],
    })
    expect(refs.has('Scout Sensor')).toBe(true)
  })
})

// ─── collectReferencedModuleNames ───────────────────────────────────────────

describe('collectReferencedModuleNames', () => {
  it('collects module names from chassis patterns', () => {
    const refs = collectReferencedModuleNames({ chassis: CHASSIS, drones: [] })
    expect(refs.has('Shield Module')).toBe(true)
  })

  it('collects module names from chassis drone configs', () => {
    const chassisWithDrones = [
      {
        id: 'c1',
        name: 'Carrier',
        patterns: [
          {
            name: 'Drone Pattern',
            modules: [],
            drones: [{ name: 'Scout', modules: ['Stealth Module'] }],
          },
        ],
      },
    ]
    const refs = collectReferencedModuleNames({ chassis: chassisWithDrones, drones: [] })
    expect(refs.has('Stealth Module')).toBe(true)
  })

  it('collects module names from drone systems when they are modules', () => {
    const drones = [{ id: 'd1', name: 'Watcher', systems: ['Shield Module'] }]
    const allModuleNames = new Set(['Shield Module'])
    const refs = collectReferencedModuleNames({ chassis: [], drones, allModuleNames })
    expect(refs.has('Shield Module')).toBe(true)
  })
})

// ─── findOrphanedActions ────────────────────────────────────────────────────

describe('findOrphanedActions', () => {
  it('returns empty array when all actions are referenced', () => {
    const referencedNames = new Set(['Shoot', 'Ram', 'Pilot Jump', 'Ghost Protocol'])
    const orphans = findOrphanedActions(ACTIONS, referencedNames)
    expect(orphans).toHaveLength(0)
  })

  it('flags actions that are not referenced anywhere', () => {
    const referencedNames = new Set(['Shoot', 'Ram'])
    const orphans = findOrphanedActions(ACTIONS, referencedNames)
    expect(orphans).toHaveLength(2)
    const orphanNames = orphans.map((o) => o.name)
    expect(orphanNames).toContain('Pilot Jump')
    expect(orphanNames).toContain('Ghost Protocol')
  })

  it('includes file and name in each OrphanResult', () => {
    const referencedNames = new Set<string>()
    const orphans = findOrphanedActions([{ id: 'a1', name: 'Lonely Action' }], referencedNames)
    const orphan = orphans[0]
    expect(orphan).toBeDefined()
    expect(orphan).toMatchObject({
      file: 'actions.json',
      name: 'Lonely Action',
    } satisfies OrphanResult)
  })
})

// ─── findOrphanedSystems ────────────────────────────────────────────────────

describe('findOrphanedSystems', () => {
  it('returns empty when all systems are referenced', () => {
    const referencedNames = new Set(['Laser Cannon', 'Ram Plate', 'Orphan System'])
    const orphans = findOrphanedSystems(SYSTEMS, referencedNames)
    expect(orphans).toHaveLength(0)
  })

  it('flags systems not referenced in any chassis/vehicle/drone', () => {
    const referencedNames = new Set(['Laser Cannon', 'Ram Plate'])
    const orphans = findOrphanedSystems(SYSTEMS, referencedNames)
    expect(orphans).toHaveLength(1)
    const orphan = orphans[0]
    expect(orphan).toBeDefined()
    expect(orphan!.name).toBe('Orphan System')
    expect(orphan!.file).toBe('systems.json')
  })
})

// ─── findOrphanedModules ────────────────────────────────────────────────────

describe('findOrphanedModules', () => {
  it('returns empty when all modules are referenced', () => {
    const referencedNames = new Set(['Shield Module', 'Orphan Module'])
    const orphans = findOrphanedModules(MODULES, referencedNames)
    expect(orphans).toHaveLength(0)
  })

  it('flags modules not referenced in any chassis/drone', () => {
    const referencedNames = new Set(['Shield Module'])
    const orphans = findOrphanedModules(MODULES, referencedNames)
    expect(orphans).toHaveLength(1)
    const orphan = orphans[0]
    expect(orphan).toBeDefined()
    expect(orphan!.name).toBe('Orphan Module')
    expect(orphan!.file).toBe('modules.json')
  })
})
