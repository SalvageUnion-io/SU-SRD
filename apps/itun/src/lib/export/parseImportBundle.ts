import { isRecord } from '../isRecord'
import type { ExportBundle } from '../schemas/exportBundle'
import { ExportBundleSchema } from '../schemas/exportBundle'

/**
 * A file that is not a backup this build can read. Its message is written for
 * the player — the file is theirs to fix — so `ImportButton` shows it rather
 * than treating it as a defect.
 */
export class ImportRefused extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ImportRefused'
  }
}

/**
 * parseImportBundle — parse and validate a raw JSON string as an ExportBundle.
 *
 * Throws a descriptive `ImportRefused` when:
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
    throw new ImportRefused('Import failed: file is not valid JSON.', { cause: err })
  }

  // Check schemaVersion early to give a clearer error before full Zod parse.
  if (isRecord(raw) && 'schemaVersion' in raw && raw.schemaVersion !== 2) {
    throw new ImportRefused(
      `Import failed: unsupported schemaVersion "${String(raw.schemaVersion)}". This build reads version 2.`
    )
  }

  const result = ExportBundleSchema.safeParse(raw)
  if (!result.success) {
    throw new ImportRefused(
      `Import failed: bundle does not match expected schema. ${result.error.message}`
    )
  }

  return result.data
}
