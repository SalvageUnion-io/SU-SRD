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
 * Exits non-zero if any file fails validation.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zodSchemaMap } from '../lib/ModelFactory.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDir = join(__dirname, '..', 'data')

type FailureEntry = {
  index: number
  name: string
  errors: string[]
}

type FileReport =
  | { file: string; status: 'ok'; count: number }
  | { file: string; status: 'fail'; count: number; failures: FailureEntry[] }
  | { file: string; status: 'no-schema' }

function validateFile(filename: string): FileReport {
  const schemaId = filename.replace(/\.json$/, '')
  const schema = zodSchemaMap[schemaId]

  if (!schema) {
    return { file: filename, status: 'no-schema' }
  }

  const filePath = join(dataDir, filename)
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown[]
  const failures: FailureEntry[] = []

  raw.forEach((entry, index) => {
    const result = schema.safeParse(entry)
    if (!result.success) {
      const name =
        typeof entry === 'object' &&
        entry !== null &&
        'name' in entry &&
        typeof (entry as Record<string, unknown>).name === 'string'
          ? ((entry as Record<string, unknown>).name as string)
          : `<unnamed>`
      const errors = result.error.issues.map(
        (i) => `${i.path.length > 0 ? i.path.join('.') : '(root)'}: ${i.message}`
      )
      failures.push({ index, name, errors })
    }
  })

  if (failures.length > 0) {
    return { file: filename, status: 'fail', count: raw.length, failures }
  }
  return { file: filename, status: 'ok', count: raw.length }
}

function main(): void {
  const dataFiles = readdirSync(dataDir)
    .filter((f) => f.endsWith('.json'))
    .sort()

  console.log('Validating all data files against Zod schemas...\n')
  console.log('='.repeat(72))

  const reports: FileReport[] = dataFiles.map(validateFile)

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

  console.log('\n' + '='.repeat(72))
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
