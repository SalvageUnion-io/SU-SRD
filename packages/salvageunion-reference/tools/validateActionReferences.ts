#!/usr/bin/env tsx
/**
 * Validates action references in the Salvage Union data.
 * Checks that all action names referenced in data files exist in actions.json.
 *
 * Thin CLI wrapper: all detection logic lives in
 * validateActionReferencesLogic.ts so this and the unified runner
 * (tools/validate.ts) can never diverge.
 */

import { loadAllDataFiles } from './loadData.js'
import {
  findActionReferenceErrors,
  ACTION_REFERENCING_FILES,
} from './validateActionReferencesLogic.js'

const filesByName = loadAllDataFiles()
const actionCount = (filesByName['actions.json'] ?? []).length
console.log(`Loaded ${actionCount} actions from actions.json\n`)

const errors = findActionReferenceErrors(filesByName)

for (const filename of ACTION_REFERENCING_FILES) {
  const count = (filesByName[filename] ?? []).length
  if (count > 0) {
    console.log(`✅ Validated ${filename} (${count} entities)`)
  }
}

console.log('\n' + '='.repeat(80))
if (errors.length === 0) {
  console.log('✅ All action references are valid!')
  process.exit(0)
} else {
  console.log(`❌ Found ${errors.length} invalid action reference(s):\n`)

  const errorsByFile = new Map<string, typeof errors>()
  for (const error of errors) {
    if (!errorsByFile.has(error.file)) {
      errorsByFile.set(error.file, [])
    }
    errorsByFile.get(error.file)!.push(error)
  }

  for (const [file, fileErrors] of errorsByFile.entries()) {
    console.log(`\n${file}:`)
    for (const error of fileErrors) {
      console.log(`  ${error.entityName}`)
      console.log(`    Field: ${error.field}`)
      console.log(`    ${error.message}`)
      if (error.suggestion) {
        console.log(`    💡 ${error.suggestion}`)
      }
      console.log()
    }
  }

  console.log(`\nTotal: ${errors.length} invalid reference(s)`)
  process.exit(1)
}
