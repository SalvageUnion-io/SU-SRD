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

// ─── Report ───────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(80))

if (allOrphans.length === 0) {
  console.log('All entities are referenced — no orphans detected.')
  console.log(`Allowlist OK: all ${ROOT_FILES.length} root file(s) exist.`)
  process.exit(0)
}

// These orphans are the non-allowlisted entities (actions/systems/modules) that
// nothing references — reported distinctly from the root-file allowlist above.
console.log(`Found ${allOrphans.length} potential orphan(s) (none are allowlisted roots):\n`)

// Group by file for readability
const orphansByFile = new Map<string, OrphanResult[]>()
for (const orphan of allOrphans) {
  if (!orphansByFile.has(orphan.file)) {
    orphansByFile.set(orphan.file, [])
  }
  orphansByFile.get(orphan.file)!.push(orphan)
}

for (const [file, fileOrphans] of orphansByFile.entries()) {
  console.log(`${file}: ${fileOrphans.length} orphan(s)`)
  for (const orphan of fileOrphans) {
    console.log(`  - ${orphan.name}`)
  }
  console.log()
}

console.log(`Total: ${allOrphans.length} potential orphan(s)`)
console.log(
  '\nNote: These entities exist in their data files but are not referenced by any other entity.'
)
console.log(
  'Review each one to confirm it is intentional (e.g. newly added but not yet placed in a pattern).'
)

// Exit with code 1 to surface orphans in CI — or 0 if you prefer warnings-only.
// Using exit 0 here so orphan detection is advisory rather than blocking.
process.exit(0)
