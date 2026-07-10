import { describe, expect, it } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  collectReferencedActionNames,
  collectReferencedSystemNames,
  collectReferencedModuleNames,
  findOrphanedActions,
  findOrphanedSystems,
  findOrphanedModules,
  findStaleRootFiles,
  partitionOrphansByAllowlist,
  runOrphanCheck,
  ROOT_FILES,
  type AllowlistEntry,
  type OrphanResult,
} from './validateOrphansLogic.js'

/** Narrow away null/undefined; throws (failing the test) when the value is missing. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

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
    expect(defined(orphan).name).toBe('Orphan System')
    expect(defined(orphan).file).toBe('systems.json')
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
    expect(defined(orphan).name).toBe('Orphan Module')
    expect(defined(orphan).file).toBe('modules.json')
  })
})

// ─── findStaleRootFiles (allowlist drift detection) ─────────────────────────

describe('findStaleRootFiles', () => {
  it('returns empty when every allowlisted root file still exists', () => {
    const rootFiles = ['chassis.json', 'classes.json', 'roll-tables.json']
    const existing = new Set([...rootFiles, 'systems.json', 'modules.json'])
    expect(findStaleRootFiles(rootFiles, existing)).toEqual([])
  })

  it('flags an allowlist entry whose data file no longer exists', () => {
    const rootFiles = ['chassis.json', 'renamed-away.json', 'classes.json']
    const existing = new Set(['chassis.json', 'classes.json'])
    expect(findStaleRootFiles(rootFiles, existing)).toEqual(['renamed-away.json'])
  })

  it('reports multiple stale entries sorted and deduplicated', () => {
    const rootFiles = ['zed.json', 'alpha.json', 'zed.json', 'kept.json']
    const existing = new Set(['kept.json'])
    expect(findStaleRootFiles(rootFiles, existing)).toEqual(['alpha.json', 'zed.json'])
  })

  it('accepts an array of existing files as well as a Set', () => {
    const rootFiles = ['a.json', 'b.json']
    expect(findStaleRootFiles(rootFiles, ['a.json'])).toEqual(['b.json'])
  })
})

// ─── partitionOrphansByAllowlist ────────────────────────────────────────────

describe('partitionOrphansByAllowlist', () => {
  const ORPHANS: OrphanResult[] = [
    { file: 'actions.json', name: 'Automated Machine Gun Turret' },
    { file: 'systems.json', name: 'Meld Injector' },
    { file: 'actions.json', name: 'Bionic Arms' },
  ]

  const ALLOWLIST: AllowlistEntry[] = [
    { file: 'actions.json', name: 'Automated Machine Gun Turret' },
    { file: 'systems.json', name: 'Meld Injector' },
  ]

  it('separates allowlisted orphans from unexpected ones', () => {
    const { unexpected, allowlisted } = partitionOrphansByAllowlist(ORPHANS, ALLOWLIST)
    expect(allowlisted.map((o) => o.name).sort()).toEqual([
      'Automated Machine Gun Turret',
      'Meld Injector',
    ])
    expect(unexpected).toEqual([{ file: 'actions.json', name: 'Bionic Arms' }])
  })

  it('matches on file AND name so same-named entries in different files do not collide', () => {
    const orphans: OrphanResult[] = [
      { file: 'systems.json', name: 'Overlap' },
      { file: 'modules.json', name: 'Overlap' },
    ]
    // Only the systems.json variant is allowlisted.
    const allowlist: AllowlistEntry[] = [{ file: 'systems.json', name: 'Overlap' }]
    const { unexpected, allowlisted } = partitionOrphansByAllowlist(orphans, allowlist)
    expect(allowlisted).toEqual([{ file: 'systems.json', name: 'Overlap' }])
    expect(unexpected).toEqual([{ file: 'modules.json', name: 'Overlap' }])
  })

  it('flags an allowlist entry that is no longer an orphan as stale', () => {
    const allowlist: AllowlistEntry[] = [
      ...ALLOWLIST,
      { file: 'modules.json', name: 'Now Referenced Module' }, // no longer an orphan
    ]
    const { staleAllowlist } = partitionOrphansByAllowlist(ORPHANS, allowlist)
    expect(staleAllowlist).toEqual([{ file: 'modules.json', name: 'Now Referenced Module' }])
  })

  it('reports no stale entries when every allowlist entry still matches an orphan', () => {
    const { staleAllowlist } = partitionOrphansByAllowlist(ORPHANS, ALLOWLIST)
    expect(staleAllowlist).toEqual([])
  })

  it('deduplicates repeated stale allowlist entries', () => {
    const allowlist: AllowlistEntry[] = [
      { file: 'modules.json', name: 'Dupe' },
      { file: 'modules.json', name: 'Dupe' },
    ]
    const { staleAllowlist } = partitionOrphansByAllowlist(ORPHANS, allowlist)
    expect(staleAllowlist).toEqual([{ file: 'modules.json', name: 'Dupe' }])
  })

  it('treats all orphans as unexpected when the allowlist is empty', () => {
    const { unexpected, allowlisted, staleAllowlist } = partitionOrphansByAllowlist(ORPHANS, [])
    expect(unexpected).toEqual(ORPHANS)
    expect(allowlisted).toEqual([])
    expect(staleAllowlist).toEqual([])
  })
})

// ─── runOrphanCheck (orchestration) ─────────────────────────────────────────
// The same "real dataset invariant" guarantee as validateActionBackrefs.test.ts:
// this exercises the exact orchestration function tools/validateOrphans.ts (the
// CLI) and tools/validate.ts (the unified runner) both call, over the real
// committed data/*.json — so a regression in the wiring (not just the pure
// detection functions above) fails `bun test` too.
describe('runOrphanCheck (real dataset invariant)', () => {
  const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')

  function loadRealData(): Record<string, unknown[]> {
    const filesByName: Record<string, unknown[]> = {}
    for (const filename of readdirSync(dataDir)) {
      if (!filename.endsWith('.json')) continue
      const parsed = JSON.parse(readFileSync(join(dataDir, filename), 'utf-8')) as unknown
      if (Array.isArray(parsed)) filesByName[filename] = parsed
    }
    return filesByName
  }

  it('finds no unexpected orphans, no stale allowlist entries, and no stale root files', () => {
    const result = runOrphanCheck(loadRealData())
    expect(result.staleRootFiles).toEqual([])
    expect(result.unexpected).toEqual([])
    expect(result.staleAllowlist).toEqual([])
  })

  it('every ROOT_FILES entry corresponds to a real data file', () => {
    const existing = new Set(readdirSync(dataDir).filter((f) => f.endsWith('.json')))
    expect(findStaleRootFiles(ROOT_FILES, existing)).toEqual([])
  })
})
