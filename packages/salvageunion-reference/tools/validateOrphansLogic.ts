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

// ─── allowlist drift detection ──────────────────────────────────────────────

/**
 * Detect stale entries in the root-entity allowlist.
 *
 * The orphan checker treats a hand-maintained list of "root" data files as
 * intentionally-unreferenced. That allowlist rots silently: if a file is
 * renamed or removed, its allowlist entry lingers and can mask a genuinely
 * orphaned successor. Given the allowlisted file names and the set of data
 * files that actually exist on disk, return the allowlist entries that no
 * longer correspond to a real file (sorted, deduplicated).
 */
export function findStaleRootFiles(rootFiles: string[], existingFiles: Iterable<string>): string[] {
  const existing = existingFiles instanceof Set ? existingFiles : new Set(existingFiles)
  const stale = new Set<string>()
  for (const file of rootFiles) {
    if (!existing.has(file)) stale.add(file)
  }
  return [...stale].sort()
}

// ─── intentional-orphan allowlist ───────────────────────────────────────────

/**
 * An entry in the intentional-orphan allowlist. Keyed by the same
 * `{ file, name }` shape the checker emits so a match is exact — and so a stale
 * entry (one whose orphan no longer exists) is detectable.
 */
export type AllowlistEntry = {
  file: string
  name: string
}

export type PartitionedOrphans = {
  /** Detected orphans NOT on the allowlist — these should fail the check. */
  unexpected: OrphanResult[]
  /** Detected orphans that matched an allowlist entry — reported, non-fatal. */
  allowlisted: OrphanResult[]
  /**
   * Allowlist entries that no longer correspond to a current orphan (the entity
   * got referenced, renamed, or removed). Stale entries rot silently and can
   * mask a genuinely-orphaned successor, so they are surfaced and should fail
   * too — mirroring {@link findStaleRootFiles}.
   */
  staleAllowlist: AllowlistEntry[]
}

const orphanKey = (e: { file: string; name: string }): string => `${e.file}\0${e.name}`

/**
 * Split the detected orphans into `unexpected` (not allowlisted → should fail)
 * and `allowlisted` (known-intentional → informational), and separately report
 * `staleAllowlist` entries that are no longer orphaned. Keeping the allowlist
 * honest is the whole point: an entry that no longer matches a real orphan must
 * be removed, or it can hide a future orphan that reuses the same name.
 */
export function partitionOrphansByAllowlist(
  orphans: OrphanResult[],
  allowlist: AllowlistEntry[]
): PartitionedOrphans {
  const allowKeys = new Set(allowlist.map(orphanKey))
  const orphanKeys = new Set(orphans.map(orphanKey))

  const unexpected: OrphanResult[] = []
  const allowlisted: OrphanResult[] = []
  for (const orphan of orphans) {
    if (allowKeys.has(orphanKey(orphan))) {
      allowlisted.push(orphan)
    } else {
      unexpected.push(orphan)
    }
  }

  const seenStale = new Set<string>()
  const staleAllowlist: AllowlistEntry[] = []
  for (const entry of allowlist) {
    const key = orphanKey(entry)
    if (!orphanKeys.has(key) && !seenStale.has(key)) {
      seenStale.add(key)
      staleAllowlist.push(entry)
    }
  }

  return { unexpected, allowlisted, staleAllowlist }
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
        if (input.allModuleNames?.has(s)) {
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

// ─── config: root files + intentional-orphan allowlist ─────────────────────
// These are top-level game concepts that nothing else references by name.
export const ROOT_FILES = [
  'chassis.json',
  'classes.json',
  'ability-tree-requirements.json',
  'roll-tables.json',
  'guides.json',
  'factions.json',
  'sources.json',
  'tech-levels.json',
  'catalog-categories.json',
  'crawlers.json',
  'crawler-bays.json',
]

// Individual actions/systems/modules that are UNreferenced by design. Each is a
// real dangler under the checker's traversal rules, but is intentional per the
// game data — so we subtract it and only FAIL on *unexpected* orphans. Keep this
// list short and justified: every entry documents WHY. If an entry stops being
// an orphan (it got wired into a pattern, renamed, or removed) the checker flags
// it as stale so this list can't rot and mask a genuine orphan.
//
// NOT allowlisted (reported to maintainers instead of hidden):
//   - "Bionic Arms" (actions.json): a Passive action duplicating the same-named
//     ability, which lists only its "Bionic Arms Attack" Turn action. It is the
//     ONLY orphaned abilities-sourced action and the only such passive/attack
//     pair in the data (not a convention) — likely a data anomaly. Left OUT so
//     the checker keeps surfacing it until a maintainer decides.
export const INTENTIONAL_ORPHANS: AllowlistEntry[] = [
  // Deployable turret weapon options. These are referenced only via
  // `customSystemOptions[].actions` nested inside the parent "Automated Weapon
  // Turret" action's `choices` — a structure the collector intentionally does
  // not traverse. Allowlisting (rather than walking customSystemOptions) means
  // they won't silently re-flag if that parent system is ever deleted; the
  // stale check would instead confirm they truly became orphans.
  { file: 'actions.json', name: 'Automated Machine Gun Turret' },
  { file: 'actions.json', name: 'Automated Green Laser Turret' },
  { file: 'actions.json', name: 'Automated 120mm Cannon Turret' },

  // Freely-installable catalog SYSTEMS. In Salvage Union, systems are
  // salvaged/crafted and installed into any mech's slots — appearing in a
  // pre-built chassis pattern is optional. These exist in systems.json but are
  // (correctly) not part of any pattern, vehicle, drone, or bio-titan loadout.
  // Verified: none appear in a `systems` array on any entity file.
  { file: 'systems.json', name: 'Adv. Fabrication Arm' },
  { file: 'systems.json', name: 'Snub-Nosed Blue Laser' },
  { file: 'systems.json', name: 'Multi-Function Repair Arm' },
  { file: 'systems.json', name: 'Rad Wave Generator' },
  { file: 'systems.json', name: 'Bio-Wings' },
  { file: 'systems.json', name: 'Meld Injector' },
  { file: 'systems.json', name: 'Meld Manipulator' },
  { file: 'systems.json', name: 'Meld Spore Launcher' },
  { file: 'systems.json', name: 'Meld System Replicator' },
  { file: 'systems.json', name: 'Meld Tendrils' },
  { file: 'systems.json', name: 'Cluster Missile' },
  { file: 'systems.json', name: 'Impact Hammer' },
  { file: 'systems.json', name: 'AMS Micro Laser' },
  { file: 'systems.json', name: 'Power Transference Cable' },
  { file: 'systems.json', name: 'Water Purification System' },

  // Same rationale, but these became orphans when the community-designed
  // "Mech Monday" blog patterns were dropped from chassis.json (the dataset
  // carries rulebook-PDF patterns only). Each is still a genuine rulebook
  // entry — it simply isn't installed by any *pre-built* pattern:
  //   Sandblaster                  Salvage Union Workshop Manual p167
  //   Aerosolised Nerve Gas Sprayer Salvage Union Workshop Manual p178
  //   Executive Body Kit           Salvage Union Workshop Manual p185
  //   Teleportation Pod            Salvage Union Workshop Manual p187
  //   Hydrologic Locomotion System False Flag p67
  { file: 'systems.json', name: 'Sandblaster' },
  { file: 'systems.json', name: 'Aerosolised Nerve Gas Sprayer' },
  { file: 'systems.json', name: 'Executive Body Kit' },
  { file: 'systems.json', name: 'Teleportation Pod' },
  { file: 'systems.json', name: 'Hydrologic Locomotion System' },

  // Freely-installable catalog MODULES. Same rationale as systems above:
  // modules are installed into mech slots and need not appear in any pre-built
  // pattern. Verified: none appear in a `modules` array on any entity file.
  { file: 'modules.json', name: 'Hacking Repeater Node' },
  { file: 'modules.json', name: 'Reactor Transference' },
  { file: 'modules.json', name: 'Corrupted Neuralink Module' },
  { file: 'modules.json', name: 'Chimerium Cell' },
  { file: 'modules.json', name: 'Meld Module Replicator' },
  { file: 'modules.json', name: 'Meld Distorter' },
  { file: 'modules.json', name: 'Analogue Internals' },
  { file: 'modules.json', name: 'Targeting Reticule' },
  { file: 'modules.json', name: 'IFF Beacon' },
  { file: 'modules.json', name: 'Surge Protector' },
  { file: 'modules.json', name: 'Remote Transponder' },
  { file: 'modules.json', name: 'EM Counterpulse' },
  { file: 'modules.json', name: 'Adaptive Chassis Linkage' },
  { file: 'modules.json', name: "Mozart's Ghost" },

  // Orphaned by the same "Mech Monday" pattern removal as the systems above;
  // all three remain genuine rulebook entries:
  //   Goflow Plant Growing System  Salvage Union Workshop Manual p71
  //   Pop Goes The Weasel          False Flag p69
  //   Meld Regenerator             False Flag p70
  { file: 'modules.json', name: 'Goflow Plant Growing System' },
  { file: 'modules.json', name: 'Pop Goes The Weasel' },
  { file: 'modules.json', name: 'Meld Regenerator' },
]

export type OrphanCheckResult = {
  staleRootFiles: string[]
  unexpected: OrphanResult[]
  allowlisted: OrphanResult[]
  staleAllowlist: AllowlistEntry[]
}

/**
 * Orchestration entry point: given the full data bag (filename -> parsed
 * array), run the entire orphan-detection pipeline (referenced-name
 * collection, orphan detection, allowlist partitioning, stale-entry
 * detection). Both the standalone CLI (tools/validateOrphans.ts) and the
 * unified runner (tools/validate.ts) call this so they can never diverge.
 */
export function runOrphanCheck(filesByName: Record<string, unknown[]>): OrphanCheckResult {
  const get = (file: string): EntityEntry[] => (filesByName[file] ?? []) as EntityEntry[]

  const staleRootFiles = findStaleRootFiles(ROOT_FILES, new Set(Object.keys(filesByName)))

  const systems = get('systems.json')
  const modules = get('modules.json')
  const chassis = get('chassis.json')
  const vehicles = get('vehicles.json')
  const drones = get('drones.json')
  const actions = get('actions.json')
  const equipment = get('equipment.json')
  const abilities = get('abilities.json')
  const bioTitans = get('bio-titans.json')
  const crawlers = get('crawlers.json')
  const creatures = get('creatures.json')
  const meld = get('meld.json')
  const npcs = get('npcs.json')
  const squads = get('squads.json')
  const traits = get('traits.json')
  const keywords = get('keywords.json')

  const allSystemNames = new Set(systems.map((s) => s.name as string))
  const allModuleNames = new Set(modules.map((m) => m.name as string))

  const referencedActionNames = collectReferencedActionNames({
    systems,
    modules,
    abilities,
    equipment,
    chassis,
    otherEntities: [
      ...bioTitans,
      ...crawlers,
      ...creatures,
      ...drones,
      ...meld,
      ...npcs,
      ...squads,
      ...traits,
      ...keywords,
      ...vehicles,
    ],
  })

  const referencedSystemNames = collectReferencedSystemNames({
    chassis,
    vehicles,
    drones,
    bioTitans,
    allSystemNames,
  })

  const referencedModuleNames = collectReferencedModuleNames({
    chassis,
    drones,
    bioTitans,
    allModuleNames,
  })

  const orphanedActions = findOrphanedActions(actions, referencedActionNames)
  const orphanedSystems = findOrphanedSystems(systems, referencedSystemNames)
  const orphanedModules = findOrphanedModules(modules, referencedModuleNames)

  const allOrphans: OrphanResult[] = [...orphanedActions, ...orphanedSystems, ...orphanedModules]

  const { unexpected, allowlisted, staleAllowlist } = partitionOrphansByAllowlist(
    allOrphans,
    INTENTIONAL_ORPHANS
  )

  return { staleRootFiles, unexpected, allowlisted, staleAllowlist }
}
