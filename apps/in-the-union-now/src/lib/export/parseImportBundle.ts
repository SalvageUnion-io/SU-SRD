import { ExportBundleSchema } from '../schemas/exportBundle'
import type { ExportBundle } from '../schemas/exportBundle'

/**
 * parseImportBundle — parse and validate a raw JSON string as an ExportBundle.
 *
 * Throws a descriptive Error when:
 *   - The string is not valid JSON.
 *   - The parsed value does not conform to ExportBundleSchema.
 *   - schemaVersion is not 1 (incompatible format).
 *
 * On success returns the validated ExportBundle.
 */
export function parseImportBundle(jsonText: string): ExportBundle {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new Error('Import failed: file is not valid JSON.')
  }

  // Check schemaVersion early to give a clearer error before full Zod parse.
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'schemaVersion' in raw &&
    (raw as Record<string, unknown>).schemaVersion !== 1
  ) {
    throw new Error(
      `Import failed: unsupported schemaVersion "${String((raw as Record<string, unknown>).schemaVersion)}". Only version 1 is supported.`
    )
  }

  const result = ExportBundleSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`Import failed: bundle does not match expected schema. ${result.error.message}`)
  }

  return result.data
}
