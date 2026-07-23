import { isRecord } from '../isRecord'
import { normalizeLegacyCargoRecord } from '../schemas/cargoLot'
import { ExportBundleSchema } from '../schemas/exportBundle'
import type { ExportBundle } from '../schemas/exportBundle'
import { normalizeLegacyPilotRecord } from '../schemas/pilot'

/**
 * Bundles written before the cargo→cargoLots rename carry mechs (and
 * patterns) with a legacy `cargo: string[]` field, and bundles written before
 * the vestigial `rollResults` removal carry it on pilots. Convert them in
 * place — the same rewrites the v3/v4 IndexedDB migrations apply — so old
 * backups stay importable.
 */
function normalizeLegacyBundle(raw: unknown): unknown {
  if (!isRecord(raw)) return raw
  const bundle = { ...raw }

  const entities = bundle.entities
  if (isRecord(entities)) {
    const entitiesCopy = { ...entities }
    if (Array.isArray(entitiesCopy.mechs)) {
      entitiesCopy.mechs = (entitiesCopy.mechs as unknown[]).map((m) =>
        isRecord(m) ? normalizeLegacyCargoRecord(m) : m
      )
    }
    if (Array.isArray(entitiesCopy.pilots)) {
      entitiesCopy.pilots = (entitiesCopy.pilots as unknown[]).map((p) =>
        isRecord(p) ? normalizeLegacyPilotRecord(p) : p
      )
    }
    bundle.entities = entitiesCopy
  }

  if (Array.isArray(bundle.mechPatterns)) {
    bundle.mechPatterns = (bundle.mechPatterns as unknown[]).map((p) =>
      isRecord(p) ? normalizeLegacyCargoRecord(p) : p
    )
  }

  return bundle
}

/**
 * parseImportBundle — parse and validate a raw JSON string as an ExportBundle.
 *
 * Throws a descriptive Error when:
 *   - The string is not valid JSON.
 *   - The parsed value does not conform to ExportBundleSchema.
 *   - schemaVersion is not 1 (incompatible format).
 *
 * Legacy compatibility: mechs/patterns carrying the pre-rename
 * `cargo: string[]` field are normalized to `cargoLots` and pilots carrying
 * the removed `rollResults` field have it dropped before validation;
 * bundles without `mechPatterns` or `encounterNpcs` get an empty array
 * (schema default) — both fields were added additively, no schemaVersion
 * bump required.
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
  raw = normalizeLegacyBundle(raw)

  // Check schemaVersion early to give a clearer error before full Zod parse.
  if (isRecord(raw) && 'schemaVersion' in raw && raw.schemaVersion !== 1) {
    throw new Error(
      `Import failed: unsupported schemaVersion "${String(raw.schemaVersion)}". Only version 1 is supported.`
    )
  }

  const result = ExportBundleSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`Import failed: bundle does not match expected schema. ${result.error.message}`)
  }

  return result.data
}
