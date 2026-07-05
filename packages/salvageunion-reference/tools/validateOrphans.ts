#!/usr/bin/env tsx
/**
 * Detects orphaned entities in the Salvage Union data.
 * An "orphan" is an entity that exists in its data file but is never
 * referenced by any other entity.
 *
 * Root entities are intentionally top-level and are never expected to be
 * referenced. These are skipped and reported separately.
 *
 * Checked for orphans:
 *   - actions.json   — must be referenced by systems, modules, abilities, equipment, chassis, etc.
 *   - systems.json   — must appear in at least one chassis pattern, vehicle, or drone
 *   - modules.json   — must appear in at least one chassis pattern or drone
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  collectReferencedActionNames,
  collectReferencedSystemNames,
  collectReferencedModuleNames,
  findOrphanedActions,
  findOrphanedSystems,
  findOrphanedModules,
  findStaleRootFiles,
  partitionOrphansByAllowlist,
  type AllowlistEntry,
  type OrphanResult,
} from './validateOrphansLogic.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dataDir = join(__dirname, '..', 'data')

function loadData(filename: string): Record<string, unknown>[] {
  try {
    const content = readFileSync(join(dataDir, filename), 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error(`Error loading ${filename}:`, error)
    return []
  }
}

// ─── Root entities (intentionally unreferenced) ──────────────────────────────
// These are top-level game concepts that nothing else references by name.
const ROOT_FILES = [
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

// ─── Intentional-orphan allowlist ────────────────────────────────────────────
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
]

console.log('Root entities (intentionally unreferenced):')
for (const file of ROOT_FILES) {
  console.log(`  ${file}`)
}

// ─── Allowlist drift detection ───────────────────────────────────────────────
// A ROOT_FILES entry that no longer maps to a real data file is a stale
// allowlist entry: it rots silently and can mask a genuinely-orphaned
// successor. Detect these up front and fail loudly so the list stays honest.
const existingDataFiles = new Set(readdirSync(dataDir).filter((f) => f.endsWith('.json')))
const staleRootFiles = findStaleRootFiles(ROOT_FILES, existingDataFiles)

if (staleRootFiles.length > 0) {
  console.error('\n' + '='.repeat(80))
  console.error(`Stale allowlist entries: ${staleRootFiles.length} root file(s) no longer exist.`)
  for (const file of staleRootFiles) {
    console.error(`  - ${file} (listed in ROOT_FILES but missing from data/)`)
  }
  console.error(
    '\nRemove these from ROOT_FILES in tools/validateOrphans.ts — a stale allowlist' +
      '\nentry can mask a genuinely-orphaned entity that replaces it.'
  )
  process.exit(1)
}

// ─── Load data ───────────────────────────────────────────────────────────────

const systems = loadData('systems.json')
const modules = loadData('modules.json')
const chassis = loadData('chassis.json')
const vehicles = loadData('vehicles.json')
const drones = loadData('drones.json')
const actions = loadData('actions.json')
const equipment = loadData('equipment.json')
const abilities = loadData('abilities.json')
const bioTitans = loadData('bio-titans.json')
const crawlers = loadData('crawlers.json')
const creatures = loadData('creatures.json')
const meld = loadData('meld.json')
const npcs = loadData('npcs.json')
const squads = loadData('squads.json')
const traits = loadData('traits.json')
const keywords = loadData('keywords.json')

const allSystemNames = new Set(systems.map((s) => s.name as string))
const allModuleNames = new Set(modules.map((m) => m.name as string))

console.log(
  `\nLoaded ${systems.length} systems, ${modules.length} modules, ${actions.length} actions`
)

// ─── Collect referenced names ─────────────────────────────────────────────────

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

// ─── Detect orphans ───────────────────────────────────────────────────────────

const orphanedActions = findOrphanedActions(actions, referencedActionNames)
const orphanedSystems = findOrphanedSystems(systems, referencedSystemNames)
const orphanedModules = findOrphanedModules(modules, referencedModuleNames)

const allOrphans: OrphanResult[] = [...orphanedActions, ...orphanedSystems, ...orphanedModules]

// ─── Subtract the intentional-orphan allowlist ────────────────────────────────
// Split detected orphans into known-intentional (allowlisted) vs unexpected, and
// surface allowlist entries that are no longer orphans (stale → must be removed).
const { unexpected, allowlisted, staleAllowlist } = partitionOrphansByAllowlist(
  allOrphans,
  INTENTIONAL_ORPHANS
)

// ─── Report ───────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(80))

if (allowlisted.length > 0) {
  console.log(`Allowlisted intentional orphan(s): ${allowlisted.length} (see INTENTIONAL_ORPHANS)`)
}

let hasFailure = false

// Stale allowlist entries: an allowlisted name that is no longer an orphan.
// Fail loudly so the allowlist stays honest and can't mask a future orphan.
if (staleAllowlist.length > 0) {
  hasFailure = true
  console.error(`\nStale allowlist entries: ${staleAllowlist.length} no longer orphaned.`)
  for (const entry of staleAllowlist) {
    console.error(`  - ${entry.file}: ${entry.name} (allowlisted but now referenced/renamed/gone)`)
  }
  console.error(
    '\nRemove these from INTENTIONAL_ORPHANS in tools/validateOrphans.ts — a stale' +
      '\nallowlist entry can mask a genuinely-orphaned entity that reuses the name.'
  )
}

// Unexpected orphans: real danglers not on the allowlist. These block CI so the
// check is meaningful — a new orphan must be either wired in or consciously
// allowlisted with a documented reason.
if (unexpected.length > 0) {
  hasFailure = true

  console.error(`\nFound ${unexpected.length} UNEXPECTED orphan(s) (not allowlisted):\n`)

  // Group by file for readability
  const orphansByFile = new Map<string, OrphanResult[]>()
  for (const orphan of unexpected) {
    if (!orphansByFile.has(orphan.file)) {
      orphansByFile.set(orphan.file, [])
    }
    orphansByFile.get(orphan.file)!.push(orphan)
  }

  for (const [file, fileOrphans] of orphansByFile.entries()) {
    console.error(`${file}: ${fileOrphans.length} orphan(s)`)
    for (const orphan of fileOrphans) {
      console.error(`  - ${orphan.name}`)
    }
    console.error('')
  }

  console.error(
    'These entities exist in their data files but are not referenced by any other entity.\n' +
      'Either wire each into a pattern/loadout, or — if it is intentionally\n' +
      'unreferenced — add it to INTENTIONAL_ORPHANS in tools/validateOrphans.ts\n' +
      'with a documented reason.'
  )
}

if (hasFailure) {
  process.exit(1)
}

console.log('\nNo unexpected orphans — all danglers are allowlisted as intentional.')
console.log(`Allowlist OK: all ${ROOT_FILES.length} root file(s) exist.`)
process.exit(0)
