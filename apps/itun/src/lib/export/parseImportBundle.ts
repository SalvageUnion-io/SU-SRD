import { isRecord } from '../isRecord'
import type { ExportBundle } from '../schemas/exportBundle'
import { ExportBundleSchema } from '../schemas/exportBundle'

/**
 * parseImportBundle — parse and validate a raw JSON string as an ExportBundle.
 *
 * Throws a descriptive Error when:
 *   - The string is not valid JSON.
 *   - schemaVersion is not 2.
 *   - The parsed value does not conform to ExportBundleSchema.
 *
 * On success returns the validated ExportBundle.
 */
export function parseImportBundle(jsonText: string): ExportBundle {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch (err) {
    throw new Error('Import failed: file is not valid JSON.', { cause: err })
  }

  // Check schemaVersion early to give a clearer error before full Zod parse.
  if (isRecord(raw) && 'schemaVersion' in raw && raw.schemaVersion !== 2) {
    throw new Error(
      `Import failed: unsupported schemaVersion "${String(raw.schemaVersion)}". This build reads version 2.`
    )
  }

  const result = ExportBundleSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`Import failed: bundle does not match expected schema. ${result.error.message}`)
  }

  return result.data
}
