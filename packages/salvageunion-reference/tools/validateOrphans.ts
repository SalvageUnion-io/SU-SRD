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
 *
 * Thin CLI wrapper: all detection logic, ROOT_FILES, and the
 * INTENTIONAL_ORPHANS allowlist live in validateOrphansLogic.ts so this and
 * the unified runner (tools/validate.ts) can never diverge.
 */

import { loadAllDataFiles } from './loadData.js'
import { runOrphanCheck, ROOT_FILES } from './validateOrphansLogic.js'

function main(): void {
  console.log('Root entities (intentionally unreferenced):')
  for (const file of ROOT_FILES) {
    console.log(`  ${file}`)
  }

  const filesByName = loadAllDataFiles()
  console.log(
    `\nLoaded ${(filesByName['systems.json'] ?? []).length} systems, ${(filesByName['modules.json'] ?? []).length} modules, ${(filesByName['actions.json'] ?? []).length} actions`
  )

  const { staleRootFiles, unexpected, allowlisted, staleAllowlist } = runOrphanCheck(filesByName)

  if (staleRootFiles.length > 0) {
    console.error('\n' + '='.repeat(80))
    console.error(`Stale allowlist entries: ${staleRootFiles.length} root file(s) no longer exist.`)
    for (const file of staleRootFiles) {
      console.error(`  - ${file} (listed in ROOT_FILES but missing from data/)`)
    }
    console.error(
      '\nRemove these from ROOT_FILES in tools/validateOrphansLogic.ts — a stale allowlist' +
        '\nentry can mask a genuinely-orphaned entity that replaces it.'
    )
    process.exit(1)
  }

  console.log('\n' + '='.repeat(80))

  if (allowlisted.length > 0) {
    console.log(
      `Allowlisted intentional orphan(s): ${allowlisted.length} (see INTENTIONAL_ORPHANS)`
    )
  }

  let hasFailure = false

  if (staleAllowlist.length > 0) {
    hasFailure = true
    console.error(`\nStale allowlist entries: ${staleAllowlist.length} no longer orphaned.`)
    for (const entry of staleAllowlist) {
      console.error(
        `  - ${entry.file}: ${entry.name} (allowlisted but now referenced/renamed/gone)`
      )
    }
    console.error(
      '\nRemove these from INTENTIONAL_ORPHANS in tools/validateOrphansLogic.ts — a stale' +
        '\nallowlist entry can mask a genuinely-orphaned entity that reuses the name.'
    )
  }

  if (unexpected.length > 0) {
    hasFailure = true

    console.error(`\nFound ${unexpected.length} UNEXPECTED orphan(s) (not allowlisted):\n`)

    const orphansByFile = new Map<string, typeof unexpected>()
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
        'unreferenced — add it to INTENTIONAL_ORPHANS in tools/validateOrphansLogic.ts\n' +
        'with a documented reason.'
    )
  }

  if (hasFailure) {
    process.exit(1)
  }

  console.log('\nNo unexpected orphans — all danglers are allowlisted as intentional.')
  console.log(`Allowlist OK: all ${ROOT_FILES.length} root file(s) exist.`)
  process.exit(0)
}

if (import.meta.main) {
  main()
}
