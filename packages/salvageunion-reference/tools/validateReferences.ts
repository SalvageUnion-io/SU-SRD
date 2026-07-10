#!/usr/bin/env tsx
/**
 * Validates cross-references in the Salvage Union data.
 * Checks that system/module/entity references exist in their respective data
 * files, and that `tableName` references resolve to a real roll table.
 *
 * Thin CLI wrapper: all detection logic lives in validateReferencesLogic.ts
 * so this and the unified runner (tools/validate.ts) can never diverge.
 */

import { loadAllDataFiles } from './loadData.js'
import { findReferenceErrors } from './validateReferencesLogic.js'

const filesByName = loadAllDataFiles()
console.log(
  `Loaded ${(filesByName['systems.json'] ?? []).length} systems and ${(filesByName['modules.json'] ?? []).length} modules`
)

const errors = findReferenceErrors(filesByName)

console.log(`\n${'='.repeat(80)}`)
if (errors.length === 0) {
  console.log('✅ All cross-references are valid!')
  process.exit(0)
} else {
  console.log(`❌ Found ${errors.length} invalid reference(s):\n`)
  for (const error of errors) {
    console.log(`  ${error.file} - ${error.entityName}`)
    console.log(`    Field: ${error.field}`)
    console.log(`    ${error.message}\n`)
  }
  process.exit(1)
}
