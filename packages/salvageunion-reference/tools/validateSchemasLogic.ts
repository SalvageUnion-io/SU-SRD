/**
 * Pure logic for Zod schema validation of the Salvage Union data.
 *
 * Validates each data file entry-by-entry (safeParse) against the same
 * zodSchemaMap ModelFactory uses at runtime, so schema drift is caught here
 * before it surfaces as a runtime error.
 *
 * Extracted from tools/validateSchemas.ts so both the standalone CLI and the
 * unified runner (tools/validate.ts) share one implementation over a
 * caller-supplied data bag, instead of each re-reading `data/*.json` itself.
 */

import type { z } from '../lib/zod.js'

export type FailureEntry = {
  index: number
  name: string
  errors: string[]
}

export type FileReport =
  | { file: string; status: 'ok'; count: number }
  | { file: string; status: 'fail'; count: number; failures: FailureEntry[] }
  | { file: string; status: 'no-schema' }

/**
 * Validate one data file's entries against its Zod schema (looked up by
 * `zodSchemaMap[filename without .json]`).
 */
export function validateFileAgainstSchema(
  filename: string,
  data: unknown[],
  zodSchemaMap: Record<string, z.ZodType<unknown>>
): FileReport {
  const schemaId = filename.replace(/\.json$/, '')
  const schema = zodSchemaMap[schemaId]

  if (!schema) {
    return { file: filename, status: 'no-schema' }
  }

  const failures: FailureEntry[] = []

  data.forEach((entry, index) => {
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
    return { file: filename, status: 'fail', count: data.length, failures }
  }
  return { file: filename, status: 'ok', count: data.length }
}

/** Run schema validation over every supplied data file. */
export function validateAllFilesAgainstSchemas(
  filesByName: Record<string, unknown[]>,
  zodSchemaMap: Record<string, z.ZodType<unknown>>
): FileReport[] {
  return Object.keys(filesByName)
    .sort()
    .map((filename) =>
      validateFileAgainstSchema(filename, filesByName[filename] ?? [], zodSchemaMap)
    )
}
