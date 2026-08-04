#!/usr/bin/env tsx

/**
 * Validate every data file against its Zod schema.
 *
 * Uses the same zodSchemaMap that ModelFactory uses at runtime, so any schema
 * drift is caught here before it surfaces as a runtime error.
 *
 * Each data file is validated entry-by-entry (safeParse) so failures are
 * reported with file name, array index, entity name, and flattened Zod errors.
 *
 * Thin CLI wrapper: all detection logic lives in validateSchemasLogic.ts so
 * this and the unified runner (tools/validate.ts) can never diverge.
 *
 * Exits non-zero if any file fails validation.
 */

import { zodSchemaMap } from '../lib/ModelFactory.js'
import { loadAllDataFiles } from './loadData.js'
import { validateAllFilesAgainstSchemas } from './validateSchemasLogic.js'

function main(): void {
  const filesByName = loadAllDataFiles()

  console.log('Validating all data files against Zod schemas...\n')
  console.log('='.repeat(72))

  const reports = validateAllFilesAgainstSchemas(filesByName, zodSchemaMap)

  let hasFailures = false
  const noSchema: string[] = []

  for (const report of reports) {
    if (report.status === 'no-schema') {
      noSchema.push(report.file)
      console.log(`  SKIP  ${report.file}  (no Zod schema registered)`)
    } else if (report.status === 'ok') {
      console.log(`  OK    ${report.file}  (${report.count} entries)`)
    } else {
      hasFailures = true
      console.log(`  FAIL  ${report.file}  (${report.failures.length}/${report.count} invalid)`)
      for (const { index, name, errors } of report.failures) {
        console.log(`        [${index}] "${name}"`)
        for (const err of errors) {
          console.log(`               ${err}`)
        }
      }
    }
  }

  console.log(`\n${'='.repeat(72)}`)
  console.log(`Files validated: ${reports.length}`)
  console.log(`Files with schema: ${reports.length - noSchema.length}`)
  if (noSchema.length > 0) {
    console.log(`Files without schema (skipped): ${noSchema.join(', ')}`)
  }

  if (hasFailures) {
    console.log('\nFAIL — one or more data files did not pass Zod schema validation.')
    process.exit(1)
  } else {
    console.log('\nPASS — all data files validate against their Zod schemas.')
  }
}

main()
