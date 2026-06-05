/**
 * Pure logic for orphan detection in Salvage Union data.
 * An "orphan" is an entity that exists in its data file but is never referenced
 * by any other entity.
 *
 * Root entities (chassis, classes, roll-tables, etc.) are intentionally
 * top-level and are never expected to be referenced.
 */

export type OrphanResult = {
  file: string
  name: string
}

type ActionEntry = Record<string, unknown>
type EntityEntry = Record<string, unknown>

// ─── helpers ────────────────────────────────────────────────────────────────

function extractActionNames(actions: unknown[]): string[] {
  const names: string[] = []
  for (const action of actions) {
    if (typeof action === 'string') {
      names.push(action)
    } else if (
      action !== null &&
      typeof action === 'object' &&
      'name' in action &&
      typeof (action as Record<string, unknown>).name === 'string'
    ) {
      names.push((action as Record<string, unknown>).name as string)
    }
  }
  return names
}

function collectActionsFromEntities(entities: EntityEntry[]): string[] {
  const names: string[] = []
  for (const entity of entities) {
    const actions = entity.actions
    if (Array.isArray(actions)) {
      names.push(...extractActionNames(actions))
    }
  }
  return names
}

// ─── collectReferencedActionNames ───────────────────────────────────────────

type CollectReferencedActionsInput = {
  systems: EntityEntry[]
  modules: EntityEntry[]
  abilities: EntityEntry[]
  equipment: EntityEntry[]
  chassis: EntityEntry[]
  otherEntities: EntityEntry[]
}

/**
 * Traverse all entity lists and collect every action name that is referenced.
 */
export function collectReferencedActionNames(input: CollectReferencedActionsInput): Set<string> {
  const referenced = new Set<string>()

  const fromEntities = [
    ...input.systems,
    ...input.modules,
    ...input.abilities,
    ...input.equipment,
    ...input.otherEntities,
  ]

  for (const name of collectActionsFromEntities(fromEntities)) {
    referenced.add(name)
  }

  // Chassis chassisAbilities array references action names
  for (const chassisItem of input.chassis) {
    const chassisAbilities = chassisItem.chassisAbilities
    if (Array.isArray(chassisAbilities)) {
      for (const abilityRef of chassisAbilities) {
        if (typeof abilityRef === 'string') {
          referenced.add(abilityRef)
        }
      }
    }
  }

  return referenced
}

// ─── collectReferencedSystemNames ───────────────────────────────────────────

type CollectReferencedSystemsInput = {
  chassis: EntityEntry[]
  vehicles: EntityEntry[]
  drones: EntityEntry[]
  /** Mech-scale boss/monster entries that may be equipped with named systems */
  bioTitans?: EntityEntry[]
  /** Optional: the full set of known system names — used to disambiguate drone.systems entries */
  allSystemNames?: Set<string>
}

/**
 * Traverse chassis patterns, vehicles, drones, and bio-titans to collect all referenced system names.
 */
export function collectReferencedSystemNames(input: CollectReferencedSystemsInput): Set<string> {
  const referenced = new Set<string>()

  // Chassis patterns
  for (const chassisItem of input.chassis) {
    const patterns = chassisItem.patterns
    if (!Array.isArray(patterns)) continue

    for (const pattern of patterns) {
      const pat = pattern as Record<string, unknown>

      // systems in pattern
      const systems = pat.systems
      if (Array.isArray(systems)) {
        for (const system of systems) {
          const name =
            typeof system === 'string' ? system : (system as Record<string, unknown>).name
          if (typeof name === 'string') referenced.add(name)
        }
      }

      // drone configs in pattern
      const drones = pat.drones
      if (Array.isArray(drones)) {
        for (const drone of drones as Record<string, unknown>[]) {
          const droneSystems = drone.systems
          if (Array.isArray(droneSystems)) {
            for (const s of droneSystems) {
              if (typeof s === 'string') referenced.add(s)
            }
          }
        }
      }
    }
  }

  // Vehicle systems
  for (const vehicle of input.vehicles) {
    const systems = vehicle.systems
    if (Array.isArray(systems)) {
      for (const s of systems) {
        if (typeof s === 'string') referenced.add(s)
      }
    }
  }

  // Drone systems — only count entries that are actually system names
  for (const drone of input.drones) {
    const systems = drone.systems
    if (Array.isArray(systems)) {
      for (const s of systems) {
        if (typeof s !== 'string') continue
        // If allSystemNames provided, only include known systems
        if (input.allSystemNames) {
          if (input.allSystemNames.has(s)) referenced.add(s)
        } else {
          referenced.add(s)
        }
      }
    }
  }

  // Titan-equipped systems
  if (input.bioTitans) {
    for (const titan of input.bioTitans) {
      const systems = titan.systems
      if (Array.isArray(systems)) {
        for (const s of systems) {
          if (typeof s === 'string') referenced.add(s)
        }
      }
    }
  }

  return referenced
}

// ─── collectReferencedModuleNames ───────────────────────────────────────────

type CollectReferencedModulesInput = {
  chassis: EntityEntry[]
  drones: EntityEntry[]
  /** Mech-scale boss/monster entries that may be equipped with named modules */
  bioTitans?: EntityEntry[]
  /** Optional: the full set of known module names — used to disambiguate drone.systems entries */
  allModuleNames?: Set<string>
}

/**
 * Traverse chassis patterns and drones to collect all referenced module names.
 */
export function collectReferencedModuleNames(input: CollectReferencedModulesInput): Set<string> {
  const referenced = new Set<string>()

  // Chassis patterns
  for (const chassisItem of input.chassis) {
    const patterns = chassisItem.patterns
    if (!Array.isArray(patterns)) continue

    for (const pattern of patterns) {
      const pat = pattern as Record<string, unknown>

      // modules in pattern
      const modules = pat.modules
      if (Array.isArray(modules)) {
        for (const module of modules) {
          const name =
            typeof module === 'string' ? module : (module as Record<string, unknown>).name
          if (typeof name === 'string') referenced.add(name)
        }
      }

      // drone configs in pattern
      const drones = pat.drones
      if (Array.isArray(drones)) {
        for (const drone of drones as Record<string, unknown>[]) {
          const droneModules = drone.modules
          if (Array.isArray(droneModules)) {
            for (const m of droneModules) {
              if (typeof m === 'string') referenced.add(m)
            }
          }
        }
      }
    }
  }

  // Drone systems field can contain module names — include when known to be modules
  for (const drone of input.drones) {
    const systems = drone.systems
    if (Array.isArray(systems)) {
      for (const s of systems) {
        if (typeof s !== 'string') continue
        if (input.allModuleNames && input.allModuleNames.has(s)) {
          referenced.add(s)
        }
      }
    }
  }

  // Titan-equipped modules
  if (input.bioTitans) {
    for (const titan of input.bioTitans) {
      const modules = titan.modules
      if (Array.isArray(modules)) {
        for (const m of modules) {
          if (typeof m === 'string') referenced.add(m)
        }
      }
    }
  }

  return referenced
}

// ─── findOrphanedActions / Systems / Modules ────────────────────────────────

/**
 * Given the full list of actions and the set of referenced action names,
 * return the orphaned entries.
 */
export function findOrphanedActions(
  actions: ActionEntry[],
  referencedNames: Set<string>
): OrphanResult[] {
  return actions
    .filter((a) => typeof a.name === 'string' && !referencedNames.has(a.name as string))
    .map((a) => ({ file: 'actions.json', name: a.name as string }))
}

/**
 * Given the full list of systems and the set of referenced system names,
 * return the orphaned entries.
 */
export function findOrphanedSystems(
  systems: EntityEntry[],
  referencedNames: Set<string>
): OrphanResult[] {
  return systems
    .filter((s) => typeof s.name === 'string' && !referencedNames.has(s.name as string))
    .map((s) => ({ file: 'systems.json', name: s.name as string }))
}

/**
 * Given the full list of modules and the set of referenced module names,
 * return the orphaned entries.
 */
export function findOrphanedModules(
  modules: EntityEntry[],
  referencedNames: Set<string>
): OrphanResult[] {
  return modules
    .filter((m) => typeof m.name === 'string' && !referencedNames.has(m.name as string))
    .map((m) => ({ file: 'modules.json', name: m.name as string }))
}
