/**
 * Pure logic for orphan detection in Salvage Union data.
 * An "orphan" is an entity that exists in its data file but is never referenced
 * by any other entity.
 */

export type OrphanResult = {
  file: string
  name: string
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
   * too.
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
    // A Bio-Titan pattern's `actions` are the ones it adds to its host.
    if (Array.isArray(entity.patterns)) {
      for (const pattern of entity.patterns) {
        const patternActions = (pattern as Record<string, unknown>).actions
        if (Array.isArray(patternActions)) {
          names.push(...extractActionNames(patternActions))
        }
      }
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

// ─── collectReferencedLoadoutNames ──────────────────────────────────────────

type CollectReferencedLoadoutInput = {
  chassis: EntityEntry[]
  drones: EntityEntry[]
  /** Mech-scale boss/monster entries that may be equipped with named systems or modules */
  bioTitans: EntityEntry[]
  /**
   * Every known name of this kind. A top-level drone lists its modules under
   * `systems` too, so this set decides which kind each drone entry is.
   */
  knownNames: Set<string>
  /** Vehicles carry systems only: pass them for `'systems'`, never `'modules'`. */
  vehicles?: EntityEntry[]
}

function stringEntries(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/**
 * Traverse chassis patterns, vehicles, drones, and bio-titans to collect every
 * referenced system (`key: 'systems'`) or module (`key: 'modules'`) name.
 */
export function collectReferencedLoadoutNames(
  key: 'systems' | 'modules',
  input: CollectReferencedLoadoutInput
): Set<string> {
  const referenced = new Set<string>()

  // Chassis patterns
  for (const chassisItem of input.chassis) {
    const patterns = chassisItem.patterns
    if (!Array.isArray(patterns)) continue

    for (const pattern of patterns) {
      const pat = pattern as Record<string, unknown>

      // A pattern entry is a name or an object with one.
      const entries = pat[key]
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          const name = typeof entry === 'string' ? entry : (entry as Record<string, unknown>).name
          if (typeof name === 'string') referenced.add(name)
        }
      }

      // drone configs in pattern
      const drones = pat.drones
      if (Array.isArray(drones)) {
        for (const drone of drones as Record<string, unknown>[]) {
          for (const name of stringEntries(drone[key])) referenced.add(name)
        }
      }
    }
  }

  for (const vehicle of input.vehicles ?? []) {
    for (const name of stringEntries(vehicle.systems)) referenced.add(name)
  }

  // Drone `systems` holds both kinds — only count the known names of this one.
  for (const drone of input.drones) {
    for (const name of stringEntries(drone.systems)) {
      if (input.knownNames.has(name)) referenced.add(name)
    }
  }

  // Titan-equipped systems or modules
  for (const titan of input.bioTitans) {
    for (const name of stringEntries(titan[key])) referenced.add(name)
  }

  return referenced
}

// ─── findOrphans ────────────────────────────────────────────────────────────

/**
 * Given every row of one data file and the set of referenced names, return the
 * rows nothing references.
 */
export function findOrphans(
  file: string,
  rows: EntityEntry[],
  referencedNames: Set<string>
): OrphanResult[] {
  return rows
    .filter((row) => typeof row.name === 'string' && !referencedNames.has(row.name as string))
    .map((row) => ({ file, name: row.name as string }))
}

// ─── config: intentional-orphan allowlist ──────────────────────────────────
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
const INTENTIONAL_ORPHANS: AllowlistEntry[] = [
  // Deployable turret weapon options. These are referenced only via
  // `source.options[].actions` (`kind: 'systemVariant'`) nested inside the
  // parent "Automated Weapon Turret" action's `choices` — a structure the
  // collector intentionally does not traverse. Allowlisting (rather than
  // walking the variant options) means they won't silently re-flag if that
  // parent system is ever deleted; the stale check would instead confirm they
  // truly became orphans.
  { file: 'actions.json', name: 'Automated Machine Gun Turret' },
  { file: 'actions.json', name: 'Automated Green Laser Turret' },
  { file: 'actions.json', name: 'Automated 120mm Cannon Turret' },

  // Freely-installable catalog SYSTEMS. In Salvage Union, systems are
  // salvaged/crafted and installed into any mech's slots — appearing in a
  // pre-built chassis pattern is optional. These exist in systems.json but are
  // (correctly) not part of any pattern, vehicle, drone, or bio-titan loadout.
  // Verified: none appear in a `systems` array on any entity file.
  { file: 'systems.json', name: 'Adv. Fabrication Arm' },
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

  // Freely-installable catalog MODULES. Same rationale as systems above:
  // modules are installed into mech slots and need not appear in any pre-built
  // pattern. Verified: none appear in a `modules` array on any entity file.
  { file: 'modules.json', name: 'Hacking Repeater Node' },
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
]

export type OrphanCheckResult = {
  unexpected: OrphanResult[]
  allowlisted: OrphanResult[]
  staleAllowlist: AllowlistEntry[]
}

/**
 * Orchestration entry point: given the full data bag (filename -> parsed
 * array), run the entire orphan-detection pipeline (referenced-name
 * collection, orphan detection, allowlist partitioning, stale-allowlist
 * detection). `tools/validate.ts` and the tests both call this, so they
 * can never diverge.
 */
export function runOrphanCheck(filesByName: Record<string, unknown[]>): OrphanCheckResult {
  const get = (file: string): EntityEntry[] => (filesByName[file] ?? []) as EntityEntry[]

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

  const referencedSystemNames = collectReferencedLoadoutNames('systems', {
    chassis,
    vehicles,
    drones,
    bioTitans,
    knownNames: allSystemNames,
  })

  const referencedModuleNames = collectReferencedLoadoutNames('modules', {
    chassis,
    drones,
    bioTitans,
    knownNames: allModuleNames,
  })

  const allOrphans: OrphanResult[] = [
    ...findOrphans('actions.json', actions, referencedActionNames),
    ...findOrphans('systems.json', systems, referencedSystemNames),
    ...findOrphans('modules.json', modules, referencedModuleNames),
  ]

  const { unexpected, allowlisted, staleAllowlist } = partitionOrphansByAllowlist(
    allOrphans,
    INTENTIONAL_ORPHANS
  )

  return { unexpected, allowlisted, staleAllowlist }
}
